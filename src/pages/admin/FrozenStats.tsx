import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { DateNav } from '@/components/DateNav'
import { WeekNav } from '@/components/WeekNav'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { getWeekDates } from '@/lib/schedule'
import { useStoreStore } from '@/stores/useStoreStore'
import { useFrozenProductStore } from '@/stores/useFrozenProductStore'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ViewMode = 'day' | 'week' | 'month' | 'year'

interface SalesRow {
  product_key: string
  store_id: string
  takeout: number
  delivery: number
}

export default function FrozenStats() {
  const today = getTodayTW()
  const now = new Date()
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedDate, setSelectedDate] = useState(today)
  const [weekRef, setWeekRef] = useState(today)
  const [monthYear, setMonthYear] = useState(now.getFullYear())
  const [monthMonth, setMonthMonth] = useState(now.getMonth() + 1)
  const [yearValue, setYearValue] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [salesData, setSalesData] = useState<SalesRow[]>([])

  const stores = useStoreStore((s) => s.items)
  const FROZEN_PRODUCTS = useFrozenProductStore((s) => s.items)

  // Compute date range based on view mode
  const dateRange = useMemo((): { start: string; end: string } => {
    if (viewMode === 'day') {
      return { start: selectedDate, end: selectedDate }
    }
    if (viewMode === 'week') {
      const weekDates = getWeekDates(weekRef)
      return { start: weekDates[0], end: weekDates[6] }
    }
    if (viewMode === 'month') {
      const firstDay = `${monthYear}-${String(monthMonth).padStart(2, '0')}-01`
      const daysInMonth = new Date(monthYear, monthMonth, 0).getDate()
      const lastDay = `${monthYear}-${String(monthMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      return { start: firstDay, end: lastDay }
    }
    // year
    return { start: `${yearValue}-01-01`, end: `${yearValue}-12-31` }
  }, [viewMode, selectedDate, weekRef, monthYear, monthMonth, yearValue])

  // Load data
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    const load = async () => {
      const { data: rows } = await supabase!
        .from('frozen_sales')
        .select('product_key, store_id, takeout, delivery')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      setSalesData(rows || [])
      setLoading(false)
    }
    load()
  }, [dateRange.start, dateRange.end])

  // Aggregate by product_key + store_id → { takeout, delivery }
  const aggregated = useMemo(() => {
    const map: Record<string, Record<string, { takeout: number; delivery: number }>> = {}
    FROZEN_PRODUCTS.forEach(p => { map[p.key] = {} })

    salesData.forEach(row => {
      if (!map[row.product_key]) map[row.product_key] = {}
      const prev = map[row.product_key][row.store_id] || { takeout: 0, delivery: 0 }
      map[row.product_key][row.store_id] = {
        takeout: prev.takeout + (row.takeout || 0),
        delivery: prev.delivery + (row.delivery || 0),
      }
    })
    return map
  }, [salesData, FROZEN_PRODUCTS])

  // Total per product
  const productTotals = useMemo(() => {
    const totals: Record<string, { takeout: number; delivery: number; total: number }> = {}
    FROZEN_PRODUCTS.forEach(p => {
      const storeData = aggregated[p.key] || {}
      let takeout = 0, delivery = 0
      Object.values(storeData).forEach(v => { takeout += v.takeout; delivery += v.delivery })
      totals[p.key] = { takeout, delivery, total: takeout + delivery }
    })
    return totals
  }, [aggregated, FROZEN_PRODUCTS])

  // Grand totals
  const grandTakeout = Object.values(productTotals).reduce((a, b) => a + b.takeout, 0)
  const grandDelivery = Object.values(productTotals).reduce((a, b) => a + b.delivery, 0)
  const grandTotalQty = grandTakeout + grandDelivery
  const grandTotalAmount = FROZEN_PRODUCTS.reduce((sum, p) => sum + (productTotals[p.key]?.total || 0) * p.price, 0)

  // Store totals
  const storeTotals = useMemo(() => {
    const totals: Record<string, { takeout: number; delivery: number; total: number }> = {}
    stores.forEach(s => {
      let takeout = 0, delivery = 0
      FROZEN_PRODUCTS.forEach(p => {
        const d = aggregated[p.key]?.[s.id]
        if (d) { takeout += d.takeout; delivery += d.delivery }
      })
      totals[s.id] = { takeout, delivery, total: takeout + delivery }
    })
    return totals
  }, [aggregated, stores, FROZEN_PRODUCTS])

  // Month navigation
  const prevMonth = () => {
    if (monthMonth === 1) { setMonthYear(monthYear - 1); setMonthMonth(12) }
    else setMonthMonth(monthMonth - 1)
  }
  const nextMonth = () => {
    if (monthMonth === 12) { setMonthYear(monthYear + 1); setMonthMonth(1) }
    else setMonthMonth(monthMonth + 1)
  }

  // Period label
  const periodLabel = useMemo(() => {
    if (viewMode === 'day') return selectedDate
    if (viewMode === 'week') {
      const weekDates = getWeekDates(weekRef)
      return `${weekDates[0]} ~ ${weekDates[6]}`
    }
    if (viewMode === 'month') return `${monthYear} 年 ${monthMonth} 月`
    return `${yearValue} 年`
  }, [viewMode, selectedDate, weekRef, monthYear, monthMonth, yearValue])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="冷凍品統計" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="冷凍品統計" backTo="/admin" />

      {/* View mode tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100">
        {(['day', 'week', 'month', 'year'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              viewMode === mode
                ? 'bg-brand-oak text-white'
                : 'text-brand-mocha hover:bg-gray-100'
            }`}
          >
            {{ day: '日', week: '週', month: '月', year: '年' }[mode]}
          </button>
        ))}
      </div>

      {/* Date navigation based on mode */}
      {viewMode === 'day' && (
        <DateNav value={selectedDate} onChange={setSelectedDate} />
      )}
      {viewMode === 'week' && (
        <WeekNav refDate={weekRef} onChange={setWeekRef} />
      )}
      {viewMode === 'month' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
          <button onClick={prevMonth} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronLeft size={18} className="text-brand-oak" />
          </button>
          <span className="flex-1 text-center text-sm font-medium text-brand-oak">
            {monthYear} 年 {monthMonth} 月
          </span>
          <button onClick={nextMonth} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronRight size={18} className="text-brand-oak" />
          </button>
        </div>
      )}
      {viewMode === 'year' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
          <button onClick={() => setYearValue(yearValue - 1)} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronLeft size={18} className="text-brand-oak" />
          </button>
          <span className="flex-1 text-center text-sm font-medium text-brand-oak">
            {yearValue} 年
          </span>
          <button onClick={() => setYearValue(yearValue + 1)} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronRight size={18} className="text-brand-oak" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : grandTotalQty === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          {periodLabel} 尚無冷凍品銷售資料
        </div>
      ) : (
        <>
          <SectionHeader title="銷售明細" icon="■" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px]">
              <thead>
                <tr className="bg-surface-section text-xs text-brand-mocha">
                  <th className="px-3 py-2 text-left font-medium">品項</th>
                  <th className="px-1 py-2 text-center font-medium">單價</th>
                  {stores.map(s => (
                    <th key={s.id} className="px-1 py-2 text-center font-medium" colSpan={2}>{s.name}</th>
                  ))}
                  <th className="px-1 py-2 text-right font-medium">合計</th>
                  <th className="px-2 py-2 text-right font-medium">金額</th>
                </tr>
                <tr className="bg-surface-section text-[10px] text-brand-lotus">
                  <th></th>
                  <th></th>
                  {stores.map(s => (
                    <th key={s.id} colSpan={2} className="px-1 pb-1">
                      <div className="flex">
                        <span className="flex-1 text-center">帶</span>
                        <span className="flex-1 text-center">送</span>
                      </div>
                    </th>
                  ))}
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {FROZEN_PRODUCTS.map(product => {
                  const pt = productTotals[product.key] || { takeout: 0, delivery: 0, total: 0 }
                  const amount = pt.total * product.price
                  return (
                    <tr key={product.key} className="border-t border-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-brand-oak">
                        {product.name}
                        <span className="block text-[10px] text-brand-lotus font-normal">{product.spec}</span>
                      </td>
                      <td className="px-1 py-2 text-xs text-center text-brand-mocha">${product.price}</td>
                      {stores.map(s => {
                        const d = aggregated[product.key]?.[s.id] || { takeout: 0, delivery: 0 }
                        return (
                          <td key={s.id} colSpan={2} className="px-1 py-2">
                            <div className="flex text-sm text-brand-oak">
                              <span className="flex-1 text-center">{d.takeout || '-'}</span>
                              <span className="flex-1 text-center">{d.delivery || '-'}</span>
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-1 py-2 text-sm text-right font-semibold text-brand-oak">{pt.total}</td>
                      <td className="px-2 py-2 text-sm text-right font-medium text-brand-oak">${amount.toLocaleString()}</td>
                    </tr>
                  )
                })}
                {/* Grand total row */}
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-brand-mocha">合計</td>
                  {stores.map(s => {
                    const st = storeTotals[s.id] || { takeout: 0, delivery: 0, total: 0 }
                    return (
                      <td key={s.id} colSpan={2} className="px-1 py-2">
                        <div className="flex text-sm font-semibold text-brand-oak">
                          <span className="flex-1 text-center">{st.takeout}</span>
                          <span className="flex-1 text-center">{st.delivery}</span>
                        </div>
                      </td>
                    )
                  })}
                  <td className="px-1 py-2 text-sm text-right font-bold text-brand-oak">{grandTotalQty}</td>
                  <td className="px-2 py-2 text-sm text-right font-bold text-brand-oak">${grandTotalAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary card */}
          <div className="mx-4 mt-4 mb-6 card !p-4">
            <h3 className="text-sm font-semibold text-brand-oak mb-2">統計摘要</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-brand-lotus">{grandTakeout}</p>
                <p className="text-[11px] text-brand-mocha">外帶</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">{grandDelivery}</p>
                <p className="text-[11px] text-brand-mocha">外送</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">{grandTotalQty}</p>
                <p className="text-[11px] text-brand-mocha">總數量</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">${grandTotalAmount.toLocaleString()}</p>
                <p className="text-[11px] text-brand-mocha">總金額</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
