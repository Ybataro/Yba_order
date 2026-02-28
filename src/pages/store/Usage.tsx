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

      // 1. 前日叫貨量 = 前日用量參考
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      const prevOrderSid = `${storeId}_${yesterdayStr}`

      const { data: prevItems } = await supabase!
        .from('order_items')
        .select('product_id, quantity')
        .eq('session_id', prevOrderSid)

      if (prevItems) {
        prevItems.forEach(item => {
          if (result[item.product_id]) {
            result[item.product_id].prevUsage = item.quantity || 0
          }
        })
      }

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
          // bag_weight 品項的 on_shelf 是 g 數，需換算成袋數
          const bagWeightMap: Record<string, number> = {}
          storeProducts.forEach(p => { if (p.bag_weight) bagWeightMap[p.id] = p.bag_weight })
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
          <div className="flex items-center justify-end gap-1 px-4 py-1.5 text-[11px] text-brand-lotus bg-white border-b border-gray-100">
            <span className="flex-1">品項</span>
            <span className="w-[46px] text-center">前日用量</span>
            <span className="w-[46px] text-center">倒掉量</span>
            <span className="w-[46px] text-center">庫存</span>
            <span className="w-[46px] text-center">央廚備料</span>
            <span className="w-[46px] text-center font-semibold">總量</span>
          </div>

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
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
