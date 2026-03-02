import type { FieldDef } from '@/data/productionZones'
import { NumericInput } from '@/components/NumericInput'
import { SugarSelectInput } from '@/components/SugarSelectInput'
import type { SugarTypeDef } from '@/stores/useProductionZoneStore'

interface ProductionFieldInputProps {
  field: FieldDef
  value: string
  onChange: (value: string) => void
  onNext?: () => void
  dataAttr?: string
  sugarTypes?: SugarTypeDef[]
}

export function ProductionFieldInput({ field, value, onChange, onNext, dataAttr, sugarTypes }: ProductionFieldInputProps) {
  if (field.type === 'sugar_select' && sugarTypes && sugarTypes.length > 0) {
    return (
      <SugarSelectInput
        value={value}
        onChange={onChange}
        sugarTypes={sugarTypes}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="text-xs text-brand-lotus mb-1 block">{field.label}</label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
        >
          <option value="">請選擇</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'text') {
    return (
      <div>
        <label className="text-xs text-brand-lotus mb-1 block">{field.label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field input-prod"
          placeholder={field.label}
        />
      </div>
    )
  }

  // numeric (default) — also handles sugar_select fallback when sugarTypes not available
  return (
    <div>
      <label className="text-xs text-brand-lotus mb-1 block">{field.label}</label>
      <NumericInput
        value={value}
        onChange={onChange}
        unit={field.unit}
        isFilled
        onNext={onNext}
        data-prodlog={dataAttr}
        className="input-prod"
      />
    </div>
  )
}
