import { AlertTriangle } from 'lucide-react'
import type { ZoneDef } from '@/data/productionZones'
import { ProductionFieldInput } from '@/components/ProductionFieldInput'
import type { StaffMember } from '@/data/staff'

interface ProductionZoneFormProps {
  zone: ZoneDef
  values: Record<string, Record<string, string>> // { itemKey: { fieldKey: value } }
  onChange: (itemKey: string, fieldKey: string, value: string) => void
  tastingNote: string
  onTastingNoteChange: (value: string) => void
  submittedBy: string
  onSubmittedByChange: (value: string) => void
  supervisorBy: string
  onSupervisorByChange: (value: string) => void
  staff: StaffMember[]
}

export function ProductionZoneForm({
  zone,
  values,
  onChange,
  tastingNote,
  onTastingNoteChange,
  submittedBy,
  onSubmittedByChange,
  supervisorBy,
  onSupervisorByChange,
  staff,
}: ProductionZoneFormProps) {
  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-prodlog]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  return (
    <div className="pb-4">
      {/* 注意事項 */}
      {zone.notice && (
        <div className="flex items-start gap-2 mx-4 mt-3 mb-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-700 leading-relaxed">{zone.notice}</span>
        </div>
      )}

      {/* 品項卡片 */}
      {zone.items.map((item) => (
        <div key={item.key} className="mx-4 mt-3 card">
          <h3 className="text-sm font-semibold text-brand-oak mb-2.5">{item.name}</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {item.fields.map((field) => (
              <ProductionFieldInput
                key={field.key}
                field={field}
                value={values[item.key]?.[field.key] ?? ''}
                onChange={(v) => onChange(item.key, field.key, v)}
                onNext={focusNext}
                dataAttr={`${item.key}_${field.key}`}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 試吃備註 */}
      <div className="mx-4 mt-3 card">
        <label className="text-xs text-brand-lotus mb-1 block">📝 試吃備註</label>
        <textarea
          value={tastingNote}
          onChange={(e) => onTastingNoteChange(e.target.value)}
          placeholder="口感、甜度、改善建議..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-surface-input px-3 py-2 text-sm text-brand-oak outline-none focus:border-brand-lotus resize-none"
        />
      </div>

      {/* 簽名 */}
      <div className="mx-4 mt-3 card space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-16">👤 簽名</span>
          <select
            value={submittedBy}
            onChange={(e) => onSubmittedByChange(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">請選擇</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-16">👨‍🍳 主管</span>
          <select
            value={supervisorBy}
            onChange={(e) => onSupervisorByChange(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">請選擇</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
