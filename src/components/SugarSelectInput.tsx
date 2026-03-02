import { useMemo } from 'react'
import { NumericInput } from '@/components/NumericInput'
import type { SugarTypeDef } from '@/stores/useProductionZoneStore'

interface SugarSelectInputProps {
  value: string  // JSON string like '{"二砂":2000,"冰糖":500}' or legacy plain number '3000'
  onChange: (value: string) => void
  sugarTypes: SugarTypeDef[]
}

/** Parse stored value — handles both JSON object and legacy plain number */
function parseValue(value: string): Record<string, string> {
  if (!value) return {}
  // Try JSON first
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        result[k] = String(v)
      }
      return result
    }
  } catch {
    // not JSON
  }
  // Legacy: plain number → no sugar type selected, just show as-is
  return {}
}

function serializeValue(map: Record<string, string>): string {
  if (Object.keys(map).length === 0) return ''
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(map)) {
    out[k] = Number(v) || 0
  }
  return JSON.stringify(out)
}

/** Check if value is a legacy plain number (not JSON) */
function isLegacyNumber(value: string): boolean {
  if (!value) return false
  try {
    JSON.parse(value)
    return false
  } catch {
    return /^\d+\.?\d*$/.test(value)
  }
}

export function SugarSelectInput({ value, onChange, sugarTypes }: SugarSelectInputProps) {
  const sugarMap = useMemo(() => parseValue(value), [value])
  const legacy = isLegacyNumber(value)

  const toggleSugar = (name: string) => {
    const newMap = { ...sugarMap }
    if (newMap[name] !== undefined) {
      delete newMap[name]
    } else {
      newMap[name] = ''
    }
    onChange(serializeValue(newMap))
  }

  const updateAmount = (name: string, amount: string) => {
    const newMap = { ...sugarMap }
    newMap[name] = amount
    onChange(serializeValue(newMap))
  }

  // Calculate total
  const total = useMemo(() => {
    let sum = 0
    for (const v of Object.values(sugarMap)) {
      sum += Number(v) || 0
    }
    return sum
  }, [sugarMap])

  return (
    <div className="col-span-2 bg-surface-section rounded-lg p-3 space-y-2">
      <label className="text-xs text-brand-lotus block">糖</label>

      {/* Legacy plain number hint */}
      {legacy && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          舊資料：{value} g（請重新選擇糖種）
        </div>
      )}

      {sugarTypes.map((st) => {
        const isChecked = sugarMap[st.name] !== undefined
        return (
          <div key={st.id} className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 min-w-[90px] cursor-pointer">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleSugar(st.name)}
                className="w-4 h-4 rounded border-gray-300 text-brand-mocha accent-brand-mocha"
              />
              <span className="text-sm text-brand-oak">{st.name}</span>
            </label>
            {isChecked && (
              <NumericInput
                value={sugarMap[st.name] ?? ''}
                onChange={(v) => updateAmount(st.name, v)}
                unit={st.unit || 'g'}
                isFilled
                className="input-prod"
              />
            )}
          </div>
        )
      })}

      {/* Total */}
      {total > 0 && (
        <div className="text-xs text-brand-lotus text-right pt-1 border-t border-gray-200">
          合計: <span className="font-semibold text-brand-oak">{total.toLocaleString()}</span> g
        </div>
      )}
    </div>
  )
}
