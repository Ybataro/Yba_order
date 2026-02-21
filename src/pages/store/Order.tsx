import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { orderSessionId, getTodayTW, getYesterdayTW, getOrderDeadline, isPastDeadline } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { formatDate } from '@/lib/utils'
import { fetchWeather, type WeatherData, type WeatherCondition } from '@/lib/weather'
import { Send, Lightbulb, Sun, CloudRain, Cloud, CloudSun, Thermometer, Droplets, TrendingUp, TrendingDown, Lock, RefreshCw, History, ChevronLeft, ChevronRight } from 'lucide-react'

const weatherIcons: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  partly_cloudy: CloudSun,
  rainy: CloudRain,
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

  const today = getTodayTW()
  const yesterday = getYesterdayTW()
  // 預設日期：若昨日叫貨截止時間（隔日08:00）尚未到，預設顯示昨日的叫貨單
  const defaultDate = !isPastDeadline(getOrderDeadline(yesterday)) ? yesterday : today
  const [selectedDate, setSelectedDate] = useState(defaultDate)
  const orderDate = selectedDate
  const sessionId = orderSessionId(storeId || '', orderDate)
  const deadline = getOrderDeadline(orderDate)
  const isToday = selectedDate === today

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00+08:00')
    d.setDate(d.getDate() + days)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const next = `${yyyy}-${mm}-${dd}`
    if (next > today) return
    setSelectedDate(next)
  }

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
        if (isPastDeadline(session.deadline)) setLocked(true)
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

      // 取最新日期的所有 sessions（可能同一天有 1F + 2F）
      const latestDate = sessions[0].date
      const latestSessions = sessions.filter(s => s.date === latestDate)
      const sids = latestSessions.map(s => s.id)

      const { data: items } = await supabase!
        .from('inventory_items')
        .select('product_id, on_shelf, stock')
        .in('session_id', sids)

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

  // 前日用量
  const [usage, setUsage] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!supabase || !storeId) return

    const load = async () => {
      // 今日 & 前日日期
      const todayDate = getTodayTW()
      const yesterdayDate = getYesterdayTW()

      // 1) 前日盤點 sessions → 前日庫存 (on_shelf + stock)
      const { data: prevSessions } = await supabase!
        .from('inventory_sessions')
        .select('id')
        .eq('store_id', storeId)
        .eq('date', yesterdayDate)

      const prevStock: Record<string, number> = {}
      if (prevSessions && prevSessions.length > 0) {
        const prevSids = prevSessions.map(s => s.id)
        const { data: prevItems } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock')
          .in('session_id', prevSids)
        if (prevItems) {
          prevItems.forEach(item => {
            const val = (item.on_shelf || 0) + (item.stock || 0)
            prevStock[item.product_id] = (prevStock[item.product_id] || 0) + val
          })
        }
      }

      // 2) 今日盤點 sessions → 今日庫存 + discarded
      const { data: todaySessions } = await supabase!
        .from('inventory_sessions')
        .select('id')
        .eq('store_id', storeId)
        .eq('date', todayDate)

      const todayStock: Record<string, number> = {}
      const todayDiscarded: Record<string, number> = {}
      if (todaySessions && todaySessions.length > 0) {
        const todaySids = todaySessions.map(s => s.id)
        const { data: todayItems } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock, discarded')
          .in('session_id', todaySids)
        if (todayItems) {
          todayItems.forEach(item => {
            const s = (item.on_shelf || 0) + (item.stock || 0)
            todayStock[item.product_id] = (todayStock[item.product_id] || 0) + s
            todayDiscarded[item.product_id] = (todayDiscarded[item.product_id] || 0) + (item.discarded || 0)
          })
        }
      }

      // 3) 今日央廚出貨
      const shipmentSessionId = `${storeId}_${todayDate}`
      const { data: shipmentItems } = await supabase!
        .from('shipment_items')
        .select('product_id, actual_qty')
        .eq('session_id', shipmentSessionId)

      const shipment: Record<string, number> = {}
      if (shipmentItems) {
        shipmentItems.forEach(item => {
          shipment[item.product_id] = (shipment[item.product_id] || 0) + (item.actual_qty || 0)
        })
      }

      // 4) 計算：用量 = 前日庫存 + 今日出貨 - 今日庫存 - 今日倒掉
      const result: Record<string, number> = {}
      const allPids = new Set([...Object.keys(prevStock), ...Object.keys(todayStock)])
      allPids.forEach(pid => {
        const prev = prevStock[pid] || 0
        const ship = shipment[pid] || 0
        const curr = todayStock[pid] || 0
        const disc = todayDiscarded[pid] || 0
        if (prev > 0 || curr > 0) {
          result[pid] = prev + ship - curr - disc
        }
      })

      setUsage(result)
    }

    load()
  }, [storeId])

  // 近 7 日平均叫貨量
  const [suggested, setSuggested] = useState<Record<string, number>>({})
  const [suggestedLoading, setSuggestedLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId) { setSuggestedLoading(false); return }

    const load = async () => {
      setSuggestedLoading(true)
      // 計算 7 天前的日期
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const sevenDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      const { data: sessions } = await supabase!
        .from('order_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .gte('date', sevenDaysAgo)
        .lte('date', today)

      if (!sessions || sessions.length === 0) {
        setSuggested({})
        setSuggestedLoading(false)
        return
      }

      const sessionIds = sessions.map(s => s.id)
      const uniqueDays = new Set(sessions.map(s => s.date)).size

      const { data: items } = await supabase!
        .from('order_items')
        .select('product_id, quantity')
        .in('session_id', sessionIds)

      if (!items || items.length === 0) {
        setSuggested({})
        setSuggestedLoading(false)
        return
      }

      // 加總各品項
      const totals: Record<string, number> = {}
      items.forEach(item => {
        totals[item.product_id] = (totals[item.product_id] || 0) + item.quantity
      })

      // 央廚休息日：週三(3)、週日(0) 公休
      // 週一(1)、週五(5) 叫貨需 ×2（隔天到貨後，再隔天央廚休息無法叫貨，需撐 2 天）
      const orderDayOfWeek = new Date(today + 'T00:00:00+08:00').getDay()
      const restDayMultiplier = (orderDayOfWeek === 1 || orderDayOfWeek === 5) ? 2 : 1

      // 計算日均 × 天氣係數 × 休息日倍率
      const result: Record<string, number> = {}
      storeProducts.forEach(p => {
        const total = totals[p.id] || 0
        const avg = total / uniqueDays
        const adjust = impactMap[p.category] || 0
        const raw = Math.max(0, avg * (1 + adjust / 100)) * restDayMultiplier
        const unit = getRoundUnit(p)
        result[p.id] = roundToUnit(raw, unit)
      })

      setSuggested(result)
      setSuggestedLoading(false)
    }

    load()
  }, [storeId, today, impactMap])

  const applyAllSuggestions = () => {
    if (locked) return
    const newOrders: Record<string, string> = {}
    storeProducts.forEach(p => {
      newOrders[p.id] = suggested[p.id] > 0 ? String(suggested[p.id]) : ''
    })
    setOrders(newOrders)
    showToast('已套用全部建議叫貨量', 'info')
  }

  // 判斷今日是否為央廚休息日前一天（週一/週五叫貨需 ×2）
  const isRestDayEve = (() => {
    const dow = new Date(today + 'T00:00:00+08:00').getDay()
    return dow === 1 || dow === 5
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
      <div className="flex items-center justify-center gap-3 px-4 py-2 bg-white border-b border-gray-100">
        <button onClick={() => shiftDate(-1)} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200">
          <ChevronLeft size={20} className="text-brand-oak" />
        </button>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={e => { if (e.target.value && e.target.value <= today) setSelectedDate(e.target.value) }}
          className="text-sm font-semibold text-brand-oak bg-transparent text-center"
        />
        <button
          onClick={() => shiftDate(1)}
          disabled={isToday}
          className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30"
        >
          <ChevronRight size={20} className="text-brand-oak" />
        </button>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(today)}
            className="text-xs text-brand-amber underline"
          >
            回到今天
          </button>
        )}
      </div>

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
            <span>{isRestDayEve ? '建議量已結合近7日用量 + 天氣因素（×2 央廚休息日備量）' : '建議量已結合近7日用量 + 天氣因素計算'}</span>
          </div>

          {!locked && (
            <div className="mx-4 mb-3">
              <button onClick={applyAllSuggestions} className="btn-secondary !h-9 !text-sm">一鍵套用全部建議量</button>
            </div>
          )}

          <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品項</span>
            <span className="w-[36px] text-center">用量</span>
            <span className="w-[40px] text-center">庫存</span>
            <span className="w-[40px] text-center text-status-info">建議</span>
            <span className="w-[60px] text-center">叫貨量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {products.map((product, idx) => (
                  <div key={product.id} className={`flex items-center px-4 py-1.5 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0 pr-1">
                      <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                      <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                    </div>
                    <span className="w-[36px] text-center text-xs font-num text-brand-mocha">{usage[product.id] != null ? (usage[product.id] > 0 ? usage[product.id] : 0) : '-'}</span>
                    <span className={`w-[40px] text-center text-xs font-num ${stock[product.id] != null && stock[product.id] === 0 ? 'text-status-danger font-bold' : 'text-brand-oak'}`}>{stock[product.id] != null ? stock[product.id] : '-'}</span>
                    <span className="w-[40px] text-center text-xs font-num text-status-info">{suggested[product.id] > 0 ? suggested[product.id] : '-'}</span>
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
