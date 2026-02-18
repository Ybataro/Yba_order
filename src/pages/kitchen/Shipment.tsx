import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { Truck, AlertTriangle, UserCheck } from 'lucide-react'

export default function Shipment() {
  const { showToast } = useToast()
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const stores = useStoreStore((s) => s.items)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [activeStore, setActiveStore] = useState(stores[0]?.id ?? '')
  const [confirmBy, setConfirmBy] = useState('')

  // 模擬各店叫貨量（門店提交的原始數量）
  const orderQty = useMemo(() => {
    const data: Record<string, Record<string, number>> = {}
    stores.forEach(store => {
      data[store.id] = {}
      storeProducts.forEach(p => {
        data[store.id][p.id] = Math.random() > 0.3 ? Math.round(Math.random() * 5 * 10) / 10 : 0
      })
    })
    return data
  }, [])

  // 實際出貨量（可編輯，預設 = 叫貨量）
  const [actualQty, setActualQty] = useState<Record<string, Record<string, string>>>(() => {
    const data: Record<string, Record<string, string>> = {}
    stores.forEach(store => {
      data[store.id] = {}
      storeProducts.forEach(p => {
        const qty = orderQty[store.id]?.[p.id] || 0
        data[store.id][p.id] = qty > 0 ? String(qty) : ''
      })
    })
    return data
  })

  const [confirmed, setConfirmed] = useState<Record<string, Record<string, boolean>>>(() => {
    const data: Record<string, Record<string, boolean>> = {}
    stores.forEach(store => { data[store.id] = {} })
    return data
  })

  const toggleConfirm = (productId: string) => {
    setConfirmed(prev => ({
      ...prev,
      [activeStore]: { ...prev[activeStore], [productId]: !prev[activeStore]?.[productId] }
    }))
  }

  // 只顯示有叫貨的品項
  const items = storeProducts.filter(p => {
    const qty = orderQty[activeStore]?.[p.id] || 0
    return qty > 0
  })

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      const catItems = items.filter(p => p.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [items])

  const confirmedCount = items.filter(p => confirmed[activeStore]?.[p.id]).length
  const diffCount = items.filter(p => {
    const ordered = orderQty[activeStore]?.[p.id] || 0
    const actual = parseFloat(actualQty[activeStore]?.[p.id] || '0') || 0
    return ordered !== actual
  }).length

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-ship]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  return (
    <div className="page-container">
      <TopNav title="出貨表" />

      {/* 門店切換 */}
      <div className="flex border-b border-gray-200 bg-white">
        {stores.map(store => (
          <button key={store.id} onClick={() => setActiveStore(store.id)}
            className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${activeStore === store.id ? 'text-brand-mocha border-b-2 border-brand-mocha' : 'text-brand-lotus'}`}>
            {store.name}
          </button>
        ))}
      </div>

      {/* 確認人員 + 統計列 */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <UserCheck size={16} className="text-brand-mocha shrink-0" />
          <span className="text-sm text-brand-oak font-medium shrink-0">確認人員</span>
          <select
            value={confirmBy}
            onChange={(e) => setConfirmBy(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">請選擇</option>
            {kitchenStaff.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-oak">
            已確認 <span className="font-semibold">{confirmedCount}/{items.length}</span> 項
          </p>
          {diffCount > 0 && (
            <p className="flex items-center gap-1 text-xs text-status-warning">
              <AlertTriangle size={12} />
              {diffCount} 項數量異動
            </p>
          )}
        </div>
      </div>

      {/* 欄位標題 */}
      <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
        <span className="flex-1">品名</span>
        <span className="w-[50px] text-center">叫貨</span>
        <span className="w-[60px] text-center">實出</span>
        <span className="w-7 text-center">✓</span>
      </div>

      {/* 品項列表 */}
      {Array.from(productsByCategory.entries()).map(([category, products]) => (
        <div key={category}>
          <SectionHeader title={category} icon="■" />
          <div className="bg-white">
            {products.map((product, idx) => {
              const ordered = orderQty[activeStore]?.[product.id] || 0
              const actual = parseFloat(actualQty[activeStore]?.[product.id] || '0') || 0
              const hasDiff = ordered !== actual
              const isConfirmed = confirmed[activeStore]?.[product.id]

              return (
                <div
                  key={product.id}
                  className={`flex items-center px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''} ${isConfirmed ? 'bg-status-success/5' : ''} ${hasDiff ? 'bg-status-warning/5' : ''}`}
                >
                  {/* 品名 */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-medium text-brand-oak leading-tight">{product.name}</p>
                    <p className="text-[10px] text-brand-lotus leading-tight">{product.unit}</p>
                    {hasDiff && (
                      <p className="text-[10px] text-status-warning font-medium leading-tight">
                        差異 {actual - ordered > 0 ? '+' : ''}{Math.round((actual - ordered) * 10) / 10} {product.unit}
                      </p>
                    )}
                  </div>

                  {/* 叫貨量（唯讀） */}
                  <span className="w-[50px] text-center text-sm font-num text-brand-lotus">{ordered}</span>

                  {/* 實出量（可編輯） */}
                  <div className="w-[60px] flex justify-center">
                    <NumericInput
                      value={actualQty[activeStore]?.[product.id] || ''}
                      onChange={(v) => setActualQty(prev => ({
                        ...prev,
                        [activeStore]: { ...prev[activeStore], [product.id]: v }
                      }))}
                      isFilled
                      onNext={focusNext}
                      className={hasDiff ? '!border-status-warning' : ''}
                      data-ship=""
                    />
                  </div>

                  {/* 確認勾選 */}
                  <button onClick={() => toggleConfirm(product.id)} className="w-7 flex justify-center">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isConfirmed ? 'bg-status-success border-status-success text-white' : 'border-gray-300'}`}>
                      {isConfirmed && <span className="text-[10px]">✓</span>}
                    </div>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <BottomAction
        label="確認全部出貨完成"
        onClick={() => {
          if (!confirmBy) {
            showToast('請先選擇確認人員', 'error')
            return
          }
          const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
          showToast(`${stores.find(s => s.id === activeStore)?.name}出貨已確認！確認人：${staffName}`)
        }}
        variant="success"
        icon={<Truck size={18} />}
      />
    </div>
  )
}
