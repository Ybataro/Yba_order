import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'

export default function Usage() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)

  const mockData = useMemo(() => {
    const data: Record<string, { prevUsage: number; discarded: number; stock: number; kitchenSupply: number; total: number }> = {}
    storeProducts.forEach(p => {
      const stock = Math.round(Math.random() * 3 * 10) / 10
      const kitchenSupply = Math.round(Math.random() * 2 * 10) / 10
      const discarded = Math.random() > 0.7 ? Math.round(Math.random() * 0.5 * 10) / 10 : 0
      data[p.id] = { prevUsage: Math.round(Math.random() * 4 * 10) / 10, discarded, stock, kitchenSupply, total: Math.round((stock + kitchenSupply) * 10) / 10 }
    })
    return data
  }, [])

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
              const d = mockData[product.id]
              return (
                <div key={product.id} className={`flex items-center justify-between px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex-1 min-w-0 pr-1">
                    <span className="text-xs font-medium text-brand-oak">{product.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-[46px] text-center text-xs font-num text-brand-oak">{d.prevUsage}</span>
                    <span className={`w-[46px] text-center text-xs font-num ${d.discarded > 0 ? 'text-status-danger font-semibold' : 'text-brand-oak'}`}>{d.discarded || 0}</span>
                    <span className="w-[46px] text-center text-xs font-num text-brand-oak">{d.stock}</span>
                    <span className="w-[46px] text-center text-xs font-num text-status-info">{d.kitchenSupply}</span>
                    <span className="w-[46px] text-center text-xs font-num font-semibold text-brand-oak">{d.total}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
