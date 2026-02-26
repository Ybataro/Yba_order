import { useRef, useEffect } from 'react'
import { DualUnitInput } from '@/components/DualUnitInput'
import { formatDualUnit } from '@/lib/utils'
import { Plus, X } from 'lucide-react'

export interface StockEntry {
  expiryDate: string
  quantity: string
}

interface StockEntryPanelProps {
  entries: StockEntry[]
  onChange: (entries: StockEntry[]) => void
  onCollapse: () => void
  unit?: string
  box_unit?: string
  box_ratio?: number
}

export function StockEntryPanel({ entries, onChange, onCollapse, unit, box_unit, box_ratio }: StockEntryPanelProps) {
  const hasDual = !!(box_unit && box_ratio && box_ratio > 0)
  const lastAddedRef = useRef<boolean>(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus the date input of the last row when a new entry is added
  useEffect(() => {
    if (lastAddedRef.current && panelRef.current) {
      lastAddedRef.current = false
      const dateInputs = panelRef.current.querySelectorAll<HTMLInputElement>('input[type="date"]')
      const last = dateInputs[dateInputs.length - 1]
      if (last) last.focus()
    }
  }, [entries.length])

  const total = entries.reduce((sum, e) => {
    const n = parseFloat(e.quantity)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const updateEntry = (index: number, field: keyof StockEntry, value: string) => {
    const next = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    onChange(next)
  }

  const addEntry = () => {
    lastAddedRef.current = true
    onChange([...entries, { expiryDate: '', quantity: '' }])
  }

  const removeEntry = (index: number) => {
    const next = entries.filter((_, i) => i !== index)
    onChange(next)
  }

  const handleQuantityNext = (index: number) => {
    if (!panelRef.current) return
    // Try to focus next row's quantity input
    const qtyInputs = panelRef.current.querySelectorAll<HTMLInputElement>('[data-stock-qty]')
    const arr = Array.from(qtyInputs)
    if (index < arr.length - 1) {
      arr[index + 1].focus()
    } else {
      // Last row → collapse and move to discard field
      onCollapse()
    }
  }

  return (
    <div ref={panelRef} className="mx-4 mb-1 rounded-lg border border-brand-oak/20 bg-amber-50/50 p-3">
      {/* Header */}
      <div className="flex items-center text-[11px] text-brand-lotus mb-1.5">
        <span className="flex-1">到期日</span>
        <span className={`${hasDual ? 'w-[110px]' : 'w-[70px]'} text-center`}>數量</span>
        <span className="w-[28px]"></span>
      </div>

      {/* Rows */}
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-1.5 mb-1.5">
          <input
            type="date"
            value={entry.expiryDate}
            onChange={(e) => updateEntry(idx, 'expiryDate', e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none focus:border-brand-oak/50 focus:ring-1 focus:ring-brand-oak/20"
          />
          <div className={`${hasDual ? 'w-[110px]' : 'w-[70px]'} flex justify-center`}>
            <DualUnitInput
              value={entry.quantity}
              onChange={(v) => updateEntry(idx, 'quantity', v)}
              unit={unit}
              box_unit={box_unit}
              box_ratio={box_ratio}
              isFilled
              onNext={() => handleQuantityNext(idx)}
              data-stock-qty=""
            />
          </div>
          <button
            type="button"
            onClick={() => removeEntry(idx)}
            className="w-[28px] h-9 flex items-center justify-center text-red-400 hover:text-red-600 active:bg-red-50 rounded"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {/* Add button */}
      <button
        type="button"
        onClick={addEntry}
        className="flex items-center gap-1 text-xs text-brand-oak/70 hover:text-brand-oak py-1.5 w-full justify-center border border-dashed border-brand-oak/20 rounded-lg mt-1"
      >
        <Plus size={14} />
        新增到期日
      </button>

      {/* Total */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-brand-oak/10">
        <span className="text-xs text-brand-lotus mr-2">庫存合計:</span>
        <span className="text-sm font-bold text-brand-oak">
          {hasDual
            ? formatDualUnit(Math.round(total * 10) / 10, unit || '', box_unit, box_ratio)
            : Math.round(total * 10) / 10}
        </span>
      </div>
    </div>
  )
}
