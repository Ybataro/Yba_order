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

  const deductions = getVal(vals, 'invoiceRefund') + getVal(vals, 'openCashBills') + getVal(vals, 'openCashCoins')
  const payments = getVal(vals, 'easyPay') + getVal(vals, 'taiwanPay') + getVal(vals, 'allPay') + getVal(vals, 'linePay') +
    getVal(vals, 'pettyCash') + getVal(vals, 'invoiceRefund2') + getVal(vals, 'prevDayUndeposited') + getVal(vals, 'changeExchange')
  const deliveryFees = getVal(vals, 'uberFee') + getVal(vals, 'pandaFee')
  const otherExpense = getVal(vals, 'otherExpense')
  const otherIncome = getVal(vals, 'otherIncome')
  const expectedTotal = posTotal - deductions - payments - deliveryFees - otherExpense + otherIncome

  const cashTotal = getVal(vals, 'cash1000') * 1000 + getVal(vals, 'cash500') * 500 + getVal(vals, 'cash100') * 100 +
    getVal(vals, 'coin50') * 50 + getVal(vals, 'coin10') * 10 + getVal(vals, 'coin5') * 5 + getVal(vals, 'coin1') * 1

  const safeTotal = getVal(vals, 'safe1000') * 1000 + getVal(vals, 'safe100') * 100 +
    getVal(vals, 'safe50') * 3000 + getVal(vals, 'safe10') * 1000 + getVal(vals, 'safe5') * 500

  const actualTotal = cashTotal + safeTotal
  const diff = actualTotal - expectedTotal

  const paymentBreakdown = [
    { label: '遊悠付', amount: getVal(vals, 'easyPay') },
    { label: '台灣PAY', amount: getVal(vals, 'taiwanPay') },
    { label: '全支付', amount: getVal(vals, 'allPay') },
    { label: 'LINEPAY', amount: getVal(vals, 'linePay') },
    { label: 'UBER', amount: getVal(vals, 'uberFee') },
    { label: 'foodpanda', amount: getVal(vals, 'pandaFee') },
  ].filter((p) => p.amount !== 0)

  const avgPrice = orderCount > 0 ? Math.round(posTotal / orderCount) : 0

  return { posTotal, orderCount, staffCount, expectedTotal, actualTotal, diff, cashTotal, safeTotal, paymentBreakdown, avgPrice }
}
