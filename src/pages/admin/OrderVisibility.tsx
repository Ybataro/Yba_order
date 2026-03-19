import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { useAllStoreOrderVisibility } from '@/hooks/useStoreOrderVisibility'
import { Eye, EyeOff } from 'lucide-react'

export default function OrderVisibility() {
  const stores = useStoreStore((s) => s.items)
  const allProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const { hiddenMap, loading, toggleHidden } = useAllStoreOrderVisibility()

  const [activeStore, setActiveStore] = useState(stores[0]?.id ?? '')

  // 只顯示叫貨可見的品項（排除 inventory_only）
  const orderProducts = useMemo(() =>
    allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'),
    [allProducts])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof orderProducts>()
    for (const cat of productCategories) {
      const items = orderProducts.filter(p => p.category === cat)
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [orderProducts, productCategories])

  const storeHidden = hiddenMap[activeStore] || new Set()
  const visibleCount = orderProducts.length - storeHidden.size
  const [toggling, setToggling] = useState<string | null>(null)

  const handleToggle = async (productId: string) => {
    setToggling(productId)
    await toggleHidden(activeStore, productId)
    setToggling(null)
  }

  return (
    <div className="page-container !pb-4">
      <TopNav title="叫貨品項管理" backTo="/admin" />

      {/* 門店切換 */}
      <div className="flex border-b border-gray-200 bg-white">
        {stores.map(store => (
          <button
            key={store.id}
            onClick={() => setActiveStore(store.id)}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
              activeStore === store.id
                ? 'text-brand-mocha border-b-2 border-brand-mocha'
                : 'text-brand-lotus'
            }`}
          >
            {store.name}
          </button>
        ))}
      </div>

      {/* 統計 */}
      <div className="px-4 py-2.5 flex items-center gap-2 bg-white border-b border-gray-100">
        <Eye size={16} className="text-brand-mocha" />
        <span className="text-sm text-brand-oak">
          顯示 <span className="font-semibold">{visibleCount}</span> / {orderProducts.length} 品項
        </span>
        <span className="text-xs text-brand-lotus ml-auto">取消勾選 = 叫貨頁隱藏</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <div>
          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {products.map((product, idx) => {
                  const isHidden = storeHidden.has(product.id)
                  const isToggling = toggling === product.id
                  return (
                    <button
                      key={product.id}
                      onClick={() => handleToggle(product.id)}
                      disabled={isToggling}
                      className={`w-full flex items-center px-4 py-2.5 text-left active:bg-gray-50 ${
                        idx < products.length - 1 ? 'border-b border-gray-50' : ''
                      } ${isHidden ? 'opacity-50' : ''}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        !isHidden ? 'bg-status-success border-status-success' : 'border-gray-300'
                      }`}>
                        {!isHidden && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0 pl-3">
                        <p className="text-sm font-medium text-brand-oak">{product.name}</p>
                        <p className="text-[10px] text-brand-lotus">{product.unit}</p>
                      </div>
                      {isHidden ? (
                        <EyeOff size={16} className="text-brand-lotus shrink-0" />
                      ) : (
                        <Eye size={16} className="text-status-success shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
