import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('zh-TW').format(num)
}

export function getTodayString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

// Why: 舊版 `new Date(dateStr + 'T00:00:00').toISOString().split('T')[0]` 會把
// 本地時間轉成 UTC（偏移 -8 小時），導致日期整體早一天。改用 +08:00 明確標記
// Asia/Taipei，並用 toLocaleDateString 而非 toISOString 取回字串。
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export function getWeekday(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WEEKDAYS[d.getDay()]}）`
}

export function formatDualUnit(qty: number, unit: string, boxUnit?: string, boxRatio?: number): string {
  if (!boxUnit || !boxRatio || boxRatio <= 0 || qty === 0) {
    return `${qty}${unit}`
  }
  const boxQty = Math.floor(qty / boxRatio)
  const unitQty = Math.round((qty - boxQty * boxRatio) * 100) / 100
  if (boxQty > 0 && unitQty > 0) return `${boxQty}${boxUnit}${unitQty}${unit}`
  if (boxQty > 0) return `${boxQty}${boxUnit}`
  return `${unitQty}${unit}`
}
