import { useEffect, useRef, useState, useMemo } from 'react'
import { X, Save } from 'lucide-react'
import { saveOrderMinTotals } from '@/lib/orderMinTotal'
import { useToast } from '@/components/Toast'

interface Product {
  id: string
  name: string
  category: string
  unit: string
}

interface OrderMinTotalSheetProps {
  open: boolean
  onClose: () => void
  storeId: string
  /** 與叫貨頁完全相同的品項清單（已過 visibility filter、已排序），確保 100% 同步 */
  products: Product[]
  productCategories: readonly string[]
  sortCategories: (cats: string[]) => string[]
  sortItems: <U extends { id: string }>(items: U[]) => U[]
  /** 目前已存的閾值，Map<productId, minTotal> */
  currentMinTotals: Map<string, number>
  /** 儲存成功後回呼，讓父層更新 state */
  onSaved: (updated: Map<string, number>) => void
}

export function OrderMinTotalSheet({
  open,
  onClose,
  storeId,
  products,
  productCategories,
  sortCategories,
  sortItems,
  currentMinTotals,
  onSaved,
}: OrderMinTotalSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const { showToast } = useToast()

  // 本地草稿：Map<productId, inputValue(string)>
  // 空字串 = 不提醒；有數值 = 設定閾值
  const [draft, setDraft] = useState<Map<string, string>>(new Map())
  const [saving, setSaving] = useState(false)

  // 每次 open 時，用 currentMinTotals 初始化草稿
  useEffect(() => {
    if (!open) return
    const init = new Map<string, string>()
    products.forEach(p => {
      const v = currentMinTotals.get(p.id)
      init.set(p.id, v != null ? String(v) : '')
    })
    setDraft(init)
  }, [open, products, currentMinTotals])

  // 鎖定背景滾動
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // 依分類排序（與叫貨頁相同邏輯）
  const productsByCategory = useMemo(() => {
    const sortedCats = sortCategories([...productCategories])
    const map = new Map<string, Product[]>()
    for (const cat of sortedCats) {
      const items = sortItems(products.filter(p => p.category === cat))
      if (items.length > 0) map.set(cat, items)
    }
    return map
  }, [products, productCategories, sortCategories, sortItems])

  const handleInputChange = (productId: string, value: string) => {
    // 只允許正數或空字串
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    setDraft(prev => {
      const next = new Map(prev)
      next.set(productId, value)
      return next
    })
  }

  const handleClear = (productId: string) => {
    setDraft(prev => {
      const next = new Map(prev)
      next.set(productId, '')
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = products.map(p => {
        const raw = draft.get(p.id) || ''
        const parsed = parseFloat(raw)
        return {
          productId: p.id,
          minTotal: !isNaN(parsed) && parsed > 0 ? parsed : null,
        }
      })

      await saveOrderMinTotals(storeId, entries)

      // 重建最新 Map 回傳給父層
      const updated = new Map<string, number>()
      entries.forEach(e => {
        if (e.minTotal != null) updated.set(e.productId, e.minTotal)
      })
      onSaved(updated)
      showToast('最低總量設定已儲存')
      onClose()
    } catch (err) {
      showToast('儲存失敗，請重試', 'error')
      console.error('[OrderMinTotalSheet] save error:', err)
    } finally {
      setSaving(false)
    }
  }

  // 計算已設定筆數（提示用）
  const settledCount = useMemo(() => {
    let count = 0
    draft.forEach(v => { if (v !== '' && parseFloat(v) > 0) count++ })
    return count
  }, [draft])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-lg bg-white rounded-t-sheet max-h-[88vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-brand-oak">叫貨最低總量設定</h2>
            <p className="text-xs text-brand-lotus mt-0.5">
              {settledCount > 0 ? `已設定 ${settledCount} 項 · ` : ''}留空表示不提醒
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200"
            disabled={saving}
          >
            <X size={20} className="text-brand-lotus" />
          </button>
        </div>

        {/* 說明 */}
        <div className="px-5 py-2.5 bg-surface-section border-b border-gray-100 shrink-0">
          <p className="text-xs text-brand-lotus leading-relaxed">
            送出叫貨單後，若品項「庫存 + 叫貨量」低於此設定值，系統將自動提醒。每日叫貨皆會依此標準偵測。
          </p>
        </div>

        {/* 品項列表 */}
        <div className="flex-1 overflow-y-auto">
          {Array.from(productsByCategory.entries()).map(([category, items]) => (
            <div key={category}>
              {/* 分類標題 */}
              <div className="flex items-center gap-2 px-4 py-2 bg-surface-section border-b border-gray-100">
                <span className="text-[11px] font-semibold text-brand-lotus tracking-wide">{category}</span>
              </div>

              <div className="bg-white">
                {items.map((product, idx) => {
                  const value = draft.get(product.id) ?? ''
                  const hasValue = value !== '' && parseFloat(value) > 0

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center px-4 py-3 gap-3 ${
                        idx < items.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      {/* 品名 */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                        <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                      </div>

                      {/* 輸入框 + 清除鈕 */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            value={value}
                            onChange={e => handleInputChange(product.id, e.target.value)}
                            placeholder="不提醒"
                            className={`w-20 h-9 rounded-input border text-sm font-num text-right pr-2 pl-2 outline-none transition-colors
                              ${hasValue
                                ? 'border-brand-amber bg-brand-amber/5 text-brand-amber font-medium'
                                : 'border-gray-200 bg-surface-input text-brand-oak'
                              }
                              focus:border-brand-lotus`}
                          />
                        </div>
                        {/* 單位標籤 */}
                        <span className="text-[11px] text-brand-lotus w-5 shrink-0">{product.unit}</span>
                        {/* 清除按鈕 */}
                        {hasValue ? (
                          <button
                            type="button"
                            onClick={() => handleClear(product.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 active:bg-gray-200 shrink-0"
                          >
                            <X size={12} className="text-brand-lotus" />
                          </button>
                        ) : (
                          <div className="w-6 h-6 shrink-0" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {/* 底部安全距離 */}
          <div className="h-4" />
        </div>

        {/* 儲存按鈕 */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-100 bg-white">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 rounded-btn bg-brand-mocha text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? '儲存中...' : '儲存設定'}
          </button>
        </div>
      </div>
    </div>
  )
}
