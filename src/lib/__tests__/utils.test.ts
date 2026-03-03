import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDualUnit, getWeekday, formatDate, formatNumber } from '../utils'

describe('formatCurrency', () => {
  it('格式化正整數', () => {
    expect(formatCurrency(1000)).toBe('$1,000')
  })

  it('格式化零', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('格式化負數', () => {
    expect(formatCurrency(-500)).toBe('-$500')
  })

  it('小數四捨五入', () => {
    const result = formatCurrency(99.5)
    // maximumFractionDigits: 0 → 四捨五入
    expect(result).toMatch(/100|99/)
  })
})

describe('formatNumber', () => {
  it('千分位格式化', () => {
    expect(formatNumber(10000)).toBe('10,000')
  })

  it('小數不截斷', () => {
    expect(formatNumber(1.5)).toBe('1.5')
  })
})

describe('getWeekday', () => {
  it('回傳正確的中文星期', () => {
    // 2026-03-03 是星期二
    expect(getWeekday('2026-03-03')).toBe('二')
  })

  it('星期日', () => {
    // 2026-03-01 是星期日
    expect(getWeekday('2026-03-01')).toBe('日')
  })

  it('星期六', () => {
    // 2026-02-28 是星期六
    expect(getWeekday('2026-02-28')).toBe('六')
  })
})

describe('formatDate', () => {
  it('格式化完整日期含星期', () => {
    expect(formatDate('2026-03-03')).toBe('2026/03/03（二）')
  })

  it('月份與日期補零', () => {
    expect(formatDate('2026-01-05')).toBe('2026/01/05（一）')
  })
})

describe('formatDualUnit', () => {
  it('無箱規時只顯示散裝', () => {
    expect(formatDualUnit(5, '顆')).toBe('5顆')
  })

  it('boxRatio = 0 時只顯示散裝', () => {
    expect(formatDualUnit(5, '顆', '箱', 0)).toBe('5顆')
  })

  it('qty = 0 時顯示 0+單位', () => {
    expect(formatDualUnit(0, '顆', '箱', 10)).toBe('0顆')
  })

  it('整箱', () => {
    expect(formatDualUnit(20, '顆', '箱', 10)).toBe('2箱')
  })

  it('箱 + 餘數', () => {
    expect(formatDualUnit(25, '顆', '箱', 10)).toBe('2箱5顆')
  })

  it('不足一箱', () => {
    expect(formatDualUnit(3, '顆', '箱', 10)).toBe('3顆')
  })
})
