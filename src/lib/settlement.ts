export interface SettlementValue {
  field_id: string
  value: string
}

export function getVal(vals: SettlementValue[], fieldId: string): number {
  const v = vals.find((x) => x.field_id === fieldId)?.value
  return parseFloat(v || '') || 0
}

export function computeSession(vals: SettlementValue[]) {
  const posTotal = getVal(vals, 'posTotal')
  const orderCount = getVal(vals, 'orderCount')
  const staffCount = getVal(vals, 'staffCount')

  const openCash = getVal(vals, 'openCashBills') + getVal(vals, 'openCashCoins')
  const prevDay = getVal(vals, 'prevDayUndeposited')
  const invoiceRefund = getVal(vals, 'invoiceRefund')
  const invoiceRefund2 = getVal(vals, 'invoiceRefund2')
  const electronic = getVal(vals, 'easyPay') + getVal(vals, 'taiwanPay') + getVal(vals, 'allPay') + getVal(vals, 'linePay')
  const cashOut = getVal(vals, 'pettyCash') + getVal(vals, 'changeExchange')
  const deliveryFees = getVal(vals, 'uberFee') + getVal(vals, 'pandaFee')
  const otherExpense = getVal(vals, 'otherExpense')
  const nextDayPettyCash = getVal(vals, 'nextDayPettyCash')
  const otherIncome = getVal(vals, 'otherIncome')
  // 應結總金額 = POS + 開店找零 + 前日未存入 - 電腦發票退款 + 發票退款 - 電子支付 - 現金支出 - 外送費用 - 其他支出 - 次日零用金 + 其他收入
  const expectedTotal = posTotal + openCash + prevDay - invoiceRefund + invoiceRefund2 - electronic - cashOut - deliveryFees - otherExpense - nextDayPettyCash + otherIncome

  const cashTotal = getVal(vals, 'cash1000') * 1000 + getVal(vals, 'cash500') * 500 + getVal(vals, 'cash100') * 100 +
    getVal(vals, 'coin50') * 50 + getVal(vals, 'coin10') * 10 + getVal(vals, 'coin5') * 5 + getVal(vals, 'coin1') * 1

  const diff = cashTotal - expectedTotal

  const paymentBreakdown = [
    { label: '遊悠付', amount: getVal(vals, 'easyPay') },
    { label: '台灣PAY', amount: getVal(vals, 'taiwanPay') },
    { label: '全支付', amount: getVal(vals, 'allPay') },
    { label: 'LINEPAY', amount: getVal(vals, 'linePay') },
    { label: 'UBER', amount: getVal(vals, 'uberFee') },
    { label: 'foodpanda', amount: getVal(vals, 'pandaFee') },
  ].filter((p) => p.amount !== 0)

  const avgPrice = orderCount > 0 ? Math.round(posTotal / orderCount) : 0

  return { posTotal, orderCount, staffCount, expectedTotal, diff, cashTotal, paymentBreakdown, avgPrice }
}
