import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { shipmentSessionId, getTodayTW } from '@/lib/session'
import { logAudit } from '@/lib/auditLog'
import { formatDualUnit } from '@/lib/utils'
import { exportReceivePdf } from '@/lib/exportReceivePdf'
import { sendTelegramNotification } from '@/lib/telegram'
import { CheckCircle, AlertTriangle, ArrowRight, MessageSquare, Package, Truck, FileText, Send, Save } from 'lucide-react'

interface ShipmentItem {
  productId: string
  name: string
  unit: string
  category: string
  orderQty: number
  actualQty: number
  hasDiff: boolean
  diff: number
  isExtra: boolean
  box_unit?: string
  box_ratio?: number
}

export default function Receive() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const allProducts = useProductStore((s) => s.items)
  const productsInitialized = useProductStore((s) => s.initialized)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const sessionId = shipmentSessionId(storeId || '', selectedDate)

  // 2026-05-22 業務改造：移除「提交收貨」流程
  // 本頁改為「央廚出貨明細對帳檢視頁」，純查看 + PDF 匯出 + 央廚回覆顯示
  // 保留：PDF 匯出、央廚回覆顯示、差異警示、✓ 勾選、receive_note 備註（可選通知央廚）
  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [hasShipment, setHasShipment] = useState(false)
  const [kitchenReply, setKitchenReply] = useState('')
  const [kitchenReplyAt, setKitchenReplyAt] = useState<string | null>(null)
  const [kitchenReplyBy, setKitchenReplyBy] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // 備註（用於送錯/漏品/破損等記錄，可選通知央廚）
  const [note, setNote] = useState('')
  const [savingNote, setSavingNote] = useState<'save' | 'notify' | null>(null)

  // Load shipment data
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    if (!productsInitialized) return
    setLoading(true)

    const load = async () => {
      const { data: session } = await supabase!
        .from('shipment_sessions')
        .select('*')
        .eq('id', sessionId)
        .maybeSingle()

      if (!session) {
        setHasShipment(false)
        setLoading(false)
        return
      }

      setHasShipment(true)
      // 載入已存的備註（門店歷史填過的）
      if (session.receive_note) setNote(session.receive_note)
      if (session.kitchen_reply) {
        setKitchenReply(session.kitchen_reply)
        setKitchenReplyAt(session.kitchen_reply_at || null)
        setKitchenReplyBy(session.kitchen_reply_by || null)
      }

      const { data: items } = await supabase!
        .from('shipment_items')
        .select('*')
        .eq('session_id', sessionId)

      if (items && items.length > 0) {
        const productMap = new Map(storeProducts.map(p => [p.id, p]))
        const loaded: ShipmentItem[] = []
        const loadedConfirmed: Record<string, boolean> = {}

        items.forEach(item => {
          const product = productMap.get(item.product_id)
          if (!product) return
          const orderQty = item.order_qty || 0
          const actualQty = item.actual_qty || 0
          const isExtra = orderQty === 0
          loaded.push({
            productId: item.product_id,
            name: product.name,
            unit: product.unit,
            category: product.category,
            orderQty,
            actualQty,
            hasDiff: !isExtra && orderQty !== actualQty,
            diff: Math.round((actualQty - orderQty) * 10) / 10,
            isExtra,
            box_unit: product.box_unit,
            box_ratio: product.box_ratio,
          })
          // 顯示央廚側打勾的 prepared 狀態（純檢視，無 submit 寫回）
          loadedConfirmed[item.product_id] = item.prepared ?? false
        })

        setShipmentItems(loaded)
        setConfirmed(loadedConfirmed)
      }

      setLoading(false)
    }

    load()
  }, [storeId, selectedDate, productsInitialized])

  const regularItems = useMemo(() => shipmentItems.filter(i => !i.isExtra), [shipmentItems])
  const extraItems = useMemo(() => shipmentItems.filter(i => i.isExtra), [shipmentItems])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ShipmentItem[]>()
    for (const cat of productCategories) {
      const catItems = regularItems.filter(i => i.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [regularItems, productCategories])

  const extraByCategory = useMemo(() => {
    const map = new Map<string, ShipmentItem[]>()
    for (const cat of productCategories) {
      const catItems = extraItems.filter(i => i.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [extraItems, productCategories])

  const toggleConfirm = (productId: string) => {
    setConfirmed(prev => ({ ...prev, [productId]: !prev[productId] }))
  }

  const confirmedCount = shipmentItems.filter(item => confirmed[item.productId]).length
  const diffCount = regularItems.filter(item => item.hasDiff).length

  // 2026-05-22 業務改造：移除 handleSubmit（門店不再寫 received_at）
  // 改為純檢視 + 可選備註（送錯/漏品/破損等記錄，可選通知央廚）

  const saveNoteToDb = async (): Promise<boolean> => {
    if (!supabase || !storeId) return false
    const { error } = await supabase
      .from('shipment_sessions')
      .update({
        receive_note: note.trim(),
        received_by: staffId || null,  // 借用 received_by 欄位記錄填寫人
      })
      .eq('id', sessionId)
    if (error) {
      showToast('儲存失敗：' + error.message, 'error')
      return false
    }
    logAudit('receive_note_save', storeId, sessionId, { hasNote: !!note.trim() })
    return true
  }

  const handleSaveNote = async () => {
    if (!note.trim()) {
      showToast('請先填寫備註', 'error')
      return
    }
    setSavingNote('save')
    const ok = await saveNoteToDb()
    setSavingNote(null)
    if (ok) showToast('備註已儲存')
  }

  const handleSaveAndNotify = async () => {
    if (!note.trim()) {
      showToast('請先填寫備註', 'error')
      return
    }
    setSavingNote('notify')
    const ok = await saveNoteToDb()
    if (!ok) { setSavingNote(null); return }

    // 推送央廚群組 + admin（YEN + ELLEN）
    const msg = [
      '⚠️ <b>門店收貨備註</b>',
      `🏪 店家：${storeName}`,
      `📅 日期：${selectedDate}`,
      `📝 內容：${note.trim()}`,
      diffCount > 0 ? `⚠️ 央廚出貨有 ${diffCount} 項數量異動` : '',
    ].filter(Boolean).join('\n')

    sendTelegramNotification(msg, false)
      .then((sent) => {
        if (sent) showToast('已儲存並通知央廚')
        else showToast('已儲存（通知央廚失敗，請重試）', 'error')
      })
      .catch(() => showToast('已儲存（通知央廚失敗）', 'error'))
      .finally(() => setSavingNote(null))
  }

  const handleExportPdf = async () => {
    setExporting(true)
    try {
      await exportReceivePdf({
        storeName,
        date: selectedDate,
        items: shipmentItems.filter(i => !i.isExtra),
        extraItems: shipmentItems.filter(i => i.isExtra),
        categories: productCategories,
        note,
        confirmedCount,
        totalCount: shipmentItems.length,
        diffCount,
      })
      showToast('PDF 已下載')
    } catch {
      showToast('PDF 匯出失敗', 'error')
    }
    setExporting(false)
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 出貨明細`} />

      {/* 日期切換（可看歷史出貨）*/}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {!loading && hasShipment && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-status-success/10 text-status-success text-sm font-medium">
          <Truck size={16} />
          <span>央廚已出貨</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : !hasShipment ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          今日尚無央廚出貨紀錄
        </div>
      ) : (
        <>
          {/* 出貨資訊 */}
          <div className="px-4 py-2.5 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-brand-oak font-medium">
                已確認 <span className="font-semibold">{confirmedCount}/{shipmentItems.length}</span> 項
              </p>
              <div className="flex items-center gap-2">
                {diffCount > 0 && (
                  <p className="flex items-center gap-1 text-xs text-status-warning font-medium">
                    <AlertTriangle size={12} />
                    {diffCount} 項數量異動
                  </p>
                )}
                <button
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-mocha/10 text-brand-mocha text-xs font-medium active:scale-95 transition-transform disabled:opacity-50"
                >
                  <FileText size={13} />
                  {exporting ? '匯出中...' : 'PDF'}
                </button>
              </div>
            </div>
          </div>

          {/* 央廚回覆 */}
          {kitchenReply && (
            <div className="mx-4 mt-3 mb-1 flex items-start gap-2 bg-status-info/10 px-3 py-2.5 rounded-btn">
              <MessageSquare size={14} className="text-brand-mocha shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs text-brand-lotus mb-0.5">
                  <span className="font-medium text-brand-oak">央廚回覆</span>
                  {kitchenReplyAt && (
                    <span>
                      {new Date(kitchenReplyAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </span>
                  )}
                  {kitchenReplyBy && <span>{kitchenReplyBy}</span>}
                </div>
                <p className="text-sm text-brand-oak font-medium">「{kitchenReply}」</p>
              </div>
            </div>
          )}

          {diffCount > 0 && (
            <div className="mx-4 mt-3 mb-1 flex items-start gap-2 bg-status-warning/10 text-status-warning px-3 py-2.5 rounded-btn text-xs">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>央廚有 <strong>{diffCount}</strong> 項出貨數量與叫貨不同，橘色標示項目請勾選確認收到</span>
            </div>
          )}

          {/* 欄位標題 */}
          <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100 mt-2">
            <span className="w-6"></span>
            <span className="flex-1 pl-2">品名</span>
            <span className="w-[50px] text-center">叫貨</span>
            <span className="w-[12px]"></span>
            <span className="w-[50px] text-center">實收</span>
          </div>

          {Array.from(itemsByCategory.entries()).map(([category, items]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {items.map((item, idx) => {
                  const isConfirmed = confirmed[item.productId]

                  return (
                    <button
                      key={item.productId}
                      onClick={() => toggleConfirm(item.productId)}
                      className={`w-full flex items-center px-4 py-2.5 text-left active:bg-gray-50 ${
                        idx < items.length - 1 ? 'border-b border-gray-50' : ''
                      } ${item.hasDiff ? 'bg-status-warning/5' : ''} ${isConfirmed ? 'bg-status-success/5' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isConfirmed ? 'bg-status-success border-status-success' : 'border-gray-300'
                      }`}>
                        {isConfirmed && <CheckCircle size={13} className="text-white" />}
                      </div>

                      <div className="flex-1 min-w-0 pl-2">
                        <p className="text-sm font-medium text-brand-oak leading-tight">{item.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">{item.unit}</p>
                        {item.hasDiff && (
                          <p className="text-[10px] text-status-warning font-medium leading-tight">
                            央廚異動 {item.diff > 0 ? '+' : ''}{item.diff} {item.unit}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        <span className={`w-[50px] text-center text-sm font-num ${
                          item.hasDiff ? 'text-brand-lotus line-through' : 'text-brand-oak'
                        }`}>
                          {formatDualUnit(item.orderQty, item.unit, item.box_unit, item.box_ratio)}
                        </span>
                        {item.hasDiff ? (
                          <>
                            <ArrowRight size={10} className="text-status-warning shrink-0" />
                            <span className="w-[50px] text-center text-sm font-num font-bold text-status-warning">
                              {formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-[12px]"></span>
                            <span className="w-[50px] text-center text-sm font-num text-brand-oak">
                              {formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)}
                            </span>
                          </>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 央廚主動出貨品項 */}
          {extraItems.length > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 px-4 py-2 bg-surface-section border-y border-gray-200">
                <Package size={14} className="text-brand-mocha" />
                <span className="text-sm font-semibold text-brand-oak">央廚主動出貨</span>
                <span className="text-[10px] text-brand-lotus">（未經叫貨）</span>
                <span className="ml-auto text-xs text-brand-lotus">{extraItems.length} 項</span>
              </div>

              <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="w-6"></span>
                <span className="flex-1 pl-2">品名</span>
                <span className="w-[50px] text-center">實出</span>
              </div>

              {Array.from(extraByCategory.entries()).map(([category, items]) => (
                <div key={`extra-${category}`}>
                  <SectionHeader title={category} icon="■" />
                  <div className="bg-white">
                    {items.map((item, idx) => {
                      const isConfirmed = confirmed[item.productId]

                      return (
                        <button
                          key={item.productId}
                          onClick={() => toggleConfirm(item.productId)}
                          className={`w-full flex items-center px-4 py-2.5 text-left active:bg-gray-50 ${
                            idx < items.length - 1 ? 'border-b border-gray-50' : ''
                          } ${isConfirmed ? 'bg-status-success/5' : ''}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isConfirmed ? 'bg-status-success border-status-success' : 'border-gray-300'
                          }`}>
                            {isConfirmed && <CheckCircle size={13} className="text-white" />}
                          </div>

                          <div className="flex-1 min-w-0 pl-2">
                            <p className="text-sm font-medium text-brand-oak leading-tight">{item.name}</p>
                            <p className="text-[10px] text-brand-lotus leading-tight">{item.unit}</p>
                          </div>

                          <span className="w-[50px] text-center text-sm font-num text-brand-oak font-bold">
                            {formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 備註區（若有送錯/漏品/破損請填寫；可選通知央廚）*/}
          <div className="mx-4 mt-4 mb-6 p-3 rounded-card border border-gray-200 bg-white">
            <label className="flex items-center gap-1.5 text-sm font-medium text-brand-oak mb-2">
              <MessageSquare size={14} className="text-brand-mocha" />
              備註
              <span className="text-xs text-brand-lotus font-normal">（送錯/漏品/破損請填寫）</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={3}
              maxLength={500}
              placeholder="例：芋泥球實際只收到 2 盒、紙碗破損 1 個..."
              className="w-full rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
              style={{ backgroundColor: 'var(--color-input-bg)' }}
            />
            <p className={`text-xs text-right mt-1 mb-3 ${note.length >= 500 ? 'text-status-danger' : 'text-brand-lotus'}`}>
              {note.length} / 500
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveNote}
                disabled={!!savingNote || !note.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn border border-brand-silver text-sm text-brand-oak font-medium active:scale-95 transition-transform disabled:opacity-50"
              >
                <Save size={14} />
                {savingNote === 'save' ? '儲存中...' : '儲存備註'}
              </button>
              <button
                onClick={handleSaveAndNotify}
                disabled={!!savingNote || !note.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-btn bg-brand-mocha text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
              >
                <Send size={14} />
                {savingNote === 'notify' ? '通知中...' : '儲存並通知央廚'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
