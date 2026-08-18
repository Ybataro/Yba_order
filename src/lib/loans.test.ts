import { describe, it, expect } from 'vitest'
import { monthsBetween, remainingAt, type Loan } from './loans'

const base: Loan = {
  id: 'loan_1', bank: '台新', name: '福祥路154號房貸',
  total_amount: 6880000, rate: 0.0249, periods: 240,
  remaining_amount: 5032641, remaining_as_of: '2026-08',
  monthly_principal: 25408, monthly_interest: 10643,
  is_active: true, sort_order: 1, note: '',
}

describe('monthsBetween', () => {
  it('同月為 0', () => expect(monthsBetween('2026-08', '2026-08')).toBe(0))
  it('跨年正確計算', () => expect(monthsBetween('2026-08', '2027-02')).toBe(6))
  it('查詢過去月份不回負數（否則餘額會被加大）', () =>
    expect(monthsBetween('2026-08', '2026-05')).toBe(0))
})

describe('remainingAt', () => {
  it('基準月回快照原值', () =>
    expect(remainingAt(base, '2026-08')).toBe(5032641))

  it('每過一個月扣一期本金', () =>
    expect(remainingAt(base, '2026-11')).toBe(5032641 - 3 * 25408))

  it('還清後歸零，不會變負數', () =>
    expect(remainingAt(base, '2126-08')).toBe(0))
})
