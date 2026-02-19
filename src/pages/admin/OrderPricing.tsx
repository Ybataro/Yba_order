import { useState, useEffect, useMemo, Fragment } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'

type DateRange = 'week' | 'month' | 'custom'

interface OrderSession {
  id: string
  store_id: string
  date: string
  order_items: { product_id: string; quantity: number }[]
}

interface SettlementSession {
  id: string
  store_id: string
  date: string
  settlement_values: { field_id: string; value: string }[]
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

function getFirstOfMonth(dateStr: string): string {
  return dateStr.slice(0, 8) + '01'
}

/** Generate array of YYYY-MM-DD from start to end */
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  while (d <= endD) {
    dates.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return dates
}

export default function OrderPricing() {
  const stores = useStoreStore((s) => s.items)
  const products = useProductStore((s) => s.items)
  const categories = useProductStore((s) => s.categories)

  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [orderSessions, setOrderSessions] = useState<OrderSession[]>([])
  const [settlementSessions, setSettlementSessions] = useState<SettlementSession[]>([])
  const [loading, setLoading] = useState(false)

  const today = getTodayTW()

  const { startDate, endDate } = useMemo(() => {
    switch (dateRange) {
      case 'week':
        return { startDate: getMonday(today), endDate: today }
      case 'month':
        return { startDate: getFirstOfMonth(today), endDate: today }
      case 'custom':
        return { startDate: customStart || today, endDate: customEnd || today }
    }
  }, [dateRange, today, customStart, customEnd])

  const dates = useMemo(() => getDateRange(startDate, endDate), [startDate, endDate])

  // Fetch
  useEffect(() => {
    if (!supabase) return
    setLoading(true)

    const orderQuery = (() => {
      let q = supabase
        .from('order_sessions')
        .select('*, order_items(*)')
        .gte('date', startDate)
        .lte('date', endDate)
      if (storeFilter !== 'all') q = q.eq('store_id', storeFilter)
      return q
    })()

    const settlementQuery = (() => {
      let q = supabase
        .from('settlement_sessions')
        .select('*, settlement_values(*)')
        .gte('date', startDate)
        .lte('date', endDate)
      if (storeFilter !== 'all') q = q.eq('store_id', storeFilter)
      return q
    })()

    Promise.all([orderQuery, settlementQuery]).then(([orderRes, settlementRes]) => {
      setOrderSessions(orderRes.data || [])
      setSettlementSessions(settlementRes.data || [])
      setLoading(false)
    })
  }, [startDate, endDate, storeFilter])

  // Build product × date matrix
  const { matrix, productTotals, grandTotal } = useMemo(() => {
    // matrix[productId][date] = quantity
    const matrix: Record<string, Record<string, number>> = {}
    const productTotals: Record<string, number> = {}

    orderSessions.forEach((s) => {
      (s.order_items || []).forEach((item) => {
        if (item.quantity <= 0) return
        if (!matrix[item.product_id]) matrix[item.product_id] = {}
        matrix[item.product_id][s.date] = (matrix[item.product_id][s.date] || 0) + item.quantity
        productTotals[item.product_id] = (productTotals[item.product_id] || 0) + item.quantity
      })
    })

    // Date totals for pricing
    const dateTotals: Record<string, { ourCost: number; franchiseCost: number }> = {}
    dates.forEach((d) => {
      let ourCost = 0
      let franchiseCost = 0
      Object.entries(matrix).forEach(([pid, dateMap]) => {
        const qty = dateMap[d] || 0
        const prod = products.find((p) => p.id === pid)
        ourCost += qty * (prod?.ourCost || 0)
        franchiseCost += qty * (prod?.franchisePrice || 0)
      })
      dateTotals[d] = { ourCost, franchiseCost }
    })

    let grandOurCost = 0
    let grandFranchiseCost = 0
    Object.values(dateTotals).forEach((v) => {
      grandOurCost += v.ourCost
      grandFranchiseCost += v.franchiseCost
    })

    return {
      matrix,
      productTotals,
      dateTotals,
      grandTotal: { ourCost: grandOurCost, franchiseCost: grandFranchiseCost },
    }
  }, [orderSessions, dates, products])

  // Settlement summary by date
  const settlementByDate = useMemo(() => {
    const map: Record<string, { posTotal: number; orderCount: number }> = {}
    settlementSessions.forEach((s) => {
      const vals = s.settlement_values || []
      const posTotal = parseFloat(vals.find((v) => v.field_id === 'posTotal')?.value || '') || 0
      const orderCount = parseFloat(vals.find((v) => v.field_id === 'orderCount')?.value || '') || 0
      if (!map[s.date]) map[s.date] = { posTotal: 0, orderCount: 0 }
      map[s.date].posTotal += posTotal
      map[s.date].orderCount += orderCount
    })
    return map
  }, [settlementSessions])

  const totalSettlement = useMemo(() => {
    let posTotal = 0
    let orderCount = 0
    Object.values(settlementByDate).forEach((v) => {
      posTotal += v.posTotal
      orderCount += v.orderCount
    })
    return { posTotal, orderCount }
  }, [settlementByDate])

  // Active products (only those with orders)
  const activeProductIds = Object.keys(productTotals)

  const formatShortDate = (d: string) => {
    const [, m, day] = d.split('-')
    return `${parseInt(m)}/${parseInt(day)}`
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="叫貨價格統計" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無歷史資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="叫貨價格統計" backTo="/admin" />

      {/* Filters */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          {([['week', '本週'], ['month', '本月'], ['custom', '自訂']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                dateRange === key
                  ? 'bg-brand-mocha text-white'
                  : 'bg-gray-100 text-brand-lotus'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
            />
            <span className="text-xs text-brand-lotus">～</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-lotus shrink-0">門店：</span>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none"
          >
            <option value="all">全部（加總各店）</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : activeProductIds.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          此期間無叫貨紀錄
        </div>
      ) : (
        <>
          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[600px]">
              {/* Header */}
              <thead>
                <tr className="bg-surface-section text-brand-lotus">
                  <th className="sticky left-0 bg-surface-section text-left px-3 py-2 font-medium min-w-[100px] z-10">品名</th>
                  {dates.map((d) => (
                    <th key={d} className="text-center px-1.5 py-2 font-medium min-w-[40px]">{formatShortDate(d)}</th>
                  ))}
                  <th className="text-center px-2 py-2 font-semibold text-brand-oak min-w-[45px]">總數</th>
                  <th className="text-center px-2 py-2 font-medium min-w-[55px]">我們價</th>
                  <th className="text-center px-2 py-2 font-semibold text-brand-oak min-w-[60px]">我們總價</th>
                  <th className="text-center px-2 py-2 font-medium min-w-[55px]">加盟價</th>
                  <th className="text-center px-2 py-2 font-semibold text-brand-oak min-w-[60px]">加盟總價</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => {
                  const catProducts = products.filter(
                    (p) => p.category === cat && activeProductIds.includes(p.id)
                  )
                  if (catProducts.length === 0) return null
                  return (
                    <Fragment key={cat}>
                      <tr>
                        <td
                          colSpan={dates.length + 6}
                          className="sticky left-0 bg-brand-camel/10 px-3 py-1.5 text-xs font-semibold text-brand-mocha"
                        >
                          {cat}
                        </td>
                      </tr>
                      {catProducts.map((prod) => {
                        const dateMap = matrix[prod.id] || {}
                        const total = productTotals[prod.id] || 0
                        const ourPrice = prod.ourCost || 0
                        const franPrice = prod.franchisePrice || 0
                        return (
                          <tr key={prod.id} className="border-b border-gray-50 bg-white">
                            <td className="sticky left-0 bg-white px-3 py-1.5 text-sm text-brand-oak truncate max-w-[120px] z-10">
                              {prod.name}
                            </td>
                            {dates.map((d) => {
                              const qty = dateMap[d] || 0
                              return (
                                <td key={d} className="text-center py-1.5 font-num text-brand-oak">
                                  {qty > 0 ? qty : <span className="text-gray-300">-</span>}
                                </td>
                              )
                            })}
                            <td className="text-center py-1.5 font-num font-semibold text-brand-oak">{total}</td>
                            <td className="text-center py-1.5 font-num text-brand-lotus">
                              {ourPrice > 0 ? ourPrice : '-'}
                            </td>
                            <td className="text-center py-1.5 font-num font-semibold text-brand-oak">
                              {ourPrice > 0 ? formatCurrency(total * ourPrice) : '-'}
                            </td>
                            <td className="text-center py-1.5 font-num text-brand-lotus">
                              {franPrice > 0 ? franPrice : '-'}
                            </td>
                            <td className="text-center py-1.5 font-num font-semibold text-brand-oak">
                              {franPrice > 0 ? formatCurrency(total * franPrice) : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary section */}
          <SectionHeader title="摘要" icon="■" />
          <div className="bg-white">
            {/* Revenue row per date */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[600px]">
                <tbody>
                  {/* 營業額 row */}
                  <tr className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2 text-sm font-semibold text-brand-oak min-w-[100px] z-10">營業額</td>
                    {dates.map((d) => {
                      const s = settlementByDate[d]
                      return (
                        <td key={d} className="text-center py-2 font-num text-brand-oak min-w-[40px]">
                          {s ? formatCurrency(s.posTotal) : '-'}
                        </td>
                      )
                    })}
                    <td className="text-center py-2 font-num font-semibold text-brand-oak min-w-[45px]">
                      {formatCurrency(totalSettlement.posTotal)}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                  {/* 號數 */}
                  <tr className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2 text-sm font-semibold text-brand-oak z-10">號數</td>
                    {dates.map((d) => {
                      const s = settlementByDate[d]
                      return (
                        <td key={d} className="text-center py-2 font-num text-brand-oak">
                          {s ? s.orderCount : '-'}
                        </td>
                      )
                    })}
                    <td className="text-center py-2 font-num font-semibold text-brand-oak">
                      {totalSettlement.orderCount}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                  {/* 客單價 */}
                  <tr className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2 text-sm font-semibold text-brand-oak z-10">客單價</td>
                    {dates.map((d) => {
                      const s = settlementByDate[d]
                      const avg = s && s.orderCount > 0 ? Math.round(s.posTotal / s.orderCount) : 0
                      return (
                        <td key={d} className="text-center py-2 font-num text-brand-oak">
                          {avg > 0 ? avg : '-'}
                        </td>
                      )
                    })}
                    <td className="text-center py-2 font-num font-semibold text-brand-oak">
                      {totalSettlement.orderCount > 0
                        ? Math.round(totalSettlement.posTotal / totalSettlement.orderCount)
                        : '-'}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Cost summary cards */}
            <div className="grid grid-cols-2 gap-px bg-gray-100 mt-px">
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">我們成本合計</p>
                <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(grandTotal.ourCost)}</p>
                {totalSettlement.posTotal > 0 && (
                  <p className="text-xs text-brand-lotus mt-0.5">
                    成本% {(grandTotal.ourCost / totalSettlement.posTotal * 100).toFixed(1)}%
                  </p>
                )}
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">加盟成本合計</p>
                <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(grandTotal.franchiseCost)}</p>
                {totalSettlement.posTotal > 0 && (
                  <p className="text-xs text-brand-lotus mt-0.5">
                    成本% {(grandTotal.franchiseCost / totalSettlement.posTotal * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
