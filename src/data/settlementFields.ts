export interface SettlementField {
  id: string
  label: string
  group: string
  type: 'input' | 'text'
  multiplier?: number
  unit?: string
}

export const settlementGroups = [
  '營運資訊',
  '結帳金額',
  '支付方式',
  '外送平台',
  '其它收支',
  '實收盤點',
] as const

export const settlementFields: SettlementField[] = [
  { id: 'orderCount', label: '今日號數', group: '營運資訊', type: 'input', unit: '號' },
  { id: 'staffCount', label: '上班人力', group: '營運資訊', type: 'input', unit: '人' },

  { id: 'posTotal', label: 'POS結帳金額', group: '結帳金額', type: 'input', unit: '元' },
  { id: 'invoiceRefund', label: '電腦發票退款', group: '結帳金額', type: 'input' },
  { id: 'openCashBills', label: '開店佰鈔', group: '結帳金額', type: 'input' },
  { id: 'openCashCoins', label: '開店零錢', group: '結帳金額', type: 'input' },

  { id: 'easyPay', label: '遊悠付', group: '支付方式', type: 'input' },
  { id: 'taiwanPay', label: '台灣PAY', group: '支付方式', type: 'input' },
  { id: 'allPay', label: '全支付', group: '支付方式', type: 'input' },
  { id: 'linePay', label: 'LINEPAY', group: '支付方式', type: 'input' },
  { id: 'pettyCash', label: '零用金申請', group: '支付方式', type: 'input' },
  { id: 'invoiceRefund2', label: '發票退款', group: '支付方式', type: 'input' },
  { id: 'prevDayUndeposited', label: '前日未存入金額', group: '支付方式', type: 'input' },
  { id: 'changeExchange', label: '換零錢', group: '支付方式', type: 'input' },
  { id: 'nextDayPettyCash', label: '次日零用金', group: '支付方式', type: 'input' },

  { id: 'uberFee', label: 'UBER訂單費用', group: '外送平台', type: 'input' },
  { id: 'pandaFee', label: 'foodpanda訂單費用', group: '外送平台', type: 'input' },

  { id: 'otherExpense', label: '其它支出', group: '其它收支', type: 'input' },
  { id: 'otherExpenseNote', label: '其它支出說明', group: '其它收支', type: 'text' },
  { id: 'otherIncome', label: '其它收入', group: '其它收支', type: 'input' },
  { id: 'otherIncomeNote', label: '其它收入說明', group: '其它收支', type: 'text' },

  { id: 'cash1000', label: '仟鈔', group: '實收盤點', type: 'input', multiplier: 1000, unit: '張' },
  { id: 'cash500', label: '伍佰鈔', group: '實收盤點', type: 'input', multiplier: 500, unit: '張' },
  { id: 'cash100', label: '佰鈔', group: '實收盤點', type: 'input', multiplier: 100, unit: '張' },
  { id: 'coin50', label: '50元', group: '實收盤點', type: 'input', multiplier: 50, unit: '枚' },
  { id: 'coin10', label: '10元', group: '實收盤點', type: 'input', multiplier: 10, unit: '枚' },
  { id: 'coin5', label: '5元', group: '實收盤點', type: 'input', multiplier: 5, unit: '枚' },
  { id: 'coin1', label: '1元', group: '實收盤點', type: 'input', multiplier: 1, unit: '枚' },

]
