import { useMemo } from 'react'
import { getWeekDates, formatShortDate, getWeekdayLabel, formatTime, getAttendanceType } from '@/lib/schedule'
import type { ShiftType, Schedule, Position } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'
import { getTodayString } from '@/lib/utils'
import { Plus } from 'lucide-react'
import type { PaintBrush } from './AdminScheduleToolbar'

interface AdminScheduleGridProps {
  refDate: string
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  positions: Position[]
  paintBrush: PaintBrush | null
  onCellClick: (staffId: string, date: string, existing?: Schedule) => void
}

export function AdminScheduleGrid({
  refDate, staff, schedules, shiftTypes, positions, paintBrush, onCellClick,
}: AdminScheduleGridProps) {
  const weekDates = getWeekDates(refDate)
  const today = getTodayString()

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftType> = {}
    shiftTypes.forEach((st) => { m[st.id] = st })
    return m
  }, [shiftTypes])

  const positionMap = useMemo(() => {
    const m: Record<string, Position> = {}
    positions.forEach((p) => { m[p.id] = p })
    return m
  }, [positions])

  const scheduleMap = useMemo(() => {
    const m: Record<string, Schedule> = {}
    schedules.forEach((s) => { m[`${s.staff_id}_${s.date}`] = s })
    return m
  }, [schedules])

  const getCellContent = (sch: Schedule) => {
    const at = sch.attendance_type || 'work'
    if (at !== 'work') {
      const atDef = getAttendanceType(at)
      return {
        label: atDef?.name || at,
        sub: null,
        tags: null,
        bg: atDef?.color || '#E0E0E0',
        textColor: atDef?.textColor || '#666',
        borderColor: undefined as string | undefined,
      }
    }
    // 排班記錄自帶的標籤（優先）
    const scheduleTags = sch.tags?.length ? sch.tags : null

    // Work
    if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
      const st = shiftMap[sch.shift_type_id]
      const posName = sch.position_id ? positionMap[sch.position_id]?.name : null
      const timeStr = `${formatTime(st.start_time)}-${formatTime(st.end_time)}`
      return {
        label: st.name,
        sub: posName ? `${timeStr} · ${posName}` : timeStr,
        tags: scheduleTags,
        bg: '#E8F5E9',
        textColor: '#2E7D32',
        borderColor: st.color,
      }
    }
    if (sch.custom_start && sch.custom_end) {
      const posName = sch.position_id ? positionMap[sch.position_id]?.name : null
      return {
        label: `${formatTime(sch.custom_start)}-${formatTime(sch.custom_end)}`,
        sub: posName,
        tags: scheduleTags,
        bg: '#E8F5E9',
        textColor: '#2E7D32',
        borderColor: '#6B5D55',
      }
    }
    return {
      label: '班',
      sub: null,
      tags: scheduleTags,
      bg: '#E8F5E9',
      textColor: '#2E7D32',
      borderColor: undefined,
    }
  }

  if (staff.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-brand-lotus">
        尚無人員資料
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-x-auto">
      <table className="w-full border-collapse table-fixed" style={{ minWidth: '900px' }}>
        <colgroup>
          <col style={{ width: '110px' }} />
          {weekDates.map((date) => (
            <col key={date} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-surface-section">
            <th className="sticky left-0 z-10 bg-surface-section px-3 py-3 text-left text-sm font-semibold text-brand-oak border-r border-gray-100">
              員工
            </th>
            {weekDates.map((date) => (
              <th
                key={date}
                className={`px-1 py-3 text-center text-sm font-medium ${
                  date === today ? 'text-brand-lotus bg-brand-lotus/5' : 'text-brand-mocha'
                }`}
              >
                <div>{formatShortDate(date)}({getWeekdayLabel(date)})</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => (
            <tr key={member.id} className="border-t border-gray-100 hover:bg-gray-50/50">
              <td className="sticky left-0 z-10 bg-white px-3 py-3 text-sm font-medium text-brand-oak border-r border-gray-100 truncate">
                {member.name}
              </td>
              {weekDates.map((date) => {
                const key = `${member.id}_${date}`
                const sch = scheduleMap[key]
                const isToday = date === today

                return (
                  <td
                    key={date}
                    className={`px-1 py-2 text-center ${isToday ? 'bg-brand-lotus/5' : ''} ${paintBrush ? 'cursor-crosshair' : 'cursor-pointer'}`}
                    onClick={() => onCellClick(member.id, date, sch)}
                  >
                    {sch ? (() => {
                      const cell = getCellContent(sch)
                      return (
                        <div
                          className="flex flex-col items-start px-2 py-1.5 rounded-lg text-left w-full"
                          style={{
                            backgroundColor: cell.bg,
                            color: cell.textColor,
                            borderLeft: cell.borderColor ? `4px solid ${cell.borderColor}` : undefined,
                          }}
                        >
                          <span className="text-xs font-medium truncate w-full">{cell.label}</span>
                          {cell.sub && (
                            <span className="text-[10px] opacity-75 mt-0.5 truncate w-full">{cell.sub}</span>
                          )}
                          {cell.tags && (
                            <div className="flex flex-wrap gap-0.5 mt-0.5">
                              {cell.tags.map((t) => (
                                <span key={t} className="px-1 py-0.5 rounded bg-white/50 text-[9px]">{t}</span>
                              ))}
                            </div>
                          )}
                          {sch.note && (
                            <span className="text-[9px] opacity-60 mt-0.5 truncate w-full">{sch.note}</span>
                          )}
                        </div>
                      )
                    })() : (
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors mx-auto">
                        <Plus size={14} className="text-gray-300" />
                      </div>
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
