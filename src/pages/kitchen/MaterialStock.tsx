import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { DualUnitInput } from '@/components/DualUnitInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useZoneStore } from '@/stores/useZoneStore'
import { supabase } from '@/lib/supabase'
import { materialStockSessionId, getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Save, AlertTriangle, UserCheck, RefreshCw } from 'lucide-react'
import { sendTelegramNotification } from '@/lib/telegram'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreSortOrder } from '@/hooks/useStoreSortOrder'
import { buildSortedByCategory } from '@/lib/sortByStore'

export default function MaterialStock() {
  const { showToast } = useToast()
  const allMaterials = useMaterialStore((s) => s.items)
  const allMaterialCategories = useMaterialStore((s) => s.categories)
  const zones = useZoneStore((s) => s.zones)
  const zoneProducts = useZoneStore((s) => s.zoneProducts)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)

  // 如果央廚有設定區域，只顯示已分配的原物料；否則顯示全部
  const { rawMaterials, materialCategories } = useMemo(() => {
    const kitchenZones = zones.filter((z) => z.storeId === 'kitchen')
    if (kitchenZones.length === 0) {
      return { rawMaterials: allMaterials, materialCategories: allMaterialCategories }
    }
    const kitchenZoneIds = new Set(kitchenZones.map((z) => z.id))
    const assignedIds = new Set(
      zoneProducts.filter((zp) => kitchenZoneIds.has(zp.zoneId)).map((zp) => zp.productId)
    )
    const filtered = allMaterials.filter((m) => assignedIds.has(m.id))
    const cats = new Set(filtered.map((m) => m.category))
    return { rawMaterials: filtered, materialCategories: allMaterialCategories.filter((c) => cats.has(c)) }
  }, [allMaterials, allMaterialCategories, zones, zoneProducts])
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const sessionId = materialStockSessionId(selectedDate)

  // 歷史編輯確認
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)

  const [stock, setStock] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    rawMaterials.forEach(m => { init[m.id] = '' })
    return init
  })

  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing session
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    const load = async () => {
      setLoading(true)
      const initStock: Record<string, string> = {}
      rawMaterials.forEach(m => { initStock[m.id] = '' })
      setStock(initStock)
      setIsEdit(false)
      setConfirmBy('')

      const { data: session } = await supabase!
        .from('material_stock_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle()

      if (!session) { setLoading(false); return }
      setIsEdit(true)
      if (session.submitted_by) setConfirmBy(session.submitted_by)

      const { data: items, error } = await supabase!
        .from('material_stock_items')
        .select('*')
        .eq('session_id', sessionId)

      if (error) {
        showToast('載入失敗：' + error.message, 'error')
      } else if (items && items.length > 0) {
        const loadedStock: Record<string, string> = { ...initStock }
        items.forEach(item => {
          loadedStock[item.material_id] = item.stock_qty != null ? String(item.stock_qty) : ''
        })
        setStock(loadedStock)
      }
      setLoading(false)
    }
    load()
  }, [selectedDate])

  // 近 7 日原物料叫貨日均
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({})
  const [weeklyLoading, setWeeklyLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setWeeklyLoading(false); return }
    const load = async () => {
      setWeeklyLoading(true)
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const sevenDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      const { data: sessions } = await supabase!
        .from('material_order_sessions')
        .select('id, date')
        .gte('date', sevenDaysAgo)
        .lte('date', today)

      if (!sessions || sessions.length === 0) { setWeeklyLoading(false); return }

      const uniqueDays = new Set(sessions.map(s => s.date)).size
      const sids = sessions.map(s => s.id)

      const { data: items } = await supabase!
        .from('material_order_items')
        .select('material_id, quantity')
        .in('session_id', sids)

      if (items) {
        const totals: Record<string, number> = {}
        items.forEach(item => {
          totals[item.material_id] = (totals[item.material_id] || 0) + item.quantity
        })
        const result: Record<string, number> = {}
        Object.entries(totals).forEach(([mid, total]) => {
          result[mid] = Math.round((total / uniqueDays) * 10) / 10
        })
        setWeeklyUsage(result)
      }
      setWeeklyLoading(false)
    }
    load()
  }, [today])

  const { sortCategories, sortItems } = useStoreSortOrder('kitchen', 'material')
  const materialsByCategory = useMemo(() =>
    buildSortedByCategory(materialCategories, rawMaterials, sortCategories, sortItems),
    [materialCategories, rawMaterials, sortCategories, sortItems])

  const getStatus = (id: string): 'ok' | 'low' | 'danger' => {
    const qty = parseFloat(stock[id]) || 0
    if (!stock[id]) return 'ok'
    if (qty <= 0.5) return 'danger'
    if (qty <= 1) return 'low'
    return 'ok'
  }

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-mat]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const doSubmit = async () => {
    if (!confirmBy) {
      showToast('請先選擇盤點人員', 'error')
      return
    }
    if (!supabase) {
      const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
      showToast(`原物料庫存已儲存！盤點人：${staffName}`)
      return
    }

    setSubmitting(true)

    const { error: sessionErr } = await supabase
      .from('material_stock_sessions')
      .upsert({
        id: sessionId,
        date: selectedDate,
        submitted_by: confirmBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      setSubmitting(false)
      return
    }

    const items = rawMaterials
      .filter(m => stock[m.id] !== '')
      .map(m => ({
        session_id: sessionId,
        material_id: m.id,
        stock_qty: stock[m.id] !== '' ? parseFloat(stock[m.id]) : null,
        bulk_qty: null,
      }))

    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from('material_stock_items')
        .upsert(items, { onConflict: 'session_id,material_id' })

      if (itemErr) {
        showToast('提交失敗：' + itemErr.message, 'error')
        setSubmitting(false)
        return
      }
    }

    // 刪除已清空的品項（不在新列表中的舊記錄）
    const filledIds = new Set(items.map(i => i.material_id))
    const { data: existing } = await supabase
      .from('material_stock_items')
      .select('id, material_id')
      .eq('session_id', sessionId)
    const toDelete = existing
      ?.filter(e => !filledIds.has(e.material_id))
      ?.map(e => e.id) || []
    if (toDelete.length > 0) {
      await supabase.from('material_stock_items').delete().in('id', toDelete)
    }

    const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
    const itemCount = rawMaterials.filter(m => stock[m.id] !== '').length
    setIsEdit(true)
    setSubmitting(false)
    showToast(`原物料庫存已儲存！盤點人：${staffName}`)
    sendTelegramNotification(
      `📦 原物料庫存盤點完成\n📅 日期：${selectedDate}\n👤 盤點人：${staffName}\n📊 品項數：${itemCount} 項`
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
      <TopNav title="原物料庫存盤點" />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : formatDate(selectedDate)}盤點紀錄，可修改後重新提交</span>
        </div>
      )}

      {(loading || weeklyLoading) ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 確認人員 */}
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

          {Array.from(materialsByCategory.entries()).map(([category, materials]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[110px] text-center">庫存</span>
                <span className="w-[36px] text-center">週用</span>
                <span className="w-[18px]"></span>
              </div>
              <div className="bg-white">
                {materials.map((material, idx) => {
                  const status = getStatus(material.id)
                  return (
                    <div
                      key={material.id}
                      className={`flex items-center px-4 py-1.5 ${idx < materials.length - 1 ? 'border-b border-gray-50' : ''} ${
                        status === 'danger' && stock[material.id] ? 'bg-status-danger/5' : status === 'low' && stock[material.id] ? 'bg-status-warning/5' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <p className="text-sm font-medium text-brand-oak leading-tight">{material.name}</p>
                        {material.spec && <p className="text-[10px] text-brand-lotus leading-tight">{material.spec}</p>}
                      </div>
                      <div className="w-[110px] shrink-0 flex justify-center">
                        <DualUnitInput value={stock[material.id]} onChange={(v) => setStock(prev => ({ ...prev, [material.id]: v }))} unit={material.unit} box_unit={material.box_unit} box_ratio={material.box_ratio} isFilled onNext={focusNext} data-mat="" />
                      </div>
                      <span className="w-[36px] text-center text-[11px] font-num text-brand-lotus">{weeklyUsage[material.id] || '-'}</span>
                      <div className="w-[18px] flex justify-center">
                        {status === 'danger' && stock[material.id] && <AlertTriangle size={13} className="text-status-danger" />}
                        {status === 'low' && stock[material.id] && <AlertTriangle size={13} className="text-status-warning" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新庫存資料' : '儲存庫存 & 前往叫貨'}
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
              你正在修改 <span className="font-semibold text-brand-oak">{formatDate(selectedDate)}</span> 的原物料庫存紀錄，確定要提交嗎？
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
