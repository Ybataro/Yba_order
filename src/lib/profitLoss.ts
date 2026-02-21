import { supabase } from '@/lib/supabase'
import { getVal, type SettlementValue } from '@/lib/settlement'

export interface ExpenseItem {
  id: string
  label: string
  amount: number
}

export interface PnLResult {
  revenue: number
  autoExpenses: ExpenseItem[]
  manualExpenses: ExpenseItem[]
  totalExpense: number
  surplus: number
  taxReserve: number
  netSurplus: number
}

interface ExpenseCategory {
  id: string
  label: string
  store_id: string
  sort_order: number
  is_auto: boolean
  auto_field: string | null
  auto_rate: number | null
}

interface MonthlyExpense {
  category_id: string
  amount: number
}

const TAX_RESERVE_RATE = 0.15

/**
 * Compute monthly P&L for a store or kitchen.
 */
export async function computeMonthlyPnL(
  storeId: string,
  yearMonth: string,
): Promise<PnLResult | null> {
  if (!supabase) return null

  const isKitchen = storeId === 'kitchen'
  const categoryStoreId = isKitchen ? 'kitchen' : 'store'

  // 1. Fetch expense categories
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('store_id', categoryStoreId)
    .order('sort_order')

  if (!categories) return null

  // 2. Fetch monthly manual expenses
  const { data: monthlyData } = await supabase
    .from('monthly_expenses')
    .select('category_id, amount')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)

  const manualMap = new Map<string, number>()
  ;(monthlyData || []).forEach((m: MonthlyExpense) => {
    manualMap.set(m.category_id, m.amount)
  })

  // 3. Compute date range for the month
  const [year, month] = yearMonth.split('-').map(Number)
  const startDate = `${yearMonth}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  // 4. Fetch daily expenses total for the month
  const { data: dailyExpData } = await supabase
    .from('daily_expenses')
    .select('amount')
    .eq('store_id', storeId)
    .gte('date', startDate)
    .lte('date', endDate)

  const dailyExpenseTotal = (dailyExpData || []).reduce(
    (sum: number, r: { amount: number }) => sum + r.amount,
    0,
  )

  // 5. For stores: fetch settlement data and order costs
  let revenue = 0
  let settlementTotals: Record<string, number> = {}
  let orderCostTotal = 0

  if (!isKitchen) {
    // 5a. Settlement sessions for the month
    const { data: sessions } = await supabase
      .from('settlement_sessions')
      .select('*, settlement_values(*)')
      .eq('store_id', storeId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (sessions) {
      sessions.forEach((s: { settlement_values: SettlementValue[] }) => {
        const vals = s.settlement_values || []
        revenue += getVal(vals, 'posTotal')
        // Accumulate raw values for fee calculations
        const fields = ['posTotal', 'uberFee', 'pandaFee', 'linePay']
        fields.forEach((f) => {
          settlementTotals[f] = (settlementTotals[f] || 0) + getVal(vals, f)
        })
      })
    }

    // 5b. Order cost: sum(quantity * our_cost) for this store's orders
    // Orders use "隔日到貨" logic: order_sessions.date = 下單日
    // We query orders whose date falls in the month
    const { data: orderSessions } = await supabase
      .from('order_sessions')
      .select('id')
      .eq('store_id', storeId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (orderSessions && orderSessions.length > 0) {
      const sessionIds = orderSessions.map((s: { id: string }) => s.id)
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .in('session_id', sessionIds)

      if (orderItems) {
        // Fetch product costs
        const productIds = [...new Set(orderItems.map((i: { product_id: string }) => i.product_id))]
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('store_products')
            .select('id, our_cost')
            .in('id', productIds)

          const costMap = new Map<string, number>()
          ;(products || []).forEach((p: { id: string; our_cost: number }) => {
            costMap.set(p.id, p.our_cost || 0)
          })

          orderItems.forEach((item: { product_id: string; quantity: number }) => {
            const cost = costMap.get(item.product_id) || 0
            orderCostTotal += (item.quantity || 0) * cost
          })
        }
      }
    }
  }

  // 6. Build expense items
  const autoExpenses: ExpenseItem[] = []
  const manualExpenses: ExpenseItem[] = []

  ;(categories as ExpenseCategory[]).forEach((cat) => {
    if (cat.is_auto) {
      let amount = 0
      if (cat.auto_field === 'dailyExpense') {
        amount = dailyExpenseTotal
      } else if (cat.auto_field === 'orderCost') {
        amount = Math.round(orderCostTotal)
      } else if (cat.auto_field && cat.auto_rate != null) {
        // Fee = raw value * rate (e.g., uberFee * 0.30 means the fee IS the raw uberFee value,
        // but for posTotal * 0.05 = business tax)
        const rawValue = settlementTotals[cat.auto_field] || 0
        if (cat.auto_field === 'posTotal') {
          // Business tax: posTotal * rate
          amount = Math.round(rawValue * cat.auto_rate)
        } else {
          // Platform fees: the raw settlement value IS the fee amount already
          // e.g., uberFee field already contains the delivery fee total
          // But the plan says rate = 0.30 for Uber meaning revenue * 0.30
          // Actually looking at settlement: uberFee = UBER訂單費用 (the order revenue from Uber)
          // So the commission = uberFee * rate
          amount = Math.round(rawValue * cat.auto_rate)
        }
      }
      autoExpenses.push({ id: cat.id, label: cat.label, amount })
    } else {
      const amount = manualMap.get(cat.id) || 0
      manualExpenses.push({ id: cat.id, label: cat.label, amount })
    }
  })

  const totalExpense = autoExpenses.reduce((s, e) => s + e.amount, 0) +
    manualExpenses.reduce((s, e) => s + e.amount, 0)

  const surplus = revenue - totalExpense
  const taxReserve = surplus > 0 ? Math.round(surplus * TAX_RESERVE_RATE) : 0
  const netSurplus = surplus - taxReserve

  return {
    revenue,
    autoExpenses,
    manualExpenses,
    totalExpense,
    surplus,
    taxReserve,
    netSurplus,
  }
}

/**
 * Compute yearly P&L summary (12 months).
 */
export async function computeYearlyPnL(
  storeId: string,
  year: number,
): Promise<{ months: { yearMonth: string; revenue: number; totalExpense: number; surplus: number }[]; totals: { revenue: number; totalExpense: number; surplus: number } } | null> {
  const months: { yearMonth: string; revenue: number; totalExpense: number; surplus: number }[] = []
  let totalRevenue = 0
  let totalExpense = 0
  let totalSurplus = 0

  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const result = await computeMonthlyPnL(storeId, ym)
    const revenue = result?.revenue || 0
    const expense = result?.totalExpense || 0
    const surplus = revenue - expense
    months.push({ yearMonth: ym, revenue, totalExpense: expense, surplus })
    totalRevenue += revenue
    totalExpense += expense
    totalSurplus += surplus
  }

  return {
    months,
    totals: { revenue: totalRevenue, totalExpense, surplus: totalSurplus },
  }
}

/**
 * Upsert a monthly manual expense.
 */
export async function upsertMonthlyExpense(
  storeId: string,
  yearMonth: string,
  categoryId: string,
  amount: number,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(
      {
        store_id: storeId,
        year_month: yearMonth,
        category_id: categoryId,
        amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,year_month,category_id' },
    )
  return !error
}
