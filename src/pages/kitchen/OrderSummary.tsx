import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { FileText, MessageSquareText, Package } from 'lucide-react'
import { exportOrderSummaryToPdf } from '@/lib/exportOrderSummaryPdf'

const fixedNoteItems = [
  { id: 'almond1000', label: '杏仁茶瓶 1000ml', unit: '個' },
  { id: 'almond300', label: '杏仁茶瓶 300ml', unit: '個' },
  { id: 'bowlK520', label: 'K520 紙碗', unit: '箱' },
  { id: 'bowl750', label: '750 紙碗', unit: '箱' },
]

export default function OrderSummary() {
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const allProducts = useProductStore((s) => s.items)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)
  const stores = useStoreStore((s) => s.items)

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const orderDate = selectedDate

  const [storeOrders, setStoreOrders] = useState<Record<string, Record<string, number>>>({})
  const [storeNotes, setStoreNotes] = useState<Record<string, { fixedItems: Record<string, number>; freeText: string }>>({})
  const [productStock, setProductStock] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    const load = async () => {
      setLoading(true)
      const ordersData: Record<string, Record<string, number>> = {}
      const notesData: Record<string, { fixedItems: Record<string, number>; freeText: string }> = {}

      // 初始化
      stores.forEach(store => {
        ordersData[store.id] = {}
        notesData[store.id] = { fixedItems: { almond1000: 0, almond300: 0, bowlK520: 0, bowl750: 0 }, freeText: '' }
      })

      // 查今日各店 order_sessions + order_items
      const { data: sessions } = await supabase!
        .from('order_sessions')
        .select('*, order_items(*)')
        .eq('date', orderDate)

      if (sessions) {
        sessions.forEach(session => {
          const sid = session.store_id
          if (!sid) return

          // 叫貨品項
          const items = session.order_items || []
          items.forEach((item: { product_id: string; quantity: number }) => {
            ordersData[sid] = ordersData[sid] || {}
            ordersData[sid][item.product_id] = (ordersData[sid][item.product_id] || 0) + item.quantity
          })

          // 備註
          notesData[sid] = {
            fixedItems: {
              almond1000: parseInt(session.almond_1000) || 0,
              almond300: parseInt(session.almond_300) || 0,
              bowlK520: parseInt(session.bowl_k520) || 0,
              bowl750: parseInt(session.bowl_750) || 0,
            },
            freeText: session.note || '',
          }
        })
      }

      // 查最近一筆成品庫存盤點（含當日及之前，因週三/日休息無盤點）
      const stockData: Record<string, number> = {}
      const { data: latestSession } = await supabase!
        .from('product_stock_sessions')
        .select('id, date')
        .lte('date', selectedDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestSession) {
        const { data: stockItems } = await supabase!
          .from('product_stock_items')
          .select('product_id, stock_qty')
          .eq('session_id', latestSession.id)

        if (stockItems) {
          stockItems.forEach(item => {
            if (item.stock_qty != null) {
              stockData[item.product_id] = item.stock_qty
            }
          })
        }
      }

      setStoreOrders(ordersData)
      setStoreNotes(notesData)
      setProductStock(stockData)
      setLoading(false)
    }

    load()
  }, [selectedDate, stores])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [storeProducts, productCategories])

  const getTotal = (productId: string) =>
    Math.round(stores.reduce((sum, s) => sum + (storeOrders[s.id]?.[productId] || 0), 0) * 10) / 10

  // 統計有叫貨的品項數
  const orderedCount = useMemo(() => {
    let count = 0
    storeProducts.forEach(p => {
      if (getTotal(p.id) > 0) count++
    })
    return count
  }, [storeProducts, storeOrders, stores])

  // 檢查某店是否有任何備註內容
  const hasNotes = (storeId: string) => {
    const n = storeNotes[storeId]
    if (!n) return false
    if (n.freeText) return true
    return Object.values(n.fixedItems).some(v => v > 0)
  }

  const handleExportPdf = async () => {
    setPdfLoading(true)
    try {
      await exportOrderSummaryToPdf({
        date: selectedDate,
        stores,
        products: storeProducts,
        categories: productCategories,
        storeOrders,
        storeNotes,
        fixedNoteItems,
        productStock,
      })
      showToast('PDF 已下載', 'success')
    } catch (e) {
      console.error('[OrderSummary] PDF export failed:', e)
      showToast('PDF 匯出失敗', 'error')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="page-container !pb-4">
      <TopNav title="各店叫貨總表" backTo={`/kitchen${staffId ? `?staff=${staffId}` : ''}`} />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
      <>
      {/* 摘要 banner + PDF 按鈕 */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-brand-amber/10 rounded-xl px-3 py-2">
          <Package size={16} className="text-brand-amber" />
          <span className="text-sm font-semibold text-brand-oak">
            {orderedCount} / {storeProducts.length}
          </span>
          <span className="text-xs text-brand-lotus">品項有叫貨</span>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={pdfLoading}
          className="h-9 px-3 rounded-lg border border-gray-300 text-sm text-brand-oak flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
        >
          <FileText size={14} />
          {pdfLoading ? '...' : 'PDF'}
        </button>
      </div>

      {/* ===== 表格 ===== */}
      <div>
        {/* 表頭 sticky */}
        <div className="sticky top-14 z-10 flex items-center gap-0.5 px-3 py-2.5 bg-[#5A4632] text-white text-xs">
          <span className="flex-1 font-semibold">品項</span>
          <span className="w-9 text-center font-semibold bg-yellow-400/20 rounded py-0.5">庫存</span>
          {stores.map(s => (
            <span key={s.id} className="w-10 text-center font-semibold">{s.name.replace('店', '')}</span>
          ))}
          <span className="w-10 text-center font-bold bg-white/15 rounded py-0.5">加總</span>
          <span className="w-11 text-center font-semibold text-[10px] leading-tight bg-white/10 rounded py-0.5">剩餘庫存</span>
        </div>

        {Array.from(productsByCategory.entries()).map(([category, products]) => {
          if (products.length === 0) return null
          return (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {products.map((product, idx) => {
                  const total = getTotal(product.id)
                  const hasOrder = total > 0
                  const stock = productStock[product.id]
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-0.5 px-3 py-1.5 ${
                        idx < products.length - 1 ? 'border-b border-gray-50' : ''
                      } ${hasOrder ? 'bg-amber-50/40' : ''}`}
                    >
                      <div className="flex-1 min-w-0 truncate">
                        <span className={`text-sm font-medium ${hasOrder ? 'text-brand-oak' : 'text-gray-400'}`}>
                          {product.name}
                        </span>
                        <span className="text-[10px] text-brand-lotus ml-0.5">({product.unit})</span>
                      </div>
                      <span className={`w-9 text-center text-sm font-num rounded py-0.5 ${
                        stock != null ? 'text-brand-oak bg-yellow-100 font-semibold' : 'text-gray-300'
                      }`}>
                        {stock != null ? stock : '-'}
                      </span>
                      {stores.map(store => {
                        const qty = storeOrders[store.id]?.[product.id] || 0
                        return (
                          <span key={store.id} className={`w-10 text-center text-sm font-num ${qty === 0 ? 'text-gray-300' : 'text-blue-700 font-semibold'}`}>
                            {qty || '-'}
                          </span>
                        )
                      })}
                      <span className={`w-10 text-center text-sm font-num font-bold rounded py-0.5 ${
                        hasOrder ? 'text-red-600 bg-red-50 ring-1 ring-red-200' : 'text-gray-300'
                      }`}>
                        {total || '-'}
                      </span>
                      {(() => {
                        const remaining = stock != null ? Math.round((stock - total) * 10) / 10 : null
                        return (
                          <span className={`w-11 text-center text-xs font-num font-semibold rounded py-0.5 ${
                            remaining != null ? (remaining < 0 ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50') : 'text-gray-300'
                          }`}>
                            {remaining != null ? remaining.toFixed(1) : '-'}
                          </span>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 各店叫貨備註 */}
      <SectionHeader title="各店叫貨備註" icon="■" />
      <div className="mx-4 mb-4 space-y-2">
        {stores.map(store => (
          <div key={store.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1.5">
              <MessageSquareText size={14} className="text-brand-mocha" />
              <span className="text-sm font-semibold text-brand-oak">{store.name}</span>
              {!hasNotes(store.id) && <span className="text-xs text-brand-lotus">（無備註）</span>}
            </div>
            {hasNotes(store.id) && (
              <div className="pl-5">
                {/* 固定項目 */}
                {fixedNoteItems.map(item => {
                  const qty = storeNotes[store.id]?.fixedItems[item.id] || 0
                  if (qty === 0) return null
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-brand-oak py-0.5">
                      <span className="text-brand-lotus">{item.label}：</span>
                      <span className="font-semibold font-num">{qty}</span>
                      <span className="text-xs text-brand-lotus">{item.unit}</span>
                    </div>
                  )
                })}
                {/* 自由備註 */}
                {storeNotes[store.id]?.freeText && (
                  <p className="text-sm text-brand-oak mt-1 bg-status-warning/5 px-2 py-1 rounded-lg">
                    {storeNotes[store.id].freeText}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}
