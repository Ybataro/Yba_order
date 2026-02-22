import { Calendar } from 'lucide-react'
import { getTodayTW } from '@/lib/session'
import { getWeekday } from '@/lib/utils'

interface DateNavProps {
  value: string
  onChange: (date: string) => void
}

export function DateNav({ value, onChange }: DateNavProps) {
  const today = getTodayTW()
  const isToday = value === today
  const weekday = getWeekday(value)

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
      <Calendar size={16} className="text-brand-mocha shrink-0" />
      <input
        type="date"
        value={value}
        max={today}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
      />
      <span className="text-sm text-brand-lotus">（{weekday}）</span>
      {!isToday && (
        <>
          <span className="text-[11px] text-status-warning bg-status-warning/10 px-2 py-0.5 rounded-full font-medium">歷史資料</span>
          <button
            onClick={() => onChange(today)}
            className="text-xs text-white bg-brand-mocha px-2.5 py-1 rounded-full font-medium ml-auto"
          >
            回今日
          </button>
        </>
      )}
    </div>
  )
}
