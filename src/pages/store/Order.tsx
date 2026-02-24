import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { DateNav } from '@/components/DateNav'
import { supabase } from '@/lib/supabase'
import { orderSessionId, productStockSessionId, getTodayTW, getYesterdayTW, getOrderDeadline, isPastDeadline } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { formatDate } from '@/lib/utils'
import { fetchWeather, type WeatherData, type WeatherCondition } from '@/lib/weather'
import { Send, Lightbulb, Sun, CloudRain, Cloud, CloudSun, Thermometer, Droplets, TrendingUp, TrendingDown, Lock, RefreshCw, History, AlertTriangle } from 'lucide-react'

const weatherIcons: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  partly_cloudy: CloudSun,
  rainy: CloudRain,
}

function parseBaseStock(baseStock?: string): number {
  if (!baseStock) return 0
  const str = baseStock.trim()
  if (/^\d+\.?\d*\s*(g|公斤|ml)/i.test(str)) return 0
  const match = str.match(/^(\d+\.?\d*)/)
  return match ? parseFloat(match[1]) : 0
}

function getWeatherImpacts(weather: WeatherData) {
  const impacts: { category: string; adjust: number; reason: string }[] = []
  const { tempHigh, rainProb, condition } = weather

  if (tempHigh >= 30) {
    impacts.push({ category: '冰品類', adjust: 20, reason: '高溫炎熱' })
    impacts.push({ category: '液體類', adjust: 10, reason: '冷飲需求增加' })
    impacts.push({ category: '加工品類', adjust: -10, reason: '熱品需求降低' })
  } else if (tempHigh <= 18) {
    impacts.push({ category: '加工品類', adjust: 20, reason: '天冷熱品需求增加' })
    impacts.push({ category: '冰品類', adjust: -30, reason: '低溫冰品需求驟降' })
  }

  if (rainProb >= 60 || condition === 'rainy') {
    impacts.push({ category: '配料類（盒裝）', adjust: -15, reason: '雨天來客減少' })
    impacts.push({ category: '主食類（袋裝）', adjust: -15, reason: '雨天來客減少' })
  }

  if (rainProb <= 20 && (condition === 'sunny' || condition === 'partly_cloudy')) {
    impacts.push({ category: '配料類（盒裝）', adjust: 10, reason: '好天氣來客增加' })
  }

  return impacts
}

function getLinkedSum(data: Record<string, number>, ids: string[]): number | null {
  let sum = 0, found = false
  for (const id of ids) {
    if (data[id] != null) { sum += data[id]; found = true }
  }
  return found ? Math.round(sum * 10) / 10 : null
}

export default function Order() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const allProducts = useProductStore((s) => s.items)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)

  const inventoryIdMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    storeProducts.forEach(p => {
      m[p.id] = p.linkedInventoryIds?.length ? p.linkedInventoryIds : [p.id]
    })
    return m
  }, [storeProducts])

  const today = getTodayTW()
  const yesterday = getYesterdayTW()
  // 預設日期：若昨日叫貨截止時間（隔日08:00）尚未到，預設顯示昨日的叫貨單
  const defaultDate = !isPastDeadline(getOrderDeadline(yesterday)) ? yesterday : today
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const orderDate = selectedDate
  const sessionId = orderSessionId(storeId || '', orderDate)
  const deadline = getOrderDeadline(orderDate)

  // 央廚休息日：週三(3)、週日(0) 提示不開放叫貨
  const isKitchenRestDay = (() => {
    const dow = new Date(selectedDate + 'T00:00:00+08:00').getDay()
    return dow === 3 || dow === 0
  })()

  const [orders, setOrders] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    return init
  })
  const [note, setNote] = useState('')
  const [almond1000, setAlmond1000] = useState('')
  const [almond300, setAlmond300] = useState('')
  const [bowlK520, setBowlK520] = useState('')
  const [bowl750, setBowl750] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  // 天氣資料
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    fetchWeather().then(setWeather)
  }, [])

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    // 切換日期時重設表單
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    setOrders(init)
    setAlmond1000(''); setAlmond300(''); setBowlK520(''); setBowl750('')
    setNote(''); setIsEdit(false); setLocked(false)
    setLoading(true)
    supabase
      .from('order_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        // 只鎖定目前正在生產的叫貨單（昨日），歷史資料可自由編輯
        if (isPastDeadline(session.deadline) && orderDate >= getYesterdayTW()) setLocked(true)
        setAlmond1000(session.almond_1000 || '')
        setAlmond300(session.almond_300 || '')
        setBowlK520(session.bowl_k520 || '')
        setBowl750(session.bowl_750 || '')
        setNote(session.note || '')

        supabase!
          .from('order_items')
          .select('*')
          .eq('session_id', sessionId)
          .then(({ data: items }) => {
            if (items && items.length > 0) {
              const loaded: Record<string, string> = {}
              storeProducts.forEach(p => { loaded[p.id] = '' })
              items.forEach((item) => {
                loaded[item.product_id] = item.quantity > 0 ? String(item.quantity) : ''
              })
              setOrders(loaded)
            }
            setLoading(false)
          })
      })
  }, [storeId, selectedDate])

  const defaultWeather: WeatherData = { date: '明日', condition: 'partly_cloudy', conditionText: '多雲', tempHigh: 28, tempLow: 20, rainProb: 30, humidity: 70 }
  const currentWeather = weather || defaultWeather
  const weatherImpacts = useMemo(() => getWeatherImpacts(currentWeather), [currentWeather])
  const impactMap = useMemo(() => {
    const m: Record<string, number> = {}
    weatherImpacts.forEach(i => { m[i.category] = i.adjust })
    return m
  }, [weatherImpacts])

  const getRoundUnit = (product: typeof storeProducts[0]): number => {
    if (product.name === '紫米紅豆湯') return 0.5
    if (product.name === '豆花(冷)' || product.name === '豆花(熱)') return 0.5
    if (product.name === '薏仁湯' || product.name === '芋頭湯(冷)' || product.name === '芋頭湯(熱)') return 0.5
    return 1
  }

  const roundToUnit = (value: number, unit: number): number => {
    return Math.round(value / unit) * unit
  }

  // 最新盤點庫存（架上 + 庫存，跨樓層加總）
  const [stock, setStock] = useState<Record<string, number>>({})
  const [stockLoading, setStockLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId) { setStockLoading(false); return }

    const load = async () => {
      setStockLoading(true)

      // 找該門店最新一筆盤點 session（可能有多樓層）
      const { data: sessions } = await supabase!
        .from('inventory_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .order('date', { ascending: false })
        .limit(10)

      if (!sessions || sessions.length === 0) {
        setStock({})
        setStockLoading(false)
        return
      }

      // 按日期分組，從最新日期開始找有品項資料的
      const uniqueDates = [...new Set(sessions.map(s => s.date))]
      let items: { product_id: string; on_shelf: number | null; stock: number | null }[] | null = null

      for (const date of uniqueDates) {
        const sids = sessions.filter(s => s.date === date).map(s => s.id)
        const { data } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock')
          .in('session_id', sids)
        if (data && data.length > 0) {
          items = data
          break
        }
      }

      if (!items || items.length === 0) {
        setStock({})
        setStockLoading(false)
        return
      }

      // 跨樓層加總 on_shelf + stock
      const totals: Record<string, number> = {}
      items.forEach(item => {
        const val = (item.on_shelf || 0) + (item.stock || 0)
        totals[item.product_id] = (totals[item.product_id] || 0) + val
      })

      setStock(totals)
      setStockLoading(false)
    }

    load()
  }, [storeId])

  // 前日用量：叫貨頁用 D = selectedDate - 1（顯示昨日用量）
  const [prevUsage, setPrevUsage] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!supabase || !storeId) return
    setPrevUsage({})

    const load = async () => {
      try {
        // D = selectedDate - 1（叫貨頁要看的是前一天的用量）
        const dObj = new Date(selectedDate + 'T00:00:00+08:00')
        dObj.setDate(dObj.getDate() - 1)
        const usageDate = dObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

        // (D-1) 庫存
        const dPrev = new Date(usageDate + 'T00:00:00+08:00')
        dPrev.setDate(dPrev.getDate() - 1)
        const prevDate = dPrev.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

        const { data: prevSessions } = await supabase!
          .from('inventory_sessions').select('id')
          .eq('store_id', storeId).eq('date', prevDate)

        const prevInv: Record<string, number> = {}
        if (prevSessions && prevSessions.length > 0) {
          const { data: items } = await supabase!
            .from('inventory_items').select('product_id, on_shelf, stock')
            .in('session_id', prevSessions.map(s => s.id))
          items?.forEach(item => {
            prevInv[item.product_id] = (prevInv[item.product_id] || 0) + (item.on_shelf || 0) + (item.stock || 0)
          })
        }

        // (D) 叫貨量
        const { data: orderSessions } = await supabase!
          .from('order_sessions').select('id')
          .eq('store_id', storeId).eq('date', usageDate)

        const orderQty: Record<string, number> = {}
        if (orderSessions && orderSessions.length > 0) {
          const { data: ordItems } = await supabase!
            .from('order_items').select('product_id, quantity')
            .in('session_id', orderSessions.map(s => s.id))
          ordItems?.forEach(item => {
            orderQty[item.product_id] = (orderQty[item.product_id] || 0) + (item.quantity || 0)
          })
        }

        // (D) 庫存 + 倒掉
        const { data: todaySessions } = await supabase!
          .from('inventory_sessions').select('id')
          .eq('store_id', storeId).eq('date', usageDate)

        const todayInv: Record<string, number> = {}
        const todayDisc: Record<string, number> = {}
        if (todaySessions && todaySessions.length > 0) {
          const { data: items } = await supabase!
            .from('inventory_items').select('product_id, on_shelf, stock, discarded')
            .in('session_id', todaySessions.map(s => s.id))
          items?.forEach(item => {
            todayInv[item.product_id] = (todayInv[item.product_id] || 0) + (item.on_shelf || 0) + (item.stock || 0)
            todayDisc[item.product_id] = (todayDisc[item.product_id] || 0) + (item.discarded || 0)
          })
        }

        const allPids = new Set([...Object.keys(prevInv), ...Object.keys(orderQty), ...Object.keys(todayInv)])
        const usage: Record<string, number> = {}
        allPids.forEach(pid => {
          if (prevInv[pid] !== undefined && todayInv[pid] !== undefined) {
            usage[pid] = Math.round(((prevInv[pid] || 0) + (orderQty[pid] || 0) - (todayInv[pid] || 0) - (todayDisc[pid] || 0)) * 10) / 10
          }
        })
        setPrevUsage(usage)
      } catch { /* ignore */ }
    }
    load()
  }, [storeId, selectedDate])

  // 央廚成品庫存（D-1）
  const [kitchenStock, setKitchenStock] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!supabase) return
    const d1 = new Date(selectedDate + 'T00:00:00+08:00')
    d1.setDate(d1.getDate() - 1)
    const prevDate = d1.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    const sessionId = productStockSessionId(prevDate)

    supabase
      .from('product_stock_items')
      .select('product_id, stock_qty')
      .eq('session_id', sessionId)
      .then(({ data }) => {
        const m: Record<string, number> = {}
        data?.forEach(item => {
          m[item.product_id] = (m[item.product_id] || 0) + (item.stock_qty || 0)
        })
        setKitchenStock(m)
      })
  }, [selectedDate])

  // 建議量計算
  interface SuggestionBreakdown {
    avgUsage: number
    dataSource: 'usage' | 'order'
    dayType: 'weekday' | 'weekend' | 'all'
    weatherAdjustPct: number
    restDayMultiplier: number
    safetyStockGap: number
    rawBeforeRound: number
  }
  const [suggested, setSuggested] = useState<Record<string, number>>({})
  const [suggestionBreakdown, setSuggestionBreakdown] = useState<Record<string, SuggestionBreakdown>>({})
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [suggestedLoading, setSuggestedLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId || stockLoading) { if (!stockLoading) setSuggestedLoading(false); return }

    const load = async () => {
      setSuggestedLoading(true)

      // 以 selectedDate 為基準計算 7 天前的日期
      const d = new Date(selectedDate + 'T00:00:00+08:00')
      d.setDate(d.getDate() - 7)
      const sevenDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      // ── Step 1: 嘗試 usage-based 計算 ──
      let usageAvg: Record<string, number> = {}
      let usageDayType: Record<string, 'weekday' | 'weekend' | 'all'> = {}
      let usageValidDays = 0

      const { data: invSessions } = await supabase!
        .from('inventory_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .gte('date', sevenDaysAgo)
        .lte('date', selectedDate)
        .order('date', { ascending: true })

      if (invSessions && invSessions.length > 0) {
        // 按日期分組
        const sessionsByDate = new Map<string, string[]>()
        invSessions.forEach(s => {
          const list = sessionsByDate.get(s.date) || []
          list.push(s.id)
          sessionsByDate.set(s.date, list)
        })

        const allInvSids = invSessions.map(s => s.id)
        const { data: invItems } = await supabase!
          .from('inventory_items')
          .select('session_id, product_id, on_shelf, stock, discarded')
          .in('session_id', allInvSids)

        // 查叫貨量（date = D 的叫貨，隔日到貨 = D+1 收貨）
        const dates = Array.from(sessionsByDate.keys())
        const { data: ordSessionsAll } = await supabase!
          .from('order_sessions')
          .select('id, date')
          .eq('store_id', storeId)
          .in('date', dates)

        let dailyOrderQty: Record<string, Record<string, number>> = {}
        if (ordSessionsAll && ordSessionsAll.length > 0) {
          const ordSidsAll = ordSessionsAll.map(s => s.id)
          const { data: ordItemsAll } = await supabase!
            .from('order_items')
            .select('session_id, product_id, quantity')
            .in('session_id', ordSidsAll)

          // 建立 order session → date 對照
          const ordSessionDateMap: Record<string, string> = {}
          ordSessionsAll.forEach(s => { ordSessionDateMap[s.id] = s.date })

          if (ordItemsAll) {
            ordItemsAll.forEach(item => {
              const dt = ordSessionDateMap[item.session_id]
              if (!dailyOrderQty[dt]) dailyOrderQty[dt] = {}
              dailyOrderQty[dt][item.product_id] = (dailyOrderQty[dt][item.product_id] || 0) + (item.quantity || 0)
            })
          }
        }

        // 建立每日庫存 map: date → pid → totalStock
        const invBySession: Record<string, { product_id: string; on_shelf: number; stock: number; discarded: number }[]> = {}
        invItems?.forEach(item => {
          if (!invBySession[item.session_id]) invBySession[item.session_id] = []
          invBySession[item.session_id].push({
            product_id: item.product_id,
            on_shelf: item.on_shelf || 0,
            stock: item.stock || 0,
            discarded: item.discarded || 0,
          })
        })

        const dailyStock: Record<string, Record<string, number>> = {}
        const dailyDiscarded: Record<string, Record<string, number>> = {}
        for (const [dt, sids] of sessionsByDate.entries()) {
          const stockMap: Record<string, number> = {}
          const discMap: Record<string, number> = {}
          sids.forEach(sid => {
            (invBySession[sid] || []).forEach(item => {
              stockMap[item.product_id] = (stockMap[item.product_id] || 0) + item.on_shelf + item.stock
              discMap[item.product_id] = (discMap[item.product_id] || 0) + item.discarded
            })
          })
          dailyStock[dt] = stockMap
          dailyDiscarded[dt] = discMap
        }

        // 逐日計算用量：(D-1)庫存 + (D-1)叫貨量 - (D)庫存 - (D)倒掉
        // 分平日(週一~四)和假日(週五~日)分別計算平均
        const isWeekend = (dateStr: string) => {
          const dow = new Date(dateStr + 'T00:00:00+08:00').getDay()
          return dow === 5 || dow === 6 || dow === 0 // 週五六日
        }

        const sortedDates = dates.sort()
        const wdSums: Record<string, number> = {} // 平日
        const wdDays: Record<string, number> = {}
        const weSums: Record<string, number> = {} // 假日
        const weDays: Record<string, number> = {}

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = sortedDates[i - 1]
          const currDate = sortedDates[i]
          const prevStk = dailyStock[prevDate] || {}
          const currStk = dailyStock[currDate] || {}
          const currDisc = dailyDiscarded[currDate] || {}
          const prevOrd = dailyOrderQty[prevDate] || {}
          const we = isWeekend(currDate)

          const allPids = new Set([...Object.keys(prevStk), ...Object.keys(currStk)])
          allPids.forEach(pid => {
            const prev = prevStk[pid] || 0
            const ord = prevOrd[pid] || 0
            const curr = currStk[pid] || 0
            const disc = currDisc[pid] || 0
            if (prev > 0 || curr > 0) {
              const u = Math.max(0, prev + ord - curr - disc)
              if (we) {
                weSums[pid] = (weSums[pid] || 0) + u
                weDays[pid] = (weDays[pid] || 0) + 1
              } else {
                wdSums[pid] = (wdSums[pid] || 0) + u
                wdDays[pid] = (wdDays[pid] || 0) + 1
              }
            }
          })
        }

        // 根據叫貨日是平日還是假日選擇對應平均
        const selectedIsWeekend = isWeekend(selectedDate)
        const primarySums = selectedIsWeekend ? weSums : wdSums
        const primaryDays = selectedIsWeekend ? weDays : wdDays
        const fallbackSums = selectedIsWeekend ? wdSums : weSums
        const fallbackDays = selectedIsWeekend ? wdDays : weDays

        usageValidDays = sortedDates.length - 1
        if (usageValidDays >= 2) {
          storeProducts.forEach(p => {
            // 優先用同類型（平日/假日）平均，不足則用另一類型平均
            const pd = primaryDays[p.id]
            if (pd && pd >= 1) {
              usageAvg[p.id] = primarySums[p.id] / pd
              usageDayType[p.id] = selectedIsWeekend ? 'weekend' : 'weekday'
            } else {
              const fd = fallbackDays[p.id]
              if (fd && fd >= 1) {
                usageAvg[p.id] = fallbackSums[p.id] / fd
                usageDayType[p.id] = selectedIsWeekend ? 'weekday' : 'weekend'
              }
            }
          })
        }
      }

      // ── Step 2: Fallback 到叫貨量 ──
      let orderAvg: Record<string, number> = {}

      const { data: ordSessions } = await supabase!
        .from('order_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .gte('date', sevenDaysAgo)
        .lte('date', selectedDate)

      if (ordSessions && ordSessions.length > 0) {
        const ordSids = ordSessions.map(s => s.id)
        const ordUniqueDays = new Set(ordSessions.map(s => s.date)).size

        const { data: ordItems } = await supabase!
          .from('order_items')
          .select('product_id, quantity')
          .in('session_id', ordSids)

        if (ordItems && ordItems.length > 0) {
          const ordTotals: Record<string, number> = {}
          ordItems.forEach(item => {
            ordTotals[item.product_id] = (ordTotals[item.product_id] || 0) + item.quantity
          })
          storeProducts.forEach(p => {
            if (ordTotals[p.id]) {
              orderAvg[p.id] = ordTotals[p.id] / ordUniqueDays
            }
          })
        }
      }

      // ── Step 3: 套用天氣 + 休息日 + 安全庫存 ──
      const orderDayOfWeek = new Date(selectedDate + 'T00:00:00+08:00').getDay()
      const restMul = (orderDayOfWeek === 2 || orderDayOfWeek === 6) ? 2 : 1

      const result: Record<string, number> = {}
      const breakdowns: Record<string, SuggestionBreakdown> = {}

      storeProducts.forEach(p => {
        const ids = p.linkedInventoryIds?.length ? p.linkedInventoryIds : [p.id]
        const linkedUsageAvg = getLinkedSum(usageAvg, ids)
        const hasUsage = linkedUsageAvg != null
        const avg = hasUsage ? linkedUsageAvg : (orderAvg[p.id] || 0)
        const dataSource: 'usage' | 'order' = hasUsage ? 'usage' : 'order'
        const weatherPct = impactMap[p.category] || 0
        const weatherAdj = Math.max(0, avg * (1 + weatherPct / 100))
        const restDayQty = weatherAdj * restMul

        const parsedBase = parseBaseStock(p.baseStock)
        const currentStock = getLinkedSum(stock, ids) || 0
        const safetyGap = Math.max(0, parsedBase - currentStock)

        const rawBeforeRound = Math.max(restDayQty, safetyGap)
        const unit = getRoundUnit(p)
        result[p.id] = roundToUnit(rawBeforeRound, unit)

        breakdowns[p.id] = {
          avgUsage: Math.round(avg * 10) / 10,
          dataSource,
          dayType: hasUsage ? (usageDayType[p.id] || 'all') : 'all',
          weatherAdjustPct: weatherPct,
          restDayMultiplier: restMul,
          safetyStockGap: Math.round(safetyGap * 10) / 10,
          rawBeforeRound: Math.round(rawBeforeRound * 10) / 10,
        }
      })

      setSuggested(result)
      setSuggestionBreakdown(breakdowns)
      setSuggestedLoading(false)
    }

    load()
  }, [storeId, selectedDate, impactMap, stock, stockLoading])

  const applyAllSuggestions = () => {
    if (locked) return
    const newOrders: Record<string, string> = {}
    storeProducts.forEach(p => {
      newOrders[p.id] = suggested[p.id] > 0 ? String(suggested[p.id]) : ''
    })
    setOrders(newOrders)
    showToast('已套用全部建議叫貨量', 'info')
  }

  // 判斷所選日期是否為央廚休息日前一天（週二/週六叫貨需 ×2）
  const isRestDayEve = (() => {
    const dow = new Date(selectedDate + 'T00:00:00+08:00').getDay()
    return dow === 2 || dow === 6
  })()

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-ord]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSubmit = async () => {
    if (locked) return
    if (!storeId) return

    setSubmitting(true)

    const session = {
      id: sessionId,
      store_id: storeId,
      date: orderDate,
      deadline,
      almond_1000: almond1000,
      almond_300: almond300,
      bowl_k520: bowlK520,
      bowl_750: bowl750,
      note,
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }

    const items = storeProducts
      .filter(p => orders[p.id] && orders[p.id] !== '')
      .map(p => ({
        session_id: sessionId,
        product_id: p.id,
        quantity: parseFloat(orders[p.id]) || 0,
      }))

    const success = await submitWithOffline({
      type: 'order',
      storeId,
      sessionId,
      session,
      items,
      onSuccess: (msg) => {
        setIsEdit(true)
        logAudit('order_submit', storeId, sessionId, { itemCount: items.length })
        showToast(msg || (isEdit ? '叫貨單已更新！' : '叫貨單已提交成功！'))
      },
      onError: (msg) => showToast(msg, 'error'),
    })

    if (success && !navigator.onLine) {
      setIsEdit(true)
    }

    setSubmitting(false)
  }

  return (
    <div className="page-container">
      <TopNav
        title={`${storeName} 叫貨`}
        rightAction={
          <button
            onClick={() => navigate(`/store/${storeId}/order-history?staff=${staffId}`)}
            className="p-1 active:opacity-70"
            title="歷史紀錄"
          >
            <History size={18} />
          </button>
        }
      />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} maxDate="tomorrow" />

      {/* 央廚休息日提示 */}
      {isKitchenRestDay && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-status-warning/10 text-status-warning text-xs font-medium">
          <AlertTriangle size={12} />
          <span>此日為央廚休息日（{new Date(selectedDate + 'T00:00:00+08:00').getDay() === 3 ? '週三' : '週日'}），正常不需叫貨</span>
        </div>
      )}

      {/* Locked banner */}
      {locked && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-status-danger/10 text-status-danger text-xs">
          <Lock size={12} />
          <span>已超過修改截止時間（隔日 08:00），此叫貨單為唯讀</span>
        </div>
      )}

      {/* Edit badge */}
      {isEdit && !locked && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入 {formatDate(selectedDate)} 叫貨紀錄，修改後可重新提交</span>
        </div>
      )}

      {(loading || stockLoading || suggestedLoading) ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 天氣預報卡片 */}
          {(() => {
            const WeatherIcon = weatherIcons[currentWeather.condition]
            return (
              <div className="mx-4 mt-3 mb-2 rounded-card overflow-hidden border border-gray-100 bg-white">
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-amber/10">
                    <WeatherIcon size={24} className="text-brand-amber" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-brand-oak">{currentWeather.date} {currentWeather.conditionText}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-brand-lotus">
                      <span className="flex items-center gap-0.5">
                        <Thermometer size={12} />
                        {currentWeather.tempLow}~{currentWeather.tempHigh}°C
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Droplets size={12} />
                        降雨 {currentWeather.rainProb}%
                      </span>
                    </div>
                  </div>
                </div>
                {weatherImpacts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 border-t border-gray-50 pt-2">
                    {weatherImpacts.map((impact, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          impact.adjust > 0
                            ? 'bg-status-warning/10 text-status-warning'
                            : 'bg-status-info/10 text-status-info'
                        }`}
                      >
                        {impact.adjust > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {impact.category.replace(/（.+）/, '')} {impact.adjust > 0 ? '+' : ''}{impact.adjust}%
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          <div className="mx-4 mb-2 flex items-center gap-2 bg-status-info/10 text-status-info px-3 py-2 rounded-btn text-xs">
            <Lightbulb size={14} />
            <span>{isRestDayEve ? '建議量已結合近7日實際用量 + 天氣 + 安全庫存（×2 央廚休息日備量）· 點擊建議數字查看明細' : '建議量已結合近7日實際用量 + 天氣 + 安全庫存計算 · 點擊建議數字查看明細'}</span>
          </div>

          {!locked && (
            <div className="mx-4 mb-3">
              <button onClick={applyAllSuggestions} className="btn-secondary !h-9 !text-sm">一鍵套用全部建議量</button>
            </div>
          )}

          <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品項</span>
            <span className="w-[32px] text-center">央廚</span>
            <span className="w-[36px] text-center text-[9px]">前日用量</span>
            <span className="w-[40px] text-center">庫存</span>
            <span className="w-[40px] text-center text-status-info">建議</span>
            <span className="w-[60px] text-center">叫貨量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {products.map((product, idx) => (
                  <div key={product.id}>
                    <div className={`flex items-center px-4 py-1.5 ${idx < products.length - 1 && expandedSuggestionId !== product.id ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0 pr-1">
                        <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                        <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                      </div>
                      <span className="w-[32px] text-center text-xs font-num text-brand-lotus">{kitchenStock[product.id] != null ? kitchenStock[product.id] : '-'}</span>
                      <span className={`w-[36px] text-center text-xs font-num ${(() => { const v = getLinkedSum(prevUsage, inventoryIdMap[product.id]); return v != null && v < 0 ? 'text-status-danger' : 'text-brand-mocha' })()}`}>{(() => { const v = getLinkedSum(prevUsage, inventoryIdMap[product.id]); return v != null ? v : '-' })()}</span>
                      <span className={`w-[40px] text-center text-xs font-num ${(() => { const v = getLinkedSum(stock, inventoryIdMap[product.id]); return v != null && v === 0 ? 'text-status-danger font-bold' : 'text-brand-oak' })()}`}>{(() => { const v = getLinkedSum(stock, inventoryIdMap[product.id]); return v != null ? v : '-' })()}</span>
                      <button
                        type="button"
                        className="w-[40px] text-center text-xs font-num text-status-info active:opacity-60"
                        onClick={() => setExpandedSuggestionId(prev => prev === product.id ? null : product.id)}
                      >
                        {suggested[product.id] > 0 ? suggested[product.id] : '-'}
                      </button>
                      <div className="w-[60px] flex justify-center">
                        <NumericInput
                          value={orders[product.id]}
                          onChange={(v) => !locked && setOrders(prev => ({ ...prev, [product.id]: v }))}
                          isFilled
                          onNext={focusNext}
                          data-ord=""
                          disabled={locked}
                        />
                      </div>
                    </div>
                    {expandedSuggestionId === product.id && suggestionBreakdown[product.id] && (() => {
                      const bd = suggestionBreakdown[product.id]
                      return (
                        <div className={`mx-4 mb-1 px-3 py-2 rounded-lg bg-surface-section text-[11px] text-brand-lotus space-y-1 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className="flex justify-between">
                            <span>7日{bd.dayType === 'weekday' ? '平日' : bd.dayType === 'weekend' ? '假日' : ''}平均{bd.dataSource === 'usage' ? '用量' : '叫貨量'}</span>
                            <span className="font-num">{bd.avgUsage} {product.unit}/天</span>
                          </div>
                          {bd.weatherAdjustPct !== 0 && (
                            <div className="flex justify-between">
                              <span>天氣調整</span>
                              <span className="font-num">{bd.weatherAdjustPct > 0 ? '+' : ''}{bd.weatherAdjustPct}%</span>
                            </div>
                          )}
                          {bd.restDayMultiplier > 1 && (
                            <div className="flex justify-between">
                              <span>休息日備量</span>
                              <span className="font-num">×{bd.restDayMultiplier}</span>
                            </div>
                          )}
                          {bd.safetyStockGap > 0 && (
                            <div className="flex justify-between">
                              <span>安全庫存補充</span>
                              <span className="font-num">+{bd.safetyStockGap}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-200 pt-1 flex justify-between font-medium text-brand-oak">
                            <span>建議量</span>
                            <span className="font-num">{suggested[product.id] > 0 ? suggested[product.id] : 0}</span>
                          </div>
                          {bd.dataSource === 'order' && (
                            <div className="text-[10px] text-status-warning">* 盤點資料不足，以叫貨量估算</div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 固定備註項目 */}
          <SectionHeader title="叫貨備註" icon="■" />
          <div className="bg-white px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-brand-oak shrink-0">杏仁茶瓶</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">1000ml</span>
                <NumericInput value={almond1000} onChange={(v) => !locked && setAlmond1000(v)} unit="個" isFilled disabled={locked} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">300ml</span>
                <NumericInput value={almond300} onChange={(v) => !locked && setAlmond300(v)} unit="個" isFilled disabled={locked} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-brand-oak shrink-0">紙碗</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">K520</span>
                <NumericInput value={bowlK520} onChange={(v) => !locked && setBowlK520(v)} unit="箱" isFilled disabled={locked} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">750</span>
                <NumericInput value={bowl750} onChange={(v) => !locked && setBowl750(v)} unit="箱" isFilled disabled={locked} />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-sm text-brand-lotus block mb-1.5">其他備註</label>
              <textarea value={note} onChange={e => !locked && setNote(e.target.value)} placeholder="有特殊需求請在此備註..."
                className="w-full h-20 rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
                style={{ backgroundColor: 'var(--color-input-bg)' }}
                disabled={locked} />
            </div>
          </div>

          {locked ? (
            <BottomAction label="已鎖定（超過隔日 08:00）" onClick={() => {}} icon={<Lock size={18} />} disabled />
          ) : (
            <BottomAction
              label={submitting ? '提交中...' : isEdit ? '更新叫貨單' : '提交叫貨單（隔日到貨）'}
              onClick={handleSubmit}
              icon={<Send size={18} />}
              disabled={submitting}
            />
          )}
        </>
      )}
    </div>
  )
}
