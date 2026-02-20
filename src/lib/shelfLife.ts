// Shelf life parsing and production urgency calculation

/**
 * Parse various shelf life formats to number of days
 * e.g., 7 → 7, "冷凍45天" → 45, "開封3天" → 3, "6個月" → 180
 */
export function parseShelfLifeDays(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0
  if (typeof value === 'number') return value

  const str = String(value).trim()

  // Direct number
  const num = parseFloat(str)
  if (!isNaN(num) && str === String(num)) return num

  // "N天" or "冷凍N天" or "開封N天"
  const dayMatch = str.match(/(\d+)\s*天/)
  if (dayMatch) return parseInt(dayMatch[1], 10)

  // "N個月"
  const monthMatch = str.match(/(\d+)\s*個月/)
  if (monthMatch) return parseInt(monthMatch[1], 10) * 30

  // "N週" or "N周"
  const weekMatch = str.match(/(\d+)\s*[週周]/)
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7

  return 0
}

export type UrgencyLevel = 'urgent' | 'low' | 'sufficient'

/**
 * Determine production urgency based on current stock vs demand
 * @param currentStock - current kitchen inventory
 * @param dailyAvg - average daily demand (from orders)
 * @param shelfLifeDays - product shelf life in days
 */
export function getProductionUrgency(
  currentStock: number,
  dailyAvg: number,
  _shelfLifeDays: number,
): UrgencyLevel {
  if (currentStock <= 0 && dailyAvg > 0) return 'urgent'
  if (dailyAvg <= 0) return 'sufficient'

  const daysOfStock = currentStock / dailyAvg

  if (daysOfStock < 1) return 'urgent'
  if (daysOfStock < 1.5) return 'low'
  return 'sufficient'
}

export function getSuggestedProduction(
  dailyAvg: number,
  currentStock: number,
  targetDays: number = 2,
): number {
  const target = dailyAvg * targetDays
  const needed = target - currentStock
  return Math.max(0, Math.ceil(needed * 10) / 10) // Round up to 0.1
}

export const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; bgColor: string }> = {
  urgent: { label: '急需生產', color: 'text-red-600', bgColor: 'bg-red-50' },
  low: { label: '庫存偏低', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  sufficient: { label: '庫存充足', color: 'text-green-600', bgColor: 'bg-green-50' },
}
