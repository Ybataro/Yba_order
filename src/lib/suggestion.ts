/**
 * 相似日匹配建議量演算法 V2
 * 改善：季節過濾、寒暑假加分、recency weight、庫存扣除、動態休息日覆蓋
 */
import { supabase } from '@/lib/supabase'
import { getDayType } from '@/lib/holidays'
import type { StoreProduct } from '@/data/storeProducts'

// ── 類型定義 ──

export type RainBucket = 'none' | 'light' | 'heavy'

export interface CoverDayDetail {
  date: string
  dayType: 'holiday' | 'weekend' | 'weekday'
  estimatedUsage: number
}

export interface SuggestionBreakdown {
  avgUsage: number
  matchLevel: 1 | 2 | 3
  matchedDays: number
  matchedDates: string[]
  targetDayType: 'holiday' | 'weekend' | 'weekday'
  targetTemp: number | null
  targetRainBucket: RainBucket | null
  targetSeason: 'cool' | 'warm'
  targetSchoolBreak: boolean
  targetRevenue: number | null
  currentStock: number
  totalDemand: number
  netDemand: number
  coverDays: number
  coverDetails: CoverDayDetail[]
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

// ── V2 新增輔助函式 ──

/** 季節判斷：11-3月涼季、4-10月暖季 */
export function getSeason(dateStr: string): 'cool' | 'warm' {
  const month = parseInt(dateStr.slice(5, 7), 10)
  return (month >= 11 || month <= 3) ? 'cool' : 'warm'
}

/** 寒暑假判斷：寒假 1/20~2/15、暑假 7-8 月 */
export function isSchoolBreak(dateStr: string): boolean {
  const month = parseInt(dateStr.slice(5, 7), 10)
  const day = parseInt(dateStr.slice(8, 10), 10)
  // 暑假 7-8 月
  if (month === 7 || month === 8) return true
  // 寒假 1/20 ~ 2/15
  if (month === 1 && day >= 20) return true
  if (month === 2 && day <= 15) return true
  return false
}

/** 央廚休息日：週三(3) 或 週日(0) */
export function isKitchenRestDay(dateStr: string): boolean {
  const dow = new Date(dateStr + 'T00:00:00+08:00').getDay()
  return dow === 3 || dow === 0
}

/** 近期權重：越近的歷史資料權重越高 */
export function getRecencyWeight(histDateStr: string, targetDateStr: string): number {
  const hist = new Date(histDateStr + 'T00:00:00+08:00').getTime()
  const target = new Date(targetDateStr + 'T00:00:00+08:00').getTime()
  const diffDays = Math.abs(target - hist) / (1000 * 60 * 60 * 24)
  if (diffDays <= 7) return 2
  if (diffDays <= 14) return 1.5
  if (diffDays <= 30) return 1.2
  return 1
}

/** 日期加減天數 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// ── Module-level 快取 ──

interface CachedData {
  storeId: string
  weatherMap: Map<string, WeatherDay>
  dailyUsages: DailyUsage[]
  revenueMap: Map<string, number>
  loadedAt: number
}

let _cache: CachedData | null = null

// ── 資料載入 ──

async function loadHistoricalData(
  storeId: string,
  products: StoreProduct[],
  bagWeightMap: Record<string, number>,
  inventoryIdMap: Record<string, string[]>,
): Promise<{ weatherMap: Map<string, WeatherDay>; dailyUsages: DailyUsage[]; revenueMap: Map<string, number> }> {
  if (!supabase) return { weatherMap: new Map(), dailyUsages: [], revenueMap: new Map() }

  // 用快取（同 store 10 分鐘內不重查）
  if (_cache && _cache.storeId === storeId && Date.now() - _cache.loadedAt < 10 * 60 * 1000) {
    return { weatherMap: _cache.weatherMap, dailyUsages: _cache.dailyUsages, revenueMap: _cache.revenueMap }
  }

  // 1. 平行查詢 sessions + weather + revenue
  const [invRes, ordRes, weatherRes, revenueRes] = await Promise.all([
    supabase.from('inventory_sessions').select('id, date')
      .eq('store_id', storeId).gte('date', '2021-01-01').order('date'),
    supabase.from('order_sessions').select('id, date')
      .eq('store_id', storeId).gte('date', '2021-01-01').order('date'),
    supabase.from('weather_records').select('date, temp_high, temp_low, rain_prob')
      .gte('date', '2021-01-01').order('date'),
    supabase.from('daily_revenue').select('date, revenue')
      .eq('store_id', storeId).order('date'),
  ])

  const invSessions = invRes.data || []
  const ordSessions = ordRes.data || []
  const weatherRows = weatherRes.data || []
  const revenueRows = revenueRes.data || []

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

  // 營業額 map
  const revenueMap = new Map<string, number>()
  revenueRows.forEach((r: { date: string; revenue: number }) => {
    revenueMap.set(r.date, r.revenue)
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

  _cache = { storeId, weatherMap, dailyUsages, revenueMap, loadedAt: Date.now() }
  return { weatherMap, dailyUsages, revenueMap }
}

// ── 核心：三階段匹配 V2 ──

interface MatchedDay {
  date: string
  score: number
  usage: number
}

/** 計算營業額相似度加分（越接近 targetRevenue，分數越高，最高 15 分） */
function revenueBonus(histDate: string, targetRevenue: number | null, revenueMap: Map<string, number>): number {
  if (targetRevenue == null || targetRevenue <= 0) return 0
  const histRevenue = revenueMap.get(histDate)
  if (histRevenue == null || histRevenue <= 0) return 0
  const ratio = Math.min(histRevenue, targetRevenue) / Math.max(histRevenue, targetRevenue)
  // ratio 1.0 = 完全一樣 → 15分, ratio 0.5 = 差一倍 → 0分
  return Math.max(0, (ratio - 0.5) * 30) // 0.5→0, 0.75→7.5, 1.0→15
}

function matchDaysV2(
  targetDayType: 'holiday' | 'weekend' | 'weekday',
  targetTemp: number | null,
  targetRainBucket: RainBucket | null,
  targetSeason: 'cool' | 'warm',
  targetSchoolBreak: boolean,
  targetDateStr: string,
  dailyUsages: DailyUsage[],
  weatherMap: Map<string, WeatherDay>,
  productId: string,
  revenueMap: Map<string, number>,
  targetRevenue: number | null,
): { matchLevel: 1 | 2 | 3; matched: MatchedDay[] } {

  // 過濾出該品項有用量的日子
  const daysWithUsage = dailyUsages
    .filter(d => d.usage[productId] != null && d.usage[productId] > 0)

  if (daysWithUsage.length === 0) {
    return { matchLevel: 3, matched: [] }
  }

  // Tier 1：嚴格匹配 — 日類型 + 季節 + 溫差5°C + 降雨 ≥2天
  if (targetTemp != null && targetRainBucket != null) {
    const tier1: MatchedDay[] = []
    for (const d of daysWithUsage) {
      const dayType = getDayType(d.date)
      if (dayType !== targetDayType) continue

      // 季節過濾
      if (getSeason(d.date) !== targetSeason) continue

      const w = weatherMap.get(d.date)
      if (!w) continue

      const tempDiff = Math.abs(w.tempHigh - targetTemp)
      if (tempDiff > 5) continue

      const histRain = getRainBucketFromProb(w.rainProb)
      if (histRain !== targetRainBucket) continue

      const recency = getRecencyWeight(d.date, targetDateStr)
      let score = (100 - tempDiff * 5) * recency
      // 寒暑假加分
      if (targetSchoolBreak && isSchoolBreak(d.date)) score += 10
      if (!targetSchoolBreak && !isSchoolBreak(d.date)) score += 5
      // 營業額相似度加分
      score += revenueBonus(d.date, targetRevenue, revenueMap)

      tier1.push({ date: d.date, score, usage: d.usage[productId] })
    }

    if (tier1.length >= 2) {
      return { matchLevel: 1, matched: tier1 }
    }
  }

  // Tier 2：放寬匹配 — 日類型 + 季節 + 溫差8°C ≥2天，降雨/假期加分
  if (targetTemp != null) {
    const tier2: MatchedDay[] = []
    for (const d of daysWithUsage) {
      const dayType = getDayType(d.date)
      if (dayType !== targetDayType) continue

      // 季節過濾
      if (getSeason(d.date) !== targetSeason) continue

      const w = weatherMap.get(d.date)
      if (!w) continue

      const tempDiff = Math.abs(w.tempHigh - targetTemp)
      if (tempDiff > 8) continue

      const recency = getRecencyWeight(d.date, targetDateStr)
      let score = (60 - tempDiff * 3) * recency

      // 降雨匹配加分
      if (targetRainBucket != null) {
        const histRain = getRainBucketFromProb(w.rainProb)
        if (histRain === targetRainBucket) score += 10
      }
      // 寒暑假加分
      if (targetSchoolBreak && isSchoolBreak(d.date)) score += 8
      if (!targetSchoolBreak && !isSchoolBreak(d.date)) score += 3
      // 營業額相似度加分
      score += revenueBonus(d.date, targetRevenue, revenueMap)

      tier2.push({ date: d.date, score, usage: d.usage[productId] })
    }

    if (tier2.length >= 2) {
      return { matchLevel: 2, matched: tier2 }
    }
  }

  // Tier 3：兜底 — 同日類型+同季節 → 同日類型 → 最近14天
  const sameDayTypeSeason = daysWithUsage.filter(d =>
    getDayType(d.date) === targetDayType && getSeason(d.date) === targetSeason,
  )
  if (sameDayTypeSeason.length >= 2) {
    const tier3 = sameDayTypeSeason.map(d => ({
      date: d.date,
      score: (30 + revenueBonus(d.date, targetRevenue, revenueMap)) * getRecencyWeight(d.date, targetDateStr),
      usage: d.usage[productId],
    }))
    return { matchLevel: 3, matched: tier3 }
  }

  const sameDayType = daysWithUsage.filter(d => getDayType(d.date) === targetDayType)
  if (sameDayType.length >= 2) {
    const tier3 = sameDayType.map(d => ({
      date: d.date,
      score: (25 + revenueBonus(d.date, targetRevenue, revenueMap)) * getRecencyWeight(d.date, targetDateStr),
      usage: d.usage[productId],
    }))
    return { matchLevel: 3, matched: tier3 }
  }

  // 最後兜底：最近 14 天
  const recent14 = daysWithUsage.slice(-14)
  const tier3: MatchedDay[] = recent14.map(d => ({
    date: d.date,
    score: (20 + revenueBonus(d.date, targetRevenue, revenueMap)) * getRecencyWeight(d.date, targetDateStr),
    usage: d.usage[productId],
  }))

  return { matchLevel: 3, matched: tier3 }
}

/** 針對特定日期的 dayType 匹配歷史用量，用於覆蓋天數各天預估 */
function estimateDailyUsage(
  dayType: 'holiday' | 'weekend' | 'weekday',
  dateStr: string,
  dailyUsages: DailyUsage[],
  weatherMap: Map<string, WeatherDay>,
  productId: string,
  revenueMap: Map<string, number>,
  targetRevenue: number | null,
): number {
  const season = getSeason(dateStr)
  const schoolBreak = isSchoolBreak(dateStr)

  const { matched } = matchDaysV2(
    dayType, null, null, season, schoolBreak, dateStr,
    dailyUsages, weatherMap, productId, revenueMap, targetRevenue,
  )

  if (matched.length === 0) return 0

  let weightedSum = 0, scoreSum = 0
  for (const m of matched) {
    weightedSum += m.usage * m.score
    scoreSum += m.score
  }
  return scoreSum > 0 ? weightedSum / scoreSum : 0
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
    const { weatherMap, dailyUsages, revenueMap } = await loadHistoricalData(
      storeId, products, bagWeightMap, inventoryIdMap,
    )

    const targetDayType = getDayType(selectedDate)
    const targetTemp = targetWeather?.tempHigh ?? null
    const targetRainBucket = targetWeather
      ? getRainBucketFromProb(targetWeather.rainProb)
      : null
    const targetSeason = getSeason(selectedDate)
    const targetSchoolBreak = isSchoolBreak(selectedDate)

    // 預估目標日營業額：取最近 4 週同日類型（weekday/weekend/holiday）的營業額平均
    let targetRevenue: number | null = null
    const revenueEntries = [...revenueMap.entries()]
      .filter(([d]) => getDayType(d) === targetDayType && getSeason(d) === targetSeason)
      .sort((a, b) => b[0].localeCompare(a[0])) // 最近的在前
      .slice(0, 8) // 取最近 8 個同類型日
    if (revenueEntries.length >= 2) {
      const sum = revenueEntries.reduce((acc, [, rev]) => acc + rev, 0)
      targetRevenue = sum / revenueEntries.length
    }

    // 動態休息日覆蓋（當天叫貨、當天出貨）
    // 叫貨日當天到貨，覆蓋當天 + 之後連續央廚休息日
    // 例: 週二叫貨 → 當天到貨 → 隔天週三央廚休息 → 覆蓋週二+週三共2天
    // 例: 週六叫貨 → 當天到貨 → 隔天週日央廚休息 → 覆蓋週六+週日共2天
    // 例: 週一叫貨 → 當天到貨 → 隔天週二正常 → 覆蓋週一共1天
    const coverDates: string[] = [selectedDate] // 當天到貨，先覆蓋當天

    // 檢查隔天起的連續休息日
    let cursor = addDays(selectedDate, 1)
    while (isKitchenRestDay(cursor)) {
      coverDates.push(cursor)
      cursor = addDays(cursor, 1)
    }

    const coverDays = coverDates.length
    // 舊 restMul 相容值（用於 breakdown 顯示）
    const restMul = coverDays

    products.forEach(p => {
      const ids = inventoryIdMap[p.id] || [p.id]

      // 用 matchDaysV2 匹配（以到貨日條件為主）
      const { matchLevel, matched } = matchDaysV2(
        targetDayType, targetTemp, targetRainBucket,
        targetSeason, targetSchoolBreak, selectedDate,
        dailyUsages, weatherMap, p.id, revenueMap, targetRevenue,
      )

      let avgUsage = 0
      if (matched.length > 0) {
        let weightedSum = 0, scoreSum = 0
        for (const m of matched) {
          weightedSum += m.usage * m.score
          scoreSum += m.score
        }
        avgUsage = scoreSum > 0 ? weightedSum / scoreSum : 0
      }

      // 覆蓋天數各天用量明細
      // 每天先嘗試用各自 dayType 匹配歷史用量；若匹配不到則 fallback 到主匹配的 avgUsage
      const coverDetails: CoverDayDetail[] = coverDates.map(date => {
        const dayType = getDayType(date)
        const estUsage = estimateDailyUsage(dayType, date, dailyUsages, weatherMap, p.id, revenueMap, targetRevenue)
        return {
          date,
          dayType,
          estimatedUsage: Math.round((estUsage > 0 ? estUsage : avgUsage) * 10) / 10,
        }
      })

      // 需求量 = 覆蓋期間各天用量加總（鮮食每天需要新鮮補貨，不因庫存扣減）
      const totalDemand = coverDetails.reduce((sum, d) => sum + d.estimatedUsage, 0)

      // 現有庫存（供 breakdown 顯示參考）
      const currentStock = getLinkedSum(stock, ids) || 0

      // 安全庫存缺口
      const parsedBase = parseBaseStock(p.baseStock)
      const safetyGap = Math.max(0, parsedBase - currentStock)

      // 建議量 = max(每日需求 × 覆蓋天數, 安全庫存缺口)
      // 鮮食叫貨不扣庫存，因為每天都需要新鮮補貨維持品質
      const netDemand = totalDemand
      const rawBeforeRound = Math.max(netDemand, safetyGap)
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
        targetSeason,
        targetSchoolBreak,
        targetRevenue: targetRevenue != null ? Math.round(targetRevenue) : null,
        currentStock: Math.round(currentStock * 10) / 10,
        totalDemand: Math.round(totalDemand * 10) / 10,
        netDemand: Math.round(netDemand * 10) / 10,
        coverDays,
        coverDetails,
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
