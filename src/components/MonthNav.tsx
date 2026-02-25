import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface MonthNavProps {
  year: number
  month: number // 1-based
  onChange: (year: number, month: number) => void
}

export function MonthNav({ year, month, onChange }: MonthNavProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isCurrentMonth = year === currentYear && month === currentMonth

  const goPrev = () => {
    if (month === 1) {
      onChange(year - 1, 12)
    } else {
      onChange(year, month - 1)
    }
  }

  const goNext = () => {
    if (month === 12) {
      onChange(year + 1, 1)
    } else {
      onChange(year, month + 1)
    }
  }

  const goCurrentMonth = () => {
    onChange(currentYear, currentMonth)
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
      <CalendarDays size={16} className="text-brand-mocha shrink-0" />
      <button onClick={goPrev} className="p-1 rounded-lg active:bg-gray-100">
        <ChevronLeft size={18} className="text-brand-oak" />
      </button>
      <span className="flex-1 text-center text-sm font-medium text-brand-oak">
        {year}年{month}月
      </span>
      <button onClick={goNext} className="p-1 rounded-lg active:bg-gray-100">
        <ChevronRight size={18} className="text-brand-oak" />
      </button>
      {!isCurrentMonth && (
        <button
          onClick={goCurrentMonth}
          className="text-xs text-brand-lotus bg-brand-lotus/10 px-2 py-1 rounded-full font-medium shrink-0 active:opacity-70"
        >
          本月
        </button>
      )}
    </div>
  )
}
