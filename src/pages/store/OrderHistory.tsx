import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface OrderSession {
  id: string
  date: string
  submitted_by?: string
  note?: string
  almond_1000?: string
  almond_300?: string
  bowl_k520?: string
  bowl_750?: string
  order_items?: OrderItem[]
}

interface OrderItem {
  product_id: string
  quantity: number
}

export default function StoreOrderHistory() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const allProducts = useProductStore((s) => s.items)
  const products = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)

  const [sessions, setSessions] = useState<OrderSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }

    const today = getTodayTW()
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const thirtyDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

    supabase
      .from('order_sessions')
      .select('*, order_items(*)')
      .eq('store_id', storeId)
      .gte('date', thirtyDaysAgo)
      .lte('date', today)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setSessions(data || [])
        setLoading(false)
      })
  }, [storeId])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name ?? id
  const getProductUnit = (id: string) => products.find((p) => p.id === id)?.unit ?? ''
  const getProductCategory = (id: string) => products.find((p) => p.id === id)?.category ?? '其他'

  const formatDateDisplay = (d: string) => {
    const [y, m, day] = d.split('-')
    const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(d + 'T00:00:00').getDay()]
    return `${y}/${m}/${day}（${wd}）`
  }

  const groupItemsByCategory = (items: OrderItem[]) => {
    const filled = items.filter(i => i.quantity > 0)
    const groups: { category: string; items: OrderItem[] }[] = []

    for (const cat of productCategories) {
      const catItems = filled.filter(i => getProductCategory(i.product_id) === cat)
      if (catItems.length > 0) {
        groups.push({ category: cat, items: catItems })
      }
    }

    // Items with unknown category
    const knownCats = new Set(productCategories)
    const others = filled.filter(i => !knownCats.has(getProductCategory(i.product_id)))
    if (others.length > 0) {
      groups.push({ category: '其他', items: others })
    }

    return groups
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 叫貨紀錄`} backTo={`/store/${storeId}/order${window.location.search}`} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : sessions.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          近 30 天無叫貨紀錄
        </div>
      ) : (
        <div>
          <div className="px-4 py-2 bg-surface-section text-xs text-brand-lotus border-b border-gray-100">
            近 30 天共 {sessions.length} 筆叫貨紀錄
          </div>

          {sessions.map((session) => {
            const expanded = expandedIds.has(session.id)
            const items = session.order_items || []
            const filledItems = items.filter(i => i.quantity > 0)

            return (
              <div key={session.id} className="border-b border-gray-100">
                <button
                  onClick={() => toggleExpand(session.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white active:bg-gray-50 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-brand-oak">
                      {formatDateDisplay(session.date)}
                    </span>
                    <p className="text-xs text-brand-lotus mt-0.5">
                      {filledItems.length} 品項
                      {session.note && ` · 📝`}
                    </p>
                  </div>
                  {expanded ? (
                    <ChevronUp size={18} className="text-brand-lotus shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-brand-lotus shrink-0" />
                  )}
                </button>

                {expanded && (
                  <div className="px-4 pb-3 bg-white">
                    {filledItems.length === 0 ? (
                      <p className="text-xs text-brand-lotus py-2">無品項資料</p>
                    ) : (
                      <div className="border border-gray-100 rounded-lg overflow-hidden">
                        {groupItemsByCategory(items).map((group) => (
                          <div key={group.category}>
                            <div className="px-3 py-1.5 bg-surface-section text-xs font-medium text-brand-lotus">
                              {group.category}
                            </div>
                            {group.items.map((item, idx) => (
                              <div
                                key={item.product_id}
                                className={`flex items-center justify-between px-3 py-2 ${
                                  idx < group.items.length - 1 ? 'border-b border-gray-50' : ''
                                }`}
                              >
                                <span className="text-sm text-brand-oak">{getProductName(item.product_id)}</span>
                                <span className="text-sm font-num text-brand-mocha">
                                  {item.quantity} {getProductUnit(item.product_id)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Extra notes */}
                    {(session.almond_1000 || session.almond_300 || session.bowl_k520 || session.bowl_750) && (
                      <div className="mt-2 text-xs text-brand-lotus space-y-0.5">
                        {(session.almond_1000 || session.almond_300) && (
                          <p>杏仁茶瓶：{session.almond_1000 ? `1000ml ${session.almond_1000}個` : ''}{session.almond_1000 && session.almond_300 ? '、' : ''}{session.almond_300 ? `300ml ${session.almond_300}個` : ''}</p>
                        )}
                        {(session.bowl_k520 || session.bowl_750) && (
                          <p>紙碗：{session.bowl_k520 ? `K520 ${session.bowl_k520}箱` : ''}{session.bowl_k520 && session.bowl_750 ? '、' : ''}{session.bowl_750 ? `750 ${session.bowl_750}箱` : ''}</p>
                        )}
                      </div>
                    )}

                    {session.note && (
                      <div className="mt-2 text-xs text-brand-lotus">
                        備註：{session.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
