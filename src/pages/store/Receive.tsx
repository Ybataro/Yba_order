import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { shipmentSessionId, getTodayTW } from '@/lib/session'
import { logAudit } from '@/lib/auditLog'
import { CheckCircle, AlertTriangle, ArrowRight, RefreshCw, MessageSquare } from 'lucide-react'

interface ShipmentItem {
  productId: string
  name: string
  unit: string
  category: string
  orderQty: number
  actualQty: number
  hasDiff: boolean
  diff: number
}

export default function Receive() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const allProducts = useProductStore((s) => s.items)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)

  const today = getTodayTW()
  const sessionId = shipmentSessionId(storeId || '', today)

  const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([])
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasShipment, setHasShipment] = useState(false)
  const [kitchenReply, setKitchenReply] = useState('')
  const [kitchenReplyAt, setKitchenReplyAt] = useState<string | null>(null)
  const [kitchenReplyBy, setKitchenReplyBy] = useState<string | null>(null)

  // Load shipment data
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
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
      if (session.received_at) setIsEdit(true)
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
          loaded.push({
            productId: item.product_id,
            name: product.name,
            unit: product.unit,
            category: product.category,
            orderQty,
            actualQty,
            hasDiff: orderQty !== actualQty,
            diff: Math.round((actualQty - orderQty) * 10) / 10,
          })
          loadedConfirmed[item.product_id] = item.received || false
        })

        setShipmentItems(loaded)
        setConfirmed(loadedConfirmed)
      }

      setLoading(false)
    }

    load()
  }, [storeId, today])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ShipmentItem[]>()
    for (const cat of productCategories) {
      const catItems = shipmentItems.filter(i => i.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [shipmentItems, productCategories])

  const toggleConfirm = (productId: string) => {
    setConfirmed(prev => ({ ...prev, [productId]: !prev[productId] }))
  }

  const confirmedCount = shipmentItems.filter(item => confirmed[item.productId]).length
  const diffCount = shipmentItems.filter(item => item.hasDiff).length

  const handleSubmit = async () => {
    if (!supabase || !storeId) {
      showToast('收貨確認已提交！')
      return
    }

    setSubmitting(true)

    // Update session receive info
    const { error: sessionErr } = await supabase
      .from('shipment_sessions')
      .update({
        receive_note: note,
        received_at: new Date().toISOString(),
        received_by: staffId || null,
      })
      .eq('id', sessionId)

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      setSubmitting(false)
      return
    }

    // Update each item's received status
    for (const item of shipmentItems) {
      await supabase
        .from('shipment_items')
        .update({ received: confirmed[item.productId] || false })
        .eq('session_id', sessionId)
        .eq('product_id', item.productId)
    }

    setIsEdit(true)
    setSubmitting(false)
    logAudit('receive_submit', storeId, sessionId)
    showToast(isEdit ? '收貨確認已更新！' : '收貨確認已提交！')
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 收貨確認`} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入收貨確認紀錄，可修改後重新提交</span>
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
              {diffCount > 0 && (
                <p className="flex items-center gap-1 text-xs text-status-warning font-medium">
                  <AlertTriangle size={12} />
                  {diffCount} 項數量異動
                </p>
              )}
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
              <span>央廚有 <strong>{diffCount}</strong> 項出貨數量與叫貨不同，橘色標示項目請留意核對</span>
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
                          {item.orderQty}
                        </span>
                        {item.hasDiff ? (
                          <>
                            <ArrowRight size={10} className="text-status-warning shrink-0" />
                            <span className="w-[50px] text-center text-sm font-num font-bold text-status-warning">
                              {item.actualQty}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="w-[12px]"></span>
                            <span className="w-[50px] text-center text-sm font-num text-brand-oak">
                              {item.actualQty}
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

          {/* 差異備註 */}
          <div className="px-4 py-3">
            <label className="text-sm font-medium text-brand-oak block mb-1.5">差異備註（若有不符）</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="例：芋泥球實際只收到2盒..."
              className="w-full h-20 rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
              style={{ backgroundColor: 'var(--color-input-bg)' }} />
          </div>

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新收貨確認' : '確認收貨完成'}
            onClick={handleSubmit}
            variant="success"
            icon={<CheckCircle size={18} />}
            disabled={submitting}
          />
        </>
      )}
    </div>
  )
}
