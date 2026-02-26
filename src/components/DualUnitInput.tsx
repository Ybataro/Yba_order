import { useState, useEffect, useRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { NumericInput } from './NumericInput'

interface DualUnitInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  unit?: string
  box_unit?: string
  box_ratio?: number
  isFilled?: boolean
  onNext?: () => void
}

export function DualUnitInput({
  value,
  onChange,
  unit,
  box_unit,
  box_ratio,
  isFilled,
  onNext,
  className,
  ...props
}: DualUnitInputProps) {
  // No box config → fallback to NumericInput
  if (!box_unit || !box_ratio || box_ratio <= 0) {
    return (
      <NumericInput
        value={value}
        onChange={onChange}
        unit={unit}
        isFilled={isFilled}
        onNext={onNext}
        className={className}
        {...props}
      />
    )
  }

  return (
    <DualFields
      value={value}
      onChange={onChange}
      unit={unit || ''}
      boxUnit={box_unit}
      boxRatio={box_ratio}
      isFilled={isFilled}
      onNext={onNext}
      className={className}
      {...props}
    />
  )
}

interface DualFieldsProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  unit: string
  boxUnit: string
  boxRatio: number
  isFilled?: boolean
  onNext?: () => void
}

function DualFields({
  value,
  onChange,
  unit,
  boxUnit,
  boxRatio,
  isFilled,
  onNext,
  className,
  ...props
}: DualFieldsProps) {
  const [localBox, setLocalBox] = useState('')
  const [localUnit, setLocalUnit] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const unitRef = useRef<HTMLInputElement>(null)

  // Sync from external value (DB load) when not editing
  useEffect(() => {
    if (isEditing) return
    if (value === '') {
      setLocalBox('')
      setLocalUnit('')
      return
    }
    const total = parseFloat(value)
    if (isNaN(total)) {
      setLocalBox('')
      setLocalUnit('')
      return
    }
    const boxQty = Math.floor(total / boxRatio)
    const unitQty = total - boxQty * boxRatio
    setLocalBox(boxQty > 0 ? String(boxQty) : '')
    // Avoid floating point artifacts
    const rounded = Math.round(unitQty * 100) / 100
    setLocalUnit(rounded > 0 ? String(rounded) : '')
  }, [value, boxRatio, isEditing])

  const emitChange = (boxStr: string, unitStr: string) => {
    const boxVal = boxStr === '' ? 0 : parseInt(boxStr, 10)
    const unitVal = unitStr === '' ? 0 : parseFloat(unitStr)
    if (isNaN(boxVal) && isNaN(unitVal)) {
      onChange('')
      return
    }
    const total = (isNaN(boxVal) ? 0 : boxVal) * boxRatio + (isNaN(unitVal) ? 0 : unitVal)
    // Round to avoid floating point
    const rounded = Math.round(total * 100) / 100
    onChange(rounded > 0 ? String(rounded) : boxStr === '' && unitStr === '' ? '' : '0')
  }

  const handleBoxChange = (v: string) => {
    // Only accept non-negative integers
    if (v !== '' && !/^\d*$/.test(v)) return
    setLocalBox(v)
    emitChange(v, localUnit)
  }

  const handleUnitChange = (v: string) => {
    // Accept decimals
    if (v !== '' && !/^\d*\.?\d*$/.test(v)) return
    setLocalUnit(v)
    emitChange(localBox, v)
  }

  const filled = isFilled && value !== ''

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="text"
        inputMode="numeric"
        value={localBox}
        onChange={(e) => handleBoxChange(e.target.value)}
        onFocus={(e) => {
          setIsEditing(true)
          e.target.select()
        }}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            unitRef.current?.focus()
          }
        }}
        placeholder="0"
        className={cn('input-field w-[36px] text-center', filled && 'filled', className)}
        disabled={props.disabled}
      />
      <span className="text-xs text-brand-lotus">{boxUnit}</span>
      <input
        ref={unitRef}
        type="text"
        inputMode="decimal"
        value={localUnit}
        onChange={(e) => handleUnitChange(e.target.value)}
        onFocus={(e) => {
          setIsEditing(true)
          e.target.select()
        }}
        onBlur={() => setIsEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onNext) {
            e.preventDefault()
            onNext()
          }
        }}
        placeholder="0"
        className={cn('input-field w-[36px] text-center', filled && 'filled', className)}
        disabled={props.disabled}
      />
      <span className="text-xs text-brand-lotus min-w-[16px]">{unit}</span>
    </div>
  )
}
