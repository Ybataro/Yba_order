import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'

// ── Types ──────────────────────────────────────────────

export interface Notification {
  id: string
  type: 'low_stock' | 'order_reminder' | 'shipment_pending' | 'settlement_reminder' | 'shift_change'
  severity: 'warning' | 'info' | 'critical'
  icon: string
  title: string
  message: string
  link?: string
  productIds?: string[]
}

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  dismiss: (id: string) => void
  dismissAll: () => void
  refresh: () => void
}

// ── localStorage helpers ───────────────────────────────

const DISMISSED_KEY = 'dismissed_notifications'

function getDismissed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}')
  } catch { return {} }
}

function setDismissed(map: Record<string, number>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(map))
}

/** 清理超過 24 小時的 dismissed 記錄 */
function cleanDismissed() {
  const map = getDismissed()
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  let changed = false
  for (const key of Object.keys(map)) {
    if (map[key] < cutoff) { delete map[key]; changed = true }
  }
  if (changed) setDismissed(map)
  return map
}

// ── 台灣時間 hour ──────────────────────────────────────

function getTaiwanHour(): number {
  const now = new Date()
  const twStr = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false })
  return parseInt(twStr, 10)
}

// ── Hook ───────────────────────────────────────────────

export function useNotifications(
  context: 'store' | 'kitchen',
  storeId?: string,
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissedState] = useState<Record<string, number>>(() => cleanDismissed())
  const stores = useStoreStore((s) => s.items)
  const products = useProductStore((s) => s.items)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null)

  // ── 查詢邏輯 ────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!supabase) { setLoading(false); return }

    const today = getTodayTW()
    const results: Notification[] = []

    // ── 1. 庫存不足（僅門店 context）──────────────────
    if (context === 'store' && storeId) {
      try {
        // 取最新盤點 session（該 store 最新 date）
        const { data: latestSession } = await supabase
          .from('inventory_sessions')
          .select('id, date')
          .eq('store_id', storeId)
          .order('date', { ascending: false })
          .limit(10)

        if (latestSession && latestSession.length > 0) {
          // 取同一天所有 session（多樓層）
          const latestDate = latestSession[0].date
          const sessionIds = latestSession
            .filter((s) => s.date === latestDate)
            .map((s) => s.id)

          const { data: invItems } = await supabase
            .from('inventory_items')
            .select('product_id, on_shelf, stock')
            .in('session_id', sessionIds)

          // 合併同品項（跨樓層加總）
          const inventoryMap: Record<string, number> = {}
          invItems?.forEach((item) => {
            const qty = (Number(item.on_shelf) || 0) + (Number(item.stock) || 0)
            inventoryMap[item.product_id] = (inventoryMap[item.product_id] || 0) + qty
          })

          // 近 7 日叫貨
          const d = new Date()
          d.setDate(d.getDate() - 7)
          const sevenDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

          const { data: orderSessions } = await supabase
            .from('order_sessions')
            .select('id, date')
            .eq('store_id', storeId)
            .gte('date', sevenDaysAgo)
            .lte('date', today)

          if (orderSessions && orderSessions.length > 0) {
            const orderSessionIds = orderSessions.map((s) => s.id)
            const uniqueDays = new Set(orderSessions.map((s) => s.date)).size

            const { data: orderItems } = await supabase
              .from('order_items')
              .select('product_id, quantity')
              .in('session_id', orderSessionIds)

            // 計算日均叫貨量
            const dailyAvg: Record<string, number> = {}
            orderItems?.forEach((item) => {
              dailyAvg[item.product_id] = (dailyAvg[item.product_id] || 0) + Number(item.quantity)
            })
            for (const pid of Object.keys(dailyAvg)) {
              dailyAvg[pid] = dailyAvg[pid] / uniqueDays
            }

            // 比對庫存 < 日均叫貨量
            const lowStockProducts: string[] = []
            for (const pid of Object.keys(dailyAvg)) {
              const currentStock = inventoryMap[pid] ?? 0
              if (currentStock < dailyAvg[pid] && dailyAvg[pid] > 0) {
                lowStockProducts.push(pid)
              }
            }

            if (lowStockProducts.length > 0) {
              const names = lowStockProducts
                .map((pid) => products.find((p) => p.id === pid)?.name)
                .filter(Boolean)
              const display = names.length <= 3
                ? names.join('、')
                : `${names.slice(0, 3).join('、')} 等 ${names.length} 項`

              results.push({
                id: `low_stock_${storeId}_${today}`,
                type: 'low_stock',
                severity: 'warning',
                icon: '🟠',
                title: '庫存不足',
                message: `${display}\n庫存低於日均叫貨量`,
                link: `/store/${storeId}/inventory`,
                productIds: lowStockProducts,
              })
            }
          }
        }
      } catch (err) {
        console.error('[useNotifications] low_stock query error:', err)
      }
    }

    // ── 2. 叫貨提醒（16:00 後）──────────────────────
    const hour = getTaiwanHour()
    if (hour >= 16) {
      try {
        if (context === 'store' && storeId) {
          const { data: todayOrder } = await supabase
            .from('order_sessions')
            .select('id')
            .eq('store_id', storeId)
            .eq('date', today)
            .limit(1)

          if (!todayOrder || todayOrder.length === 0) {
            results.push({
              id: `order_reminder_${storeId}_${today}`,
              type: 'order_reminder',
              severity: 'info',
              icon: '🔵',
              title: '叫貨提醒',
              message: '今天還沒叫貨\n截止時間：隔日 08:00',
              link: `/store/${storeId}/order`,
            })
          }
        } else if (context === 'kitchen') {
          // 查所有門店今日叫貨
          const { data: todayOrders } = await supabase
            .from('order_sessions')
            .select('store_id')
            .eq('date', today)

          const orderedStoreIds = new Set(todayOrders?.map((o) => o.store_id) || [])
          const missingStores = stores.filter((s) => !orderedStoreIds.has(s.id))

          if (missingStores.length > 0) {
            const names = missingStores.map((s) => s.name).join('、')
            results.push({
              id: `order_reminder_kitchen_${today}`,
              type: 'order_reminder',
              severity: 'info',
              icon: '🔵',
              title: '叫貨提醒',
              message: `${names} 今天還沒叫貨`,
            })
          }
        }
      } catch (err) {
        console.error('[useNotifications] order_reminder query error:', err)
      }
    }

    // ── 3. 出貨未收貨 ─────────────────────────────────
    try {
      let query = supabase
        .from('shipment_sessions')
        .select('id, store_id, date')
        .not('confirmed_at', 'is', null)
        .is('received_at', null)

      if (context === 'store' && storeId) {
        query = query.eq('store_id', storeId)
      }

      const { data: pendingShipments } = await query

      if (pendingShipments && pendingShipments.length > 0) {
        if (context === 'store' && storeId) {
          results.push({
            id: `shipment_pending_${storeId}_${pendingShipments[0].date}`,
            type: 'shipment_pending',
            severity: 'warning',
            icon: '🟡',
            title: '出貨未收貨',
            message: '央廚已出貨，請確認收貨',
            link: `/store/${storeId}/receive`,
          })
        } else if (context === 'kitchen') {
          const storeIds = [...new Set(pendingShipments.map((s) => s.store_id))]
          const names = storeIds
            .map((sid) => stores.find((s) => s.id === sid)?.name)
            .filter(Boolean)
            .join('、')

          results.push({
            id: `shipment_pending_kitchen_${today}`,
            type: 'shipment_pending',
            severity: 'warning',
            icon: '🟡',
            title: '出貨未收貨',
            message: `${names} 尚未確認收貨`,
          })
        }
      }
    } catch (err) {
      console.error('[useNotifications] shipment_pending query error:', err)
    }

    // ── 4. 結帳提醒（21:00 後尚未結帳）─ critical ────
    if (hour >= 21) {
      try {
        if (context === 'store' && storeId) {
          const { data: todaySettlement } = await supabase
            .from('settlement_sessions')
            .select('id')
            .eq('store_id', storeId)
            .eq('date', today)
            .limit(1)

          if (!todaySettlement || todaySettlement.length === 0) {
            results.push({
              id: `settlement_reminder_${storeId}_${today}`,
              type: 'settlement_reminder',
              severity: 'critical',
              icon: '🔴',
              title: '尚未結帳！',
              message: '已過 21:00，今日尚未提交結帳資料\n請盡快完成每日結帳',
              link: `/store/${storeId}/settlement`,
            })
          }
        } else if (context === 'kitchen') {
          const { data: todaySettlements } = await supabase
            .from('settlement_sessions')
            .select('store_id')
            .eq('date', today)

          const settledIds = new Set(todaySettlements?.map((s) => s.store_id) || [])
          const unsettledStores = stores.filter((s) => !settledIds.has(s.id))

          if (unsettledStores.length > 0) {
            const names = unsettledStores.map((s) => s.name).join('、')
            results.push({
              id: `settlement_reminder_kitchen_${today}`,
              type: 'settlement_reminder',
              severity: 'critical',
              icon: '🔴',
              title: '門店尚未結帳',
              message: `${names} 今日尚未結帳`,
            })
          }
        }
      } catch (err) {
        console.error('[useNotifications] settlement_reminder query error:', err)
      }
    }

    // ── 5. 換班提醒（14:00~15:00）─ info ─────────────
    if (hour >= 14 && hour < 15) {
      if (context === 'store' && storeId) {
        results.push({
          id: `shift_change_${storeId}_${today}`,
          type: 'shift_change',
          severity: 'info',
          icon: '🔄',
          title: '換班提醒',
          message: '現在是換班時段\n請完成交接確認',
        })
      }
    }

    setNotifications(results)
    setLoading(false)
  }, [context, storeId, stores, products])

  // ── Dismiss ──────────────────────────────────────────

  const dismiss = useCallback((id: string) => {
    const map = getDismissed()
    map[id] = Date.now()
    setDismissed(map)
    setDismissedState({ ...map })
  }, [])

  const dismissAll = useCallback(() => {
    const map = getDismissed()
    notifications.forEach((n) => { map[n.id] = Date.now() })
    setDismissed(map)
    setDismissedState({ ...map })
  }, [notifications])

  // ── Lifecycle ────────────────────────────────────────

  useEffect(() => {
    fetchNotifications()
    intervalRef.current = setInterval(fetchNotifications, 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchNotifications])

  // ── Filter dismissed ─────────────────────────────────

  const visible = notifications.filter((n) => !dismissed[n.id])

  return {
    notifications: visible,
    unreadCount: visible.length,
    loading,
    dismiss,
    dismissAll,
    refresh: fetchNotifications,
  }
}
