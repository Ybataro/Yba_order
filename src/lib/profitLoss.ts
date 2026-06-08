import { supabase } from '@/lib/supabase'
import { getVal, type SettlementValue } from '@/lib/settlement'

export interface ExpenseItem {
  id: string
  label: string
  amount: number
  note?: string                // 手動費用備註（讀 monthly_expenses.note）
  // 以下供 UI 顯示「自動計算來源」與「是否被手動覆寫」
  isAuto?: boolean
  autoField?: string | null
  rate?: number | null         // 此月生效的費率（如 0.30 表示 30%）
  rawValue?: number            // 計算用的 raw 值（如 uberFee 原始營業額）
  autoAmount?: number          // 自動算出的金額（未被 override 時 = amount）
  overridden?: boolean         // true = 此月使用手動覆寫值
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
  override_amount: number | null
  note: string | null
}

interface RateHistoryRow {
  category_id: string
  effective_from: string
  rate: number
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

  // 一店一份分類：lehua / xingnan / kitchen 各自獨立
  const { data: categories } = await supabase
    .from('expense_categories')
    .select('*')
    .eq('store_id', storeId)
    .order('sort_order')

  if (!categories) return null

  // 2. Fetch monthly manual expenses（含自動覆寫 + 備註）
  const { data: monthlyData } = await supabase
    .from('monthly_expenses')
    .select('category_id, amount, override_amount, note')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)

  const manualMap = new Map<string, number>()
  const overrideMap = new Map<string, number>()
  const noteMap = new Map<string, string>()
  ;(monthlyData || []).forEach((m: MonthlyExpense) => {
    manualMap.set(m.category_id, m.amount)
    if (m.override_amount != null) overrideMap.set(m.category_id, m.override_amount)
    if (m.note) noteMap.set(m.category_id, m.note)
  })

  // 2b. Fetch effective rates for this month（費率歷史版本）
  const autoCategoryIds = (categories as ExpenseCategory[])
    .filter(c => c.is_auto && c.auto_rate != null)
    .map(c => c.id)

  const effectiveRateMap = new Map<string, number>()
  if (autoCategoryIds.length > 0) {
    const { data: rateRows } = await supabase
      .from('expense_rate_history')
      .select('category_id, effective_from, rate')
      .in('category_id', autoCategoryIds)
      .lte('effective_from', yearMonth)
      .order('effective_from', { ascending: false })

    ;(rateRows || []).forEach((r: RateHistoryRow) => {
      // 同 category 多筆時，第一筆（最新生效）勝出
      if (!effectiveRateMap.has(r.category_id)) {
        effectiveRateMap.set(r.category_id, r.rate)
      }
    })
  }

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

    // 5b. Order cost: sum(actual_qty * our_cost) for this store's actual shipments
    // SSOT: 央廚實際出貨量（含主動出貨/補出貨）才是真實成本，order_items 是「店長叫貨意圖」
    // shipment_sessions.date = 出貨日
    const { data: shipmentSessions } = await supabase
      .from('shipment_sessions')
      .select('id')
      .eq('store_id', storeId)
      .gte('date', startDate)
      .lte('date', endDate)

    if (shipmentSessions && shipmentSessions.length > 0) {
      const sessionIds = shipmentSessions.map((s: { id: string }) => s.id)
      const { data: shipItems } = await supabase
        .from('shipment_items')
        .select('product_id, actual_qty')
        .in('session_id', sessionIds)

      if (shipItems) {
        const productIds = [...new Set(shipItems.map((i: { product_id: string }) => i.product_id))]
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('store_products')
            .select('id, our_cost')
            .in('id', productIds)

          const costMap = new Map<string, number>()
          ;(products || []).forEach((p: { id: string; our_cost: number }) => {
            costMap.set(p.id, p.our_cost || 0)
          })

          shipItems.forEach((item: { product_id: string; actual_qty: number }) => {
            const cost = costMap.get(item.product_id) || 0
            orderCostTotal += (item.actual_qty || 0) * cost
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
      // 此月份的有效費率（優先 history，否則 fallback 到 expense_categories.auto_rate）
      const effectiveRate = effectiveRateMap.get(cat.id) ?? cat.auto_rate

      let autoAmount = 0
      let rawValue: number | undefined
      if (cat.auto_field === 'dailyExpense') {
        autoAmount = dailyExpenseTotal
      } else if (cat.auto_field === 'orderCost') {
        autoAmount = Math.round(orderCostTotal)
      } else if (cat.auto_field && effectiveRate != null) {
        rawValue = settlementTotals[cat.auto_field] || 0
        autoAmount = Math.round(rawValue * effectiveRate)
      }

      // 月度覆寫：手動值優先
      const override = overrideMap.get(cat.id)
      const finalAmount = override != null ? override : autoAmount

      autoExpenses.push({
        id: cat.id,
        label: cat.label,
        amount: finalAmount,
        isAuto: true,
        autoField: cat.auto_field,
        rate: effectiveRate,
        rawValue,
        autoAmount,
        overridden: override != null,
      })
    } else {
      const amount = manualMap.get(cat.id) || 0
      const note = noteMap.get(cat.id) || ''
      manualExpenses.push({ id: cat.id, label: cat.label, amount, note, isAuto: false })
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

/**
 * 更新手動費用的備註（不動 amount）。空字串 = 清除備註。
 */
export async function upsertMonthlyExpenseNote(
  storeId: string,
  yearMonth: string,
  categoryId: string,
  note: string,
): Promise<boolean> {
  if (!supabase) return false
  // 先查既有 amount 避免覆蓋為 0
  const { data: existing } = await supabase
    .from('monthly_expenses')
    .select('amount')
    .eq('store_id', storeId)
    .eq('year_month', yearMonth)
    .eq('category_id', categoryId)
    .maybeSingle()
  const amount = existing?.amount ?? 0
  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(
      {
        store_id: storeId,
        year_month: yearMonth,
        category_id: categoryId,
        amount,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,year_month,category_id' },
    )
  return !error
}

/**
 * 設定自動類別的月度覆寫金額（傳 null = 清除覆寫，回到自動算）
 */
export async function setMonthlyOverride(
  storeId: string,
  yearMonth: string,
  categoryId: string,
  overrideAmount: number | null,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('monthly_expenses')
    .upsert(
      {
        store_id: storeId,
        year_month: yearMonth,
        category_id: categoryId,
        amount: 0, // 自動類別不用 amount，只用 override_amount
        override_amount: overrideAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,year_month,category_id' },
    )
  return !error
}

/**
 * 新增/更新費率（生效起始月份）
 * 同一 category + 同 effective_from 會被 upsert 取代
 */
export async function setExpenseRate(
  categoryId: string,
  effectiveFrom: string,
  rate: number,
  note: string = '',
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('expense_rate_history')
    .upsert(
      { category_id: categoryId, effective_from: effectiveFrom, rate, note },
      { onConflict: 'category_id,effective_from' },
    )
  return !error
}

/**
 * 取得指定 category 的所有費率歷史（按 effective_from 由新到舊）
 */
export async function getRateHistory(categoryId: string): Promise<{ effective_from: string; rate: number; note: string }[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('expense_rate_history')
    .select('effective_from, rate, note')
    .eq('category_id', categoryId)
    .order('effective_from', { ascending: false })
  return (data as { effective_from: string; rate: number; note: string }[] | null) || []
}

/**
 * 刪除特定費率版本
 */
export async function deleteRateVersion(categoryId: string, effectiveFrom: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('expense_rate_history')
    .delete()
    .eq('category_id', categoryId)
    .eq('effective_from', effectiveFrom)
  return !error
}
