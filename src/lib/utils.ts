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
