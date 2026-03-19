import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { DualUnitInput } from '@/components/DualUnitInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useZoneStore } from '@/stores/useZoneStore'
import { supabase } from '@/lib/supabase'
import { productStockSessionId, getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Save, UserCheck, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { sendTelegramNotification } from '@/lib/telegram'
import { useStaffStore } from '@/stores/useStaffStore'
import { logAudit } from '@/lib/auditLog'
import { StockEntryPanel, type StockEntry } from '@/components/StockEntryPanel'
import { useStoreSortOrder } from '@/hooks/useStoreSortOrder'
import { buildSortedByCategory } from '@/lib/sortByStore'
import { NumericInput } from '@/components/NumericInput'
import { useKitchenRealtimeStock } from '@/hooks/useKitchenRealtimeStock'

export default function ProductStock() {
  const { showToast } = useToast()
  const allProducts = useProductStore((s) => s.items)
  const allCategories = useProductStore((s) => s.categories)
  const zones = useZoneStore((s) => s.zones)
  const zoneProducts = useZoneStore((s) => s.zoneProducts)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)

  // 如果央廚有設定區域，只顯示已分配的成品；否則顯示全部
  const { storeProducts, productCategories } = useMemo(() => {
    const kitchenZones = zones.filter((z) => z.storeId === 'kitchen')
    if (kitchenZones.length === 0) {
      return { storeProducts: allProducts, productCategories: allCategories }
    }
    const kitchenZoneIds = new Set(kitchenZones.map((z) => z.id))
    const assignedIds = new Set(
      zoneProducts.filter((zp) => kitchenZoneIds.has(zp.zoneId)).map((zp) => zp.productId)
    )
    const filtered = allProducts.filter((p) => assignedIds.has(p.id))
    const cats = new Set(filtered.map((p) => p.category))
    return { storeProducts: filtered, productCategories: allCategories.filter((c) => cats.has(c)) }
  }, [allProducts, allCategories, zones, zoneProducts])
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const sessionId = productStockSessionId(selectedDate)

  // 歷史編輯確認
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)

  const [stock, setStock] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    return init
  })

  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Stock entries (到期日批次) state
  const [stockEntries, setStockEntries] = useState<Record<string, StockEntry[]>>({})
  const originalStockEntries = useRef<Record<string, StockEntry[]>>({})
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null)

  // Load existing session
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    // Reset state for new date
    const initStock: Record<string, string> = {}
    storeProducts.forEach(p => { initStock[p.id] = '' })
    setStock(initStock)
    setIsEdit(false)
    setConfirmBy('')
    setStockEntries({})
    originalStockEntries.current = {}
    setExpandedStockId(null)

    const load = async () => {
      try {
        const { data: session } = await supabase!
          .from('product_stock_sessions')
          .select('*')
          .eq('id', sessionId)
          .maybeSingle()

        if (!session) { setLoading(false); return }
        setIsEdit(true)
        if (session.submitted_by) setConfirmBy(session.submitted_by)

        const { data: items } = await supabase!
          .from('product_stock_items')
          .select('*')
          .eq('session_id', sessionId)

        if (items && items.length > 0) {
          const loadedStock: Record<string, string> = {}
          storeProducts.forEach(p => { loadedStock[p.id] = '' })
          items.forEach(item => {
            loadedStock[item.product_id] = item.stock_qty != null ? String(item.stock_qty) : ''
          })
          setStock(loadedStock)
        }

        // Load stock entries (到期日批次)
        const { data: seRows } = await supabase!
          .from('product_stock_entries')
          .select('product_id, expiry_date, quantity')
          .eq('session_id', sessionId)
          .order('expiry_date', { ascending: true })

        if (seRows && seRows.length > 0) {
          const grouped: Record<string, StockEntry[]> = {}
          seRows.forEach((r) => {
            if (!grouped[r.product_id]) grouped[r.product_id] = []
            grouped[r.product_id].push({
              expiryDate: r.expiry_date,
              quantity: r.quantity != null ? String(r.quantity) : '',
            })
          })
          originalStockEntries.current = JSON.parse(JSON.stringify(grouped))
          setStockEntries(grouped)
        }
      } catch {
        // ignore fetch errors
      }
      setLoading(false)
    }

    load()
  }, [selectedDate])

  // 即時庫存區
  const {
    items: realtimeItems,
    restockValues: rtRestock,
    remainingValues: rtRemaining,
    updateRestock: updateRtRestock,
    saveItem: saveRtItem,
    loading: rtLoading,
  } = useKitchenRealtimeStock({ selectedDate })
  const [rtSaving, setRtSaving] = useState<Record<string, boolean>>({})
  const [rtSaved, setRtSaved] = useState<Record<string, boolean>>({})

  const handleRtSave = async (itemKey: string) => {
    if (!confirmBy) {
      showToast('請先選擇盤點人員', 'error')
      return
    }
    setRtSaving((p) => ({ ...p, [itemKey]: true }))
    const ok = await saveRtItem(itemKey, confirmBy)
    setRtSaving((p) => ({ ...p, [itemKey]: false }))
    if (ok) {
      setRtSaved((p) => ({ ...p, [itemKey]: true }))
      setTimeout(() => setRtSaved((p) => ({ ...p, [itemKey]: false })), 2000)
    } else {
      showToast('儲存失敗', 'error')
    }
  }

  const { sortCategories, sortItems } = useStoreSortOrder('kitchen', 'product')
  // 過濾掉「包材類」（已移至即時庫存區）
  const filteredCategories = useMemo(() =>
    productCategories.filter((c) => c !== '包材類'),
    [productCategories])
  const productsByCategory = useMemo(() =>
    buildSortedByCategory(filteredCategories, storeProducts, sortCategories, sortItems),
    [filteredCategories, storeProducts, sortCategories, sortItems])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-pst]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  // Auto-sum stock entries → stock[productId]
  const updateStockFromEntries = useCallback((productId: string, entries: StockEntry[]) => {
    const sum = entries.reduce((acc, e) => {
      const n = parseFloat(e.quantity)
      return acc + (isNaN(n) ? 0 : n)
    }, 0)
    const sumStr = entries.length > 0 ? String(Math.round(sum * 10) / 10) : ''
    setStock(prev => ({ ...prev, [productId]: sumStr }))
  }, [])

  const doSubmit = async () => {
    if (submittingRef.current) return
    if (!confirmBy) {
      showToast('請先選擇盤點人員', 'error')
      return
    }
    if (!supabase) {
      const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
      showToast(`成品庫存已儲存！盤點人：${staffName}`)
      return
    }

    submittingRef.current = true
    setSubmitting(true)

    const { error: sessionErr } = await supabase
      .from('product_stock_sessions')
      .upsert({
        id: sessionId,
        date: selectedDate,
        submitted_by: confirmBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    // Save stock items: upsert + 刪除多餘（安全模式）
    const items = storeProducts
      .filter(p => stock[p.id] !== '')
      .map(p => ({
        session_id: sessionId,
        product_id: p.id,
        stock_qty: parseFloat(stock[p.id]),
      }))

    if (items.length > 0) {
      const { error: upsertItemErr } = await supabase
        .from('product_stock_items')
        .upsert(items, { onConflict: 'session_id,product_id' })

      if (upsertItemErr) {
        showToast('提交失敗：' + upsertItemErr.message, 'error')
        submittingRef.current = false
        setSubmitting(false)
        return
      }
      // 刪除不在新列表中的舊品項
      const newItemIds = new Set(items.map(i => i.product_id))
      const { data: existingItems } = await supabase
        .from('product_stock_items')
        .select('id, product_id')
        .eq('session_id', sessionId)
      const itemsToDelete = existingItems?.filter(e => !newItemIds.has(e.product_id))?.map(e => e.id) || []
      if (itemsToDelete.length > 0) {
        await supabase.from('product_stock_items').delete().in('id', itemsToDelete)
      }
    } else {
      // 全部清空
      await supabase.from('product_stock_items').delete().eq('session_id', sessionId)
    }

    // Save stock entries (到期日批次): upsert + 刪除多餘（安全模式）
    // 避免 DELETE 成功但 INSERT 失敗導致到期日資料全部遺失
    // 合併同一 (product_id, expiry_date) 的數量，避免批次內重複 key 導致 23505 錯誤
    const seMap = new Map<string, { session_id: string; product_id: string; expiry_date: string; quantity: number }>()
    let seRawCount = 0
    const seMergedKeys: string[] = []
    const seSkipped: string[] = []
    Object.entries(stockEntries).forEach(([pid, entries]) => {
      entries.forEach((e) => {
        if (e.expiryDate && e.quantity !== '') {
          seRawCount++
          const key = `${pid}|${e.expiryDate}`
          const existing = seMap.get(key)
          if (existing) {
            existing.quantity += parseFloat(e.quantity) || 0
            seMergedKeys.push(key)
          } else {
            seMap.set(key, {
              session_id: sessionId,
              product_id: pid,
              expiry_date: e.expiryDate,
              quantity: parseFloat(e.quantity) || 0,
            })
          }
        } else {
          seSkipped.push(`${pid}|date=${e.expiryDate}|qty=${e.quantity}`)
        }
      })
    })
    const seInserts = Array.from(seMap.values())

    let seUpsertOk = false
    let seDeletedCount = 0
    let seVerifyCount = -1
    let seErrorMsg = ''

    if (seInserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('product_stock_entries')
        .upsert(seInserts, { onConflict: 'session_id,product_id,expiry_date' })

      if (upsertErr) {
        seErrorMsg = `${upsertErr.code}|${upsertErr.message}`
        console.error('[productStockEntries] upsert error:', upsertErr)
        showToast('到期日資料儲存失敗，請重新提交', 'error')
      } else {
        seUpsertOk = true
        // 刪除不在新列表中的舊行
        const { data: existing } = await supabase
          .from('product_stock_entries')
          .select('id, product_id, expiry_date')
          .eq('session_id', sessionId)
        const newKeys = new Set(seInserts.map(i => `${i.product_id}|${i.expiry_date}`))
        const toDelete = existing?.filter(e => !newKeys.has(`${e.product_id}|${e.expiry_date}`))?.map(e => e.id) || []
        if (toDelete.length > 0) {
          await supabase.from('product_stock_entries').delete().in('id', toDelete)
        }
        seDeletedCount = toDelete.length
        // 驗證：讀回確認筆數正確
        const { data: verifyRows } = await supabase
          .from('product_stock_entries')
          .select('id')
          .eq('session_id', sessionId)
        seVerifyCount = verifyRows?.length ?? -1
        if (seVerifyCount !== seInserts.length) {
          showToast(`到期日資料筆數異常（預期 ${seInserts.length}，實際 ${seVerifyCount}），請檢查後重新提交`, 'error')
        }
      }
    } else {
      // 無到期日資料 → 清空該 session 的所有 stock entries
      seUpsertOk = true
      await supabase.from('product_stock_entries').delete().eq('session_id', sessionId)
    }

    // Audit log：記錄 stock entries 完整診斷資訊
    logAudit('product_stock_entries_save', 'kitchen', sessionId, {
      staffId: confirmBy,
      rawCount: seRawCount,
      dedupCount: seInserts.length,
      mergedKeys: seMergedKeys.length > 0 ? seMergedKeys : undefined,
      skipped: seSkipped.length > 0 ? seSkipped : undefined,
      upsertOk: seUpsertOk,
      errorMsg: seErrorMsg || undefined,
      deletedCount: seDeletedCount,
      verifyCount: seVerifyCount,
      mismatch: seVerifyCount !== -1 && seVerifyCount !== seInserts.length,
    })

    originalStockEntries.current = JSON.parse(JSON.stringify(stockEntries))

    // 一併儲存即時庫存區有填寫的品項
    let rtSavedCount = 0
    for (const item of realtimeItems) {
      const val = rtRestock[item.id]
      if (val !== undefined && val !== '') {
        const ok = await saveRtItem(item.id, confirmBy)
        if (ok) {
          rtSavedCount++
          setRtSaved((p) => ({ ...p, [item.id]: true }))
          setTimeout(() => setRtSaved((p) => ({ ...p, [item.id]: false })), 2000)
        }
      }
    }

    const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
    const itemCount = storeProducts.filter(p => stock[p.id] !== '').length
    setIsEdit(true)
    submittingRef.current = false
    setSubmitting(false)
    const rtMsg = rtSavedCount > 0 ? `（含即時庫存 ${rtSavedCount} 項）` : ''
    showToast(`成品庫存已儲存！盤點人：${staffName}${rtMsg}`)
    sendTelegramNotification(
      `🏭 成品庫存盤點完成\n📅 日期：${selectedDate}\n👤 盤點人：${staffName}\n📊 品項數：${itemCount} 項${rtSavedCount > 0 ? `\n📦 即時庫存：${rtSavedCount} 項` : ''}`
    )
  }

  const handleSubmit = () => {
    if (!isToday) {
      setShowHistoryConfirm(true)
    } else {
      doSubmit()
    }
  }

  return (
    <div className="page-container">
      <TopNav title="成品庫存盤點" />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : formatDate(selectedDate)}盤點紀錄，可修改後重新提交</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 盤點人員 */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
            <UserCheck size={16} className="text-brand-mocha shrink-0" />
            <span className="text-sm text-brand-oak font-medium shrink-0">盤點人員</span>
            <select
              value={confirmBy}
              onChange={(e) => setConfirmBy(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
            >
              <option value="">請選擇</option>
              {kitchenStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 即時庫存區 */}
          {!rtLoading && realtimeItems.length > 0 && (
            <div>
              <SectionHeader title="即時庫存區" icon="■" />
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[70px] text-center">補貨</span>
                <span className="w-10" />
                <span className="w-[60px] text-center">剩餘</span>
              </div>
              <div className="bg-white">
                {realtimeItems.map((item, idx) => {
                  const remaining = rtRemaining[item.id] || 0
                  const isSaving = rtSaving[item.id] || false
                  const isSaved = rtSaved[item.id] || false

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center px-4 py-2 ${idx < realtimeItems.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-brand-oak leading-tight">{item.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">{item.unit}</p>
                      </div>
                      <div className="w-[70px] shrink-0">
                        <NumericInput
                          value={rtRestock[item.id] || ''}
                          onChange={(v) => updateRtRestock(item.id, v)}
                          isFilled
                          allowNegative
                        />
                      </div>
                      <button
                        onClick={() => handleRtSave(item.id)}
                        disabled={isSaving}
                        className={`w-10 h-8 flex items-center justify-center rounded-lg mx-1 text-white text-xs font-medium active:scale-95 transition-all ${
                          isSaved ? 'bg-green-500' : 'bg-brand-mocha'
                        }`}
                      >
                        {isSaving ? '...' : isSaved ? <Check size={14} /> : '確認'}
                      </button>
                      <span className={`w-[60px] text-center text-sm font-semibold ${remaining < 0 ? 'text-status-danger' : 'text-brand-oak'}`}>
                        {remaining}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {products.map((product, idx) => {
                  const hasStockEntries = (stockEntries[product.id]?.length ?? 0) > 0
                  const isExpanded = expandedStockId === product.id

                  return (
                    <div key={product.id}>
                      <div className={`flex items-center justify-between px-4 py-2.5 ${idx < products.length - 1 && !isExpanded ? 'border-b border-gray-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                          {product.shelfLifeDays && <span className="text-[10px] text-brand-lotus ml-1">期效{product.shelfLifeDays}</span>}
                        </div>
                        {/* 庫存欄：有到期日資料 → 顯示合計+展開按鈕；否則原始輸入+「+」按鈕 */}
                        {hasStockEntries || isExpanded ? (
                          <button
                            type="button"
                            onClick={() => setExpandedStockId(isExpanded ? null : product.id)}
                            className={`w-[56px] h-9 rounded-lg flex items-center justify-center gap-0.5 text-base font-semibold transition-colors ${
                              stock[product.id] !== '' ? 'bg-green-50 text-brand-oak' : 'bg-gray-50 text-brand-lotus'
                            } border border-gray-200`}
                          >
                            <span className="text-sm">{stock[product.id] || '0'}</span>
                            {isExpanded
                              ? <ChevronUp size={12} className="text-brand-lotus" />
                              : <ChevronDown size={12} className="text-brand-lotus" />
                            }
                          </button>
                        ) : (
                          <div className="relative">
                            <DualUnitInput value={stock[product.id]} onChange={(v) => setStock(prev => ({ ...prev, [product.id]: v }))} unit={product.unit} box_unit={product.box_unit} box_ratio={product.box_ratio} integerOnly={product.integerOnly} isFilled onNext={focusNext} data-pst="" />
                            <button
                              type="button"
                              title="依到期日分批輸入"
                              onClick={() => {
                                setStockEntries(prev => ({
                                  ...prev,
                                  [product.id]: [{ expiryDate: '', quantity: stock[product.id] || '' }],
                                }))
                                setExpandedStockId(product.id)
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-oak/70 text-white flex items-center justify-center text-[10px] leading-none"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      {/* 展開到期日面板 */}
                      {isExpanded && (
                        <StockEntryPanel
                          entries={stockEntries[product.id] || []}
                          onChange={(entries, changedField) => {
                            if (entries.length === 0) {
                              setStockEntries(prev => {
                                const next = { ...prev }
                                delete next[product.id]
                                return next
                              })
                              setExpandedStockId(null)
                              setStock(prev => ({ ...prev, [product.id]: '' }))
                              return
                            }
                            setStockEntries(prev => ({ ...prev, [product.id]: entries }))
                            // Only recalculate stock total when quantity changes (not date)
                            if (changedField !== 'expiryDate') {
                              updateStockFromEntries(product.id, entries)
                            }
                          }}
                          onCollapse={() => setExpandedStockId(null)}
                          unit={product.unit}
                          box_unit={product.box_unit}
                          box_ratio={product.box_ratio}
                          integerOnly={product.integerOnly}
                        />
                      )}
                      {isExpanded && idx < products.length - 1 && (
                        <div className="border-b border-gray-50" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新成品庫存' : '儲存成品庫存'}
            onClick={handleSubmit}
            icon={<Save size={18} />}
            disabled={submitting}
          />
        </>
      )}

      {/* 歷史編輯確認對話框 */}
      {showHistoryConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-oak text-center mb-2">修改歷史資料</h3>
            <p className="text-sm text-brand-lotus text-center mb-5">
              你正在修改 <span className="font-semibold text-brand-oak">{formatDate(selectedDate)}</span> 的成品庫存紀錄，確定要提交嗎？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHistoryConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-brand-lotus"
              >
                取消
              </button>
              <button
                onClick={() => { setShowHistoryConfirm(false); doSubmit() }}
                className="flex-1 h-10 rounded-xl bg-status-warning text-white text-sm font-semibold"
              >
                確定修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
