import { ATTENDANCE_TYPES } from '@/lib/schedule'

export function ScheduleLegend() {
  const mainTypes = ATTENDANCE_TYPES.filter((t) =>
    ['work', 'rest_day', 'regular_leave', 'national_holiday', 'annual_leave', 'sick_leave', 'personal_leave', 'late_early'].includes(t.id)
  )

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 bg-white border-t border-gray-100">
      {mainTypes.map((t) => (
        <div key={t.id} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: t.color, border: `1px solid ${t.textColor}40` }}
          />
          <span className="text-xs text-brand-mocha">{t.name}</span>
        </div>
      ))}
    </div>
  )
}
