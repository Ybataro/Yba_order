// === Session ID builders ===

export function inventorySessionId(storeId: string, date: string, zoneCode: string): string {
  const z = zoneCode ? zoneCode.toLowerCase() : ''
  return z ? `${storeId}_${date}_${z}` : `${storeId}_${date}`
}

export function orderSessionId(storeId: string, date: string): string {
  return `${storeId}_${date}`
}

export function settlementSessionId(storeId: string, date: string): string {
  return `${storeId}_${date}`
}

export function shipmentSessionId(storeId: string, date: string): string {
  return `${storeId}_${date}`
}

export function materialStockSessionId(date: string): string {
  return `kitchen_${date}`
}

export function materialOrderSessionId(date: string): string {
  return `kitchen_${date}`
}

// === Taiwan timezone helpers ===

/** YYYY-MM-DD in Asia/Taipei */
export function getTodayTW(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
}

/** 叫貨修改截止：隔天 08:00 台灣時間 (= 隔天 00:00 UTC) */
export function getOrderDeadline(orderDate: string): string {
  const [y, m, d] = orderDate.split('-').map(Number)
  // 08:00 +08:00 = 00:00 UTC, 所以 next day 00:00 UTC
  const deadline = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0))
  return deadline.toISOString()
}

/** 是否已超過截止時間 */
export function isPastDeadline(deadline: string): boolean {
  return new Date() >= new Date(deadline)
}
