import { useMemo } from 'react'
import { getWeekDates, formatShortDate, getWeekdayLabel, formatTime, getAttendanceType, getTagColor } from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'
import { getTodayString } from '@/lib/utils'
import { Plus } from 'lucide-react'

interface ScheduleGridProps {
  refDate: string
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  canSchedule: boolean
  onCellClick?: (staffId: string, date: string, existing?: Schedule) => void
}

export function ScheduleGrid({ refDate, staff, schedules, shiftTypes, canSchedule, onCellClick }: ScheduleGridProps) {
  const weekDates = getWeekDates(refDate)
  const today = getTodayString()

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftType> = {}
    shiftTypes.forEach((st) => { m[st.id] = st })
    return m
  }, [shiftTypes])

  // staff_id + date → Schedule
  const scheduleMap = useMemo(() => {
    const m: Record<string, Schedule> = {}
    schedules.forEach((s) => { m[`${s.staff_id}_${s.date}`] = s })
    return m
  }, [schedules])

  const isLeave = (s: Schedule): boolean => {
    const at = s.attendance_type || 'work'
    return at !== 'work'
  }

  const getLeaveType = (s: Schedule) => {
    const at = s.attendance_type || 'work'
    return at !== 'work' ? getAttendanceType(at) : undefined
  }

  const getLabel = (s: Schedule): string => {
    const leave = getLeaveType(s)
    if (leave) return leave.name
    if (s.shift_type_id && shiftMap[s.shift_type_id]) {
      return shiftMap[s.shift_type_id].name
    }
    if (s.custom_start && s.custom_end) {
      return `${formatTime(s.custom_start)}-${formatTime(s.custom_end)}`
    }
    return s.tags?.length ? '' : '班'
  }

  const getTime = (s: Schedule): string | null => {
    if (isLeave(s)) return null
    if (s.shift_type_id && shiftMap[s.shift_type_id]) {
      const st = shiftMap[s.shift_type_id]
      return `${formatTime(st.start_time)}-${formatTime(st.end_time)}`
    }
    return null
  }

  const getTags = (s: Schedule): string[] => {
    return s.tags?.length ? s.tags : []
  }

  const getColor = (s: Schedule): { bg: string; text?: string } => {
    const leave = getLeaveType(s)
    if (leave) return { bg: leave.color, text: leave.textColor }
    if (s.shift_type_id && shiftMap[s.shift_type_id]) {
      return { bg: shiftMap[s.shift_type_id].color }
    }
    return { bg: '#6B5D55' }
  }

  if (staff.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-brand-lotus">
        尚無人員資料
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[520px]">
        <thead>
          <tr className="bg-surface-section">
            <th className="sticky left-0 z-10 bg-surface-section px-3 py-2 text-left text-xs font-semibold text-brand-oak w-[72px] min-w-[72px]">
              員工
            </th>
            {weekDates.map((date) => (
              <th
                key={date}
                className={`px-1 py-2 text-center text-xs font-medium min-w-[60px] ${
                  date === today ? 'text-brand-lotus bg-brand-lotus/5' : 'text-brand-mocha'
                }`}
              >
                <div>{getWeekdayLabel(date)}</div>
                <div className="text-[10px]">{formatShortDate(date)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id} className="border-t border-gray-50">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 text-sm font-medium text-brand-oak w-[72px] min-w-[72px]">
                {member.name}
              </td>
              {weekDates.map((date) => {
                const key = `${member.id}_${date}`
                const sch = scheduleMap[key]
                const isToday = date === today

                return (
                  <td
                    key={date}
                    className={`px-1 py-1.5 text-center ${isToday ? 'bg-brand-lotus/5' : ''}`}
                  >
                    {sch ? (() => {
                      const time = getTime(sch)
                      const tags = getTags(sch)
                      const color = getColor(sch)
                      return (
                        <button
                          onClick={() => canSchedule && onCellClick?.(member.id, date, sch)}
                          className={`inline-block px-2 py-1 rounded-md text-xs font-medium max-w-full ${canSchedule ? 'active:opacity-70' : ''}`}
                          style={{ backgroundColor: color.bg, color: color.text || '#fff' }}
                          disabled={!canSchedule}
                        >
                          <div className="truncate">{getLabel(sch)}</div>
                          {time && <div className="text-[9px] opacity-80 truncate">{time}</div>}
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                              {tags.map((t) => {
                                const tc = getTagColor(t)
                                return (
                                  <span key={t} className="px-1 py-0.5 rounded text-[8px] font-medium" style={{ backgroundColor: tc.bg, color: tc.text }}>{t}</span>
                                )
                              })}
                            </div>
                          )}
                        </button>
                      )
                    })() : canSchedule ? (
                      <button
                        onClick={() => onCellClick?.(member.id, date)}
                        className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center mx-auto active:bg-gray-100"
                      >
                        <Plus size={14} className="text-gray-300" />
                      </button>
                    ) : (
                      <span className="text-gray-200 text-xs">-</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
