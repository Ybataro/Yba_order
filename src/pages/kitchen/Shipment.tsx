import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { supabase } from '@/lib/supabase'
import { shipmentSessionId, getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { logAudit } from '@/lib/auditLog'
import { Truck, AlertTriangle, UserCheck, RefreshCw, MessageSquare, Clock, Send } from 'lucide-react'

export default function Shipment() {
  const { showToast } = useToast()
  const allProducts = useProductStore((s) => s.items)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)
  const stores = useStoreStore((s) => s.items)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [activeStore, setActiveStore] = useState(stores[0]?.id ?? '')
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const orderDate = selectedDate

  // 歷史編輯確認
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)

  // 各店叫貨量（從 order_sessions/order_items 載入）
  const [orderQty, setOrderQty] = useState<Record<string, Record<string, number>>>({})
  const [actualQty, setActualQty] = useState<Record<string, Record<string, string>>>({})
  const [confirmed, setConfirmed] = useState<Record<string, Record<string, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // 收貨回饋
  const [receiveStatus, setReceiveStatus] = useState<Record<string, {
    received_at: string | null
    received_by: string | null
    receive_note: string
    kitchen_reply: string
    kitchen_reply_at: string | null
    kitchen_reply_by: string | null
    unreceived_items: { name: string; unit: string; order_qty: number; actual_qty: number }[]
  }>>({})
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replySubmitting, setReplySubmitting] = useState(false)

  // Load order data + existing shipment for all stores
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    const loadAll = async () => {
      const oqData: Record<string, Record<string, number>> = {}
      const aqData: Record<string, Record<string, string>> = {}
      const cfData: Record<string, Record<string, boolean>> = {}
      const editData: Record<string, boolean> = {}
      const rcvData: typeof receiveStatus = {}
      const rplyData: Record<string, string> = {}
      const productMap = new Map(storeProducts.map(p => [p.id, p]))

      for (const store of stores) {
        oqData[store.id] = {}
        aqData[store.id] = {}
        cfData[store.id] = {}
        storeProducts.forEach(p => {
          oqData[store.id][p.id] = 0
          aqData[store.id][p.id] = ''
        })

        // Load order for this store on selected date
        const orderSid = `${store.id}_${orderDate}`
        const { data: orderItems } = await supabase!
          .from('order_items')
          .select('product_id, quantity')
          .eq('session_id', orderSid)

        if (orderItems) {
          orderItems.forEach(item => {
            oqData[store.id][item.product_id] = item.quantity || 0
            aqData[store.id][item.product_id] = item.quantity > 0 ? String(item.quantity) : ''
          })
        }

        // Load existing shipment (含收貨回饋欄位)
        const shipSid = shipmentSessionId(store.id, selectedDate)
        const { data: shipSession } = await supabase!
          .from('shipment_sessions')
          .select('confirmed_by, received_at, received_by, receive_note, kitchen_reply, kitchen_reply_at, kitchen_reply_by')
          .eq('id', shipSid)
          .maybeSingle()

        if (shipSession) {
          editData[store.id] = true
          if (shipSession.confirmed_by) setConfirmBy(shipSession.confirmed_by)

          const { data: shipItems } = await supabase!
            .from('shipment_items')
            .select('*')
            .eq('session_id', shipSid)

          const unreceived: typeof rcvData[string]['unreceived_items'] = []

          if (shipItems) {
            shipItems.forEach(item => {
              aqData[store.id][item.product_id] = item.actual_qty > 0 ? String(item.actual_qty) : ''
              cfData[store.id][item.product_id] = item.received || false

              // 收集未收到的品項
              if (shipSession.received_at && !item.received) {
                const product = productMap.get(item.product_id)
                if (product) {
                  unreceived.push({
                    name: product.name,
                    unit: product.unit,
                    order_qty: item.order_qty || 0,
                    actual_qty: item.actual_qty || 0,
                  })
                }
              }
            })
          }

          rcvData[store.id] = {
            received_at: shipSession.received_at || null,
            received_by: shipSession.received_by || null,
            receive_note: shipSession.receive_note || '',
            kitchen_reply: shipSession.kitchen_reply || '',
            kitchen_reply_at: shipSession.kitchen_reply_at || null,
            kitchen_reply_by: shipSession.kitchen_reply_by || null,
            unreceived_items: unreceived,
          }

          if (shipSession.kitchen_reply) {
            rplyData[store.id] = shipSession.kitchen_reply
          }
        }
      }

      setOrderQty(oqData)
      setActualQty(aqData)
      setConfirmed(cfData)
      setIsEdit(editData)
      setReceiveStatus(rcvData)
      setReplyText(rplyData)
      setLoading(false)
    }

    loadAll()
  }, [selectedDate])

  const toggleConfirm = (productId: string) => {
    setConfirmed(prev => ({
      ...prev,
      [activeStore]: { ...prev[activeStore], [productId]: !prev[activeStore]?.[productId] }
    }))
  }

  // 只顯示有叫貨的品項
  const items = storeProducts.filter(p => {
    const qty = orderQty[activeStore]?.[p.id] || 0
    return qty > 0
  })

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      const catItems = items.filter(p => p.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [items, productCategories])

  const confirmedCount = items.filter(p => confirmed[activeStore]?.[p.id]).length
  const diffCount = items.filter(p => {
    const ordered = orderQty[activeStore]?.[p.id] || 0
    const actual = parseFloat(actualQty[activeStore]?.[p.id] || '0') || 0
    return ordered !== actual
  }).length

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-ship]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const doSubmit = async () => {
    if (!confirmBy) {
      showToast('請先選擇確認人員', 'error')
      return
    }
    if (!supabase) {
      const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
      showToast(`${stores.find(s => s.id === activeStore)?.name}出貨已確認！確認人：${staffName}`)
      return
    }

    setSubmitting(true)
    const sid = shipmentSessionId(activeStore, selectedDate)

    const { error: sessionErr } = await supabase
      .from('shipment_sessions')
      .upsert({
        id: sid,
        store_id: activeStore,
        date: selectedDate,
        confirmed_by: confirmBy,
        confirmed_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      setSubmitting(false)
      return
    }

    const shipItems = items.map(p => ({
      session_id: sid,
      product_id: p.id,
      order_qty: orderQty[activeStore]?.[p.id] || 0,
      actual_qty: parseFloat(actualQty[activeStore]?.[p.id] || '0') || 0,
      received: false,
    }))

    // Delete old shipment items first (handles removed order items)
    await supabase.from('shipment_items').delete().eq('session_id', sid)

    if (shipItems.length > 0) {
      const { error: itemErr } = await supabase
        .from('shipment_items')
        .insert(shipItems)

      if (itemErr) {
        showToast('提交失敗：' + itemErr.message, 'error')
        setSubmitting(false)
        return
      }
    }

    const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
    setIsEdit(prev => ({ ...prev, [activeStore]: true }))
    setSubmitting(false)
    logAudit('shipment_submit', activeStore, sid)
    showToast(`${stores.find(s => s.id === activeStore)?.name}出貨已確認！確認人：${staffName}`)
  }

  const handleSubmit = () => {
    if (!isToday) {
      setShowHistoryConfirm(true)
    } else {
      doSubmit()
    }
  }

  // 央廚回覆收貨差異
  const handleReply = async (storeId: string) => {
    const text = replyText[storeId]?.trim()
    if (!text) {
      showToast('請輸入回覆內容', 'error')
      return
    }
    if (!supabase) return

    setReplySubmitting(true)
    const sid = shipmentSessionId(storeId, selectedDate)

    const { error } = await supabase
      .from('shipment_sessions')
      .update({
        kitchen_reply: text,
        kitchen_reply_at: new Date().toISOString(),
        kitchen_reply_by: confirmBy || null,
      })
      .eq('id', sid)

    if (error) {
      showToast('回覆失敗：' + error.message, 'error')
      setReplySubmitting(false)
      return
    }

    setReceiveStatus(prev => ({
      ...prev,
      [storeId]: {
        ...prev[storeId],
        kitchen_reply: text,
        kitchen_reply_at: new Date().toISOString(),
        kitchen_reply_by: confirmBy || null,
      }
    }))
    setReplySubmitting(false)
    logAudit('shipment_reply', storeId, sid)
    showToast('回覆已送出')
  }

  const quickReplies = ['下次補出', '已知悉', '已補出']

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const getStaffName = (staffId: string | null) => {
    if (!staffId) return ''
    const staff = kitchenStaff.find(s => s.id === staffId)
    return staff?.name || staffId
  }

  return (
    <div className="page-container">
      <TopNav title="出貨表" />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {/* 門店切換 */}
      <div className="flex border-b border-gray-200 bg-white">
        {stores.map(store => (
          <button key={store.id} onClick={() => setActiveStore(store.id)}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeStore === store.id ? 'text-brand-mocha border-b-2 border-brand-mocha' : 'text-brand-lotus'}`}>
            {store.name}
          </button>
        ))}
      </div>

      {isEdit[activeStore] && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : formatDate(selectedDate)}出貨紀錄，可修改後重新提交</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 確認人員 + 統計列 */}
          <div className="px-4 py-2.5 bg-white border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck size={16} className="text-brand-mocha shrink-0" />
              <span className="text-sm text-brand-oak font-medium shrink-0">確認人員</span>
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-brand-oak">
                已確認 <span className="font-semibold">{confirmedCount}/{items.length}</span> 項
              </p>
              {diffCount > 0 && (
                <p className="flex items-center gap-1 text-xs text-status-warning">
                  <AlertTriangle size={12} />
                  {diffCount} 項數量異動
                </p>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              {isToday ? '此門店今日尚無叫貨紀錄' : `此門店 ${formatDate(selectedDate)} 無叫貨紀錄`}
            </div>
          ) : (
            <>
              {/* 欄位標題 */}
              <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[50px] text-center">叫貨</span>
                <span className="w-[60px] text-center">實出</span>
                <span className="w-7 text-center">✓</span>
              </div>

              {Array.from(productsByCategory.entries()).map(([category, products]) => (
                <div key={category}>
                  <SectionHeader title={category} icon="■" />
                  <div className="bg-white">
                    {products.map((product, idx) => {
                      const ordered = orderQty[activeStore]?.[product.id] || 0
                      const actual = parseFloat(actualQty[activeStore]?.[product.id] || '0') || 0
                      const hasDiff = ordered !== actual
                      const isConfirmed = confirmed[activeStore]?.[product.id]

                      return (
                        <div
                          key={product.id}
                          className={`flex items-center px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''} ${isConfirmed ? 'bg-status-success/5' : ''} ${hasDiff ? 'bg-status-warning/5' : ''}`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="text-sm font-medium text-brand-oak leading-tight">{product.name}</p>
                            <p className="text-[10px] text-brand-lotus leading-tight">{product.unit}</p>
                            {hasDiff && (
                              <p className="text-[10px] text-status-warning font-medium leading-tight">
                                差異 {actual - ordered > 0 ? '+' : ''}{Math.round((actual - ordered) * 10) / 10} {product.unit}
                              </p>
                            )}
                          </div>
                          <span className="w-[50px] text-center text-sm font-num text-brand-lotus">{ordered}</span>
                          <div className="w-[60px] flex justify-center">
                            <NumericInput
                              value={actualQty[activeStore]?.[product.id] || ''}
                              onChange={(v) => setActualQty(prev => ({
                                ...prev,
                                [activeStore]: { ...prev[activeStore], [product.id]: v }
                              }))}
                              isFilled
                              onNext={focusNext}
                              className={hasDiff ? '!border-status-warning' : ''}
                              data-ship=""
                            />
                          </div>
                          <button onClick={() => toggleConfirm(product.id)} className="w-7 flex justify-center">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isConfirmed ? 'bg-status-success border-status-success text-white' : 'border-gray-300'}`}>
                              {isConfirmed && <span className="text-[10px]">✓</span>}
                            </div>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* 收貨回饋區 */}
          {isEdit[activeStore] && (
            <div className="mx-4 mt-4 mb-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-section border-b border-gray-100">
                <MessageSquare size={16} className="text-brand-mocha" />
                <span className="text-sm font-semibold text-brand-oak">收貨回饋</span>
              </div>

              {(() => {
                const status = receiveStatus[activeStore]
                if (!status || !status.received_at) {
                  return (
                    <div className="px-4 py-4 flex items-center gap-2 text-sm text-brand-lotus">
                      <Clock size={14} />
                      <span>{stores.find(s => s.id === activeStore)?.name} 尚未確認收貨</span>
                    </div>
                  )
                }

                const hasDiscrepancy = status.unreceived_items.length > 0 || status.receive_note

                return (
                  <div className="divide-y divide-gray-100">
                    {/* 收貨確認狀態 */}
                    <div className="px-4 py-2.5 flex items-center gap-2 text-sm text-status-success">
                      <span>✅</span>
                      <span>{stores.find(s => s.id === activeStore)?.name} 已確認收貨</span>
                      <span className="text-xs text-brand-lotus ml-auto">
                        {formatTime(status.received_at)}
                      </span>
                    </div>

                    {/* 未收到品項 */}
                    {status.unreceived_items.length > 0 && (
                      <div className="px-4 py-2.5">
                        <p className="flex items-center gap-1.5 text-sm font-medium text-status-warning mb-1.5">
                          <AlertTriangle size={14} />
                          未收到品項：
                        </p>
                        <ul className="space-y-1 pl-5">
                          {status.unreceived_items.map((item, i) => (
                            <li key={i} className="text-sm text-brand-oak list-disc">
                              {item.name}({item.unit}) — 叫{item.order_qty}/出{item.actual_qty}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 門店備註 */}
                    {status.receive_note && (
                      <div className="px-4 py-2.5">
                        <p className="text-xs text-brand-lotus mb-0.5">門店備註</p>
                        <p className="text-sm text-brand-oak">{status.receive_note}</p>
                      </div>
                    )}

                    {/* 已回覆顯示 */}
                    {status.kitchen_reply && (
                      <div className="px-4 py-2.5 bg-status-info/5">
                        <div className="flex items-center gap-1.5 text-xs text-brand-lotus mb-0.5">
                          <span>已回覆</span>
                          <span>{formatTime(status.kitchen_reply_at)}</span>
                          {status.kitchen_reply_by && (
                            <span>{getStaffName(status.kitchen_reply_by)}</span>
                          )}
                        </div>
                        <p className="text-sm text-brand-oak font-medium">「{status.kitchen_reply}」</p>
                      </div>
                    )}

                    {/* 回覆輸入區（有差異或已有回覆才顯示） */}
                    {(hasDiscrepancy || status.kitchen_reply) && (
                      <div className="px-4 py-3">
                        <p className="text-xs text-brand-lotus mb-2">
                          {status.kitchen_reply ? '修改回覆：' : '回覆處理方式：'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {quickReplies.map(text => (
                            <button
                              key={text}
                              onClick={() => setReplyText(prev => ({ ...prev, [activeStore]: text }))}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                replyText[activeStore] === text
                                  ? 'bg-brand-mocha text-white border-brand-mocha'
                                  : 'bg-white text-brand-oak border-gray-200 hover:border-brand-lotus'
                              }`}
                            >
                              {text}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyText[activeStore] || ''}
                            onChange={e => setReplyText(prev => ({ ...prev, [activeStore]: e.target.value }))}
                            placeholder="自訂回覆..."
                            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus"
                          />
                          <button
                            onClick={() => handleReply(activeStore)}
                            disabled={replySubmitting || !replyText[activeStore]?.trim()}
                            className="h-9 px-4 rounded-lg bg-brand-mocha text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Send size={14} />
                            送出
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          <BottomAction
            label={submitting ? '提交中...' : isEdit[activeStore] ? '更新出貨確認' : '確認全部出貨完成'}
            onClick={handleSubmit}
            variant="success"
            icon={<Truck size={18} />}
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
              你正在修改 <span className="font-semibold text-brand-oak">{formatDate(selectedDate)}</span> 的出貨紀錄，確定要提交嗎？
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
