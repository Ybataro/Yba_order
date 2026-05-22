import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW, shipmentSessionId } from '@/lib/session'

interface UsageEntry {
  prevUsage: number
  discarded: number
  stock: number
  kitchenSupply: number
  total: number
}

export default function Usage() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const today = getTodayTW()

  const [usageData, setUsageData] = useState<Record<string, UsageEntry>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }

    const load = async () => {
      setLoading(true)
      const result: Record<string, UsageEntry> = {}
      storeProducts.forEach(p => {
        result[p.id] = { prevUsage: 0, discarded: 0, stock: 0, kitchenSupply: 0, total: 0 }
      })

      // bag_weight map (used by both today's 盤點 and 昨日用量計算)
      const bagWeightMap: Record<string, number> = {}
      storeProducts.forEach(p => { if (p.bag_weight) bagWeightMap[p.id] = p.bag_weight })

      // 1. 前日用量 = 物料平衡公式（與 Inventory.tsx / Order.tsx 對齊 SSOT）
      //    昨日 = today - 1，前日 = today - 2
      //    公式：prev(today-2 庫存) + 出貨(today-1 actual_qty) - today(today-1 庫存) - 倒掉(today-1)
      const yesterday = new Date(today + 'T00:00:00+08:00')
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      const dayBefore = new Date(today + 'T00:00:00+08:00')
      dayBefore.setDate(dayBefore.getDate() - 2)
      const dayBeforeStr = dayBefore.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      const [prevInvSessRes, ydInvSessRes, ydShipSessRes] = await Promise.all([
        supabase!.from('inventory_sessions').select('id').eq('store_id', storeId).eq('date', dayBeforeStr),
        supabase!.from('inventory_sessions').select('id').eq('store_id', storeId).eq('date', yesterdayStr),
        supabase!.from('shipment_sessions').select('id').eq('store_id', storeId).eq('date', yesterdayStr),
      ])

      const sumInvSession = async (sids: string[]) => {
        const inv: Record<string, number> = {}
        const disc: Record<string, number> = {}
        if (!sids.length) return { inv, disc }
        const { data } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock, discarded')
          .in('session_id', sids)
        data?.forEach(it => {
          const bw = bagWeightMap[it.product_id]
          const onShelfBags = bw ? (it.on_shelf || 0) / bw : (it.on_shelf || 0)
          inv[it.product_id] = (inv[it.product_id] || 0) + onShelfBags + (it.stock || 0)
          disc[it.product_id] = (disc[it.product_id] || 0) + (it.discarded || 0)
        })
        return { inv, disc }
      }

      const prevSids = (prevInvSessRes.data || []).map(s => s.id)
      const ydSids = (ydInvSessRes.data || []).map(s => s.id)
      const ydShipSids = (ydShipSessRes.data || []).map(s => s.id)

      const [{ inv: prevInv }, { inv: ydInv, disc: ydDisc }] = await Promise.all([
        sumInvSession(prevSids),
        sumInvSession(ydSids),
      ])

      const ydShipQty: Record<string, number> = {}
      if (ydShipSids.length > 0) {
        const { data: shipItems } = await supabase!
          .from('shipment_items')
          .select('product_id, actual_qty')
          .in('session_id', ydShipSids)
        shipItems?.forEach(it => {
          ydShipQty[it.product_id] = (ydShipQty[it.product_id] || 0) + (it.actual_qty || 0)
        })
      }

      storeProducts.forEach(p => {
        const prev = prevInv[p.id]
        const ydToday = ydInv[p.id]
        if (prev != null && ydToday != null) {
          const ship = ydShipQty[p.id] || 0
          const disc = ydDisc[p.id] || 0
          result[p.id].prevUsage = Math.round((prev + ship - ydToday - disc) * 10) / 10
        }
      })

      // 2. 最新盤點：庫存(on_shelf+stock) + 倒掉量
      const { data: invSessions } = await supabase!
        .from('inventory_sessions')
        .select('id, date')
        .eq('store_id', storeId)
        .order('date', { ascending: false })
        .limit(10)

      if (invSessions && invSessions.length > 0) {
        const latestDate = invSessions[0].date
        const latestSids = invSessions.filter(s => s.date === latestDate).map(s => s.id)

        const { data: invItems } = await supabase!
          .from('inventory_items')
          .select('product_id, on_shelf, stock, discarded')
          .in('session_id', latestSids)

        if (invItems) {
          invItems.forEach(item => {
            if (result[item.product_id]) {
              const bw = bagWeightMap[item.product_id]
              const onShelfBags = bw ? (item.on_shelf || 0) / bw : (item.on_shelf || 0)
              result[item.product_id].stock += onShelfBags + (item.stock || 0)
              result[item.product_id].discarded += (item.discarded || 0)
            }
          })
        }
      }

      // 3. 今日央廚出貨
      const shipSid = shipmentSessionId(storeId, today)
      const { data: shipItems } = await supabase!
        .from('shipment_items')
        .select('product_id, actual_qty')
        .eq('session_id', shipSid)

      if (shipItems) {
        shipItems.forEach(item => {
          if (result[item.product_id]) {
            result[item.product_id].kitchenSupply = item.actual_qty || 0
          }
        })
      }

      // 計算總量
      Object.values(result).forEach(entry => {
        entry.stock = Math.round(entry.stock * 10) / 10
        entry.discarded = Math.round(entry.discarded * 10) / 10
        entry.total = Math.round((entry.stock + entry.kitchenSupply) * 10) / 10
      })

      setUsageData(result)
      setLoading(false)
    }

    load()
  }, [storeId, today])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  return (
    <div className="page-container !pb-8">
      <TopNav title={`${storeName} 每日用量`} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          <div className="sticky top-14 z-10 flex items-center justify-end gap-1 px-4 py-1.5 text-[11px] text-brand-lotus bg-white border-b border-gray-100">
            <span className="flex-1">品項</span>
            <span className="w-[46px] text-center">前日用量</span>
            <span className="w-[46px] text-center">倒掉量</span>
            <span className="w-[46px] text-center">庫存</span>
            <span className="w-[46px] text-center">央廚備料</span>
            <span className="w-[46px] text-center font-semibold">總量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" sticky={false} />
              <div className="bg-white">
                {products.map((product, idx) => {
                  const d = usageData[product.id] || { prevUsage: 0, discarded: 0, stock: 0, kitchenSupply: 0, total: 0 }
                  return (
                    <div key={product.id} className={`flex items-center justify-between px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <div className="flex-1 min-w-0 pr-1">
                        <span className="text-xs font-medium text-brand-oak">{product.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-[46px] text-center text-xs font-num text-brand-oak">{d.prevUsage || '-'}</span>
                        <span className={`w-[46px] text-center text-xs font-num ${d.discarded > 0 ? 'text-status-danger font-semibold' : 'text-brand-oak'}`}>{d.discarded || 0}</span>
                        <span className="w-[46px] text-center text-xs font-num text-brand-oak">{d.stock || '-'}</span>
                        <span className="w-[46px] text-center text-xs font-num text-status-info">{d.kitchenSupply || '-'}</span>
                        <span className="w-[46px] text-center text-xs font-num font-semibold text-brand-oak">{d.total || '-'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
