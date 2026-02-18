import { useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { Send } from 'lucide-react'

interface InventoryEntry {
  onShelf: string
  stock: string
  discarded: string
}

export default function Inventory() {
  const { storeId } = useParams<{ storeId: string }>()
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)

  const [data, setData] = useState<Record<string, InventoryEntry>>(() => {
    const init: Record<string, InventoryEntry> = {}
    storeProducts.forEach(p => {
      init[p.id] = { onShelf: '', stock: '', discarded: '' }
    })
    return init
  })

  const updateField = useCallback((productId: string, field: keyof InventoryEntry, value: string) => {
    setData(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value }
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
      const e = data[p.id]
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  const getCategoryCompleted = useCallback((products: typeof storeProducts) => {
    return products.filter(p => {
      const e = data[p.id]
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data])

  const handleSubmit = () => {
    showToast('盤點資料已提交成功！')
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 物料盤點`} />
      <ProgressBar current={completedCount} total={storeProducts.length} />

      {Array.from(productsByCategory.entries()).map(([category, products]) => (
        <div key={category}>
          <SectionHeader
            title={category}
            icon="■"
            completed={getCategoryCompleted(products)}
            total={products.length}
          />
          {/* 欄位標題列 */}
          <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[60px] text-center">架上</span>
            <span className="w-[60px] text-center">庫存</span>
            <span className="w-[60px] text-center">倒掉</span>
          </div>
          <div className="bg-white">
            {products.map((product, idx) => {
              const entry = data[product.id]
              const isFilled = entry.onShelf !== '' || entry.stock !== '' || entry.discarded !== ''

              return (
                <div
                  key={product.id}
                  className={`flex items-center px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''} ${isFilled ? 'bg-surface-filled/30' : ''}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-semibold text-brand-oak leading-tight">{product.name}</p>
                    <p className="text-[10px] text-brand-lotus leading-tight">
                      {product.shelfLifeDays ? `期效${product.shelfLifeDays}` : ''}
                      {product.baseStock ? ` · ${product.baseStock}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <NumericInput
                      value={entry.onShelf}
                      onChange={(v) => updateField(product.id, 'onShelf', v)}
                      isFilled
                      onNext={focusNext}
                      data-inv=""
                    />
                    <NumericInput
                      value={entry.stock}
                      onChange={(v) => updateField(product.id, 'stock', v)}
                      isFilled
                      onNext={focusNext}
                      data-inv=""
                    />
                    <NumericInput
                      value={entry.discarded}
                      onChange={(v) => updateField(product.id, 'discarded', v)}
                      isFilled
                      className={entry.discarded && parseFloat(entry.discarded) > 0 ? '!text-status-danger' : ''}
                      onNext={focusNext}
                      data-inv=""
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <BottomAction label="預覽並提交盤點" onClick={handleSubmit} icon={<Send size={18} />} />
    </div>
  )
}
