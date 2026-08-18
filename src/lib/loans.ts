import { supabase } from '@/lib/supabase'

export interface Loan {
  id: string
  bank: string
  name: string
  total_amount: number
  rate: number | null
  periods: number | null
  remaining_amount: number
  remaining_as_of: string      // YYYY-MM 快照基準月
  monthly_principal: number
  monthly_interest: number
  is_active: boolean
  sort_order: number
  note: string
}

/** 兩個 YYYY-MM 相差幾個月（b − a），b 早於 a 時回 0 */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return Math.max(0, (ty - fy) * 12 + (tm - fm))
}

/**
 * 推算指定月份的剩餘本金：快照餘額 − 已過月數 × 月繳本金。
 * 避免每月手動更新餘額；還清後歸零不會變負數。
 */
export function remainingAt(loan: Loan, yearMonth: string): number {
  const elapsed = monthsBetween(loan.remaining_as_of, yearMonth)
  return Math.max(0, loan.remaining_amount - elapsed * loan.monthly_principal)
}

export interface LoanSummary {
  loans: Loan[]
  monthlyPrincipal: number
  monthlyInterest: number
  monthlyTotal: number
  totalRemaining: number   // 指定月份推算後的剩餘負債總額
}

/** 取得所有啟用中的貸款，並彙總指定月份的負債狀態 */
export async function fetchLoanSummary(yearMonth: string): Promise<LoanSummary> {
  const empty: LoanSummary = {
    loans: [], monthlyPrincipal: 0, monthlyInterest: 0, monthlyTotal: 0, totalRemaining: 0,
  }
  if (!supabase) return empty

  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const loans = (data as Loan[] | null) || []

  // 已還清的貸款不再計入月繳（剩餘為 0 表示期滿）
  const active = loans.filter((l) => remainingAt(l, yearMonth) > 0)

  return {
    loans,
    monthlyPrincipal: active.reduce((s, l) => s + l.monthly_principal, 0),
    monthlyInterest: active.reduce((s, l) => s + l.monthly_interest, 0),
    monthlyTotal: active.reduce((s, l) => s + l.monthly_principal + l.monthly_interest, 0),
    totalRemaining: loans.reduce((s, l) => s + remainingAt(l, yearMonth), 0),
  }
}

/**
 * 年度彙總：逐月累加，讓年中還清的貸款不會被多算月份。
 * totalRemaining 取年底（12 月）推算值。
 */
export async function fetchLoanSummaryForYear(year: number): Promise<LoanSummary> {
  const empty: LoanSummary = {
    loans: [], monthlyPrincipal: 0, monthlyInterest: 0, monthlyTotal: 0, totalRemaining: 0,
  }
  if (!supabase) return empty

  const { data } = await supabase
    .from('loans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const loans = (data as Loan[] | null) || []
  let principal = 0
  let interest = 0

  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    loans.forEach((l) => {
      if (remainingAt(l, ym) > 0) {
        principal += l.monthly_principal
        interest += l.monthly_interest
      }
    })
  }

  return {
    loans,
    monthlyPrincipal: principal,
    monthlyInterest: interest,
    monthlyTotal: principal + interest,
    totalRemaining: loans.reduce((s, l) => s + remainingAt(l, `${year}-12`), 0),
  }
}

export async function upsertLoan(loan: Loan): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('loans')
    .upsert({ ...loan, updated_at: new Date().toISOString() })
  return !error
}

export async function deleteLoan(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('loans').delete().eq('id', id)
  return !error
}
