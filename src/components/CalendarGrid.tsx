import { useMemo } from 'react'
import { formatTime, getAttendanceType } from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'
import { getTodayString } from '@/lib/utils'
import { Plus } from 'lucide-react'

interface CalendarGridProps {
  year: number
  month: number // 1-based
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  canSchedule: boolean
  onCellClick?: (staffId: string, date: string, existing?: Schedule) => void
}

/** Build calendar weeks: array of 7-element arrays, each element is a date string or null (outside month) */
function buildCalendarWeeks(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate()
  // Day of week for 1st: 0=Sun..6=Sat → convert to Mon-based: Mon=0..Sun=6
  const firstDow = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDow + 6) % 7 // Mon=0

  const weeks: (string | null)[][] = []
  let week: (string | null)[] = []

  // Leading nulls
  for (let i = 0; i < startOffset; i++) {
    week.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    week.push(dateStr)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  // Trailing nulls
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

export function CalendarGrid({ year, month, staff, schedules, shiftTypes, canSchedule, onCellClick }: CalendarGridProps) {
  const today = getTodayString()
  const weeks = useMemo(() => buildCalendarWeeks(year, month), [year, month])

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftType> = {}
    shiftTypes.forEach((st) => { m[st.id] = st })
    return m
  }, [shiftTypes])

  // date → Schedule[]
  const dateSchedules = useMemo(() => {
    const m: Record<string, Schedule[]> = {}
    schedules.forEach((s) => {
      if (!m[s.date]) m[s.date] = []
      m[s.date].push(s)
    })
    return m
  }, [schedules])

  const staffMap = useMemo(() => {
    const m: Record<string, StaffMember> = {}
    staff.forEach((s) => { m[s.id] = s })
    return m
  }, [staff])

  /** Full label for tooltip */
  const getFullLabel = (s: Schedule): string => {
    const at = s.attendance_type || 'work'
    if (at !== 'work') {
      const leave = getAttendanceType(at)
      return leave?.name || at
    }
    if (s.shift_type_id && shiftMap[s.shift_type_id]) {
      const st = shiftMap[s.shift_type_id]
      return `${st.name} ${formatTime(st.start_time)}-${formatTime(st.end_time)}`
    }
    if (s.custom_start && s.custom_end) {
      return `${formatTime(s.custom_start)}-${formatTime(s.custom_end)}`
    }
    return '班'
  }

  /** Short staff name: max 2 chars */
  const getShortName = (name: string): string => {
    return name.length <= 2 ? name : name.slice(0, 2)
  }

  // Staff-based color palette: each person gets a unique fixed color
  const STAFF_COLORS: { bg: string; text: string }[] = [
    { bg: '#E8D5C4', text: '#5D4037' },  // 奶茶
    { bg: '#C8E6C9', text: '#2E7D32' },  // 抹茶
    { bg: '#BBDEFB', text: '#1565C0' },  // 天藍
    { bg: '#F8BBD0', text: '#AD1457' },  // 櫻粉
    { bg: '#D1C4E9', text: '#4527A0' },  // 薰衣草
    { bg: '#FFE0B2', text: '#E65100' },  // 橘果
    { bg: '#B2DFDB', text: '#00695C' },  // 薄荷
    { bg: '#FFCDD2', text: '#C62828' },  // 莓紅
    { bg: '#FFF9C4', text: '#F57F17' },  // 檸檬
    { bg: '#CFD8DC', text: '#37474F' },  // 灰藍
    { bg: '#DCEDC8', text: '#558B2F' },  // 青蘋果
    { bg: '#F0F4C3', text: '#9E9D24' },  // 萊姆
  ]

  const staffColorMap = useMemo(() => {
    const m: Record<string, { bg: string; text: string }> = {}
    staff.forEach((s, i) => {
      m[s.id] = STAFF_COLORS[i % STAFF_COLORS.length]
    })
    return m
  }, [staff])

  /** Get badge color: staff-based for work, leave-type color for leaves */
  const getBadgeColor = (sch: Schedule): { bg: string; text: string } => {
    const at = sch.attendance_type || 'work'
    if (at !== 'work') {
      const leave = getAttendanceType(at)
      if (leave) return { bg: leave.color, text: leave.textColor }
    }
    return staffColorMap[sch.staff_id] || { bg: '#6B5D55', text: '#ffffff' }
  }

  const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

  if (staff.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-brand-lotus">
        尚無人員資料
      </div>
    )
  }

  return (
    <div className="overflow-x-auto px-2 pb-4">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`py-1.5 text-center text-xs font-semibold ${
              i >= 5 ? 'text-brand-lotus' : 'text-brand-mocha'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-gray-100">
          {week.map((date, di) => {
            if (!date) {
              return <div key={`empty-${di}`} className="min-h-[64px] bg-gray-50/50 border-r border-gray-100 last:border-r-0" />
            }

            const isToday = date === today
            const daySchedules = dateSchedules[date] || []
            const dayNum = new Date(date + 'T00:00:00').getDate()

            return (
              <div
                key={date}
                className={`min-h-[64px] border-r border-gray-100 last:border-r-0 p-0.5 ${
                  isToday ? 'bg-brand-lotus/5' : ''
                }`}
              >
                {/* Date number */}
                <div className={`text-[10px] font-medium px-0.5 mb-0.5 ${
                  isToday ? 'text-brand-lotus font-bold' : di >= 5 ? 'text-brand-lotus/70' : 'text-brand-oak'
                }`}>
                  {dayNum}
                </div>

                {/* Schedule badges — flex-wrap, name-only pills, color = shift */}
                <div className="flex flex-wrap gap-[2px]">
                  {daySchedules.map((sch) => {
                    const member = staffMap[sch.staff_id]
                    if (!member) return null
                    const color = getBadgeColor(sch)
                    const shortName = getShortName(member.name)
                    const fullLabel = getFullLabel(sch)

                    return (
                      <button
                        key={sch.id}
                        onClick={() => canSchedule && onCellClick?.(sch.staff_id, date, sch)}
                        disabled={!canSchedule}
                        title={`${member.name} ${fullLabel}`}
                        className={`rounded px-[3px] py-[1px] text-[8px] leading-tight font-semibold whitespace-nowrap ${
                          canSchedule ? 'active:opacity-70' : ''
                        }`}
                        style={{ backgroundColor: color.bg, color: color.text }}
                      >
                        {shortName}
                      </button>
                    )
                  })}

                  {/* Add button for empty cells */}
                  {canSchedule && daySchedules.length === 0 && (
                    <button
                      onClick={() => {
                        if (staff.length > 0) {
                          onCellClick?.(staff[0].id, date)
                        }
                      }}
                      className="w-full flex items-center justify-center py-1 rounded bg-gray-50 active:bg-gray-100"
                    >
                      <Plus size={10} className="text-gray-300" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
