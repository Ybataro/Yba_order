import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { supabase } from '@/lib/supabase'
import { shipmentSessionId, getTodayTW, getYesterdayTW } from '@/lib/session'
import { Truck, AlertTriangle, UserCheck, RefreshCw } from 'lucide-react'

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
  const orderDate = getYesterdayTW() // 叫貨是隔日到貨，所以查昨日的叫貨

  // 各店叫貨量（從 order_sessions/order_items 載入）
  const [orderQty, setOrderQty] = useState<Record<string, Record<string, number>>>({})
  const [actualQty, setActualQty] = useState<Record<string, Record<string, string>>>({})
  const [confirmed, setConfirmed] = useState<Record<string, Record<string, boolean>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Load order data + existing shipment for all stores
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    const loadAll = async () => {
      const oqData: Record<string, Record<string, number>> = {}
      const aqData: Record<string, Record<string, string>> = {}
      const cfData: Record<string, Record<string, boolean>> = {}
      const editData: Record<string, boolean> = {}

      for (const store of stores) {
        oqData[store.id] = {}
        aqData[store.id] = {}
        cfData[store.id] = {}
        storeProducts.forEach(p => {
          oqData[store.id][p.id] = 0
          aqData[store.id][p.id] = ''
        })

        // Load yesterday's order for this store (隔日到貨)
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

        // Load existing shipment
        const shipSid = shipmentSessionId(store.id, today)
        const { data: shipSession } = await supabase!
          .from('shipment_sessions')
          .select('confirmed_by')
          .eq('id', shipSid)
          .maybeSingle()

        if (shipSession) {
          editData[store.id] = true
          if (shipSession.confirmed_by) setConfirmBy(shipSession.confirmed_by)

          const { data: shipItems } = await supabase!
            .from('shipment_items')
            .select('*')
            .eq('session_id', shipSid)

          if (shipItems) {
            shipItems.forEach(item => {
              aqData[store.id][item.product_id] = item.actual_qty > 0 ? String(item.actual_qty) : ''
              cfData[store.id][item.product_id] = item.received || false
            })
          }
        }
      }

      setOrderQty(oqData)
      setActualQty(aqData)
      setConfirmed(cfData)
      setIsEdit(editData)
      setLoading(false)
    }

    loadAll()
  }, [today])

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

  const handleSubmit = async () => {
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
    const sid = shipmentSessionId(activeStore, today)

    const { error: sessionErr } = await supabase
      .from('shipment_sessions')
      .upsert({
        id: sid,
        store_id: activeStore,
        date: today,
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

    if (shipItems.length > 0) {
      const { error: itemErr } = await supabase
        .from('shipment_items')
        .upsert(shipItems, { onConflict: 'session_id,product_id' })

      if (itemErr) {
        showToast('提交失敗：' + itemErr.message, 'error')
        setSubmitting(false)
        return
      }
    }

    const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
    setIsEdit(prev => ({ ...prev, [activeStore]: true }))
    setSubmitting(false)
    showToast(`${stores.find(s => s.id === activeStore)?.name}出貨已確認！確認人：${staffName}`)
  }

  return (
    <div className="page-container">
      <TopNav title="出貨表" />

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
          <span>已載入今日出貨紀錄，可修改後重新提交</span>
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
              此門店今日尚無叫貨紀錄
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

          <BottomAction
            label={submitting ? '提交中...' : isEdit[activeStore] ? '更新出貨確認' : '確認全部出貨完成'}
            onClick={handleSubmit}
            variant="success"
            icon={<Truck size={18} />}
            disabled={submitting}
          />
        </>
      )}
    </div>
  )
}
