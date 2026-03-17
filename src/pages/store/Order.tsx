import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { DualUnitInput } from '@/components/DualUnitInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { DateNav } from '@/components/DateNav'
import { supabase } from '@/lib/supabase'
import { orderSessionId, getTodayTW, getYesterdayTW, getOrderDeadline, isPastDeadline } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { formatDate } from '@/lib/utils'
import { fetchWeather, type WeatherData, type WeatherCondition } from '@/lib/weather'
import { computeSuggestions, clearSuggestionCache, type SuggestionBreakdown } from '@/lib/suggestion'
import { backfillWeatherIfNeeded } from '@/lib/backfillWeather'
import { Send, Lightbulb, Sun, CloudRain, Cloud, CloudSun, Thermometer, Droplets, RefreshCw, History, AlertTriangle, Package } from 'lucide-react'
import { InventoryStockModal } from '@/components/InventoryStockModal'
import { useStoreSortOrder } from '@/hooks/useStoreSortOrder'
import { buildSortedByCategory } from '@/lib/sortByStore'

const weatherIcons: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  partly_cloudy: CloudSun,
  rainy: CloudRain,
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
  const productsReady = useProductStore((s) => s.initialized)
  const storeProducts = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)

  // Build bag_weight lookup for inventory → bag conversion
  // 也將 parent 的 bag_weight 傳播到 linkedInventoryIds（子品項可能沒有單獨設 bag_weight）
  const bagWeightMap = useMemo(() => {
    const m: Record<string, number> = {}
    allProducts.forEach(p => { if (p.bag_weight) m[p.id] = p.bag_weight })
    // 若子品項自身沒有 bag_weight，繼承 parent 的
    allProducts.forEach(p => {
      if (p.bag_weight && p.linkedInventoryIds?.length) {
        p.linkedInventoryIds.forEach(id => { if (!m[id]) m[id] = p.bag_weight! })
      }
    })
    return m
  }, [allProducts])

  const inventoryIdMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    storeProducts.forEach(p => {
      // Always include own ID + any linked inventory IDs (e.g. 芋圓 + 芋圓上掀)
      const ids = [p.id]
      if (p.linkedInventoryIds?.length) {
        p.linkedInventoryIds.forEach(id => { if (!ids.includes(id)) ids.push(id) })
      }
      m[p.id] = ids
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
  const [bowl750Lid, setBowl750Lid] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // 天氣資料
  const [weather, setWeather] = useState<WeatherData | null>(null)

  useEffect(() => {
    fetchWeather().then(setWeather)
    backfillWeatherIfNeeded().catch(() => {})
  }, [])

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    // 切換日期時重設表單
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    setOrders(init)
    setAlmond1000(''); setAlmond300(''); setBowlK520(''); setBowl750(''); setBowl750Lid('')
    setNote(''); setIsEdit(false)
    setLoading(true)
    supabase
      .from('order_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        setAlmond1000(session.almond_1000 || '')
        setAlmond300(session.almond_300 || '')
        setBowlK520(session.bowl_k520 || '')
        setBowl750(session.bowl_750 || '')
        setBowl750Lid(session.bowl_750_lid || '')
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

  // 最新盤點庫存（架上 + 庫存，跨樓層加總）
  const [stock, setStock] = useState<Record<string, number>>({})
  const [stockDate, setStockDate] = useState('')
  const [stockEntries, setStockEntries] = useState<Record<string, { expiryDate: string; quantity: number }[]>>({})
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockLoading, setStockLoading] = useState(true)

  // 將 stock（per product_id）加總為 linked 版本，供 modal 顯示使用
  const linkedStock = useMemo(() => {
    const m: Record<string, number> = {}
    storeProducts.forEach(p => {
      const ids = inventoryIdMap[p.id] || [p.id]
      const v = getLinkedSum(stock, ids)
      if (v != null) m[p.id] = v
    })
    return m
  }, [stock, storeProducts, inventoryIdMap])

  useEffect(() => {
    if (!supabase || !storeId || !productsReady) { setStockLoading(false); return }

    const load = async () => {
      setStockLoading(true)

      // 找該門店 < selectedDate 最新一筆盤點 session（可能有多樓層）
      const { data: sessions } = await supabase!
        .from('inventory_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .lt('date', selectedDate)
        .order('date', { ascending: false })
        .limit(10)

      if (!sessions || sessions.length === 0) {
        setStock({})
        setStockEntries({})
        setStockLoading(false)
        return
      }

      // 按日期分組，從最新日期開始找有品項資料的
      const uniqueDates = [...new Set(sessions.map(s => s.date))]
      let items: { product_id: string; on_shelf: number | null; stock: number | null }[] | null = null
      let foundDate = ''
      let foundSids: string[] = []

      for (const date of uniqueDates) {
        const sids = sessions.filter(s => s.date === date).map(s => s.id)
        const { data } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock')
          .in('session_id', sids)
        if (data && data.length > 0) {
          items = data
          foundDate = date
          foundSids = sids
          break
        }
      }

      if (!items || items.length === 0) {
        setStock({})
        setStockDate('')
        setStockEntries({})
        setStockLoading(false)
        return
      }

      // 跨樓層加總 on_shelf + stock（bag_weight 品項的 on_shelf 是 g 數，需換算成袋數）
      const totals: Record<string, number> = {}
      items.forEach(item => {
        const bw = bagWeightMap[item.product_id]
        const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
        const val = onShelfBags + (item.stock || 0)
        totals[item.product_id] = Math.round(((totals[item.product_id] || 0) + val) * 100) / 100
      })

      // 抓到期日批次
      const { data: seRows } = await supabase!
        .from('inventory_stock_entries')
        .select('product_id, expiry_date, quantity')
        .in('session_id', foundSids)
        .order('expiry_date', { ascending: true })

      const entries: Record<string, { expiryDate: string; quantity: number }[]> = {}
      seRows?.forEach(r => {
        if (!entries[r.product_id]) entries[r.product_id] = []
        entries[r.product_id].push({ expiryDate: r.expiry_date, quantity: r.quantity || 0 })
      })

      setStock(totals)
      setStockDate(foundDate)
      setStockEntries(entries)
      setStockLoading(false)
    }

    load()
  }, [storeId, selectedDate, bagWeightMap, productsReady])

  // 前日用量：叫貨頁用 D = selectedDate - 1（顯示昨日用量）
  const [prevUsage, setPrevUsage] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!supabase || !storeId || !productsReady) return
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
            const bw = bagWeightMap[item.product_id]
            const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
            prevInv[item.product_id] = (prevInv[item.product_id] || 0) + onShelfBags + (item.stock || 0)
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
            const bw = bagWeightMap[item.product_id]
            const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
            todayInv[item.product_id] = (todayInv[item.product_id] || 0) + onShelfBags + (item.stock || 0)
            todayDisc[item.product_id] = (todayDisc[item.product_id] || 0) + (item.discarded || 0)
          })
        }

        // Calculate usage per order product
        // Sum inventory across: own product_id + linkedInventoryIds (e.g. 芋圓 + 芋圓上掀)
        const usage: Record<string, number> = {}
        storeProducts.forEach(p => {
          // Collect all inventory IDs: own ID + linked IDs
          const allInvIds = new Set<string>([p.id])
          if (p.linkedInventoryIds?.length) {
            p.linkedInventoryIds.forEach(id => allInvIds.add(id))
          }
          const sumInv = (data: Record<string, number>) => {
            let total = 0, found = false
            for (const id of allInvIds) {
              if (data[id] != null) { total += data[id]; found = true }
            }
            return found ? total : null
          }
          const prev = sumInv(prevInv)
          const today = sumInv(todayInv)
          if (prev != null && today != null) {
            const disc = sumInv(todayDisc) || 0
            // 叫貨量也需查關聯品項（芋圓總的叫貨可能存在 p011）
            let ord = 0
            for (const id of allInvIds) {
              if (orderQty[id] != null) ord += orderQty[id]
            }
            usage[p.id] = Math.round((prev + ord - today - disc) * 10) / 10
          }
        })
        setPrevUsage(usage)
      } catch { /* ignore */ }
    }
    load()
  }, [storeId, selectedDate, storeProducts, bagWeightMap])

  // 央廚成品庫存（抓資料庫最近一筆有資料的盤點，因週三/日休息無盤點）
  const [kitchenStock, setKitchenStock] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!supabase) return
    setKitchenStock({})

    const load = async () => {
      const { data: latestSession } = await supabase!
        .from('product_stock_sessions')
        .select('id, date')
        .lte('date', selectedDate)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestSession) return

      const { data } = await supabase!
        .from('product_stock_items')
        .select('product_id, stock_qty')
        .eq('session_id', latestSession.id)

      const m: Record<string, number> = {}
      data?.forEach(item => {
        m[item.product_id] = (m[item.product_id] || 0) + (item.stock_qty || 0)
      })
      setKitchenStock(m)
    }

    load()
  }, [selectedDate])

  // 建議量計算（相似日匹配演算法）
  const [suggested, setSuggested] = useState<Record<string, number>>({})
  const [suggestionBreakdown, setSuggestionBreakdown] = useState<Record<string, SuggestionBreakdown>>({})
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<string | null>(null)
  const [suggestedLoading, setSuggestedLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId || !productsReady || stockLoading) { if (!stockLoading) setSuggestedLoading(false); return }

    const load = async () => {
      setSuggestedLoading(true)

      const targetWeather = weather
        ? { tempHigh: weather.tempHigh, rainProb: weather.rainProb }
        : null

      const { suggested: result, breakdowns } = await computeSuggestions(
        storeId,
        selectedDate,
        storeProducts,
        bagWeightMap,
        inventoryIdMap,
        stock,
        targetWeather,
      )

      setSuggested(result)
      setSuggestionBreakdown(breakdowns)
      setSuggestedLoading(false)
    }

    load()
  }, [storeId, selectedDate, stock, stockLoading, bagWeightMap, inventoryIdMap, productsReady, weather])

  // 切換門店時清除建議量快取
  useEffect(() => {
    clearSuggestionCache()
  }, [storeId])

  const applyAllSuggestions = () => {
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

  const { sortCategories, sortItems } = useStoreSortOrder(storeId || '', 'product')
  const productsByCategory = useMemo(() =>
    buildSortedByCategory(productCategories, storeProducts, sortCategories, sortItems),
    [productCategories, storeProducts, sortCategories, sortItems])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-ord]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSubmit = async () => {
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
      bowl_750_lid: bowl750Lid,
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
      onConflict: 'session_id,product_id',
      itemIdField: 'product_id',
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
      {/* Edit badge */}
      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入 {formatDate(selectedDate)} 叫貨紀錄，修改後可重新提交</span>
        </div>
      )}

      {/* 門店最新盤點庫存按鈕 */}
      <button
        onClick={() => setShowStockModal(true)}
        className="mx-4 mt-2 mb-1 flex items-center gap-2 w-[calc(100%-2rem)] px-3 py-2.5 rounded-card border border-gray-200 bg-white active:bg-gray-50"
      >
        <Package size={16} className="text-brand-mocha shrink-0" />
        <span className="text-sm font-medium text-brand-oak flex-1 text-left">查看最新盤點庫存</span>
        {stockDate && (
          <span className="text-[11px] text-brand-lotus shrink-0">
            最新：{stockDate.slice(5).replace('-', '/')}
          </span>
        )}
      </button>

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
              </div>
            )
          })()}

          <div className="mx-4 mb-2 flex items-center gap-2 bg-status-info/10 text-status-info px-3 py-2 rounded-btn text-xs">
            <Lightbulb size={14} />
            <span>{isRestDayEve ? '建議量已扣除庫存、結合季節 + 天氣 + 安全庫存（含休息日覆蓋）· 點擊建議數字查看明細' : '建議量已扣除庫存、結合季節 + 天氣 + 安全庫存 · 點擊建議數字查看明細'}</span>
          </div>

          <div className="mx-4 mb-3">
            <button onClick={applyAllSuggestions} className="btn-secondary !h-9 !text-sm">一鍵套用全部建議量</button>
          </div>

          <div className="sticky top-14 z-10 flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品項</span>
            <span className="w-[32px] text-center">央廚</span>
            <span className="w-[36px] text-center text-[9px]">前日用量</span>
            <span className="w-[40px] text-center">庫存</span>
            <span className="w-[40px] text-center text-status-info">建議</span>
            <span className="w-[110px] text-center">叫貨量</span>
            <span className="w-[32px] text-center">總量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" sticky={false} />
              <div className="bg-white">
                {products.map((product, idx) => (
                  <div key={product.id}>
                    <div className={`flex items-center px-4 py-1.5 ${idx < products.length - 1 && expandedSuggestionId !== product.id ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0 pr-1">
                        <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                        <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                      </div>
                      <span className="w-[32px] text-center text-xs font-num text-brand-lotus">{(() => { const v = getLinkedSum(kitchenStock, inventoryIdMap[product.id] || [product.id]); return v != null ? v : '-' })()}</span>
                      <span className={`w-[36px] text-center text-xs font-num ${prevUsage[product.id] != null && prevUsage[product.id] < 0 ? 'text-status-danger' : 'text-brand-mocha'}`}>{prevUsage[product.id] != null ? prevUsage[product.id] : '-'}</span>
                      <span className={`w-[40px] text-center text-xs font-num ${(() => { const v = getLinkedSum(stock, inventoryIdMap[product.id]); return v != null && v === 0 ? 'text-status-danger font-bold' : 'text-brand-oak' })()}`}>{(() => { const v = getLinkedSum(stock, inventoryIdMap[product.id]); return v != null ? v : '-' })()}</span>
                      <button
                        type="button"
                        className="w-[40px] text-center text-xs font-num text-status-info active:opacity-60"
                        onClick={() => setExpandedSuggestionId(prev => prev === product.id ? null : product.id)}
                      >
                        {suggested[product.id] > 0 ? suggested[product.id] : (suggestionBreakdown[product.id]?.matchedDays > 0 ? 0 : '-')}
                      </button>
                      <div className="w-[110px] shrink-0 flex justify-center">
                        <DualUnitInput
                          value={orders[product.id]}
                          onChange={(v) => setOrders(prev => ({ ...prev, [product.id]: v }))}
                          unit={product.unit}
                          box_unit={product.box_unit}
                          box_ratio={product.box_ratio}
                          isFilled
                          onNext={focusNext}
                          integerOnly={product.integerOnly}
                          data-ord=""
                          className={product.wideInput ? 'input-wide' : undefined}
                        />
                      </div>
                      {(() => {
                        const inv = getLinkedSum(stock, inventoryIdMap[product.id])
                        const ord = parseFloat(orders[product.id]) || 0
                        const total = inv != null ? Math.round((inv + ord) * 10) / 10 : (ord > 0 ? ord : null)
                        return <span className="w-[32px] text-center text-xs font-num text-brand-mocha">{total != null ? total : '-'}</span>
                      })()}
                    </div>
                    {expandedSuggestionId === product.id && suggestionBreakdown[product.id] && (() => {
                      const bd = suggestionBreakdown[product.id]
                      const tierLabel = bd.matchLevel === 1 ? 'Tier 1（嚴格匹配）' : bd.matchLevel === 2 ? 'Tier 2（放寬匹配）' : 'Tier 3（近期平均）'
                      const dayTypeLabel = bd.targetDayType === 'holiday' ? '假日' : bd.targetDayType === 'weekend' ? '週末' : '平日'
                      const rainLabel = bd.targetRainBucket === 'none' ? '無雨' : bd.targetRainBucket === 'light' ? '小雨' : bd.targetRainBucket === 'heavy' ? '大雨' : '-'
                      const seasonLabel = bd.targetSeason === 'cool' ? '秋冬' : '春夏'
                      const coverDayTypeLabel = (dt: string) => dt === 'holiday' ? '假日' : dt === 'weekend' ? '週末' : '平日'
                      return (
                        <div className={`mx-4 mb-1 px-3 py-2 rounded-lg bg-surface-section text-[11px] text-brand-lotus space-y-1 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className="flex justify-between">
                            <span>匹配等級</span>
                            <span className={`font-medium ${bd.matchLevel === 1 ? 'text-status-success' : bd.matchLevel === 2 ? 'text-status-info' : 'text-status-warning'}`}>{tierLabel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>匹配天數</span>
                            <span className="font-num">{bd.matchedDays} 天</span>
                          </div>
                          {bd.matchedDates.length > 0 && (
                            <div className="flex justify-between items-start">
                              <span className="shrink-0">匹配日期</span>
                              <span className="font-num text-right">{bd.matchedDates.map(d => d.slice(2).replace(/-/g, '/')).join(', ')}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>目標條件</span>
                            <span className="font-num">{dayTypeLabel} / {bd.targetTemp != null ? `${bd.targetTemp}°C` : '-'} / {rainLabel}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>季節</span>
                            <span className="font-medium">{seasonLabel}{bd.targetSchoolBreak ? '（寒暑假）' : ''}</span>
                          </div>
                          {bd.targetRevenue != null && (
                            <div className="flex justify-between">
                              <span>預估營業額</span>
                              <span className="font-num">${bd.targetRevenue.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>加權平均用量</span>
                            <span className="font-num">{bd.avgUsage} {product.unit}/天</span>
                          </div>
                          {/* 覆蓋天數明細 */}
                          <div className="flex justify-between">
                            <span>覆蓋天數</span>
                            <span className="font-num">{bd.coverDays} 天</span>
                          </div>
                          {bd.coverDetails.length > 0 && (
                            <div className="pl-2 space-y-0.5">
                              {bd.coverDetails.map(cd => (
                                <div key={cd.date} className="flex justify-between text-[10px]">
                                  <span>{cd.date.slice(5).replace('-', '/')}（{coverDayTypeLabel(cd.dayType)}）</span>
                                  <span className="font-num">{cd.estimatedUsage} {product.unit}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>預估總需求</span>
                            <span className="font-num">{bd.totalDemand} {product.unit}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>現有庫存</span>
                            <span className="font-num">{bd.currentStock} {product.unit}</span>
                          </div>
                          <div className="flex justify-between font-medium">
                            <span>淨需求</span>
                            <span className="font-num">{bd.netDemand} {product.unit}</span>
                          </div>
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
                          {bd.matchLevel === 3 && bd.matchedDays === 0 && (
                            <div className="text-[10px] text-status-warning">* 歷史資料不足，無法提供建議</div>
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
          <SectionHeader title="叫貨備註" icon="■" sticky={false} />
          <div className="bg-white px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-brand-oak shrink-0">杏仁茶瓶</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">1000ml</span>
                <NumericInput value={almond1000} onChange={(v) => setAlmond1000(v)} unit="個" isFilled />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">300ml</span>
                <NumericInput value={almond300} onChange={(v) => setAlmond300(v)} unit="個" isFilled />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-brand-oak shrink-0">紙碗</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">K520</span>
                <NumericInput value={bowlK520} onChange={(v) => setBowlK520(v)} unit="箱" isFilled />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">750</span>
                <NumericInput value={bowl750} onChange={(v) => setBowl750(v)} unit="箱" isFilled />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-brand-lotus">750蓋</span>
                <NumericInput value={bowl750Lid} onChange={(v) => setBowl750Lid(v)} unit="箱" isFilled />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-sm text-brand-lotus block mb-1.5">其他備註</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="有特殊需求請在此備註..."
                className="w-full h-20 rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
                style={{ backgroundColor: 'var(--color-input-bg)' }} />
            </div>
          </div>

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新叫貨單' : '提交叫貨單（隔日到貨）'}
            onClick={handleSubmit}
            icon={<Send size={18} />}
            disabled={submitting}
          />
        </>
      )}

      <InventoryStockModal
        open={showStockModal}
        onClose={() => setShowStockModal(false)}
        stock={linkedStock}
        stockDate={stockDate}
        stockEntries={stockEntries}
        products={storeProducts}
        productCategories={productCategories}
        sortCategories={sortCategories}
        sortItems={sortItems}
      />
    </div>
  )
}
