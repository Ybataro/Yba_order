import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import {
  parseShelfLifeDays,
  getProductionUrgency,
  getSuggestedProduction,
  urgencyConfig,
  type UrgencyLevel,
} from '@/lib/shelfLife'
import { RefreshCw } from 'lucide-react'

type Tab = 'today' | 'tomorrow' | 'week'

interface ProductScheduleItem {
  id: string
  name: string
  category: string
  unit: string
  kitchenStock: number
  dailyDemand: number
  suggestedQty: number
  urgency: UrgencyLevel
  shelfLifeDays: number
}

function getDateNDaysAgo(n: number): string {
  const d = new Date(getTodayTW() + 'T00:00:00+08:00')
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

/** 取最近的工作日（往前跳過央廚休息日：週三/日） */
function getEffectiveYesterday(): string {
  const d = new Date(getTodayTW() + 'T00:00:00+08:00')
  do {
    d.setDate(d.getDate() - 1)
  } while (d.getDay() === 0 || d.getDay() === 3)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

function getDateNDaysAhead(n: number): string {
  const d = new Date(getTodayTW() + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-')
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`
}

const weekDayNames = ['日', '一', '二', '三', '四', '五', '六']

export default function ProductionSchedule() {
  const [tab, setTab] = useState<Tab>('today')
  const [loading, setLoading] = useState(true)
  const products = useProductStore((s) => s.items)

  const today = getTodayTW()
  const yesterday = getEffectiveYesterday()
  const sevenDaysAgo = getDateNDaysAgo(7)

  // Data states
  const [kitchenStockMap, setKitchenStockMap] = useState<Record<string, number>>({})
  const [orderDemandMap, setOrderDemandMap] = useState<Record<string, number>>({})
  const [todayDemandMap, setTodayDemandMap] = useState<Record<string, number>>({})
  const [dailyOrderMap, setDailyOrderMap] = useState<Record<string, Record<string, number>>>({})

  // Fetch data
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    setLoading(true)
    Promise.all([
      // A. Kitchen product stock (latest session)
      supabase
        .from('product_stock_sessions')
        .select('id, date, product_stock_items(product_id, quantity)')
        .eq('store_id', 'kitchen')
        .order('date', { ascending: false })
        .limit(5),

      // B. Order items (7 days) — demand from all stores
      supabase
        .from('order_items')
        .select('product_id, quantity, order_sessions!inner(date)')
        .gte('order_sessions.date', sevenDaysAgo)
        .lte('order_sessions.date', today),

      // C. Today's demand (yesterday's orders = today's shipment)
      supabase
        .from('order_items')
        .select('product_id, quantity, order_sessions!inner(date)')
        .eq('order_sessions.date', yesterday),
    ]).then(([stockRes, orderRes, todayOrderRes]) => {
      // Kitchen stock
      const stockMap: Record<string, number> = {}
      const sessions = (stockRes.data || []) as Array<{
        id: string
        date: string
        product_stock_items: Array<{ product_id: string; quantity: number }>
      }>
      if (sessions.length > 0) {
        const latestDate = sessions[0].date
        sessions
          .filter((s) => s.date === latestDate)
          .forEach((s) => {
            ;(s.product_stock_items || []).forEach((item) => {
              stockMap[item.product_id] = (stockMap[item.product_id] || 0) + (item.quantity || 0)
            })
          })
      }
      setKitchenStockMap(stockMap)

      // 7-day demand averages
      const demandTotals: Record<string, number> = {}
      const demandDays = new Set<string>()
      const dailyMap: Record<string, Record<string, number>> = {}

      ;(orderRes.data || []).forEach((item: { product_id: string; quantity: number; order_sessions: { date: string }[] }) => {
        const sessionDate = item.order_sessions?.[0]?.date
        if (!sessionDate) return
        demandTotals[item.product_id] = (demandTotals[item.product_id] || 0) + (item.quantity || 0)
        demandDays.add(sessionDate)

        if (!dailyMap[sessionDate]) dailyMap[sessionDate] = {}
        dailyMap[sessionDate][item.product_id] = (dailyMap[sessionDate][item.product_id] || 0) + (item.quantity || 0)
      })

      const days = Math.max(demandDays.size, 1)
      const avgMap: Record<string, number> = {}
      for (const [pid, total] of Object.entries(demandTotals)) {
        avgMap[pid] = Math.round((total / days) * 10) / 10
      }
      setOrderDemandMap(avgMap)
      setDailyOrderMap(dailyMap)

      // Today's specific demand
      const todayMap: Record<string, number> = {}
      ;(todayOrderRes.data || []).forEach((item: { product_id: string; quantity: number }) => {
        todayMap[item.product_id] = (todayMap[item.product_id] || 0) + (item.quantity || 0)
      })
      setTodayDemandMap(todayMap)

      setLoading(false)
    })
  }, [today, yesterday, sevenDaysAgo])

  // Compute schedule items
  const scheduleItems = useMemo((): ProductScheduleItem[] => {
    return products
      .filter((p) => p.visibleIn !== 'inventory_only')
      .map((p) => {
        const kitchenStock = kitchenStockMap[p.id] || 0
        const dailyDemand = tab === 'today' ? (todayDemandMap[p.id] || orderDemandMap[p.id] || 0) : (orderDemandMap[p.id] || 0)
        const shelfLifeDays = parseShelfLifeDays(p.shelfLifeDays)
        const urgency = getProductionUrgency(kitchenStock, dailyDemand, shelfLifeDays)
        const suggestedQty = getSuggestedProduction(dailyDemand, kitchenStock)
        return {
          id: p.id,
          name: p.name,
          category: p.category,
          unit: p.unit,
          kitchenStock,
          dailyDemand,
          suggestedQty,
          urgency,
          shelfLifeDays,
        }
      })
      .filter((item) => item.dailyDemand > 0 || item.kitchenStock > 0)
      .sort((a, b) => {
        const urgencyOrder: Record<UrgencyLevel, number> = { urgent: 0, low: 1, sufficient: 2 }
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      })
  }, [products, kitchenStockMap, orderDemandMap, todayDemandMap, tab])

  // Week view data
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => getDateNDaysAhead(i))
  }, [])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="生產排程建議" backTo="/kitchen" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="生產排程建議" backTo="/kitchen" />

      {/* Tabs */}
      <div className="flex gap-2 px-4 py-2 bg-white border-b border-gray-100">
        {([['today', '今日生產'], ['tomorrow', '明日預估'], ['week', '本週概覽']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
              tab === key ? 'bg-brand-mocha text-white' : 'bg-gray-100 text-brand-lotus'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-brand-lotus">
          <RefreshCw size={16} className="animate-spin" />
          載入中...
        </div>
      ) : tab === 'week' ? (
        /* ===== Week Overview ===== */
        <>
          <SectionHeader title="本週生產概覽" icon="■" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-surface-section text-brand-lotus">
                  <th className="sticky left-0 bg-surface-section text-left px-3 py-2 font-medium min-w-[80px] z-10">品名</th>
                  {weekDates.map((d) => {
                    const dow = new Date(d + 'T00:00:00').getDay()
                    return (
                      <th key={d} className="text-center px-1.5 py-2 font-medium min-w-[50px]">
                        <div>{formatShortDate(d)}</div>
                        <div className="text-[10px] text-gray-400">{weekDayNames[dow]}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {scheduleItems.filter((item) => item.suggestedQty > 0 || item.urgency !== 'sufficient').map((item) => (
                  <tr key={item.id} className="border-b border-gray-50">
                    <td className="sticky left-0 bg-white px-3 py-2 font-medium text-brand-oak z-10">{item.name}</td>
                    {weekDates.map((d) => {
                      const dayDemand = dailyOrderMap[d]?.[item.id] || item.dailyDemand
                      const suggested = Math.max(0, Math.ceil((dayDemand - item.kitchenStock / 7) * 10) / 10)
                      const bg = suggested > item.dailyDemand * 1.5 ? 'bg-red-50 text-red-600'
                        : suggested > 0 ? 'bg-amber-50 text-amber-600'
                        : 'text-gray-300'
                      return (
                        <td key={d} className={`text-center px-1.5 py-2 font-num ${bg}`}>
                          {suggested > 0 ? suggested : '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* ===== Today / Tomorrow list ===== */
        <>
          <SectionHeader title={tab === 'today' ? '今日建議生產' : '明日預估需求'} icon="■" />

          {/* Summary */}
          <div className="bg-white px-4 py-3 border-b border-gray-100">
            <div className="flex gap-4 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                急需 {scheduleItems.filter((i) => i.urgency === 'urgent').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                偏低 {scheduleItems.filter((i) => i.urgency === 'low').length}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                充足 {scheduleItems.filter((i) => i.urgency === 'sufficient').length}
              </span>
            </div>
          </div>

          {/* Column header */}
          <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[50px] text-right">庫存</span>
            <span className="w-[50px] text-right">需求</span>
            <span className="w-[55px] text-right">建議量</span>
            <span className="w-[55px] text-right">狀態</span>
          </div>

          {/* Items */}
          <div className="bg-white divide-y divide-gray-50">
            {scheduleItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-400">無需生產的品項</div>
            ) : (
              scheduleItems.map((item) => {
                const cfg = urgencyConfig[item.urgency]
                return (
                  <div key={item.id} className={`flex items-center px-4 py-2.5 ${item.urgency === 'urgent' ? 'bg-red-50/50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-oak truncate">{item.name}</p>
                      <p className="text-[11px] text-brand-lotus">{item.unit} · 保存 {item.shelfLifeDays || '?'} 天</p>
                    </div>
                    <span className="w-[50px] text-right text-sm font-num text-brand-oak">{item.kitchenStock}</span>
                    <span className="w-[50px] text-right text-sm font-num text-brand-oak">{item.dailyDemand}</span>
                    <span className="w-[55px] text-right text-sm font-num font-semibold text-brand-oak">
                      {item.suggestedQty > 0 ? item.suggestedQty : '-'}
                    </span>
                    <span className={`w-[55px] text-right text-[11px] font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}
