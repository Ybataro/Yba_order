import { Calendar } from 'lucide-react'
import { getTodayTW } from '@/lib/session'
import { getWeekday } from '@/lib/utils'

interface DateNavProps {
  value: string
  onChange: (date: string) => void
  /** 允許選到的最大日期，預設今天。傳 'tomorrow' 可選到明日 */
  maxDate?: 'today' | 'tomorrow'
}

export function DateNav({ value, onChange, maxDate = 'today' }: DateNavProps) {
  const today = getTodayTW()
  const isToday = value === today

  const maxVal = (() => {
    if (maxDate === 'tomorrow') {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    }
    return today
  })()

  const isFuture = value > today
  const weekday = getWeekday(value)

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
      <Calendar size={16} className="text-brand-mocha shrink-0" />
      <input
        type="date"
        value={value}
        max={maxVal}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
      />
      <span className="text-sm text-brand-lotus">（{weekday}）</span>
      {isFuture && (
        <span className="text-[11px] text-status-info bg-status-info/10 px-2 py-0.5 rounded-full font-medium">明日叫貨</span>
      )}
      {!isToday && !isFuture && (
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
