import { useRef, useEffect, useState } from 'react'
import { DualUnitInput } from '@/components/DualUnitInput'
import { formatDualUnit } from '@/lib/utils'
import { Plus, X, Calendar } from 'lucide-react'

export interface StockEntry {
  expiryDate: string
  quantity: string
}

interface StockEntryPanelProps {
  entries: StockEntry[]
  onChange: (entries: StockEntry[], changedField?: keyof StockEntry) => void
  onCollapse: () => void
  unit?: string
  box_unit?: string
  box_ratio?: number
  integerOnly?: boolean
}

/** Parse shorthand date input (e.g. "0308") into YYYY-MM-DD */
function parseShortDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 4) {
    const mm = parseInt(digits.slice(0, 2), 10)
    const dd = parseInt(digits.slice(2, 4), 10)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const year = new Date().getFullYear()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${year}-${pad(mm)}-${pad(dd)}`
    }
  }
  if (digits.length === 8) {
    const yyyy = parseInt(digits.slice(0, 4), 10)
    const mm = parseInt(digits.slice(4, 6), 10)
    const dd = parseInt(digits.slice(6, 8), 10)
    if (yyyy >= 2020 && yyyy <= 2099 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${yyyy}-${pad(mm)}-${pad(dd)}`
    }
  }
  return null
}

/** Format YYYY-MM-DD to MM/DD display */
function displayDate(iso: string): string {
  if (!iso) return ''
  const parts = iso.split('-')
  if (parts.length === 3) return `${parts[1]}/${parts[2]}`
  return iso
}

function DateInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && textRef.current) {
      textRef.current.focus()
    }
  }, [autoFocus])

  const handleBlur = () => {
    setEditing(false)
    if (!text) return
    const parsed = parseShortDate(text)
    if (parsed) {
      onChange(parsed)
      setText('')
    } else {
      setText('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="flex-1 flex items-center gap-1">
      <input
        ref={textRef}
        type="text"
        inputMode="numeric"
        placeholder={value ? displayDate(value) : 'MMDD'}
        value={editing ? text : (value ? displayDate(value) : '')}
        onFocus={() => { setEditing(true); setText('') }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 min-w-0 h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none focus:border-brand-oak/50 focus:ring-1 focus:ring-brand-oak/20"
      />
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
      <button
        type="button"
        onClick={() => hiddenRef.current?.showPicker?.()}
        className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-brand-oak/60 hover:text-brand-oak active:bg-amber-50 shrink-0"
      >
        <Calendar size={16} />
      </button>
    </div>
  )
}

export function StockEntryPanel({ entries, onChange, onCollapse, unit, box_unit, box_ratio, integerOnly }: StockEntryPanelProps) {
  const hasDual = !!(box_unit && box_ratio && box_ratio > 0)
  const lastAddedRef = useRef<boolean>(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [focusLastDate, setFocusLastDate] = useState(false)

  // Focus the date input of the last row when a new entry is added
  useEffect(() => {
    if (lastAddedRef.current) {
      lastAddedRef.current = false
      setFocusLastDate(true)
    }
  }, [entries.length])

  useEffect(() => {
    if (focusLastDate) setFocusLastDate(false)
  }, [focusLastDate])

  const total = entries.reduce((sum, e) => {
    const n = parseFloat(e.quantity)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  const updateEntry = (index: number, field: keyof StockEntry, value: string) => {
    const next = entries.map((e, i) => (i === index ? { ...e, [field]: value } : e))
    onChange(next, field)
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
    const qtyInputs = panelRef.current.querySelectorAll<HTMLInputElement>('[data-stock-qty]')
    const arr = Array.from(qtyInputs)
    if (index < arr.length - 1) {
      arr[index + 1].focus()
    } else {
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
          <DateInput
            value={entry.expiryDate}
            onChange={(v) => updateEntry(idx, 'expiryDate', v)}
            autoFocus={focusLastDate && idx === entries.length - 1}
          />
          <div className={`${hasDual ? 'w-[110px]' : 'w-[70px]'} flex justify-center`}>
            <DualUnitInput
              value={entry.quantity}
              onChange={(v) => updateEntry(idx, 'quantity', v)}
              unit={unit}
              box_unit={box_unit}
              box_ratio={box_ratio}
              integerOnly={integerOnly}
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
