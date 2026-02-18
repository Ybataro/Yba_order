import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { Save, UserCheck } from 'lucide-react'
import { useStaffStore } from '@/stores/useStaffStore'

export default function ProductStock() {
  const { showToast } = useToast()
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [confirmBy, setConfirmBy] = useState('')

  const [stock, setStock] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    return init
  })

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-pst]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  return (
    <div className="page-container">
      <TopNav title="成品庫存盤點" />

      {/* 盤點人員 */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
        <UserCheck size={16} className="text-brand-mocha shrink-0" />
        <span className="text-sm text-brand-oak font-medium shrink-0">盤點人員</span>
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

      {Array.from(productsByCategory.entries()).map(([category, products]) => (
        <div key={category}>
          <SectionHeader title={category} icon="■" />
          <div className="bg-white">
            {products.map((product, idx) => (
              <div key={product.id} className={`flex items-center justify-between px-4 py-2.5 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                  {product.shelfLifeDays && <span className="text-[10px] text-brand-lotus ml-1">期效{product.shelfLifeDays}</span>}
                </div>
                <NumericInput value={stock[product.id]} onChange={(v) => setStock(prev => ({ ...prev, [product.id]: v }))} unit={product.unit} isFilled onNext={focusNext} data-pst="" />
              </div>
            ))}
          </div>
        </div>
      ))}

      <BottomAction label="儲存成品庫存" onClick={() => {
        if (!confirmBy) {
          showToast('請先選擇盤點人員', 'error')
          return
        }
        const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
        showToast(`成品庫存已儲存！盤點人：${staffName}`)
      }} icon={<Save size={18} />} />
    </div>
  )
}
