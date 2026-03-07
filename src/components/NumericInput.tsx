import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface NumericInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  unit?: string
  isFilled?: boolean
  onNext?: () => void
  integerOnly?: boolean
}

export function NumericInput({ value, onChange, unit, isFilled, onNext, integerOnly, className, ...props }: NumericInputProps) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode={integerOnly ? 'numeric' : 'decimal'}
        value={value}
        onChange={(e) => {
          const v = e.target.value
          const pattern = integerOnly ? /^\d*$/ : /^\d*\.?\d*$/
          if (v === '' || pattern.test(v)) {
            onChange(v)
          }
        }}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onNext) {
            e.preventDefault()
            onNext()
          }
        }}
        className={cn(
          'input-field',
          isFilled && value !== '' && 'filled',
          className
        )}
        {...props}
      />
      {unit && <span className="text-xs text-brand-lotus min-w-[20px]">{unit}</span>}
    </div>
  )
}
