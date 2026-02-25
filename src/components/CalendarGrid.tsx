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

/** Cutoff hour: < 17 = 午班 (top), >= 17 = 晚班 (bottom) */
const SHIFT_CUTOFF = 17

/** Determine if a schedule is afternoon (true) or evening (false), or null for leave */
function isAfternoonShift(sch: Schedule, shiftMap: Record<string, ShiftType>): boolean | null {
  const at = sch.attendance_type || 'work'
  if (at !== 'work') return null // leave → spans both

  if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
    const st = shiftMap[sch.shift_type_id]
    const hour = parseInt(st.start_time.split(':')[0], 10)
    return hour < SHIFT_CUTOFF
  }
  if (sch.custom_start) {
    const hour = parseInt(sch.custom_start.split(':')[0], 10)
    return hour < SHIFT_CUTOFF
  }
  return true // default to afternoon
}

/** Build calendar weeks: array of 7-element arrays, each element is a date string or null (outside month) */
function buildCalendarWeeks(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDow + 6) % 7

  const weeks: (string | null)[][] = []
  let week: (string | null)[] = []

  for (let i = 0; i < startOffset; i++) week.push(null)

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    week.push(dateStr)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

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

  // Staff-based color palette
  const STAFF_COLORS: { bg: string; text: string }[] = [
    { bg: '#E8D5C4', text: '#5D4037' },
    { bg: '#C8E6C9', text: '#2E7D32' },
    { bg: '#BBDEFB', text: '#1565C0' },
    { bg: '#F8BBD0', text: '#AD1457' },
    { bg: '#D1C4E9', text: '#4527A0' },
    { bg: '#FFE0B2', text: '#E65100' },
    { bg: '#B2DFDB', text: '#00695C' },
    { bg: '#FFCDD2', text: '#C62828' },
    { bg: '#FFF9C4', text: '#F57F17' },
    { bg: '#CFD8DC', text: '#37474F' },
    { bg: '#DCEDC8', text: '#558B2F' },
    { bg: '#F0F4C3', text: '#9E9D24' },
  ]

  const staffOrderMap = useMemo(() => {
    const m: Record<string, number> = {}
    staff.forEach((s, i) => { m[s.id] = i })
    return m
  }, [staff])

  const sortByStaff = (arr: Schedule[]) =>
    arr.sort((a, b) => (staffOrderMap[a.staff_id] ?? 999) - (staffOrderMap[b.staff_id] ?? 999))

  const staffColorMap = useMemo(() => {
    const m: Record<string, { bg: string; text: string }> = {}
    staff.forEach((s, i) => {
      m[s.id] = STAFF_COLORS[i % STAFF_COLORS.length]
    })
    return m
  }, [staff])

  const getBadgeColor = (sch: Schedule): { bg: string; text: string } => {
    // Always use staff-fixed color for consistency
    return staffColorMap[sch.staff_id] || { bg: '#6B5D55', text: '#ffffff' }
  }

  const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

  /** Render a badge */
  const renderBadge = (sch: Schedule) => {
    const member = staffMap[sch.staff_id]
    if (!member) return null
    const color = getBadgeColor(sch)
    const shortName = getShortName(member.name)
    const fullLabel = getFullLabel(sch)
    return (
      <button
        key={sch.id}
        onClick={() => canSchedule && onCellClick?.(sch.staff_id, sch.date, sch)}
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
  }

  if (staff.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-brand-lotus">
        尚無人員資料
      </div>
    )
  }

  return (
    <div className="overflow-x-auto px-2 pb-4">
      {/* min-w ensures badges stay side-by-side; overflows horizontally on mobile */}
      <div className="min-w-[700px]">
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
              return <div key={`empty-${di}`} className="min-h-[72px] bg-gray-50/50 border-r border-gray-100 last:border-r-0" />
            }

            const isToday = date === today
            const daySchedules = dateSchedules[date] || []
            const dayNum = new Date(date + 'T00:00:00').getDate()

            // Split work schedules into afternoon / evening (skip leaves)
            const afternoon: Schedule[] = []
            const evening: Schedule[] = []

            daySchedules.forEach((sch) => {
              const at = sch.attendance_type || 'work'
              if (at !== 'work') return // hide leaves from calendar
              const period = isAfternoonShift(sch, shiftMap)
              if (period === false) evening.push(sch)
              else afternoon.push(sch)
            })

            sortByStaff(afternoon)
            sortByStaff(evening)

            return (
              <div
                key={date}
                className={`min-h-[72px] border-r border-gray-100 last:border-r-0 flex flex-col ${
                  isToday ? 'bg-brand-lotus/5' : ''
                }`}
              >
                {/* Date number */}
                <div className={`text-[10px] font-medium px-0.5 ${
                  isToday ? 'text-brand-lotus font-bold' : di >= 5 ? 'text-brand-lotus/70' : 'text-brand-oak'
                }`}>
                  {dayNum}
                </div>

                {/* Afternoon (午班) — top half */}
                <div className="flex items-start min-h-[14px]">
                  <span className="text-[7px] text-brand-mocha/40 leading-none pt-0.5 pl-px shrink-0">午</span>
                  <div className="flex-1 flex flex-wrap gap-[2px] px-0.5 py-px content-start">
                    {afternoon.map(renderBadge)}
                  </div>
                </div>

                {/* Divider */}
                <div className="mx-0.5 border-t border-brand-mocha/30" />

                {/* Evening (晚班) — bottom half */}
                <div className="flex items-start min-h-[14px]">
                  <span className="text-[7px] text-brand-mocha/40 leading-none pt-0.5 pl-px shrink-0">晚</span>
                  <div className="flex-1 flex flex-wrap gap-[2px] px-0.5 py-px content-start">
                    {evening.map(renderBadge)}
                  </div>
                </div>

                {/* Add button for empty cells */}
                {canSchedule && daySchedules.length === 0 && (
                  <div className="flex-1 flex items-center justify-center">
                    <button
                      onClick={() => {
                        if (staff.length > 0) onCellClick?.(staff[0].id, date)
                      }}
                      className="p-1 rounded bg-gray-50 active:bg-gray-100"
                    >
                      <Plus size={10} className="text-gray-300" />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      </div>
    </div>
  )
}
