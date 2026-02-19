import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { computeSession, type SettlementValue } from '@/lib/settlement'
import { RefreshCw } from 'lucide-react'

// ---------- types ----------

interface SettlementSession {
  id: string
  store_id: string
  date: string
  settlement_values: SettlementValue[]
}

interface OrderSession {
  id: string
  store_id: string
  date: string
}

interface ShipmentSession {
  id: string
  store_id: string
  date: string
  confirmed_at: string | null
  received_at: string | null
}

interface InventorySession {
  id: string
  store_id: string
  date: string
  zone_code: string
  inventory_items: InventoryItem[]
}

interface InventoryItem {
  product_id: string
  on_shelf: number | null
  stock: number | null
}

interface OrderItemRow {
  session_id: string
  product_id: string
  quantity: number
  order_sessions: { store_id: string; date: string } | null
}

// ---------- helpers ----------

function getDateNDaysAgo(n: number): string {
  const d = new Date(getTodayTW() + 'T00:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-')
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`
}

// ---------- component ----------

export default function BossDashboard() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)
  const products = useProductStore((s) => s.items)

  const today = getTodayTW()
  const sevenDaysAgo = getDateNDaysAgo(6)

  const [loading, setLoading] = useState(true)
  const [settlements, setSettlements] = useState<SettlementSession[]>([])
  const [orderSessions, setOrderSessions] = useState<OrderSession[]>([])
  const [shipmentSessions, setShipmentSessions] = useState<ShipmentSession[]>([])
  const [inventorySessions, setInventorySessions] = useState<InventorySession[]>([])
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([])

  // Fetch all data
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    setLoading(true)
    Promise.all([
      // A. Settlements (7 days)
      supabase
        .from('settlement_sessions')
        .select('*, settlement_values(*)')
        .gte('date', sevenDaysAgo)
        .lte('date', today)
        .order('date', { ascending: false }),
      // B. Order sessions (today)
      supabase
        .from('order_sessions')
        .select('id, store_id, date')
        .eq('date', today),
      // C. Shipment sessions (today)
      supabase
        .from('shipment_sessions')
        .select('id, store_id, date, confirmed_at, received_at')
        .eq('date', today),
      // D. Latest inventory sessions with items
      supabase
        .from('inventory_sessions')
        .select('id, store_id, date, zone_code, inventory_items(product_id, on_shelf, stock)')
        .order('date', { ascending: false }),
      // E. Order items (7 days) with session info
      supabase
        .from('order_items')
        .select('session_id, product_id, quantity, order_sessions(store_id, date)')
        .gte('order_sessions.date', sevenDaysAgo)
        .lte('order_sessions.date', today),
    ]).then(([settRes, orderRes, shipRes, invRes, orderItemRes]) => {
      setSettlements((settRes.data as SettlementSession[] | null) || [])
      setOrderSessions((orderRes.data as OrderSession[] | null) || [])
      setShipmentSessions((shipRes.data as ShipmentSession[] | null) || [])
      setInventorySessions((invRes.data as InventorySession[] | null) || [])
      setOrderItems((orderItemRes.data as OrderItemRow[] | null)?.filter(i => i.order_sessions) || [])
      setLoading(false)
    })
  }, [today, sevenDaysAgo])

  // ===== Computed data =====

  // Today's settlements
  const todaySettlements = useMemo(() =>
    settlements.filter((s) => s.date === today),
  [settlements, today])

  // Summary cards
  const summary = useMemo(() => {
    let totalRevenue = 0
    let totalOrders = 0
    let totalStaff = 0
    let abnormalStores = 0

    todaySettlements.forEach((s) => {
      const c = computeSession(s.settlement_values || [])
      totalRevenue += c.posTotal
      totalOrders += c.orderCount
      totalStaff += c.staffCount
      if (Math.abs(c.diff) > 10) abnormalStores++
    })

    return { totalRevenue, totalOrders, totalStaff, abnormalStores }
  }, [todaySettlements])

  // Per-store details
  const storeDetails = useMemo(() => {
    return stores.map((store) => {
      const session = todaySettlements.find((s) => s.store_id === store.id)
      if (!session) {
        return { storeId: store.id, storeName: store.name, settled: false as const }
      }
      const c = computeSession(session.settlement_values || [])
      return {
        storeId: store.id,
        storeName: store.name,
        settled: true as const,
        posTotal: c.posTotal,
        orderCount: c.orderCount,
        staffCount: c.staffCount,
        diff: c.diff,
      }
    })
  }, [stores, todaySettlements])

  // 7-day revenue trend
  const trendData = useMemo(() => {
    const days: { date: string; revenue: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = getDateNDaysAgo(i)
      const daySessions = settlements.filter((s) => s.date === d)
      let revenue = 0
      daySessions.forEach((s) => {
        revenue += computeSession(s.settlement_values || []).posTotal
      })
      days.push({ date: d, revenue })
    }
    return days
  }, [settlements])

  const maxRevenue = useMemo(() => Math.max(...trendData.map((d) => d.revenue), 1), [trendData])

  // Inventory alerts
  const inventoryAlerts = useMemo(() => {
    // Get latest inventory per store+product
    const latestInventory = new Map<string, number>()
    // Group by store, take only the latest date per store
    const storeLatestDate = new Map<string, string>()
    inventorySessions.forEach((s) => {
      const prev = storeLatestDate.get(s.store_id)
      if (!prev || s.date > prev) storeLatestDate.set(s.store_id, s.date)
    })

    inventorySessions.forEach((s) => {
      if (s.date !== storeLatestDate.get(s.store_id)) return
      ;(s.inventory_items || []).forEach((item) => {
        const key = `${s.store_id}__${item.product_id}`
        const qty = (item.on_shelf || 0) + (item.stock || 0)
        latestInventory.set(key, (latestInventory.get(key) || 0) + qty)
      })
    })

    // Daily average order quantity per product across all stores (7 days)
    const orderTotals = new Map<string, number>()
    const orderDays = new Map<string, Set<string>>()
    orderItems.forEach((item) => {
      if (!item.order_sessions) return
      const key = `${item.order_sessions.store_id}__${item.product_id}`
      orderTotals.set(key, (orderTotals.get(key) || 0) + (item.quantity || 0))
      if (!orderDays.has(key)) orderDays.set(key, new Set())
      orderDays.get(key)!.add(item.order_sessions.date)
    })

    const productMap = new Map(products.map((p) => [p.id, p]))

    const alerts: { storeId: string; storeName: string; productName: string; inventory: number; dailyAvg: number }[] = []

    latestInventory.forEach((invQty, key) => {
      const [storeId, productId] = key.split('__')
      const totalOrdered = orderTotals.get(key) || 0
      const daysCount = orderDays.get(key)?.size || 7
      const dailyAvg = daysCount > 0 ? totalOrdered / daysCount : 0
      if (dailyAvg > 0 && invQty < dailyAvg) {
        const product = productMap.get(productId)
        alerts.push({
          storeId,
          storeName: getStoreName(storeId),
          productName: product?.name || productId,
          inventory: Math.round(invQty * 10) / 10,
          dailyAvg: Math.round(dailyAvg * 10) / 10,
        })
      }
    })

    return alerts.sort((a, b) => a.storeName.localeCompare(b.storeName) || a.productName.localeCompare(b.productName))
  }, [inventorySessions, orderItems, products, getStoreName])

  // Order / Shipment status per store
  const orderShipStatus = useMemo(() => {
    return stores.map((store) => {
      const hasOrder = orderSessions.some((s) => s.store_id === store.id)
      const shipment = shipmentSessions.find((s) => s.store_id === store.id)
      let shipStatus: 'none' | 'shipped' | 'received' = 'none'
      if (shipment) {
        shipStatus = shipment.received_at ? 'received' : 'shipped'
      }
      return { storeId: store.id, storeName: store.name, hasOrder, shipStatus }
    })
  }, [stores, orderSessions, shipmentSessions])

  // ---------- render ----------

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="老闆儀表板" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="老闆儀表板" backTo="/admin" />

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-brand-lotus">
          <RefreshCw size={16} className="animate-spin" />
          載入中...
        </div>
      ) : (
        <>
          {/* ===== 1. 今日摘要卡片 ===== */}
          <SectionHeader title="今日摘要" icon="■" />
          <div className="bg-white">
            <div className="grid grid-cols-2 gap-px bg-gray-100">
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">總營業額</p>
                <p className="text-xl font-bold text-brand-oak font-num mt-0.5">
                  {formatCurrency(summary.totalRevenue)}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">總號數</p>
                <p className="text-xl font-bold text-brand-oak font-num mt-0.5">
                  {summary.totalOrders}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">總人力</p>
                <p className="text-xl font-bold text-brand-oak font-num mt-0.5">
                  {summary.totalStaff}
                </p>
              </div>
              <div className="bg-white px-4 py-3">
                <p className="text-xs text-brand-lotus">差額異常門店</p>
                <p className={`text-xl font-bold font-num mt-0.5 ${summary.abnormalStores === 0 ? 'text-status-success' : 'text-status-danger'}`}>
                  {summary.abnormalStores}
                </p>
              </div>
            </div>
          </div>

          {/* ===== 2. 各店營運明細 ===== */}
          <SectionHeader title="各店營運明細" icon="■" />
          <div className="bg-white divide-y divide-gray-50">
            {storeDetails.map((s) => (
              <div key={s.storeId} className="flex items-center px-4 py-3">
                <span className="text-sm font-semibold text-brand-oak w-16 shrink-0">{s.storeName}</span>
                {s.settled ? (
                  <div className="flex-1 flex items-center gap-3 text-xs text-brand-lotus">
                    <span>營業額 <span className="font-num text-brand-oak">{formatCurrency(s.posTotal)}</span></span>
                    <span><span className="font-num text-brand-oak">{s.orderCount}</span>號</span>
                    <span><span className="font-num text-brand-oak">{s.staffCount}</span>人</span>
                    <span className={`font-medium ${Math.abs(s.diff) <= 10 ? 'text-status-success' : 'text-status-danger'}`}>
                      差{s.diff >= 0 ? '+' : ''}{s.diff}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-brand-silver">未結帳</span>
                )}
              </div>
            ))}
          </div>

          {/* ===== 3. 近7天營收趨勢 ===== */}
          <SectionHeader title="近7天營收趨勢" icon="■" />
          <div className="bg-white px-4 py-4">
            <div className="flex items-end gap-2 h-32">
              {trendData.map((d) => {
                const pct = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0
                const isToday = d.date === today
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] font-num text-brand-lotus">
                      {d.revenue > 0 ? formatCurrency(d.revenue) : ''}
                    </span>
                    <div className="w-full flex items-end" style={{ height: '80px' }}>
                      <div
                        className={`w-full rounded-t transition-all ${isToday ? 'bg-brand-amber' : 'bg-brand-mocha/40'}`}
                        style={{ height: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] ${isToday ? 'font-bold text-brand-amber' : 'text-brand-lotus'}`}>
                      {formatShortDate(d.date)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ===== 4. 庫存警示 ===== */}
          <SectionHeader title="庫存警示" icon="■" />
          <div className="bg-white">
            {inventoryAlerts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-status-success">各店庫存充足 ✓</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {inventoryAlerts.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-brand-mocha/10 text-brand-mocha mr-2">{a.storeName}</span>
                      <span className="text-sm text-brand-oak">{a.productName}</span>
                    </div>
                    <div className="text-right text-xs text-brand-lotus">
                      <span className="text-status-danger font-num">{a.inventory}</span>
                      <span className="mx-1">/</span>
                      <span>日均 <span className="font-num">{a.dailyAvg}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== 5. 今日叫貨/出貨狀態 ===== */}
          <SectionHeader title="今日叫貨/出貨狀態" icon="■" />
          <div className="bg-white divide-y divide-gray-50 mb-6">
            {orderShipStatus.map((s) => (
              <div key={s.storeId} className="flex items-center px-4 py-2.5">
                <span className="text-sm font-semibold text-brand-oak w-16 shrink-0">{s.storeName}</span>
                <div className="flex-1 flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.hasOrder ? 'bg-status-success/10 text-status-success' : 'bg-gray-100 text-brand-silver'}`}>
                    叫貨{s.hasOrder ? '已送出' : '未送出'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.shipStatus === 'received' ? 'bg-status-success/10 text-status-success' :
                    s.shipStatus === 'shipped' ? 'bg-brand-amber/10 text-brand-amber' :
                    'bg-gray-100 text-brand-silver'
                  }`}>
                    {s.shipStatus === 'received' ? '已收貨' : s.shipStatus === 'shipped' ? '已出貨未收貨' : '未出貨'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
