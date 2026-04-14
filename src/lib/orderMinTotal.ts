import { supabase } from '@/lib/supabase'

export interface OrderMinTotalEntry {
  productId: string
  minTotal: number
}

/**
 * 讀取指定門店所有最低總量設定。
 * 回傳 Map<productId, minTotal>，無設定的品項不在 Map 內。
 */
export async function fetchOrderMinTotals(storeId: string): Promise<Map<string, number>> {
  if (!supabase) return new Map()
  const { data, error } = await supabase
    .from('store_order_min_totals')
    .select('product_id, min_total')
    .eq('store_id', storeId)
  if (error) {
    console.error('[orderMinTotal] fetch failed:', error.message)
    return new Map()
  }
  const map = new Map<string, number>()
  data?.forEach(r => map.set(r.product_id as string, Number(r.min_total)))
  return map
}

/**
 * 批次儲存最低總量設定。
 * entries 中有值的執行 upsert，值為 null 的執行 delete（清除=關閉提醒）。
 */
export async function saveOrderMinTotals(
  storeId: string,
  entries: Array<{ productId: string; minTotal: number | null }>,
): Promise<void> {
  if (!supabase) return

  const toUpsert = entries.filter(e => e.minTotal != null && e.minTotal > 0)
  const toDelete = entries.filter(e => e.minTotal == null || e.minTotal <= 0).map(e => e.productId)

  const now = new Date().toISOString()

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('store_order_min_totals')
      .upsert(
        toUpsert.map(e => ({
          store_id: storeId,
          product_id: e.productId,
          min_total: e.minTotal!,
          updated_at: now,
        })),
        { onConflict: 'store_id,product_id' },
      )
    if (error) console.error('[orderMinTotal] upsert failed:', error.message)
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('store_order_min_totals')
      .delete()
      .eq('store_id', storeId)
      .in('product_id', toDelete)
    if (error) console.error('[orderMinTotal] delete failed:', error.message)
  }
}
