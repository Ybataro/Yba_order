import { supabase } from '@/lib/supabase'

// 業務：每週一訂貨豆漿
// 公式：上週使用量 = 上週庫存 + 前次進貨 − 訂貨日庫存 − 過期損耗
//      本週訂貨量 = 上週使用量 − 訂貨日庫存 + 上週使用量÷7×3，保底 5
// SKU：p019 微糖、p020 無糖（排除 p1773123026632 豆花用）

export const DOUJIANG_WEITANG_ID = 'p019'  // 微糖豆漿
export const DOUJIANG_WUTANG_ID = 'p020'   // 無糖豆漿
const MIN_ORDER_QTY = 5
// 豆漿袋裝克數（如果之後 store_products.bag_weight 改了，可改為動態抓）
const DOUJIANG_BAG_WEIGHT = 2500

/** 門店盤點：總計 = on_shelf / bag_weight + stock（袋） */
function storeTotalBags(stock: number, onShelf: number): number {
  return (onShelf / DOUJIANG_BAG_WEIGHT) + stock
}

export interface DoujiangVariantData {
  prevStock: number          // 上週庫存
  prevReceived: number       // 前次進貨（上週合計）
  orderStock: number         // 訂貨日庫存合計（樂華+興南+央廚）
  discarded: number          // 過期損耗（上週合計）
  usage: number              // 上週使用量（公式算）
  recommended: number        // 本週推薦訂貨量（公式算 + 保底）
}

export interface DoujiangOrderRow {
  id: string
  order_date: string
  weitang_prev_stock: number
  weitang_prev_received: number
  weitang_order_stock: number
  weitang_discarded: number
  weitang_usage: number
  weitang_recommended: number
  weitang_actual_ordered: number
  wutang_prev_stock: number
  wutang_prev_received: number
  wutang_order_stock: number
  wutang_discarded: number
  wutang_usage: number
  wutang_recommended: number
  wutang_actual_ordered: number
  snapshot_kitchen: { weitang?: number; wutang?: number }
  snapshot_lehua: { weitang?: number; wutang?: number }
  snapshot_xingnan: { weitang?: number; wutang?: number }
  status: 'draft' | 'sent'
  sent_at: string | null
  note: string
  submitted_by: string | null
  created_at: string
  updated_at: string
}

/**
 * 計算本週訂貨建議量
 * usage = prevStock + prevReceived − orderStock − discarded
 * recommended = max(MIN_ORDER_QTY, usage − orderStock + usage/7*3)
 */
export function computeDoujiangVariant(
  prevStock: number,
  prevReceived: number,
  orderStock: number,
  discarded: number,
): { usage: number; recommended: number } {
  const usage = prevStock + prevReceived - orderStock - discarded
  const raw = usage - orderStock + (usage / 7) * 3
  // 訂貨量整數四捨五入（袋裝不能切），保底 5 袋
  const recommended = Math.max(MIN_ORDER_QTY, Math.round(raw))
  return { usage: Math.round(usage * 10) / 10, recommended }
}

function fmtDate(x: Date): string {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function shiftDate(orderDate: string, deltaDays: number): string {
  const d = new Date(orderDate + 'T00:00:00')
  d.setDate(d.getDate() + deltaDays)
  return fmtDate(d)
}

/**
 * 取得指定日期的「上週一 ~ 上週日」區間（訂貨日的前 7 天到前 1 天）
 */
function getPrevWeekRange(orderDate: string): { from: string; to: string } {
  return { from: shiftDate(orderDate, -7), to: shiftDate(orderDate, -1) }
}

/**
 * 訂貨日庫存抓取日期：
 * - 門店：D-1（週日盤點，週一早上訂貨時抓昨晚的）
 * - 央廚：D-2（央廚週日沒盤點，抓週六的）
 * 業務：訂貨在週一早上，盤點在週一晚上 23:30，所以「訂貨日」抓 D-1 / D-2
 */
function getOrderStockDates(orderDate: string): { storeDate: string; kitchenDate: string } {
  return {
    storeDate: shiftDate(orderDate, -1),
    kitchenDate: shiftDate(orderDate, -2),
  }
}

interface AutoFillResult {
  weitang: DoujiangVariantData
  wutang: DoujiangVariantData
  snapshot: {
    kitchen: { weitang: number; wutang: number }
    lehua: { weitang: number; wutang: number }
    xingnan: { weitang: number; wutang: number }
  }
  /** 過期損耗三方拆解（上週合計）*/
  discardedBreakdown: {
    kitchen: { weitang: number; wutang: number }
    lehua: { weitang: number; wutang: number }
    xingnan: { weitang: number; wutang: number }
  }
  isFirstOrder: boolean       // 沒有上一筆 doujiang_orders 時 = true（首次上線）
}

/**
 * 訂貨日自動帶出所有公式變數（除了 prev_stock/prev_received 首次需手填）
 */
export async function autoFillDoujiangOrder(orderDate: string): Promise<AutoFillResult | null> {
  if (!supabase) return null

  const { from: prevWeekFrom, to: prevWeekTo } = getPrevWeekRange(orderDate)
  const { storeDate, kitchenDate } = getOrderStockDates(orderDate)
  const ids = [DOUJIANG_WEITANG_ID, DOUJIANG_WUTANG_ID]

  // 1. 訂貨日庫存：門店抓 D-1（週日盤點）、央廚抓 D-2（央廚週日無盤點）
  // 門店「總計（袋）」= on_shelf / bag_weight + stock（架上克數換成袋 + 庫存袋數）
  const [lehuaInvRes, xingnanInvRes, kitchenStockRes] = await Promise.all([
    supabase.from('inventory_items')
      .select('product_id, stock, on_shelf, inventory_sessions!inner(store_id, date)')
      .in('product_id', ids)
      .eq('inventory_sessions.store_id', 'lehua')
      .eq('inventory_sessions.date', storeDate),
    supabase.from('inventory_items')
      .select('product_id, stock, on_shelf, inventory_sessions!inner(store_id, date)')
      .in('product_id', ids)
      .eq('inventory_sessions.store_id', 'xingnan')
      .eq('inventory_sessions.date', storeDate),
    supabase.from('product_stock_items')
      .select('product_id, stock_qty, product_stock_sessions!inner(date)')
      .in('product_id', ids)
      .eq('product_stock_sessions.date', kitchenDate),
  ])

  const lehuaStock = sumStoreTotal(lehuaInvRes.data)
  const xingnanStock = sumStoreTotal(xingnanInvRes.data)
  const kitchenStock = sumByProduct(kitchenStockRes.data, 'product_id', 'stock_qty')

  // 2. 上週進貨（shipment_items.actual_qty 合計）
  const { data: shipData } = await supabase
    .from('shipment_items')
    .select('product_id, actual_qty, shipment_sessions!inner(date)')
    .in('product_id', ids)
    .gte('shipment_sessions.date', prevWeekFrom)
    .lte('shipment_sessions.date', prevWeekTo)

  const shipSum = sumByProduct(shipData, 'product_id', 'actual_qty')

  // 3. 過期損耗（樂華 / 興南 inventory.discarded + 央廚 product_stock.discarded）
  const [lehuaDiscRes, xingnanDiscRes, kitchenDiscRes] = await Promise.all([
    supabase.from('inventory_items')
      .select('product_id, discarded, inventory_sessions!inner(store_id, date)')
      .in('product_id', ids)
      .eq('inventory_sessions.store_id', 'lehua')
      .gte('inventory_sessions.date', prevWeekFrom)
      .lte('inventory_sessions.date', prevWeekTo),
    supabase.from('inventory_items')
      .select('product_id, discarded, inventory_sessions!inner(store_id, date)')
      .in('product_id', ids)
      .eq('inventory_sessions.store_id', 'xingnan')
      .gte('inventory_sessions.date', prevWeekFrom)
      .lte('inventory_sessions.date', prevWeekTo),
    supabase.from('product_stock_items')
      .select('product_id, discarded, product_stock_sessions!inner(date)')
      .in('product_id', ids)
      .gte('product_stock_sessions.date', prevWeekFrom)
      .lte('product_stock_sessions.date', prevWeekTo),
  ])
  const lehuaDisc = sumByProduct(lehuaDiscRes.data, 'product_id', 'discarded')
  const xingnanDisc = sumByProduct(xingnanDiscRes.data, 'product_id', 'discarded')
  const kitchenDisc = sumByProduct(kitchenDiscRes.data, 'product_id', 'discarded')

  // 4. 上一筆 doujiang_orders → 上週庫存 + 前次進貨
  const { data: prevOrders } = await supabase
    .from('doujiang_orders')
    .select('*')
    .lt('order_date', orderDate)
    .order('order_date', { ascending: false })
    .limit(1)

  const prev = (prevOrders && prevOrders[0]) as DoujiangOrderRow | undefined
  const isFirstOrder = !prev

  const weitangOrderStock = (lehuaStock[DOUJIANG_WEITANG_ID] || 0) + (xingnanStock[DOUJIANG_WEITANG_ID] || 0) + (kitchenStock[DOUJIANG_WEITANG_ID] || 0)
  const weitangDiscarded = (lehuaDisc[DOUJIANG_WEITANG_ID] || 0) + (xingnanDisc[DOUJIANG_WEITANG_ID] || 0) + (kitchenDisc[DOUJIANG_WEITANG_ID] || 0)
  const weitangPrevStock = prev?.weitang_order_stock || 0
  const weitangPrevReceived = shipSum[DOUJIANG_WEITANG_ID] || 0
  const weitangCalc = computeDoujiangVariant(weitangPrevStock, weitangPrevReceived, weitangOrderStock, weitangDiscarded)

  const wutangOrderStock = (lehuaStock[DOUJIANG_WUTANG_ID] || 0) + (xingnanStock[DOUJIANG_WUTANG_ID] || 0) + (kitchenStock[DOUJIANG_WUTANG_ID] || 0)
  const wutangDiscarded = (lehuaDisc[DOUJIANG_WUTANG_ID] || 0) + (xingnanDisc[DOUJIANG_WUTANG_ID] || 0) + (kitchenDisc[DOUJIANG_WUTANG_ID] || 0)
  const wutangPrevStock = prev?.wutang_order_stock || 0
  const wutangPrevReceived = shipSum[DOUJIANG_WUTANG_ID] || 0
  const wutangCalc = computeDoujiangVariant(wutangPrevStock, wutangPrevReceived, wutangOrderStock, wutangDiscarded)

  return {
    weitang: {
      prevStock: weitangPrevStock,
      prevReceived: weitangPrevReceived,
      orderStock: weitangOrderStock,
      discarded: weitangDiscarded,
      usage: weitangCalc.usage,
      recommended: weitangCalc.recommended,
    },
    wutang: {
      prevStock: wutangPrevStock,
      prevReceived: wutangPrevReceived,
      orderStock: wutangOrderStock,
      discarded: wutangDiscarded,
      usage: wutangCalc.usage,
      recommended: wutangCalc.recommended,
    },
    snapshot: {
      kitchen: { weitang: kitchenStock[DOUJIANG_WEITANG_ID] || 0, wutang: kitchenStock[DOUJIANG_WUTANG_ID] || 0 },
      lehua: { weitang: lehuaStock[DOUJIANG_WEITANG_ID] || 0, wutang: lehuaStock[DOUJIANG_WUTANG_ID] || 0 },
      xingnan: { weitang: xingnanStock[DOUJIANG_WEITANG_ID] || 0, wutang: xingnanStock[DOUJIANG_WUTANG_ID] || 0 },
    },
    discardedBreakdown: {
      kitchen: { weitang: kitchenDisc[DOUJIANG_WEITANG_ID] || 0, wutang: kitchenDisc[DOUJIANG_WUTANG_ID] || 0 },
      lehua: { weitang: lehuaDisc[DOUJIANG_WEITANG_ID] || 0, wutang: lehuaDisc[DOUJIANG_WUTANG_ID] || 0 },
      xingnan: { weitang: xingnanDisc[DOUJIANG_WEITANG_ID] || 0, wutang: xingnanDisc[DOUJIANG_WUTANG_ID] || 0 },
    },
    isFirstOrder,
  }
}

function sumByProduct(rows: unknown[] | null, idKey: string, valKey: string): Record<string, number> {
  const acc: Record<string, number> = {}
  ;(rows || []).forEach((r) => {
    const row = r as Record<string, unknown>
    const pid = row[idKey] as string
    const val = Number(row[valKey]) || 0
    acc[pid] = (acc[pid] || 0) + val
  })
  return acc
}

/** 門店「總計（袋）」加總：on_shelf/bag_weight + stock */
function sumStoreTotal(rows: unknown[] | null): Record<string, number> {
  const acc: Record<string, number> = {}
  ;(rows || []).forEach((r) => {
    const row = r as Record<string, unknown>
    const pid = row['product_id'] as string
    const stock = Number(row['stock']) || 0
    const onShelf = Number(row['on_shelf']) || 0
    acc[pid] = (acc[pid] || 0) + storeTotalBags(stock, onShelf)
  })
  // 四捨五入到 2 位（與門店盤點 UI 顯示一致）
  Object.keys(acc).forEach((k) => { acc[k] = Math.round(acc[k] * 100) / 100 })
  return acc
}

/**
 * 列出歷史訂貨記錄（由新到舊）
 */
export async function listDoujiangOrders(limit = 20): Promise<DoujiangOrderRow[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('doujiang_orders')
    .select('*')
    .order('order_date', { ascending: false })
    .limit(limit)
  return (data as DoujiangOrderRow[] | null) || []
}

/**
 * 取得指定日期的訂貨記錄
 */
export async function getDoujiangOrder(orderDate: string): Promise<DoujiangOrderRow | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('doujiang_orders')
    .select('*')
    .eq('order_date', orderDate)
    .maybeSingle()
  return (data as DoujiangOrderRow | null) || null
}

export interface SaveDoujiangInput {
  orderDate: string
  weitang: DoujiangVariantData & { actualOrdered: number }
  wutang: DoujiangVariantData & { actualOrdered: number }
  snapshot: {
    kitchen: { weitang: number; wutang: number }
    lehua: { weitang: number; wutang: number }
    xingnan: { weitang: number; wutang: number }
  }
  status: 'draft' | 'sent'
  note: string
  submittedBy: string | null
}

export async function saveDoujiangOrder(input: SaveDoujiangInput): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'no supabase' }
  const payload = {
    order_date: input.orderDate,
    weitang_prev_stock: input.weitang.prevStock,
    weitang_prev_received: input.weitang.prevReceived,
    weitang_order_stock: input.weitang.orderStock,
    weitang_discarded: input.weitang.discarded,
    weitang_usage: input.weitang.usage,
    weitang_recommended: input.weitang.recommended,
    weitang_actual_ordered: input.weitang.actualOrdered,
    wutang_prev_stock: input.wutang.prevStock,
    wutang_prev_received: input.wutang.prevReceived,
    wutang_order_stock: input.wutang.orderStock,
    wutang_discarded: input.wutang.discarded,
    wutang_usage: input.wutang.usage,
    wutang_recommended: input.wutang.recommended,
    wutang_actual_ordered: input.wutang.actualOrdered,
    snapshot_kitchen: input.snapshot.kitchen,
    snapshot_lehua: input.snapshot.lehua,
    snapshot_xingnan: input.snapshot.xingnan,
    status: input.status,
    sent_at: input.status === 'sent' ? new Date().toISOString() : null,
    note: input.note,
    submitted_by: input.submittedBy,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('doujiang_orders')
    .upsert(payload, { onConflict: 'order_date' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteDoujiangOrder(orderDate: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('doujiang_orders').delete().eq('order_date', orderDate)
  return !error
}
