import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { Download, Sun, Cloud, CloudRain, CloudSun, Info } from 'lucide-react'
import { exportToExcel } from '@/lib/exportExcel'
import type { WeatherCondition } from '@/lib/weather'

// ── Types ──

type DateRange = 'week' | 'month' | '3month' | 'custom'

interface WeatherRecord {
  id: string
  date: string
  condition: WeatherCondition
  condition_text: string
  temp_high: number
  temp_low: number
  rain_prob: number
  humidity: number
}

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

// ── Helpers ──

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

function getDateNDaysAgo(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - n)
  return toLocalDateStr(d)
}

function formatShortDate(d: string) {
  const [, m, day] = d.split('-')
  return `${parseInt(m)}/${parseInt(day)}`
}

function getWeekday(dateStr: string): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr + 'T00:00:00')
  return days[d.getDay()]
}

const conditionIcon = (c: WeatherCondition, size = 16) => {
  switch (c) {
    case 'sunny': return <Sun size={size} className="text-amber-500" />
    case 'cloudy': return <Cloud size={size} className="text-gray-400" />
    case 'partly_cloudy': return <CloudSun size={size} className="text-amber-400" />
    case 'rainy': return <CloudRain size={size} className="text-blue-400" />
  }
}

const conditionLabel = (c: WeatherCondition) => {
  switch (c) {
    case 'sunny': return '晴天'
    case 'cloudy': return '陰天'
    case 'partly_cloudy': return '多雲'
    case 'rainy': return '雨天'
  }
}

const conditionColor = (c: WeatherCondition) => {
  switch (c) {
    case 'sunny': return '#f59e0b'
    case 'cloudy': return '#9ca3af'
    case 'partly_cloudy': return '#fbbf24'
    case 'rainy': return '#60a5fa'
  }
}

// ── Component ──

export default function WeatherAnalysis() {
  const stores = useStoreStore((s) => s.items)
  const products = useProductStore((s) => s.items)
  const categories = useProductStore((s) => s.categories)

  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [weatherRecords, setWeatherRecords] = useState<WeatherRecord[]>([])
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
      case '3month':
        return { startDate: getDateNDaysAgo(today, 90), endDate: today }
      case 'custom':
        return { startDate: customStart || today, endDate: customEnd || today }
    }
  }, [dateRange, today, customStart, customEnd])

  // Fetch data
  useEffect(() => {
    if (!supabase) return
    setLoading(true)

    const weatherQuery = supabase
      .from('weather_records')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')

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

    Promise.all([weatherQuery, orderQuery, settlementQuery]).then(([wRes, oRes, sRes]) => {
      setWeatherRecords(wRes.data || [])
      setOrderSessions(oRes.data || [])
      setSettlementSessions(sRes.data || [])
      setLoading(false)
    })
  }, [startDate, endDate, storeFilter])

  // ── Computed data ──

  // Weather map by date
  const weatherByDate = useMemo(() => {
    const map: Record<string, WeatherRecord> = {}
    weatherRecords.forEach((w) => { map[w.date] = w })
    return map
  }, [weatherRecords])

  // Settlement by date
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

  // Order quantity by date per category
  const orderByDate = useMemo(() => {
    const map: Record<string, Record<string, number>> = {} // date -> category -> qty
    orderSessions.forEach((s) => {
      if (!map[s.date]) map[s.date] = {}
      ;(s.order_items || []).forEach((item) => {
        if (item.quantity <= 0) return
        const prod = products.find((p) => p.id === item.product_id)
        const cat = prod?.category || '其他'
        map[s.date][cat] = (map[s.date][cat] || 0) + item.quantity
      })
    })
    return map
  }, [orderSessions, products])

  // Dates with weather data (for calendar)
  const calendarDates = useMemo(() => {
    const dates: string[] = []
    const d = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')
    while (d <= endD) {
      dates.push(toLocalDateStr(d))
      d.setDate(d.getDate() + 1)
    }
    return dates
  }, [startDate, endDate])

  // ── Section B: Weather vs Revenue cards ──
  const weatherRevenueStats = useMemo(() => {
    const byCondition: Record<string, { totalRevenue: number; days: number }> = {}
    const byTemp: { hot: { total: number; days: number }; cold: { total: number; days: number } } = {
      hot: { total: 0, days: 0 },
      cold: { total: 0, days: 0 },
    }

    weatherRecords.forEach((w) => {
      const s = settlementByDate[w.date]
      if (!s) return

      // By condition
      if (!byCondition[w.condition]) byCondition[w.condition] = { totalRevenue: 0, days: 0 }
      byCondition[w.condition].totalRevenue += s.posTotal
      byCondition[w.condition].days += 1

      // By temp
      if (w.temp_high >= 30) {
        byTemp.hot.total += s.posTotal
        byTemp.hot.days += 1
      }
      if (w.temp_low <= 18) {
        byTemp.cold.total += s.posTotal
        byTemp.cold.days += 1
      }
    })

    const sunnyAvg = byCondition['sunny']?.days ? byCondition['sunny'].totalRevenue / byCondition['sunny'].days : 0
    const rainyAvg = byCondition['rainy']?.days ? byCondition['rainy'].totalRevenue / byCondition['rainy'].days : 0
    const hotAvg = byTemp.hot.days ? byTemp.hot.total / byTemp.hot.days : 0
    const coldAvg = byTemp.cold.days ? byTemp.cold.total / byTemp.cold.days : 0

    return {
      sunny: { avg: sunnyAvg, days: byCondition['sunny']?.days || 0 },
      rainy: { avg: rainyAvg, days: byCondition['rainy']?.days || 0 },
      hot: { avg: hotAvg, days: byTemp.hot.days },
      cold: { avg: coldAvg, days: byTemp.cold.days },
      sunnyVsRainyDiff: sunnyAvg && rainyAvg ? ((sunnyAvg - rainyAvg) / sunnyAvg) * 100 : null,
      hotVsColdDiff: hotAvg && coldAvg ? ((hotAvg - coldAvg) / hotAvg) * 100 : null,
    }
  }, [weatherRecords, settlementByDate])

  // ── Section C: Category usage by weather ──
  const categoryByWeather = useMemo(() => {
    // category -> condition -> { totalQty, days }
    const map: Record<string, Record<string, { totalQty: number; days: Set<string> }>> = {}

    weatherRecords.forEach((w) => {
      const dateOrders = orderByDate[w.date]
      if (!dateOrders) return

      Object.entries(dateOrders).forEach(([cat, qty]) => {
        if (!map[cat]) map[cat] = {}
        if (!map[cat][w.condition]) map[cat][w.condition] = { totalQty: 0, days: new Set() }
        map[cat][w.condition].totalQty += qty
        map[cat][w.condition].days.add(w.date)
      })
    })

    // Convert to avg
    const result: Record<string, Record<string, number>> = {}
    Object.entries(map).forEach(([cat, condMap]) => {
      result[cat] = {}
      Object.entries(condMap).forEach(([cond, data]) => {
        result[cat][cond] = data.days.size > 0 ? Math.round(data.totalQty / data.days.size) : 0
      })
    })
    return result
  }, [weatherRecords, orderByDate])

  const categoryBarMax = useMemo(() => {
    let max = 0
    Object.values(categoryByWeather).forEach((condMap) => {
      Object.values(condMap).forEach((v) => { if (v > max) max = v })
    })
    return max
  }, [categoryByWeather])

  // ── Section D: Temperature scatter data ──
  const scatterData = useMemo(() => {
    return weatherRecords
      .filter((w) => settlementByDate[w.date])
      .map((w) => ({
        date: w.date,
        temp: Math.round((w.temp_high + w.temp_low) / 2),
        revenue: settlementByDate[w.date].posTotal,
        condition: w.condition,
      }))
  }, [weatherRecords, settlementByDate])

  const scatterBounds = useMemo(() => {
    if (scatterData.length === 0) return { minTemp: 10, maxTemp: 40, minRev: 0, maxRev: 10000 }
    const temps = scatterData.map((d) => d.temp)
    const revs = scatterData.map((d) => d.revenue)
    return {
      minTemp: Math.min(...temps) - 2,
      maxTemp: Math.max(...temps) + 2,
      minRev: 0,
      maxRev: Math.max(...revs) * 1.1,
    }
  }, [scatterData])

  // ── Section E: Insight summary ──
  const insights = useMemo(() => {
    const texts: string[] = []
    const { sunny, rainy, hot, cold, sunnyVsRainyDiff, hotVsColdDiff } = weatherRevenueStats

    if (sunnyVsRainyDiff !== null && sunny.days >= 2 && rainy.days >= 2) {
      if (sunnyVsRainyDiff > 0) {
        texts.push(`雨天日均營業額比晴天低 ${Math.abs(sunnyVsRainyDiff).toFixed(0)}%（晴天 ${formatCurrency(sunny.avg)} vs 雨天 ${formatCurrency(rainy.avg)}）`)
      } else {
        texts.push(`雨天日均營業額比晴天高 ${Math.abs(sunnyVsRainyDiff).toFixed(0)}%（雨天 ${formatCurrency(rainy.avg)} vs 晴天 ${formatCurrency(sunny.avg)}）`)
      }
    }

    if (hotVsColdDiff !== null && hot.days >= 2 && cold.days >= 2) {
      if (hotVsColdDiff > 0) {
        texts.push(`高溫日(≥30°C)日均營業額比低溫日(≤18°C)高 ${Math.abs(hotVsColdDiff).toFixed(0)}%`)
      } else {
        texts.push(`低溫日(≤18°C)日均營業額比高溫日(≥30°C)高 ${Math.abs(hotVsColdDiff).toFixed(0)}%`)
      }
    }

    // Check ice/hot category trends
    const iceCategories = categories.filter((c) => c.includes('冰') || c.includes('冷'))
    const hotCategories = categories.filter((c) => c.includes('熱') || c.includes('湯'))

    iceCategories.forEach((cat) => {
      const data = categoryByWeather[cat]
      if (!data) return
      const sunnyAvg = data['sunny'] || 0
      const rainyAvg = data['rainy'] || 0
      if (sunnyAvg > 0 && rainyAvg > 0 && sunnyAvg > rainyAvg * 1.2) {
        texts.push(`「${cat}」在晴天叫貨量比雨天多 ${Math.round(((sunnyAvg - rainyAvg) / rainyAvg) * 100)}%`)
      }
    })

    hotCategories.forEach((cat) => {
      const data = categoryByWeather[cat]
      if (!data) return
      const sunnyAvg = data['sunny'] || 0
      const rainyAvg = data['rainy'] || 0
      if (rainyAvg > 0 && sunnyAvg > 0 && rainyAvg > sunnyAvg * 1.2) {
        texts.push(`「${cat}」在雨天叫貨量比晴天多 ${Math.round(((rainyAvg - sunnyAvg) / sunnyAvg) * 100)}%`)
      }
    })

    if (texts.length === 0) {
      texts.push('累積更多天氣資料後將自動生成分析建議')
    }

    return texts
  }, [weatherRevenueStats, categoryByWeather, categories])

  // ── Excel export ──
  const handleExport = () => {
    const rows = calendarDates.map((date) => {
      const w = weatherByDate[date]
      const s = settlementByDate[date]
      const o = orderByDate[date]
      const row: Record<string, unknown> = {
        '日期': date,
        '天氣': w ? w.condition_text : '-',
        '最高溫': w ? w.temp_high : '-',
        '最低溫': w ? w.temp_low : '-',
        '降雨%': w ? w.rain_prob : '-',
        '濕度%': w ? w.humidity : '-',
        '營業額': s ? s.posTotal : 0,
        '號數': s ? s.orderCount : 0,
      }
      categories.forEach((cat) => {
        row[`叫貨_${cat}`] = o?.[cat] || 0
      })
      return row
    })
    exportToExcel({
      data: rows,
      fileName: `天氣用量分析_${startDate}_${endDate}.xlsx`,
      sheetName: '天氣分析',
    })
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="天氣用量分析" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無歷史資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="天氣用量分析" backTo="/admin" />

      {/* Filters */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          {([['week', '本週'], ['month', '本月'], ['3month', '近三月'], ['custom', '自訂']] as const).map(([key, label]) => (
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

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* Data insufficient notice */}
          {weatherRecords.length < 7 && (
            <div className="mx-4 mt-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                目前天氣記錄僅 {weatherRecords.length} 天，建議累積 14 天以上再參考分析結果
              </p>
            </div>
          )}

          {/* Export button */}
          <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
            >
              <Download size={14} />
              匯出 Excel
            </button>
          </div>

          {/* A. Weather Calendar */}
          <SectionHeader title="天氣日曆總覽" icon="■" />
          <div className="bg-white overflow-x-auto">
            <div className="flex min-w-max px-2 py-3 gap-1">
              {calendarDates.map((date) => {
                const w = weatherByDate[date]
                const s = settlementByDate[date]
                return (
                  <div
                    key={date}
                    className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg bg-surface-section min-w-[56px]"
                  >
                    <span className="text-[10px] text-brand-lotus">{formatShortDate(date)}</span>
                    <span className="text-[10px] text-brand-lotus">{getWeekday(date)}</span>
                    {w ? (
                      <>
                        {conditionIcon(w.condition, 18)}
                        <span className="text-[10px] text-brand-oak font-num">
                          {w.temp_low}~{w.temp_high}°
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300 py-1">無資料</span>
                    )}
                    {s ? (
                      <>
                        <span className="text-[10px] font-semibold text-brand-oak font-num">
                          {s.posTotal >= 1000 ? `${(s.posTotal / 1000).toFixed(1)}k` : s.posTotal}
                        </span>
                        <span className="text-[9px] text-brand-lotus font-num">{s.orderCount}號</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-gray-300">-</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* B. Weather vs Revenue Cards */}
          <SectionHeader title="天氣 vs 營業額" icon="■" />
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            {/* Sunny vs Rainy */}
            <div className="bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sun size={14} className="text-amber-500" />
                <span className="text-xs text-brand-lotus">晴天日均</span>
              </div>
              <p className="text-lg font-bold text-brand-oak font-num">
                {weatherRevenueStats.sunny.days > 0 ? formatCurrency(weatherRevenueStats.sunny.avg) : '-'}
              </p>
              <p className="text-[10px] text-brand-lotus">{weatherRevenueStats.sunny.days} 天</p>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CloudRain size={14} className="text-blue-400" />
                <span className="text-xs text-brand-lotus">雨天日均</span>
              </div>
              <p className="text-lg font-bold text-brand-oak font-num">
                {weatherRevenueStats.rainy.days > 0 ? formatCurrency(weatherRevenueStats.rainy.avg) : '-'}
              </p>
              <p className="text-[10px] text-brand-lotus">
                {weatherRevenueStats.rainy.days} 天
                {weatherRevenueStats.sunnyVsRainyDiff !== null && (
                  <span className={weatherRevenueStats.sunnyVsRainyDiff > 0 ? ' text-red-500' : ' text-green-600'}>
                    {' '}({weatherRevenueStats.sunnyVsRainyDiff > 0 ? '-' : '+'}{Math.abs(weatherRevenueStats.sunnyVsRainyDiff).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
            {/* Hot vs Cold */}
            <div className="bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">🌡️</span>
                <span className="text-xs text-brand-lotus">高溫日(≥30°C)</span>
              </div>
              <p className="text-lg font-bold text-brand-oak font-num">
                {weatherRevenueStats.hot.days > 0 ? formatCurrency(weatherRevenueStats.hot.avg) : '-'}
              </p>
              <p className="text-[10px] text-brand-lotus">{weatherRevenueStats.hot.days} 天</p>
            </div>
            <div className="bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">❄️</span>
                <span className="text-xs text-brand-lotus">低溫日(≤18°C)</span>
              </div>
              <p className="text-lg font-bold text-brand-oak font-num">
                {weatherRevenueStats.cold.days > 0 ? formatCurrency(weatherRevenueStats.cold.avg) : '-'}
              </p>
              <p className="text-[10px] text-brand-lotus">
                {weatherRevenueStats.cold.days} 天
                {weatherRevenueStats.hotVsColdDiff !== null && (
                  <span className={weatherRevenueStats.hotVsColdDiff > 0 ? ' text-red-500' : ' text-green-600'}>
                    {' '}({weatherRevenueStats.hotVsColdDiff > 0 ? '-' : '+'}{Math.abs(weatherRevenueStats.hotVsColdDiff).toFixed(0)}%)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* C. Category Usage vs Weather */}
          <SectionHeader title="品類用量 vs 天氣" icon="■" />
          <div className="bg-white">
            {Object.keys(categoryByWeather).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-brand-lotus">尚無交叉資料</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {categories.filter((cat) => categoryByWeather[cat]).map((cat) => {
                  const condMap = categoryByWeather[cat]
                  return (
                    <div key={cat} className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-brand-oak mb-2">{cat}</p>
                      {(['sunny', 'partly_cloudy', 'cloudy', 'rainy'] as WeatherCondition[])
                        .filter((c) => condMap[c] !== undefined)
                        .map((c) => (
                          <div key={c} className="flex items-center gap-2 mb-1">
                            <div className="flex items-center gap-1 w-14 shrink-0">
                              {conditionIcon(c, 12)}
                              <span className="text-[10px] text-brand-lotus">{conditionLabel(c)}</span>
                            </div>
                            <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${categoryBarMax > 0 ? (condMap[c] / categoryBarMax) * 100 : 0}%`,
                                  backgroundColor: conditionColor(c),
                                  opacity: 0.6,
                                }}
                              />
                            </div>
                            <span className="text-xs font-num text-brand-oak w-8 text-right">{condMap[c]}</span>
                          </div>
                        ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* D. Temperature vs Revenue Scatter */}
          <SectionHeader title="溫度 vs 營業額" icon="■" />
          <div className="bg-white px-4 py-4">
            {scatterData.length === 0 ? (
              <div className="py-8 text-center text-sm text-brand-lotus">尚無交叉資料</div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex gap-3 mb-3 flex-wrap">
                  {(['sunny', 'partly_cloudy', 'cloudy', 'rainy'] as WeatherCondition[]).map((c) => (
                    <div key={c} className="flex items-center gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: conditionColor(c) }}
                      />
                      <span className="text-[10px] text-brand-lotus">{conditionLabel(c)}</span>
                    </div>
                  ))}
                </div>

                {/* Chart area */}
                <div className="relative border border-gray-200 rounded-lg" style={{ height: 200 }}>
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-1 text-[9px] text-brand-lotus text-right pr-1">
                    <span>{scatterBounds.maxRev >= 1000 ? `${(scatterBounds.maxRev / 1000).toFixed(0)}k` : scatterBounds.maxRev.toFixed(0)}</span>
                    <span>{scatterBounds.maxRev >= 2000 ? `${(scatterBounds.maxRev / 2000).toFixed(0)}k` : (scatterBounds.maxRev / 2).toFixed(0)}</span>
                    <span>0</span>
                  </div>
                  {/* X-axis labels */}
                  <div className="absolute left-10 right-0 bottom-0 h-4 flex justify-between px-2 text-[9px] text-brand-lotus">
                    <span>{scatterBounds.minTemp}°</span>
                    <span>{Math.round((scatterBounds.minTemp + scatterBounds.maxTemp) / 2)}°</span>
                    <span>{scatterBounds.maxTemp}°</span>
                  </div>
                  {/* Plot area */}
                  <div className="absolute left-10 right-1 top-1 bottom-4">
                    {scatterData.map((d, i) => {
                      const xPct = ((d.temp - scatterBounds.minTemp) / (scatterBounds.maxTemp - scatterBounds.minTemp)) * 100
                      const yPct = (d.revenue / scatterBounds.maxRev) * 100
                      return (
                        <div
                          key={i}
                          className="absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 translate-y-1/2 opacity-80 hover:opacity-100 hover:scale-150 transition-all cursor-default"
                          style={{
                            left: `${xPct}%`,
                            bottom: `${yPct}%`,
                            backgroundColor: conditionColor(d.condition),
                          }}
                          title={`${d.date} ${d.temp}° ${formatCurrency(d.revenue)}`}
                        />
                      )
                    })}
                  </div>
                </div>
                <p className="text-[10px] text-brand-lotus text-center mt-1">X: 平均溫度(°C) / Y: 營業額</p>
              </>
            )}
          </div>

          {/* E. Insight Summary */}
          <SectionHeader title="分析摘要" icon="■" />
          <div className="bg-white px-4 py-3">
            <div className="space-y-2">
              {insights.map((text, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-brand-mocha shrink-0 mt-0.5">•</span>
                  <p className="text-sm text-brand-oak">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
