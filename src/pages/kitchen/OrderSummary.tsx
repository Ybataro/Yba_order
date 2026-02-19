import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { Printer, MessageSquareText } from 'lucide-react'
import { getTodayString } from '@/lib/utils'

const fixedNoteItems = [
  { id: 'almond1000', label: '杏仁茶瓶 1000ml', unit: '個' },
  { id: 'almond300', label: '杏仁茶瓶 300ml', unit: '個' },
  { id: 'bowlK520', label: 'K520 紙碗', unit: '箱' },
  { id: 'bowl750', label: '750 紙碗', unit: '箱' },
]

export default function OrderSummary() {
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const stores = useStoreStore((s) => s.items)
  const today = getTodayTW()

  const [storeOrders, setStoreOrders] = useState<Record<string, Record<string, number>>>({})
  const [storeNotes, setStoreNotes] = useState<Record<string, { fixedItems: Record<string, number>; freeText: string }>>({})
  const [loading, setLoading] = useState(true)

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
        .eq('date', today)

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

      setStoreOrders(ordersData)
      setStoreNotes(notesData)
      setLoading(false)
    }

    load()
  }, [today, stores])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  const getTotal = (productId: string) =>
    Math.round(stores.reduce((sum, s) => sum + (storeOrders[s.id]?.[productId] || 0), 0) * 10) / 10

  const handlePrint = () => {
    window.print()
  }

  // 檢查某店是否有任何備註內容
  const hasNotes = (storeId: string) => {
    const n = storeNotes[storeId]
    if (!n) return false
    if (n.freeText) return true
    return Object.values(n.fixedItems).some(v => v > 0)
  }

  return (
    <div className="page-container !pb-4">
      <TopNav title="各店叫貨總表" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
      <>
      {/* 列印按鈕 */}
      <div className="no-print px-4 pt-3 pb-1">
        <button
          onClick={handlePrint}
          className="btn-secondary !h-9 !text-sm flex items-center justify-center gap-2"
        >
          <Printer size={16} />
          列印 A4 叫貨總表
        </button>
      </div>

      {/* ===== 螢幕版（手機瀏覽） ===== */}
      <div className="screen-only">
        <div className="sticky top-14 z-10 flex items-center justify-end gap-1 px-4 py-2 bg-white border-b border-gray-100 text-xs text-brand-lotus">
          <span className="flex-1">品項</span>
          {stores.map(s => (
            <span key={s.id} className="w-[55px] text-center font-semibold">{s.name.replace('店', '')}</span>
          ))}
          <span className="w-[60px] text-center font-bold text-brand-oak">加總</span>
        </div>

        {Array.from(productsByCategory.entries()).map(([category, products]) => (
          <div key={category}>
            <SectionHeader title={category} icon="■" />
            <div className="bg-white">
              {products.map((product, idx) => {
                const total = getTotal(product.id)
                return (
                  <div key={product.id} className={`flex items-center justify-end gap-1 px-4 py-1.5 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                      <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                    </div>
                    {stores.map(store => {
                      const qty = storeOrders[store.id]?.[product.id] || 0
                      return (
                        <span key={store.id} className={`w-[55px] text-center text-sm font-num ${qty === 0 ? 'text-gray-300' : 'text-brand-oak'}`}>
                          {qty || '-'}
                        </span>
                      )
                    })}
                    <span className={`w-[60px] text-center text-sm font-num font-bold ${total > 0 ? 'text-brand-amber' : 'text-gray-300'}`}>
                      {total || '-'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 各店叫貨備註 */}
        <SectionHeader title="各店叫貨備註" icon="■" />
        <div className="bg-white">
          {stores.map((store, sIdx) => (
            <div key={store.id} className={`px-4 py-2.5 ${sIdx < stores.length - 1 ? 'border-b border-gray-100' : ''}`}>
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
      </div>

      {/* ===== 列印版（A4 表格） ===== */}
      <div className="print-only" style={{ display: 'none' }}>
        <div className="print-header">
          <h1>阿爸的芋圓 — 各店叫貨總表</h1>
          <span className="print-date">{getTodayString()}</span>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>品項</th>
              <th>單位</th>
              {stores.map(s => (
                <th key={s.id}>{s.name}</th>
              ))}
              <th>加總</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(productsByCategory.entries()).map(([category, products]) => (
              <>
                <tr key={`cat-${category}`} className="cat-row">
                  <td colSpan={stores.length + 4}>{category}</td>
                </tr>
                {products.map(product => {
                  const total = getTotal(product.id)
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{product.unit}</td>
                      {stores.map(store => {
                        const qty = storeOrders[store.id]?.[product.id] || 0
                        return (
                          <td key={store.id} className={qty === 0 ? 'zero' : ''}>
                            {qty || '-'}
                          </td>
                        )
                      })}
                      <td className="total-col">{total || '-'}</td>
                      <td></td>
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>

        {/* 列印版備註區 */}
        <div style={{ marginTop: '8px', borderTop: '1px solid #ccc', paddingTop: '6px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B5D55', marginBottom: '4px' }}>各店叫貨備註</p>
          {stores.map(store => (
            <div key={store.id} style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#7A6E5F' }}>{store.name}：</span>
              {hasNotes(store.id) ? (
                <span style={{ fontSize: '10px', color: '#6B5D55' }}>
                  {fixedNoteItems
                    .filter(item => (storeNotes[store.id]?.fixedItems[item.id] || 0) > 0)
                    .map(item => `${item.label} ${storeNotes[store.id].fixedItems[item.id]}${item.unit}`)
                    .join('、')}
                  {storeNotes[store.id]?.freeText ? `。${storeNotes[store.id].freeText}` : ''}
                </span>
              ) : (
                <span style={{ fontSize: '10px', color: '#aaa' }}>無備註</span>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
