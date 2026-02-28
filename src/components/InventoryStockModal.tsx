import { useEffect, useRef, useMemo } from 'react'
import { X } from 'lucide-react'
import { formatDualUnit } from '@/lib/utils'

interface Product {
  id: string
  name: string
  category: string
  unit: string
  box_unit?: string
  box_ratio?: number
}

interface StockEntry {
  expiryDate: string
  quantity: number
}

interface InventoryStockModalProps {
  open: boolean
  onClose: () => void
  stock: Record<string, number>
  stockDate: string
  stockEntries: Record<string, StockEntry[]>
  products: Product[]
  productCategories: string[]
  sortCategories: (cats: string[]) => string[]
  sortItems: <U extends { id: string }>(items: U[]) => U[]
}

export function InventoryStockModal({
  open,
  onClose,
  stock,
  stockDate,
  stockEntries,
  products,
  productCategories,
  sortCategories,
  sortItems,
}: InventoryStockModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const productsByCategory = useMemo(() => {
    const sorted = sortCategories(productCategories)
    const map = new Map<string, Product[]>()
    for (const cat of sorted) {
      const catItems = sortItems(products.filter((p) => p.category === cat))
      const withStock = catItems.filter((p) => stock[p.id] != null)
      if (withStock.length > 0) map.set(cat, withStock)
    }
    return map
  }, [products, productCategories, stock, sortCategories, sortItems])

  if (!open) return null

  const formattedDate = stockDate
    ? stockDate.replace(/-/g, '/')
    : '無資料'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-lg bg-white rounded-t-sheet max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-brand-oak">最新盤點庫存</h2>
            <p className="text-xs text-brand-lotus mt-0.5">盤點日期：{formattedDate}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200">
            <X size={20} className="text-brand-lotus" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {productsByCategory.size === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              尚無盤點資料
            </div>
          ) : (
            Array.from(productsByCategory.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-2.5 font-semibold text-sm flex items-center gap-2" style={{ backgroundColor: 'var(--color-section-bg)', color: 'var(--color-text-primary)' }}>
                  <span className="w-2 h-2 rounded-sm bg-brand-mocha inline-block" />
                  <span>{category}</span>
                </div>
                <div className="bg-white">
                  {items.map((product, idx) => {
                    const qty = stock[product.id] || 0
                    const entries = stockEntries[product.id]
                    const hasEntries = entries && entries.length > 0

                    return (
                      <div
                        key={product.id}
                        className={`px-4 py-2 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                          <span className={`text-sm font-num shrink-0 ml-3 ${qty === 0 ? 'text-status-danger font-bold' : 'text-brand-oak'}`}>
                            {formatDualUnit(qty, product.unit, product.box_unit, product.box_ratio)}
                          </span>
                        </div>
                        {hasEntries && (
                          <div className="mt-1 space-y-0.5 pl-2">
                            {entries.map((e, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] text-brand-lotus">
                                <span>{e.expiryDate.replace(/-/g, '/')}</span>
                                <span className="font-num">
                                  {formatDualUnit(e.quantity, product.unit, product.box_unit, product.box_ratio)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary w-full !h-11">關閉</button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
