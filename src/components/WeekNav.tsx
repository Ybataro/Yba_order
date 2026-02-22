import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { getWeekDates, formatShortDate, getWeekdayLabel, toLocalDateString } from '@/lib/schedule'
import { getTodayString } from '@/lib/utils'

interface WeekNavProps {
  /** 當前參考日期（週內任一天） */
  refDate: string
  onChange: (newRefDate: string) => void
}

export function WeekNav({ refDate, onChange }: WeekNavProps) {
  const weekDates = getWeekDates(refDate)
  const monday = weekDates[0]
  const sunday = weekDates[6]
  const today = getTodayString()
  const isCurrentWeek = weekDates.includes(today)

  const goPrev = () => {
    const d = new Date(monday + 'T00:00:00')
    d.setDate(d.getDate() - 7)
    onChange(toLocalDateString(d))
  }

  const goNext = () => {
    const d = new Date(monday + 'T00:00:00')
    d.setDate(d.getDate() + 7)
    onChange(toLocalDateString(d))
  }

  const goToday = () => {
    onChange(today)
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
      <CalendarDays size={16} className="text-brand-mocha shrink-0" />
      <button onClick={goPrev} className="p-1 rounded-lg active:bg-gray-100">
        <ChevronLeft size={18} className="text-brand-oak" />
      </button>
      <span className="flex-1 text-center text-sm font-medium text-brand-oak">
        {formatShortDate(monday)}（{getWeekdayLabel(monday)}）~ {formatShortDate(sunday)}（{getWeekdayLabel(sunday)}）
      </span>
      <button onClick={goNext} className="p-1 rounded-lg active:bg-gray-100">
        <ChevronRight size={18} className="text-brand-oak" />
      </button>
      {!isCurrentWeek && (
        <button
          onClick={goToday}
          className="text-xs text-brand-lotus bg-brand-lotus/10 px-2 py-1 rounded-full font-medium shrink-0 active:opacity-70"
        >
          本週
        </button>
      )}
    </div>
  )
}
