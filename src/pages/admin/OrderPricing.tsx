import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { NumericInput } from '@/components/NumericInput'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportExcel'

type DateRange = 'today' | 'week' | 'month' | 'custom'

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

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return toLocalDateStr(d)
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
    dates.push(toLocalDateStr(d))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

export default function OrderPricing() {
  const stores = useStoreStore((s) => s.items)
  const allProducts = useProductStore((s) => s.items)
  const products = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const categories = useProductStore((s) => s.categories)
  const updateProduct = useProductStore((s) => s.update)

  // Local editable price state — keyed by product id
  const [editPrices, setEditPrices] = useState<Record<string, { ourCost?: string; franchisePrice?: string }>>({})

  const getPriceValue = useCallback((pid: string, field: 'ourCost' | 'franchisePrice', prodValue: number) => {
    const editing = editPrices[pid]?.[field]
    if (editing !== undefined) return editing
    return prodValue > 0 ? String(prodValue) : ''
  }, [editPrices])

  const handlePriceChange = useCallback((pid: string, field: 'ourCost' | 'franchisePrice', value: string) => {
    setEditPrices((prev) => ({
      ...prev,
      [pid]: { ...prev[pid], [field]: value },
    }))
  }, [])

  const handlePriceBlur = useCallback((pid: string, field: 'ourCost' | 'franchisePrice') => {
    const raw = editPrices[pid]?.[field]
    if (raw === undefined) return
    const num = parseFloat(raw) || 0
    updateProduct(pid, { [field]: num })
    setEditPrices((prev) => {
      const next = { ...prev }
      if (next[pid]) {
        delete next[pid][field]
        if (Object.keys(next[pid]).length === 0) delete next[pid]
      }
      return next
    })
  }, [editPrices, updateProduct])

  const [dateRange, setDateRange] = useState<DateRange>('week')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [orderSessions, setOrderSessions] = useState<OrderSession[]>([])
  const [settlementSessions, setSettlementSessions] = useState<SettlementSession[]>([])
  const [loading, setLoading] = useState(false)

  const today = getTodayTW()
  const currentYear = today.slice(0, 4)

  // Yearly cost section
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [yearlyOrders, setYearlyOrders] = useState<OrderSession[]>([])
  const [yearlyLoading, setYearlyLoading] = useState(false)

  const { startDate, endDate } = useMemo(() => {
    switch (dateRange) {
      case 'today':
        return { startDate: today, endDate: today }
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

  // Fetch yearly data
  useEffect(() => {
    if (!supabase) return
    setYearlyLoading(true)
    const yearStart = `${selectedYear}-01-01`
    const yearEnd = `${selectedYear}-12-31`
    let q = supabase
      .from('order_sessions')
      .select('*, order_items(*)')
      .gte('date', yearStart)
      .lte('date', yearEnd)
    if (storeFilter !== 'all') q = q.eq('store_id', storeFilter)
    q.then((res) => {
      setYearlyOrders(res.data || [])
      setYearlyLoading(false)
    })
  }, [selectedYear, storeFilter])

  // Monthly cost breakdown
  const monthlyCosts = useMemo(() => {
    const currentMonth = selectedYear === currentYear ? parseInt(today.slice(5, 7)) : 12
    const months: { month: number; ourCost: number; franchiseCost: number }[] = []
    for (let m = 1; m <= currentMonth; m++) {
      let ourCost = 0
      let franchiseCost = 0
      const mm = String(m).padStart(2, '0')
      yearlyOrders.forEach((s) => {
        if (s.date.slice(5, 7) !== mm) return
        ;(s.order_items || []).forEach((item) => {
          if (item.quantity <= 0) return
          const prod = products.find((p) => p.id === item.product_id)
          ourCost += item.quantity * (prod?.ourCost || 0)
          franchiseCost += item.quantity * (prod?.franchisePrice || 0)
        })
      })
      months.push({ month: m, ourCost, franchiseCost })
    }
    return months
  }, [yearlyOrders, products, selectedYear, currentYear, today])

  const yearlyTotal = useMemo(() => {
    let ourCost = 0
    let franchiseCost = 0
    monthlyCosts.forEach((m) => {
      ourCost += m.ourCost
      franchiseCost += m.franchiseCost
    })
    return { ourCost, franchiseCost }
  }, [monthlyCosts])

  const yearlyMax = useMemo(() => {
    let max = 0
    monthlyCosts.forEach((m) => {
      if (m.ourCost > max) max = m.ourCost
      if (m.franchiseCost > max) max = m.franchiseCost
    })
    return max
  }, [monthlyCosts])

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
          {([['today', '本日'], ['week', '本週'], ['month', '本月'], ['custom', '自訂']] as const).map(([key, label]) => (
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
      ) : (
        <>
          <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100">
            <button
              onClick={() => {
                const rows = products.map(prod => {
                  const dateMap = matrix[prod.id] || {}
                  const total = productTotals[prod.id] || 0
                  const row: Record<string, unknown> = {
                    '分類': prod.category,
                    '品名': prod.name,
                  }
                  dates.forEach(d => { row[formatShortDate(d)] = dateMap[d] || 0 })
                  row['總數'] = total
                  row['我們價'] = prod.ourCost || 0
                  row['我們總價'] = total * (prod.ourCost || 0)
                  row['加盟價'] = prod.franchisePrice || 0
                  row['加盟總價'] = total * (prod.franchisePrice || 0)
                  return row
                })
                exportToExcel({
                  data: rows,
                  fileName: `叫貨價格統計_${startDate}_${endDate}.xlsx`,
                  sheetName: '價格統計',
                })
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
            >
              <Download size={14} />
              匯出 Excel
            </button>
          </div>
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
                  const catProducts = products.filter((p) => p.category === cat)
                  if (catProducts.length === 0) return null
                  return (
                    <Fragment key={cat}>
                      <tr>
                        <td className="sticky left-0 bg-brand-camel/10 px-3 py-1.5 text-xs font-semibold text-brand-mocha z-10">
                          {cat}
                        </td>
                        <td colSpan={dates.length + 5} className="bg-brand-camel/10" />
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
                            <td className="text-center py-0.5 px-0.5">
                              <NumericInput
                                value={getPriceValue(prod.id, 'ourCost', ourPrice)}
                                onChange={(v) => handlePriceChange(prod.id, 'ourCost', v)}
                                onBlur={() => handlePriceBlur(prod.id, 'ourCost')}
                                isFilled
                                className="!w-[52px] !h-7 !text-xs"
                              />
                            </td>
                            <td className="text-center py-1.5 font-num font-semibold text-brand-oak">
                              {formatCurrency(total * ourPrice)}
                            </td>
                            <td className="text-center py-0.5 px-0.5">
                              <NumericInput
                                value={getPriceValue(prod.id, 'franchisePrice', franPrice)}
                                onChange={(v) => handlePriceChange(prod.id, 'franchisePrice', v)}
                                onBlur={() => handlePriceBlur(prod.id, 'franchisePrice')}
                                isFilled
                                className="!w-[52px] !h-7 !text-xs"
                              />
                            </td>
                            <td className="text-center py-1.5 font-num font-semibold text-brand-oak">
                              {formatCurrency(total * franPrice)}
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

          {/* Yearly cost section */}
          <SectionHeader title="年度成本統計" icon="■" />
          <div className="bg-white">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
              <span className="text-xs text-brand-lotus shrink-0">年度：</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none"
              >
                {Array.from({ length: parseInt(currentYear) - 2024 }, (_, i) => String(2025 + i)).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {yearlyLoading ? (
              <div className="flex items-center justify-center py-10 text-sm text-brand-lotus">載入中...</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {monthlyCosts.map((m) => (
                  <div key={m.month} className="px-4 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-brand-oak w-10">{m.month}月</span>
                      <div className="flex gap-4 text-xs font-num">
                        <span className="text-brand-mocha">{formatCurrency(m.ourCost)}</span>
                        <span className="text-brand-lotus">{formatCurrency(m.franchiseCost)}</span>
                      </div>
                    </div>
                    {yearlyMax > 0 && (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-brand-mocha w-10 shrink-0">我們</span>
                          <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-mocha/60 rounded-full transition-all"
                              style={{ width: `${yearlyMax > 0 ? (m.ourCost / yearlyMax) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-brand-lotus w-10 shrink-0">加盟</span>
                          <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-camel/60 rounded-full transition-all"
                              style={{ width: `${yearlyMax > 0 ? (m.franchiseCost / yearlyMax) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Yearly total */}
                <div className="grid grid-cols-2 gap-px bg-gray-100">
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">年度我們成本</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(yearlyTotal.ourCost)}</p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">年度加盟成本</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(yearlyTotal.franchiseCost)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
