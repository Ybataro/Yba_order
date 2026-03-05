/**
 * 相似日匹配建議量演算法
 * 利用歷史天氣 + 日類型 + 氣溫，匹配最相似的歷史日計算加權平均用量
 */
import { supabase } from '@/lib/supabase'
import { getDayType } from '@/lib/holidays'
import type { StoreProduct } from '@/data/storeProducts'

// ── 類型定義 ──

export type RainBucket = 'none' | 'light' | 'heavy'

export interface SuggestionBreakdown {
  avgUsage: number
  matchLevel: 1 | 2 | 3
  matchedDays: number
  matchedDates: string[]
  targetDayType: 'holiday' | 'weekend' | 'weekday'
  targetTemp: number | null
  targetRainBucket: RainBucket | null
  restDayMultiplier: number
  safetyStockGap: number
  rawBeforeRound: number
}

interface WeatherDay {
  date: string
  tempHigh: number
  tempLow: number
  rainProb: number
}

interface DailyUsage {
  date: string
  usage: Record<string, number> // productId → usage
}

// ── 工具函式 ──

export function getRainBucketFromMm(precipMm: number): RainBucket {
  if (precipMm <= 1) return 'none'
  if (precipMm <= 10) return 'light'
  return 'heavy'
}

export function getRainBucketFromProb(rainProb: number): RainBucket {
  if (rainProb <= 20) return 'none'
  if (rainProb <= 60) return 'light'
  return 'heavy'
}

export function parseBaseStock(baseStock?: string): number {
  if (!baseStock) return 0
  const str = baseStock.trim()
  if (/^\d+\.?\d*\s*(g|公斤|ml)/i.test(str)) return 0
  const match = str.match(/^(\d+\.?\d*)/)
  return match ? parseFloat(match[1]) : 0
}

export function getRoundUnit(productName: string): number {
  if (productName === '紫米紅豆湯') return 0.5
  if (productName === '豆花(冷)' || productName === '豆花(熱)') return 0.5
  if (productName === '薏仁湯' || productName === '芋頭湯(冷)' || productName === '芋頭湯(熱)') return 0.5
  return 1
}

export function roundToUnit(value: number, unit: number): number {
  return Math.round(value / unit) * unit
}

function getLinkedSum(data: Record<string, number>, ids: string[]): number | null {
  let sum = 0, found = false
  for (const id of ids) {
    if (data[id] != null) { sum += data[id]; found = true }
  }
  return found ? Math.round(sum * 10) / 10 : null
}

// ── Module-level 快取 ──

interface CachedData {
  storeId: string
  weatherMap: Map<string, WeatherDay>
  dailyUsages: DailyUsage[]
  loadedAt: number
}

let _cache: CachedData | null = null

// ── 資料載入 ──

async function loadHistoricalData(
  storeId: string,
  products: StoreProduct[],
  bagWeightMap: Record<string, number>,
  inventoryIdMap: Record<string, string[]>,
): Promise<{ weatherMap: Map<string, WeatherDay>; dailyUsages: DailyUsage[] }> {
  if (!supabase) return { weatherMap: new Map(), dailyUsages: [] }

  // 用快取（同 store 10 分鐘內不重查）
  if (_cache && _cache.storeId === storeId && Date.now() - _cache.loadedAt < 10 * 60 * 1000) {
    return { weatherMap: _cache.weatherMap, dailyUsages: _cache.dailyUsages }
  }

  // 1. 平行查詢 sessions + weather
  const [invRes, ordRes, weatherRes] = await Promise.all([
    supabase.from('inventory_sessions').select('id, date')
      .eq('store_id', storeId).gte('date', '2021-01-01').order('date'),
    supabase.from('order_sessions').select('id, date')
      .eq('store_id', storeId).gte('date', '2021-01-01').order('date'),
    supabase.from('weather_records').select('date, temp_high, temp_low, rain_prob')
      .gte('date', '2021-01-01').order('date'),
  ])

  const invSessions = invRes.data || []
  const ordSessions = ordRes.data || []
  const weatherRows = weatherRes.data || []

  // 天氣 map
  const weatherMap = new Map<string, WeatherDay>()
  weatherRows.forEach((w: { date: string; temp_high: number; temp_low: number; rain_prob: number }) => {
    weatherMap.set(w.date, {
      date: w.date,
      tempHigh: w.temp_high,
      tempLow: w.temp_low,
      rainProb: w.rain_prob,
    })
  })

  // 2. 批次查 inventory_items 和 order_items
  const invSids = invSessions.map((s: { id: string }) => s.id)
  const ordSids = ordSessions.map((s: { id: string }) => s.id)

  // Supabase `.in()` 有上限，分批查
  const BATCH = 500
  const invItemsList: { session_id: string; product_id: string; on_shelf: number; stock: number; discarded: number }[] = []
  for (let i = 0; i < invSids.length; i += BATCH) {
    const batch = invSids.slice(i, i + BATCH)
    const { data } = await supabase
      .from('inventory_items')
      .select('session_id, product_id, on_shelf, stock, discarded')
      .in('session_id', batch)
    if (data) invItemsList.push(...data)
  }

  const ordItemsList: { session_id: string; product_id: string; quantity: number }[] = []
  for (let i = 0; i < ordSids.length; i += BATCH) {
    const batch = ordSids.slice(i, i + BATCH)
    const { data } = await supabase
      .from('order_items')
      .select('session_id, product_id, quantity')
      .in('session_id', batch)
    if (data) ordItemsList.push(...data)
  }

  // 3. 建立 session→date 對照
  const invSessionDate: Record<string, string> = {}
  invSessions.forEach((s: { id: string; date: string }) => { invSessionDate[s.id] = s.date })
  const ordSessionDate: Record<string, string> = {}
  ordSessions.forEach((s: { id: string; date: string }) => { ordSessionDate[s.id] = s.date })

  // 4. 每日庫存 map: date → pid → total
  const dailyStock: Record<string, Record<string, number>> = {}
  const dailyDisc: Record<string, Record<string, number>> = {}
  invItemsList.forEach(item => {
    const date = invSessionDate[item.session_id]
    if (!date) return
    if (!dailyStock[date]) dailyStock[date] = {}
    if (!dailyDisc[date]) dailyDisc[date] = {}
    const bw = bagWeightMap[item.product_id]
    const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
    dailyStock[date][item.product_id] = (dailyStock[date][item.product_id] || 0) + onShelfBags + (item.stock || 0)
    dailyDisc[date][item.product_id] = (dailyDisc[date][item.product_id] || 0) + (item.discarded || 0)
  })

  // 每日叫貨 map: date → pid → quantity
  const dailyOrder: Record<string, Record<string, number>> = {}
  ordItemsList.forEach(item => {
    const date = ordSessionDate[item.session_id]
    if (!date) return
    if (!dailyOrder[date]) dailyOrder[date] = {}
    dailyOrder[date][item.product_id] = (dailyOrder[date][item.product_id] || 0) + (item.quantity || 0)
  })

  // 5. 建立每日用量
  // 策略一：有連續盤點資料 → 用公式 (D-1)庫存 + (D)叫貨 - (D)庫存 - (D)倒掉
  // 策略二：只有叫貨資料（Excel 匯入歷史）→ 直接用叫貨量作為用量近似值
  const dailyUsages: DailyUsage[] = []
  const invDates = new Set(Object.keys(dailyStock))

  // 策略一：盤點用量
  const allInvDates = [...invDates].sort()
  for (let i = 1; i < allInvDates.length; i++) {
    const prevDate = allInvDates[i - 1]
    const currDate = allInvDates[i]
    const prevStk = dailyStock[prevDate] || {}
    const currStk = dailyStock[currDate] || {}
    const currDisc = dailyDisc[currDate] || {}
    const prevOrd = dailyOrder[prevDate] || {}

    const usage: Record<string, number> = {}

    products.forEach(p => {
      const ids = inventoryIdMap[p.id] || [p.id]

      const sumMap = (data: Record<string, number>) => {
        let total = 0, found = false
        for (const id of ids) {
          if (data[id] != null) { total += data[id]; found = true }
        }
        return found ? total : null
      }

      const prev = sumMap(prevStk)
      const curr = sumMap(currStk)
      if (prev != null && curr != null) {
        const disc = sumMap(currDisc) || 0
        let ord = 0
        for (const id of ids) {
          if (prevOrd[id] != null) ord += prevOrd[id]
        }
        const u = Math.max(0, prev + ord - curr - disc)
        if (u > 0) usage[p.id] = Math.round(u * 10) / 10
      }
    })

    if (Object.keys(usage).length > 0) {
      dailyUsages.push({ date: currDate, usage })
    }
  }

  // 策略二：沒有盤點的日期，直接用叫貨量作為用量近似值
  const usageDates = new Set(dailyUsages.map(d => d.date))
  const orderOnlyDates = Object.keys(dailyOrder).filter(d => !invDates.has(d) && !usageDates.has(d)).sort()

  for (const date of orderOnlyDates) {
    const orderData = dailyOrder[date]
    if (!orderData) continue

    const usage: Record<string, number> = {}
    products.forEach(p => {
      const ids = inventoryIdMap[p.id] || [p.id]
      let total = 0, found = false
      for (const id of ids) {
        if (orderData[id] != null) { total += orderData[id]; found = true }
      }
      if (found && total > 0) {
        usage[p.id] = Math.round(total * 10) / 10
      }
    })

    if (Object.keys(usage).length > 0) {
      dailyUsages.push({ date, usage })
    }
  }

  // 按日期排序
  dailyUsages.sort((a, b) => a.date.localeCompare(b.date))

  _cache = { storeId, weatherMap, dailyUsages, loadedAt: Date.now() }
  return { weatherMap, dailyUsages }
}

// ── 核心：三階段匹配 ──

interface MatchedDay {
  date: string
  score: number
  usage: number
}

function matchDays(
  targetDayType: 'holiday' | 'weekend' | 'weekday',
  targetTemp: number | null,
  targetRainBucket: RainBucket | null,
  dailyUsages: DailyUsage[],
  weatherMap: Map<string, WeatherDay>,
  productId: string,
): { matchLevel: 1 | 2 | 3; matched: MatchedDay[] } {

  // 過濾出該品項有用量的日子
  const daysWithUsage = dailyUsages
    .filter(d => d.usage[productId] != null && d.usage[productId] > 0)

  if (daysWithUsage.length === 0) {
    return { matchLevel: 3, matched: [] }
  }

  // Tier 1：嚴格匹配
  if (targetTemp != null && targetRainBucket != null) {
    const tier1: MatchedDay[] = []
    for (const d of daysWithUsage) {
      const dayType = getDayType(d.date)
      if (dayType !== targetDayType) continue

      const w = weatherMap.get(d.date)
      if (!w) continue

      const tempDiff = Math.abs(w.tempHigh - targetTemp)
      if (tempDiff > 3) continue

      const histRain = getRainBucketFromProb(w.rainProb)
      if (histRain !== targetRainBucket) continue

      tier1.push({
        date: d.date,
        score: 100 - tempDiff * 5,
        usage: d.usage[productId],
      })
    }

    if (tier1.length >= 3) {
      return { matchLevel: 1, matched: tier1 }
    }
  }

  // Tier 2：放寬匹配（忽略 rainBucket）
  if (targetTemp != null) {
    const tier2: MatchedDay[] = []
    for (const d of daysWithUsage) {
      const dayType = getDayType(d.date)
      if (dayType !== targetDayType) continue

      const w = weatherMap.get(d.date)
      if (!w) continue

      const tempDiff = Math.abs(w.tempHigh - targetTemp)
      if (tempDiff > 5) continue

      tier2.push({
        date: d.date,
        score: 60 - tempDiff * 3,
        usage: d.usage[productId],
      })
    }

    if (tier2.length >= 3) {
      return { matchLevel: 2, matched: tier2 }
    }
  }

  // Tier 3：兜底 — 最近 14 天平均
  const recent14 = daysWithUsage.slice(-14)
  const tier3: MatchedDay[] = recent14.map(d => ({
    date: d.date,
    score: 30,
    usage: d.usage[productId],
  }))

  return { matchLevel: 3, matched: tier3 }
}

// ── 主函式 ──

export interface SuggestionResult {
  suggested: Record<string, number>
  breakdowns: Record<string, SuggestionBreakdown>
}

export async function computeSuggestions(
  storeId: string,
  selectedDate: string,
  products: StoreProduct[],
  bagWeightMap: Record<string, number>,
  inventoryIdMap: Record<string, string[]>,
  stock: Record<string, number>,
  targetWeather: { tempHigh: number; rainProb: number } | null,
): Promise<SuggestionResult> {
  const suggested: Record<string, number> = {}
  const breakdowns: Record<string, SuggestionBreakdown> = {}

  try {
    const { weatherMap, dailyUsages } = await loadHistoricalData(
      storeId, products, bagWeightMap, inventoryIdMap,
    )

    const targetDayType = getDayType(selectedDate)
    const targetTemp = targetWeather?.tempHigh ?? null
    const targetRainBucket = targetWeather
      ? getRainBucketFromProb(targetWeather.rainProb)
      : null

    // 休息日倍率（週二/六叫貨 ×2）
    const dow = new Date(selectedDate + 'T00:00:00+08:00').getDay()
    const restMul = (dow === 2 || dow === 6) ? 2 : 1

    products.forEach(p => {
      const ids = inventoryIdMap[p.id] || [p.id]

      const { matchLevel, matched } = matchDays(
        targetDayType, targetTemp, targetRainBucket,
        dailyUsages, weatherMap, p.id,
      )

      let avgUsage = 0
      if (matched.length > 0) {
        // 加權平均
        let weightedSum = 0, scoreSum = 0
        for (const m of matched) {
          weightedSum += m.usage * m.score
          scoreSum += m.score
        }
        avgUsage = scoreSum > 0 ? weightedSum / scoreSum : 0
      }

      const restDayQty = avgUsage * restMul

      const parsedBase = parseBaseStock(p.baseStock)
      const currentStock = getLinkedSum(stock, ids) || 0
      const safetyGap = Math.max(0, parsedBase - currentStock)

      const rawBeforeRound = Math.max(restDayQty, safetyGap)
      const unit = getRoundUnit(p.name)
      suggested[p.id] = roundToUnit(rawBeforeRound, unit)

      // 取最佳匹配日期（分數高→低），最多顯示 5 個
      const sortedDates = [...matched]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(m => m.date)

      breakdowns[p.id] = {
        avgUsage: Math.round(avgUsage * 10) / 10,
        matchLevel,
        matchedDays: matched.length,
        matchedDates: sortedDates,
        targetDayType,
        targetTemp,
        targetRainBucket,
        restDayMultiplier: restMul,
        safetyStockGap: Math.round(safetyGap * 10) / 10,
        rawBeforeRound: Math.round(rawBeforeRound * 10) / 10,
      }
    })
  } catch (err) {
    console.warn('[suggestion] 計算建議量失敗，fallback 為 0:', err)
  }

  return { suggested, breakdowns }
}

/** 清除快取（換門店或需要刷新時呼叫） */
export function clearSuggestionCache(): void {
  _cache = null
}
