import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { Save, AlertTriangle, UserCheck } from 'lucide-react'
import { useStaffStore } from '@/stores/useStaffStore'

export default function MaterialStock() {
  const { showToast } = useToast()
  const rawMaterials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [confirmBy, setConfirmBy] = useState('')

  const [stock, setStock] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    rawMaterials.forEach(m => { init[m.id] = '' })
    return init
  })

  const [bulk, setBulk] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    rawMaterials.forEach(m => { init[m.id] = '' })
    return init
  })

  const weeklyUsage = useMemo(() => {
    const d: Record<string, number> = {}
    rawMaterials.forEach(m => { d[m.id] = Math.round(Math.random() * 5 * 10) / 10 })
    return d
  }, [])

  const materialsByCategory = useMemo(() => {
    const map = new Map<string, typeof rawMaterials>()
    for (const cat of materialCategories) {
      map.set(cat, rawMaterials.filter(m => m.category === cat))
    }
    return map
  }, [])

  const getStatus = (id: string): 'ok' | 'low' | 'danger' => {
    const qty = parseFloat(stock[id]) || 0
    if (!stock[id]) return 'ok'
    if (qty <= 0.5) return 'danger'
    if (qty <= 1) return 'low'
    return 'ok'
  }

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-mat]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  return (
    <div className="page-container">
      <TopNav title="原物料庫存盤點" />

      {/* 確認人員 */}
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

      {Array.from(materialsByCategory.entries()).map(([category, materials]) => (
        <div key={category}>
          <SectionHeader title={category} icon="■" />
          {/* 欄位標題 */}
          <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[56px] text-center">庫存</span>
            <span className="w-[56px] text-center">散裝</span>
            <span className="w-[36px] text-center">週用</span>
            <span className="w-[18px]"></span>
          </div>
          <div className="bg-white">
            {materials.map((material, idx) => {
              const status = getStatus(material.id)
              return (
                <div
                  key={material.id}
                  className={`flex items-center px-4 py-1.5 ${idx < materials.length - 1 ? 'border-b border-gray-50' : ''} ${
                    status === 'danger' && stock[material.id] ? 'bg-status-danger/5' : status === 'low' && stock[material.id] ? 'bg-status-warning/5' : ''
                  }`}
                >
                  {/* 品名 */}
                  <div className="flex-1 min-w-0 pr-1">
                    <p className="text-sm font-medium text-brand-oak leading-tight">{material.name}</p>
                    {material.spec && <p className="text-[10px] text-brand-lotus leading-tight">{material.spec}</p>}
                  </div>
                  {/* 庫存 */}
                  <NumericInput value={stock[material.id]} onChange={(v) => setStock(prev => ({ ...prev, [material.id]: v }))} isFilled onNext={focusNext} data-mat="" />
                  {/* 間距 */}
                  <div className="w-2 shrink-0"></div>
                  {/* 散裝 */}
                  <NumericInput value={bulk[material.id]} onChange={(v) => setBulk(prev => ({ ...prev, [material.id]: v }))} isFilled onNext={focusNext} data-mat="" />
                  {/* 週用量 */}
                  <span className="w-[36px] text-center text-[11px] font-num text-brand-lotus">{weeklyUsage[material.id]}</span>
                  {/* 狀態 */}
                  <div className="w-[18px] flex justify-center">
                    {status === 'danger' && stock[material.id] && <AlertTriangle size={13} className="text-status-danger" />}
                    {status === 'low' && stock[material.id] && <AlertTriangle size={13} className="text-status-warning" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <BottomAction label="儲存庫存 & 前往叫貨" onClick={() => {
        if (!confirmBy) {
          showToast('請先選擇盤點人員', 'error')
          return
        }
        const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
        showToast(`原物料庫存已儲存！盤點人：${staffName}`)
      }} icon={<Save size={18} />} />
    </div>
  )
}
