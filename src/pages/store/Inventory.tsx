// Day32: prevUsage linkedInventoryIds fix
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { DualUnitInput } from '@/components/DualUnitInput'
import { SectionHeader } from '@/components/SectionHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { DateNav } from '@/components/DateNav'
import { useZoneFilteredProducts } from '@/hooks/useZoneFilteredProducts'
import { supabase } from '@/lib/supabase'
import { inventorySessionId, getTodayTW } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { Send, RefreshCw, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { sendTelegramNotification } from '@/lib/telegram'
import { StockEntryPanel, type StockEntry } from '@/components/StockEntryPanel'
import { useProductStore } from '@/stores/useProductStore'
import { useFrozenProductStore } from '@/stores/useFrozenProductStore'
import { useZoneStore } from '@/stores/useZoneStore'
import { useStoreSortOrder } from '@/hooks/useStoreSortOrder'
import { buildSortedByCategory } from '@/lib/sortByStore'
import { useSupplyTracker } from '@/hooks/useSupplyTracker'
import { SUPPLY_ITEMS } from '@/lib/supplyItems'

interface InventoryEntry {
  onShelf: string
  stock: string
  discarded: string
}

export default function Inventory() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const { products: allZoneProducts, categories: productCategories, storeZones, currentZone, setZone } = useZoneFilteredProducts(storeId || '')
  const storeProducts = useMemo(() => allZoneProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'inventory_only'), [allZoneProducts])
  const allProducts = useProductStore((s) => s.items)
  const allFrozenProducts = useFrozenProductStore((s) => s.items)
  const zoneProducts = useZoneStore((s) => s.zoneProducts)
  const zoneStoreReady = useZoneStore((s) => s.initialized)

  // Filter frozen products by zone assignment (same logic as regular products)
  const FROZEN_PRODUCTS = useMemo(() => {
    if (storeZones.length === 0) return allFrozenProducts
    const matchedZone = currentZone ? storeZones.find(z => z.zoneCode === currentZone) : null
    if (matchedZone) {
      const assignedIds = new Set(
        zoneProducts.filter(zp => zp.zoneId === matchedZone.id).map(zp => zp.productId)
      )
      return allFrozenProducts.filter(fp => assignedIds.has(fp.key))
    }
    // Merged view or no zone selected: show all assigned to any zone of this store
    const storeZoneIds = new Set(storeZones.map(z => z.id))
    const assignedIds = new Set(
      zoneProducts.filter(zp => storeZoneIds.has(zp.zoneId)).map(zp => zp.productId)
    )
    return allFrozenProducts.filter(fp => assignedIds.has(fp.key))
  }, [allFrozenProducts, storeZones, currentZone, zoneProducts])

  // Filter supply items: only show if at least one deductionKey exists in current FROZEN_PRODUCTS
  const visibleSupplyItems = useMemo(() => {
    const frozenKeys = new Set(FROZEN_PRODUCTS.map(fp => fp.key))
    return SUPPLY_ITEMS.filter(item =>
      item.deductionKeys.some(dk => frozenKeys.has(dk))
    )
  }, [FROZEN_PRODUCTS])

  // Build bag_weight lookup from all products (allZoneProducts includes all filtered products)
  // 也將 parent 的 bag_weight 傳播到 linkedInventoryIds（子品項可能沒有單獨設 bag_weight）
  const bagWeightMap = useMemo(() => {
    const m: Record<string, number> = {}
    allZoneProducts.forEach(p => { if (p.bag_weight) m[p.id] = p.bag_weight })
    allZoneProducts.forEach(p => {
      if (p.bag_weight && p.linkedInventoryIds?.length) {
        p.linkedInventoryIds.forEach(id => { if (!m[id]) m[id] = p.bag_weight! })
      }
    })
    return m
  }, [allZoneProducts])
  const hasBagWeightItems = useMemo(() => storeProducts.some(p => !!p.bag_weight), [storeProducts])

  // inventoryIdMap: 每個品項的 ID 列表（自身 + linkedInventoryIds），用於加總關聯品項
  const inventoryIdMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    allZoneProducts.forEach(p => {
      const ids = [p.id]
      if (p.linkedInventoryIds?.length) {
        p.linkedInventoryIds.forEach(id => { if (!ids.includes(id)) ids.push(id) })
      }
      m[p.id] = ids
    })
    return m
  }, [allZoneProducts])

  // 純聚合品項：linkable=false 且有關聯其他品項 → 唯讀（如芋圓總、白玉總、蔗片冰1F+2F）
  // linkable=true 的品項（如蔗片冰1F）雖有 linkedInventoryIds 但仍需手動輸入
  const isAggregateItem = useCallback((productId: string): boolean => {
    const p = allZoneProducts.find(item => item.id === productId)
    if (!p) return false
    return !p.linkable && (p.linkedInventoryIds?.length ?? 0) > 0
  }, [allZoneProducts])

  const hasMultipleZones = storeZones.length > 1
  const isMergedView = hasMultipleZones && !currentZone
  const currentZoneObj = storeZones.find((z) => z.zoneCode === currentZone)
  const zoneLabel = isMergedView ? '' : currentZoneObj ? ` ${currentZoneObj.zoneName}` : ''

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const sessionId = inventorySessionId(storeId || '', selectedDate, currentZone || '')

  const [data, setData] = useState<Record<string, InventoryEntry>>({})
  const originalData = useRef<Record<string, InventoryEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successInfo, setSuccessInfo] = useState({ itemCount: 0, date: '' })

  // Stock entries (到期日批次) state
  const [stockEntries, setStockEntries] = useState<Record<string, StockEntry[]>>({})
  const originalStockEntries = useRef<Record<string, StockEntry[]>>({})
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null)

  // Frozen product sales state (takeout + delivery)
  interface FrozenEntry { takeout: string; delivery: string }
  const emptyFrozenEntry: FrozenEntry = { takeout: '', delivery: '' }
  const [frozenData, setFrozenData] = useState<Record<string, FrozenEntry>>({})
  const [frozenLoading, setFrozenLoading] = useState(true)
  const originalFrozenData = useRef<Record<string, FrozenEntry>>({})
  const [mergedFrozenData, setMergedFrozenData] = useState<Record<string, FrozenEntry>>({})

  // Merged view state
  const [mergedData, setMergedData] = useState<Record<string, InventoryEntry>>({})
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, boolean>>({})
  const [mergedLoading, setMergedLoading] = useState(false)

  // Previous day usage (前日用量)
  const [prevUsage, setPrevUsage] = useState<Record<string, number>>({})

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    // 有樓層但 zone 尚未自動設定（首次 render），跳過此次避免用錯 session ID
    if (storeZones.length > 0 && !currentZone && !searchParams.get('zone')) return
    // Zone store 尚未初始化完成（zones 還沒載入），也跳過避免用無 zone 的 session ID
    if (!zoneStoreReady) return
    const sid = inventorySessionId(storeId, selectedDate, currentZone || '')
    setLoading(true)
    setIsEdit(false)
    setData({})
    originalData.current = {}
    setStockEntries({})
    originalStockEntries.current = {}
    setExpandedStockId(null)

    const load = async () => {
      try {
        const { data: session } = await supabase!
          .from('inventory_sessions')
          .select('id')
          .eq('id', sid)
          .maybeSingle()

        if (!session) { setLoading(false); return }
        setIsEdit(true)

        const { data: items } = await supabase!
          .from('inventory_items')
          .select('*')
          .eq('session_id', sid)

        if (items && items.length > 0) {
          const loaded: Record<string, InventoryEntry> = {}
          items.forEach((item) => {
            loaded[item.product_id] = {
              onShelf: item.on_shelf != null ? String(item.on_shelf) : '',
              stock: item.stock != null ? String(item.stock) : '',
              discarded: item.discarded != null ? String(item.discarded) : '',
            }
          })
          originalData.current = JSON.parse(JSON.stringify(loaded))
          setData(loaded)
        }

        // Load stock entries (到期日批次)
        const { data: seRows } = await supabase!
          .from('inventory_stock_entries')
          .select('product_id, expiry_date, quantity')
          .eq('session_id', sid)
          .order('expiry_date', { ascending: true })

        if (seRows && seRows.length > 0) {
          const grouped: Record<string, StockEntry[]> = {}
          seRows.forEach((r) => {
            if (!grouped[r.product_id]) grouped[r.product_id] = []
            grouped[r.product_id].push({
              expiryDate: r.expiry_date,
              quantity: r.quantity != null ? String(r.quantity) : '',
            })
          })
          originalStockEntries.current = JSON.parse(JSON.stringify(grouped))
          setStockEntries(grouped)
        }
      } catch {
        // ignore fetch errors
      }
      setLoading(false)
    }

    load()
  }, [storeId, storeZones, currentZone, selectedDate, zoneStoreReady])

  // Auto-sum stock entries → data[productId].stock
  const updateStockFromEntries = useCallback((productId: string, entries: StockEntry[]) => {
    const sum = entries.reduce((acc, e) => {
      const n = parseFloat(e.quantity)
      return acc + (isNaN(n) ? 0 : n)
    }, 0)
    const sumStr = entries.length > 0 ? String(Math.round(sum * 10) / 10) : ''
    setData(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] ?? { onShelf: '', stock: '', discarded: '' }),
        stock: sumStr,
      },
    }))
  }, [])

  // Load frozen product sales data
  useEffect(() => {
    if (!supabase || !storeId) { setFrozenLoading(false); return }
    setFrozenLoading(true)
    setFrozenData({})
    originalFrozenData.current = {}

    const load = async () => {
      try {
        const zoneCode = currentZone || ''
        const { data: rows } = await supabase!
          .from('frozen_sales')
          .select('product_key, takeout, delivery')
          .eq('store_id', storeId)
          .eq('date', selectedDate)
          .eq('zone_code', zoneCode)

        if (rows && rows.length > 0) {
          const loaded: Record<string, FrozenEntry> = {}
          rows.forEach((r) => {
            loaded[r.product_key] = {
              takeout: r.takeout ? String(r.takeout) : '',
              delivery: r.delivery ? String(r.delivery) : '',
            }
          })
          originalFrozenData.current = JSON.parse(JSON.stringify(loaded))
          setFrozenData(loaded)
        }
      } catch {
        // ignore
      }
      setFrozenLoading(false)
    }
    load()
  }, [storeId, selectedDate, currentZone])

  // Load merged frozen data for "全部" view
  useEffect(() => {
    if (!supabase || !storeId || !isMergedView) return

    const load = async () => {
      try {
        const { data: rows } = await supabase!
          .from('frozen_sales')
          .select('product_key, takeout, delivery')
          .eq('store_id', storeId)
          .eq('date', selectedDate)

        const merged: Record<string, FrozenEntry> = {}
        if (rows) {
          rows.forEach((r) => {
            const prev = merged[r.product_key] || { takeout: '0', delivery: '0' }
            merged[r.product_key] = {
              takeout: String((parseInt(prev.takeout) || 0) + (r.takeout || 0)),
              delivery: String((parseInt(prev.delivery) || 0) + (r.delivery || 0)),
            }
          })
        }
        setMergedFrozenData(merged)
      } catch {
        // ignore
      }
    }
    load()
  }, [storeId, isMergedView, selectedDate])

  // Load merged data for "全部" view
  useEffect(() => {
    if (!supabase || !storeId || !isMergedView) return
    setMergedLoading(true)

    const load = async () => {
      try {
        const zoneSids = storeZones.map((z) =>
          inventorySessionId(storeId, selectedDate, z.zoneCode)
        )

        // Check which sessions exist
        const { data: sessions } = await supabase!
          .from('inventory_sessions')
          .select('id, zone_code')
          .in('id', zoneSids)

        const existingIds = new Set((sessions || []).map((s) => s.id))
        const statuses: Record<string, boolean> = {}
        storeZones.forEach((z) => {
          const sid = inventorySessionId(storeId, selectedDate, z.zoneCode)
          statuses[z.zoneCode] = existingIds.has(sid)
        })
        setZoneStatuses(statuses)

        // Load all items from existing sessions
        const existingSids = zoneSids.filter((sid) => existingIds.has(sid))
        if (existingSids.length === 0) {
          setMergedData({})
          setMergedLoading(false)
          return
        }

        const { data: items } = await supabase!
          .from('inventory_items')
          .select('*')
          .in('session_id', existingSids)

        // Merge: sum values for same product across zones
        const merged: Record<string, InventoryEntry> = {}
        if (items) {
          items.forEach((item) => {
            const existing = merged[item.product_id]
            if (!existing) {
              merged[item.product_id] = {
                onShelf: item.on_shelf != null ? String(item.on_shelf) : '',
                stock: item.stock != null ? String(item.stock) : '',
                discarded: item.discarded != null ? String(item.discarded) : '',
              }
            } else {
              // Sum values
              const addNum = (a: string, b: number | null): string => {
                if (b == null) return a
                if (a === '') return String(b)
                return String(parseFloat(a) + b)
              }
              merged[item.product_id] = {
                onShelf: addNum(existing.onShelf, item.on_shelf),
                stock: addNum(existing.stock, item.stock),
                discarded: addNum(existing.discarded, item.discarded),
              }
            }
          })
        }
        setMergedData(merged)
      } catch {
        // ignore
      }
      setMergedLoading(false)
    }

    load()
  }, [storeId, isMergedView, storeZones, selectedDate])

  // Calculate previous day usage (前日用量)
  useEffect(() => {
    if (!supabase || !storeId) return
    setPrevUsage({})

    const load = async () => {
      try {
        // prevDate = selectedDate - 1 day (timezone-safe)
        const d = new Date(selectedDate + 'T00:00:00+08:00')
        d.setDate(d.getDate() - 1)
        const prevDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

        // 1. Previous day inventory (all zones merged)
        const { data: prevSessions } = await supabase!
          .from('inventory_sessions')
          .select('id')
          .eq('store_id', storeId)
          .eq('date', prevDate)

        const prevInv: Record<string, number> = {}
        if (prevSessions && prevSessions.length > 0) {
          const sids = prevSessions.map(s => s.id)
          const { data: prevItems } = await supabase!
            .from('inventory_items')
            .select('product_id, on_shelf, stock')
            .in('session_id', sids)
          if (prevItems) {
            prevItems.forEach(item => {
              const bw = bagWeightMap[item.product_id]
              const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
              const val = onShelfBags + (item.stock || 0)
              prevInv[item.product_id] = (prevInv[item.product_id] || 0) + val
            })
          }
        }

        // 2. Today's order quantity (order_sessions.date = selectedDate)
        const { data: orderSessions } = await supabase!
          .from('order_sessions')
          .select('id')
          .eq('store_id', storeId)
          .eq('date', selectedDate)

        const orderQty: Record<string, number> = {}
        if (orderSessions && orderSessions.length > 0) {
          const osids = orderSessions.map(s => s.id)
          const { data: orderItems } = await supabase!
            .from('order_items')
            .select('product_id, quantity')
            .in('session_id', osids)
          if (orderItems) {
            orderItems.forEach(item => {
              orderQty[item.product_id] = (orderQty[item.product_id] || 0) + (item.quantity || 0)
            })
          }
        }

        // 3. Today's inventory + discarded (all zones merged)
        const { data: todaySessions } = await supabase!
          .from('inventory_sessions')
          .select('id')
          .eq('store_id', storeId)
          .eq('date', selectedDate)

        const todayInv: Record<string, number> = {}
        const todayDisc: Record<string, number> = {}
        if (todaySessions && todaySessions.length > 0) {
          const tsids = todaySessions.map(s => s.id)
          const { data: todayItems } = await supabase!
            .from('inventory_items')
            .select('product_id, on_shelf, stock, discarded')
            .in('session_id', tsids)
          if (todayItems) {
            todayItems.forEach(item => {
              const bw = bagWeightMap[item.product_id]
              const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
              const inv = onShelfBags + (item.stock || 0)
              todayInv[item.product_id] = (todayInv[item.product_id] || 0) + inv
              todayDisc[item.product_id] = (todayDisc[item.product_id] || 0) + (item.discarded || 0)
            })
          }
        }

        // Calculate usage using linkedInventoryIds grouping (same approach as Order.tsx)
        // IMPORTANT: Must use allProducts (not allZoneProducts) because parent aggregate
        // products (芋圓(總), 白玉(總), 粉圓) are order_only and NOT in allZoneProducts,
        // but their linkedInventoryIds and orderQty are needed for correct calculation.
        const linkedChildren = new Set<string>()
        allProducts.forEach(p => {
          if (p.linkedInventoryIds?.length) {
            p.linkedInventoryIds.forEach(id => linkedChildren.add(id))
          }
        })

        const usage: Record<string, number> = {}
        allProducts.forEach(p => {
          const allInvIds = new Set<string>([p.id])
          if (p.linkedInventoryIds?.length) {
            p.linkedInventoryIds.forEach(id => allInvIds.add(id))
          }
          // Skip sub-products that belong to a parent group
          // (they'll get usage from parent via getLinkedPrevUsage)
          if (allInvIds.size === 1 && linkedChildren.has(p.id)) return

          const sumData = (data: Record<string, number>) => {
            let total = 0, found = false
            for (const id of allInvIds) {
              if (data[id] != null) { total += data[id]; found = true }
            }
            return found ? total : null
          }
          const prev = sumData(prevInv)
          const today = sumData(todayInv)
          if (prev != null && today != null) {
            const disc = sumData(todayDisc) || 0
            let ord = 0
            for (const id of allInvIds) {
              if (orderQty[id] != null) ord += orderQty[id]
            }
            usage[p.id] = Math.round((prev + ord - today - disc) * 10) / 10
          }
        })
        setPrevUsage(usage)
      } catch {
        // ignore
      }
    }
    load()
  }, [storeId, selectedDate, bagWeightMap, allProducts])

  const getEntry = useCallback((productId: string): InventoryEntry => {
    if (isMergedView) return mergedData[productId] ?? { onShelf: '', stock: '', discarded: '' }
    return data[productId] ?? { onShelf: '', stock: '', discarded: '' }
  }, [data, isMergedView, mergedData])

  // 計算關聯品項的總計（架上/bag_weight + 庫存），用於 蔗片冰(1F+2F) 等聚合品項
  const getLinkedTotal = useCallback((productId: string): number | null => {
    const ids = inventoryIdMap[productId] || [productId]
    const source = isMergedView ? mergedData : data
    let sum = 0, found = false
    for (const id of ids) {
      const e = source[id]
      if (e && (e.onShelf !== '' || e.stock !== '')) {
        const bw = bagWeightMap[id]
        const onShelfVal = parseFloat(e.onShelf) || 0
        const stockVal = parseFloat(e.stock) || 0
        sum += (bw ? onShelfVal / bw : onShelfVal) + stockVal
        found = true
      }
    }
    return found ? Math.round(sum * 100) / 100 : null
  }, [inventoryIdMap, isMergedView, mergedData, data, bagWeightMap])

  // 計算關聯品項的前日用量加總
  // 子品項（被 parent 的 linkedInventoryIds 包含）→ 反向查找 parent 的用量
  const getLinkedPrevUsage = useCallback((productId: string): number | undefined => {
    // 如果自身有數據就直接用
    if (prevUsage[productId] !== undefined) return prevUsage[productId]
    // 嘗試用 inventoryIdMap（parent → children）加總
    const ids = inventoryIdMap[productId] || [productId]
    let sum = 0, found = false
    for (const id of ids) {
      if (prevUsage[id] !== undefined) { sum += prevUsage[id]; found = true }
    }
    if (found) return Math.round(sum * 10) / 10
    // 反向查找：如果此品項是某 parent 的子品項，取 parent 的用量
    // Must use allProducts (not allZoneProducts) because parent may be order_only
    for (const p of allProducts) {
      if (p.linkedInventoryIds?.includes(productId) && prevUsage[p.id] !== undefined) {
        return prevUsage[p.id]
      }
    }
    return undefined
  }, [inventoryIdMap, prevUsage, allProducts])

  const updateField = useCallback((productId: string, field: keyof InventoryEntry, value: string) => {
    setData(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? { onShelf: '', stock: '', discarded: '' }), [field]: value }
    }))
  }, [])

  const focusNext = useCallback(() => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-inv]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) {
      arr[idx + 1].focus()
    }
  }, [])

  const completedCount = useMemo(() => {
    return storeProducts.filter(p => {
      if (isAggregateItem(p.id)) return getLinkedTotal(p.id) != null
      const e = getEntry(p.id)
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data, storeProducts, getEntry, isAggregateItem, getLinkedTotal])

  const { sortCategories, sortItems } = useStoreSortOrder(storeId || '', 'product')
  const productsByCategory = useMemo(() =>
    buildSortedByCategory(productCategories, storeProducts, sortCategories, sortItems),
    [productCategories, storeProducts, sortCategories, sortItems])

  const isItemModified = useCallback((productId: string): boolean => {
    if (!isEdit) return false
    const orig = originalData.current[productId]
    const curr = data[productId]
    if (!orig && !curr) return false
    if (!orig) return !!(curr && (curr.onShelf !== '' || curr.stock !== '' || curr.discarded !== ''))
    if (!curr) return true
    return orig.onShelf !== curr.onShelf || orig.stock !== curr.stock || orig.discarded !== curr.discarded
  }, [isEdit, data])

  const modifiedCount = useMemo(() => {
    if (!isEdit) return 0
    return storeProducts.filter(p => isItemModified(p.id)).length
  }, [isEdit, storeProducts, isItemModified])

  const getCategoryCompleted = useCallback((products: typeof storeProducts) => {
    return products.filter(p => {
      if (isAggregateItem(p.id)) return getLinkedTotal(p.id) != null
      const e = getEntry(p.id)
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data, getEntry, isAggregateItem, getLinkedTotal])

  // Supply tracker (其他區)
  const {
    restockValues: supplyRestock,
    remainingValues: supplyRemaining,
    updateRestock: updateSupplyRestock,
    saveSupplyData,
    loading: supplyLoading,
  } = useSupplyTracker({
    storeId: storeId || '',
    selectedDate,
    currentZone,
    isMergedView,
    frozenData,
    mergedFrozenData,
  })

  const frozenDisplayData = isMergedView ? mergedFrozenData : frozenData
  const frozenCompletedCount = useMemo(() => {
    return FROZEN_PRODUCTS.filter(p => {
      const e = frozenDisplayData[p.key]
      if (!e) return false
      return (e.takeout !== '' && e.takeout !== '0') || (e.delivery !== '' && e.delivery !== '0')
    }).length
  }, [frozenDisplayData, FROZEN_PRODUCTS])

  const updateFrozenField = useCallback((key: string, field: 'takeout' | 'delivery', value: string) => {
    // Only accept integers (no decimals)
    if (value !== '' && !/^\d+$/.test(value)) return
    setFrozenData(prev => ({
      ...prev,
      [key]: { ...(prev[key] || emptyFrozenEntry), [field]: value },
    }))
  }, [])

  const handleSubmit = async () => {
    if (!storeId) return
    // 防止重複提交（useRef 同步鎖，避免 React batch 導致多次觸發）
    if (submittingRef.current) return
    submittingRef.current = true

    // 防呆：庫存欄必填（聚合品項跳過，其數據由子品項加總）
    const missingStock = storeProducts.filter(p => {
      if (isAggregateItem(p.id)) return false
      const e = getEntry(p.id)
      return e.stock === ''
    })
    if (missingStock.length > 0) {
      showToast(`尚有 ${missingStock.length} 項品項未填庫存（無則填 0）`, 'error')
      submittingRef.current = false
      return
    }

    setSubmitting(true)

    const session = {
      id: sessionId,
      store_id: storeId,
      date: selectedDate,
      zone_code: currentZone || '',
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }

    const items = storeProducts
      .filter(p => {
        const e = getEntry(p.id)
        return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
      })
      .map(p => {
        const e = getEntry(p.id)
        return {
          session_id: sessionId,
          product_id: p.id,
          on_shelf: e.onShelf !== '' ? parseFloat(e.onShelf) : null,
          stock: e.stock !== '' ? parseFloat(e.stock) : null,
          discarded: e.discarded !== '' ? parseFloat(e.discarded) : null,
        }
      })

    // Prepare frozen sales upsert data
    const frozenItems = FROZEN_PRODUCTS
      .filter(p => {
        const e = frozenData[p.key]
        if (!e) return false
        return (e.takeout !== '' && parseInt(e.takeout) > 0) || (e.delivery !== '' && parseInt(e.delivery) > 0)
      })
      .map(p => {
        const e = frozenData[p.key] || emptyFrozenEntry
        return {
          store_id: storeId,
          date: selectedDate,
          zone_code: currentZone || '',
          product_key: p.key,
          takeout: parseInt(e.takeout) || 0,
          delivery: parseInt(e.delivery) || 0,
          submitted_by: staffId || null,
          updated_at: new Date().toISOString(),
        }
      })

    // 先快照 stockEntries，避免 async 過程中 state 變動導致 stale closure
    const stockEntriesSnapshot = JSON.parse(JSON.stringify(stockEntries)) as Record<string, StockEntry[]>
    const success = await submitWithOffline({
      type: 'inventory',
      storeId,
      sessionId,
      session,
      items,
      onConflict: 'session_id,product_id',
      itemIdField: 'product_id',
      onSuccess: () => {
        // 主要的 DB 寫入已移到 submitWithOffline 之後，這裡只做 UI 更新
        setIsEdit(true)
        logAudit('inventory_submit', storeId, sessionId, { itemCount: items.length, frozenCount: frozenItems.length })
        setSuccessInfo({ itemCount: items.length, date: selectedDate })
        setShowSuccessModal(true)
        sendTelegramNotification(
          `📋 門店盤點完成\n🏪 店家：${storeName}\n📅 日期：${selectedDate}\n📊 品項數：${items.length} 項`
        )
      },
      onError: (msg) => showToast(msg, 'error'),
    })

    if (success && navigator.onLine && supabase) {
      // 在 submitWithOffline 成功後，await 附加的 DB 寫入
      // Upsert frozen sales
      if (frozenItems.length > 0) {
        await supabase.from('frozen_sales').upsert(frozenItems, {
          onConflict: 'store_id,date,zone_code,product_key',
        })
      }
      // Save supply tracker (其他區)
      await saveSupplyData(staffId)
      // Save stock entries (到期日批次): upsert + 刪除多餘（安全模式）
      // 用快照避免 stale closure
      // 合併同一 (product_id, expiry_date) 的數量，避免批次內重複 key 導致 upsert 失敗
      const seMap = new Map<string, { session_id: string; product_id: string; expiry_date: string; quantity: number }>()
      let seRawCount = 0
      const seMergedKeys: string[] = []
      const seSkipped: string[] = []
      Object.entries(stockEntriesSnapshot).forEach(([pid, entries]) => {
        (entries as StockEntry[]).forEach((e) => {
          if (e.expiryDate && e.quantity !== '') {
            seRawCount++
            const key = `${pid}|${e.expiryDate}`
            const existing = seMap.get(key)
            if (existing) {
              existing.quantity += parseFloat(e.quantity) || 0
              seMergedKeys.push(key)
            } else {
              seMap.set(key, {
                session_id: sessionId,
                product_id: pid,
                expiry_date: e.expiryDate,
                quantity: parseFloat(e.quantity) || 0,
              })
            }
          } else {
            seSkipped.push(`${pid}|date=${e.expiryDate}|qty=${e.quantity}`)
          }
        })
      })
      const seInserts = Array.from(seMap.values())
      // 安全模式：先 upsert 新資料 → 成功後才刪除不在新列表中的舊行
      // 避免 DELETE 成功但 INSERT 失敗導致到期日資料全部遺失
      let seUpsertOk = false
      let seDeletedCount = 0
      let seVerifyCount = -1
      let seErrorMsg = ''
      if (seInserts.length > 0) {
        const { error: upsertErr } = await supabase
          .from('inventory_stock_entries')
          .upsert(seInserts, { onConflict: 'session_id,product_id,expiry_date' })
        if (upsertErr) {
          seErrorMsg = `${upsertErr.code}|${upsertErr.message}`
          console.error('[stockEntries] upsert error:', upsertErr)
          showToast('到期日資料儲存失敗，請重新提交', 'error')
        } else {
          seUpsertOk = true
          // 刪除不在新列表中的舊行
          const { data: existing } = await supabase
            .from('inventory_stock_entries')
            .select('id, product_id, expiry_date')
            .eq('session_id', sessionId)
          const newKeys = new Set(seInserts.map(i => `${i.product_id}|${i.expiry_date}`))
          const toDelete = existing?.filter(e => !newKeys.has(`${e.product_id}|${e.expiry_date}`))?.map(e => e.id) || []
          if (toDelete.length > 0) {
            await supabase.from('inventory_stock_entries').delete().in('id', toDelete)
          }
          seDeletedCount = toDelete.length
          // 驗證：讀回確認筆數正確
          const { data: verifyRows } = await supabase
            .from('inventory_stock_entries')
            .select('id')
            .eq('session_id', sessionId)
          seVerifyCount = verifyRows?.length ?? -1
          if (seVerifyCount !== seInserts.length) {
            showToast(`到期日資料筆數異常（預期 ${seInserts.length}，實際 ${seVerifyCount}），請檢查後重新提交`, 'error')
          }
        }
      } else {
        // 無到期日資料 → 清空該 session 的所有 stock entries
        seUpsertOk = true
        await supabase.from('inventory_stock_entries').delete().eq('session_id', sessionId)
      }
      // Audit log：記錄 stock entries 完整診斷資訊
      logAudit('stock_entries_save', storeId, sessionId, {
        staffId,
        rawCount: seRawCount,
        dedupCount: seInserts.length,
        mergedKeys: seMergedKeys.length > 0 ? seMergedKeys : undefined,
        skipped: seSkipped.length > 0 ? seSkipped : undefined,
        upsertOk: seUpsertOk,
        errorMsg: seErrorMsg || undefined,
        deletedCount: seDeletedCount,
        verifyCount: seVerifyCount,
        mismatch: seVerifyCount !== -1 && seVerifyCount !== seInserts.length,
      })
      originalData.current = JSON.parse(JSON.stringify(data))
      originalFrozenData.current = JSON.parse(JSON.stringify(frozenData))
      originalStockEntries.current = JSON.parse(JSON.stringify(stockEntriesSnapshot))
    }

    if (success && !navigator.onLine) {
      // offline success — still mark as submitted locally
      originalData.current = JSON.parse(JSON.stringify(data))
      originalFrozenData.current = JSON.parse(JSON.stringify(frozenData))
      originalStockEntries.current = JSON.parse(JSON.stringify(stockEntriesSnapshot))
      setIsEdit(true)
    }

    setSubmitting(false)
    submittingRef.current = false
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName}${zoneLabel} 物料盤點`} />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {/* Edit badge */}
      {isEdit && !isMergedView && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : selectedDate}盤點紀錄，修改後可重新提交</span>
          {modifiedCount > 0 && (
            <span className="ml-auto font-medium text-brand-lotus">已修改 {modifiedCount} 項</span>
          )}
        </div>
      )}

      {/* Zone selector pills */}
      {hasMultipleZones && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-section border-b border-gray-100">
          {storeZones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setZone(zone.zoneCode)}
              className={`py-1 px-4 rounded-full text-sm font-semibold transition-colors ${
                zone.zoneCode === currentZone
                  ? 'bg-brand-oak text-white'
                  : 'bg-white text-brand-oak border border-brand-oak/30'
              }`}
            >
              {zone.zoneName}
            </button>
          ))}
          <button
            onClick={() => setZone(null)}
            className={`py-1 px-4 rounded-full text-sm font-semibold transition-colors ml-auto ${
              isMergedView
                ? 'bg-brand-oak text-white'
                : 'bg-white text-brand-oak border border-brand-oak/30'
            }`}
          >
            全部
          </button>
        </div>
      )}

      {/* Merged view status banner */}
      {isMergedView && !mergedLoading && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-xs font-medium text-blue-800 mb-1">📋 合併檢視（唯讀）</p>
          <div className="flex gap-3 text-xs">
            {storeZones.map((zone) => (
              <span key={zone.id} className={zoneStatuses[zone.zoneCode] ? 'text-green-700' : 'text-red-600'}>
                {zoneStatuses[zone.zoneCode] ? '✓' : '✗'} {zone.zoneName} {zoneStatuses[zone.zoneCode] ? '已提交' : '未提交'}
              </span>
            ))}
          </div>
        </div>
      )}

      {(isMergedView ? mergedLoading : loading) ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          <ProgressBar current={completedCount} total={storeProducts.length} />

          {/* 欄位標題列 */}
          <div className="sticky top-14 z-10 flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[56px] text-center">架上</span>
            {hasBagWeightItems && <span className="w-[44px] text-center text-[9px]">總計</span>}
            <span className="w-[110px] text-center">庫存</span>
            <span className="w-[56px] text-center">倒掉</span>
            <span className="w-[40px] text-center text-[9px]">前日用量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader
                title={category}
                icon="■"
                sticky={false}
                completed={getCategoryCompleted(products)}
                total={products.length}
              />
              <div className="bg-white">
                {products.map((product, idx) => {
                  const entry = getEntry(product.id)
                  const isFilled = entry.onShelf !== '' || entry.stock !== '' || entry.discarded !== ''
                  const modified = isItemModified(product.id)
                  const hasStockEntries = (stockEntries[product.id]?.length ?? 0) > 0
                  const isExpanded = expandedStockId === product.id
                  const linkedTotal = getLinkedTotal(product.id)
                  const linkedUsage = getLinkedPrevUsage(product.id)
                  const isAggregate = isAggregateItem(product.id)

                  return (
                    <div key={product.id}>
                      <div
                        className={`flex items-center px-4 py-2 ${idx < products.length - 1 && !isExpanded ? 'border-b border-gray-50' : ''} ${modified ? 'bg-amber-100 border-l-3 border-l-amber-500' : isFilled ? 'bg-surface-filled/30' : ''}`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="text-sm font-semibold text-brand-oak leading-tight">{product.name}</p>
                          <p className="text-[10px] text-brand-lotus leading-tight">
                            {product.shelfLifeDays ? `期效${product.shelfLifeDays}` : ''}
                            {product.baseStock ? ` · ${product.baseStock}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isMergedView ? (
                            <>
                              <span className="w-[56px] shrink-0 text-center text-sm text-brand-oak">
                                {entry.onShelf ? (product.bag_weight ? `${entry.onShelf}g` : entry.onShelf) : '-'}
                              </span>
                              {hasBagWeightItems && (
                                <span className="w-[44px] shrink-0 text-center text-xs font-num text-brand-mocha">
                                  {linkedTotal != null ? linkedTotal : ''}
                                </span>
                              )}
                              <span className="w-[110px] shrink-0 text-center text-sm text-brand-oak">{entry.stock || '-'}</span>
                              <span className={`w-[56px] shrink-0 text-center text-sm ${entry.discarded && parseFloat(entry.discarded) > 0 ? 'text-status-danger' : 'text-brand-oak'}`}>{entry.discarded || '-'}</span>
                              <span className={`w-[40px] shrink-0 text-center text-sm ${linkedUsage !== undefined ? (linkedUsage < 0 ? 'text-status-danger' : 'text-brand-oak') : 'text-brand-lotus'}`}>
                                {linkedUsage !== undefined ? linkedUsage : '-'}
                              </span>
                            </>
                          ) : isAggregate ? (
                            /* 聚合品項：唯讀顯示，數據來自關聯子品項加總 */
                            <>
                              <span className="w-[56px] shrink-0 text-center text-sm text-brand-lotus">-</span>
                              {hasBagWeightItems && (
                                <span className="w-[44px] shrink-0 text-center text-xs font-num text-brand-mocha font-semibold">
                                  {linkedTotal != null ? linkedTotal : '-'}
                                </span>
                              )}
                              <span className="w-[110px] shrink-0 text-center text-sm text-brand-lotus">-</span>
                              <span className="w-[56px] shrink-0 text-center text-sm text-brand-lotus">-</span>
                              <span className={`w-[40px] shrink-0 text-center text-sm ${linkedUsage !== undefined ? (linkedUsage < 0 ? 'text-status-danger' : 'text-brand-oak') : 'text-brand-lotus'}`}>
                                {linkedUsage !== undefined ? linkedUsage : '-'}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-[56px] shrink-0">
                                {product.bag_weight ? (
                                  <div className="relative">
                                    <NumericInput
                                      value={entry.onShelf}
                                      onChange={(v) => updateField(product.id, 'onShelf', v)}
                                      isFilled
                                      onNext={focusNext}
                                      data-inv=""
                                    />
                                    <span className="absolute -top-1 -right-1 text-[9px] text-brand-lotus font-medium bg-surface-section rounded px-0.5">g</span>
                                  </div>
                                ) : (
                                  <NumericInput
                                    value={entry.onShelf}
                                    onChange={(v) => updateField(product.id, 'onShelf', v)}
                                    isFilled
                                    onNext={focusNext}
                                    data-inv=""
                                  />
                                )}
                              </div>
                              {hasBagWeightItems && (
                                <span className="w-[44px] shrink-0 text-center text-xs font-num text-brand-mocha">
                                  {linkedTotal != null ? linkedTotal : ''}
                                </span>
                              )}
                              {/* 庫存欄：有到期日資料 → 顯示合計+展開按鈕；否則原始輸入 */}
                              <div className="w-[110px] shrink-0 flex justify-center">
                                {hasStockEntries || isExpanded ? (
                                  <button
                                    type="button"
                                    onClick={() => setExpandedStockId(isExpanded ? null : product.id)}
                                    className={`w-[56px] h-9 rounded-lg flex items-center justify-center gap-0.5 text-base font-semibold transition-colors ${
                                      entry.stock !== '' ? 'bg-green-50 text-brand-oak' : 'bg-gray-50 text-brand-lotus'
                                    } border border-gray-200`}
                                  >
                                    <span className="text-sm">{entry.stock || '0'}</span>
                                    {isExpanded
                                      ? <ChevronUp size={12} className="text-brand-lotus" />
                                      : <ChevronDown size={12} className="text-brand-lotus" />
                                    }
                                  </button>
                                ) : (
                                  <div className="relative">
                                    <DualUnitInput
                                      value={entry.stock}
                                      onChange={(v) => updateField(product.id, 'stock', v)}
                                      unit={product.unit}
                                      box_unit={product.box_unit}
                                      box_ratio={product.box_ratio}
                                      isFilled
                                      onNext={focusNext}
                                      integerOnly={product.integerOnly}
                                      data-inv=""
                                      className={product.wideInput ? 'input-wide' : undefined}
                                    />
                                    <button
                                      type="button"
                                      title="依到期日分批輸入"
                                      onClick={() => {
                                        setStockEntries(prev => ({
                                          ...prev,
                                          [product.id]: [{ expiryDate: '', quantity: entry.stock || '' }],
                                        }))
                                        setExpandedStockId(product.id)
                                      }}
                                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-brand-oak/70 text-white flex items-center justify-center text-[10px] leading-none"
                                    >
                                      +
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div className="w-[56px] shrink-0">
                                <NumericInput
                                  value={entry.discarded}
                                  onChange={(v) => updateField(product.id, 'discarded', v)}
                                  isFilled
                                  className={entry.discarded && parseFloat(entry.discarded) > 0 ? '!text-status-danger' : ''}
                                  onNext={focusNext}
                                  data-inv=""
                                />
                              </div>
                              <span className={`w-[40px] shrink-0 text-center text-sm ${linkedUsage !== undefined ? (linkedUsage < 0 ? 'text-status-danger' : 'text-brand-oak') : 'text-brand-lotus'}`}>
                                {linkedUsage !== undefined ? linkedUsage : '-'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* 展開到期日面板 */}
                      {isExpanded && !isMergedView && (
                        <StockEntryPanel
                          entries={stockEntries[product.id] || []}
                          onChange={(entries) => {
                            if (entries.length === 0) {
                              // All entries removed → revert to plain input mode
                              setStockEntries(prev => {
                                const next = { ...prev }
                                delete next[product.id]
                                return next
                              })
                              setExpandedStockId(null)
                              // Reset stock to empty so user can type directly
                              updateField(product.id, 'stock', '')
                              return
                            }
                            setStockEntries(prev => ({ ...prev, [product.id]: entries }))
                            updateStockFromEntries(product.id, entries)
                          }}
                          onCollapse={() => {
                            setExpandedStockId(null)
                            requestAnimationFrame(() => {
                              const allInputs = document.querySelectorAll<HTMLInputElement>('[data-inv]')
                              const arr = Array.from(allInputs)
                              for (let i = 0; i < arr.length; i++) {
                                const row = arr[i].closest('[data-product-id]')
                                if (row?.getAttribute('data-product-id') === product.id) {
                                  if (arr[i + 1]) arr[i + 1].focus()
                                  break
                                }
                              }
                            })
                          }}
                          unit={product.unit}
                          box_unit={product.box_unit}
                          box_ratio={product.box_ratio}
                          integerOnly={product.integerOnly}
                        />
                      )}
                      {isExpanded && idx < products.length - 1 && (
                        <div className="border-b border-gray-50" />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 冷凍品販售 */}
          {!frozenLoading && FROZEN_PRODUCTS.length > 0 && (
            <div>
              <SectionHeader
                title="冷凍品販售"
                icon="■"
                sticky={false}
                completed={frozenCompletedCount}
                total={FROZEN_PRODUCTS.length}
              />
              {/* 欄位標題列 */}
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[60px] text-center">外帶</span>
                <span className="w-[60px] text-center">外送</span>
              </div>
              <div className="bg-white">
                {FROZEN_PRODUCTS.map((product, idx) => {
                  const entry = frozenDisplayData[product.key] || emptyFrozenEntry
                  const isFilled = (entry.takeout !== '' && entry.takeout !== '0') || (entry.delivery !== '' && entry.delivery !== '0')

                  return (
                    <div
                      key={product.key}
                      className={`flex items-center px-4 py-2 ${idx < FROZEN_PRODUCTS.length - 1 ? 'border-b border-gray-50' : ''} ${isFilled ? 'bg-surface-filled/30' : ''}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-brand-oak leading-tight">{product.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">{product.spec}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isMergedView ? (
                          <>
                            <span className="w-[60px] text-center text-sm text-brand-oak">{entry.takeout || '-'}</span>
                            <span className="w-[60px] text-center text-sm text-brand-oak">{entry.delivery || '-'}</span>
                          </>
                        ) : (
                          <>
                            <NumericInput
                              value={entry.takeout}
                              onChange={(v) => updateFrozenField(product.key, 'takeout', v)}
                              isFilled
                              onNext={focusNext}
                              data-inv=""
                            />
                            <NumericInput
                              value={entry.delivery}
                              onChange={(v) => updateFrozenField(product.key, 'delivery', v)}
                              isFilled
                              onNext={focusNext}
                              data-inv=""
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 其他區（消耗品追蹤） */}
          {!supplyLoading && visibleSupplyItems.length > 0 && (
            <div>
              <SectionHeader title="其他區" icon="■" sticky={false} />
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[70px] text-center">補貨</span>
                <span className="w-[70px] text-center">剩餘庫存</span>
              </div>
              <div className="bg-white">
                {visibleSupplyItems.map((item, idx) => {
                  const restock = supplyRestock[item.key] || ''
                  const remaining = supplyRemaining[item.key] || 0

                  return (
                    <div
                      key={item.key}
                      className={`flex items-center px-4 py-2 ${idx < visibleSupplyItems.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-brand-oak leading-tight">{item.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">{item.unit}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isMergedView ? (
                          <>
                            <span className="w-[70px] text-center text-sm text-brand-oak">{restock || '-'}</span>
                            <span className={`w-[70px] text-center text-sm font-semibold ${remaining < 0 ? 'text-status-danger' : 'text-brand-oak'}`}>
                              {remaining}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="w-[70px] shrink-0">
                              <NumericInput
                                value={restock}
                                onChange={(v) => updateSupplyRestock(item.key, v)}
                                isFilled
                                onNext={focusNext}
                                data-inv=""
                              />
                            </div>
                            <span className={`w-[70px] text-center text-sm font-semibold ${remaining < 0 ? 'text-status-danger' : 'text-brand-oak'}`}>
                              {remaining}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!isMergedView && (
            <BottomAction
              label={submitting ? '提交中...' : isEdit ? '更新盤點資料' : '預覽並提交盤點'}
              onClick={handleSubmit}
              icon={<Send size={18} />}
              disabled={submitting}
            />
          )}
        </>
      )}

      {/* 送出成功確認框 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm text-center">
            <CheckCircle size={48} className="text-status-success mx-auto mb-3" />
            <h3 className="text-lg font-bold text-brand-oak mb-1">盤點送出成功</h3>
            <p className="text-sm text-brand-lotus mb-1">{storeName}{zoneLabel}</p>
            <p className="text-sm text-brand-lotus mb-1">{successInfo.date.replace(/-/g, '/')}</p>
            <p className="text-sm text-brand-lotus mb-5">共 {successInfo.itemCount} 項品項</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-11 rounded-xl bg-status-success text-white text-sm font-semibold"
            >
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
