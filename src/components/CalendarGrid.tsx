import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { formatTime, getAttendanceType, getTagColor } from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'
import { getTodayString } from '@/lib/utils'
import { Plus, Pencil, X } from 'lucide-react'

interface CalendarGridProps {
  year: number
  month: number // 1-based
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  canSchedule: boolean
  onCellClick?: (staffId: string, date: string, existing?: Schedule) => void
  popupStaffIds?: Set<string>
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

export function CalendarGrid({ year, month, staff, schedules, shiftTypes, canSchedule, onCellClick, popupStaffIds }: CalendarGridProps) {
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

  /** Get effective tags for a schedule (schedule tags + shift type tags) */
  const getEffectiveTags = useCallback((sch: Schedule): string[] => {
    const tags: string[] = [...(sch.tags || [])]
    if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
      const st = shiftMap[sch.shift_type_id]
      if (st.tags?.length) {
        for (const t of st.tags) {
          if (!tags.includes(t)) tags.push(t)
        }
      }
    }
    return tags
  }, [shiftMap])

  // Info popup state — includes anchor position for inline placement
  const [popupInfo, setPopupInfo] = useState<{
    sch: Schedule; name: string; label: string; color: { bg: string; text: string }
    anchorTop: number; anchorLeft: number; anchorWidth: number
  } | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close popup on outside click
  useEffect(() => {
    if (!popupInfo) return
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopupInfo(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popupInfo])

  // Scroll popup into view when it appears
  useEffect(() => {
    if (popupInfo && popupRef.current) {
      setTimeout(() => {
        popupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [popupInfo])

  /** Render a badge with tags below */
  const renderBadge = (sch: Schedule) => {
    const member = staffMap[sch.staff_id]
    if (!member) return null
    const color = getBadgeColor(sch)
    const shortName = getShortName(member.name)
    const fullLabel = getFullLabel(sch)
    const tags = getEffectiveTags(sch)
    const tagsTitle = tags.length > 0 ? ` [${tags.join(', ')}]` : ''

    const badgeContent = (
      <>
        <span>{shortName}</span>
        {tags.length > 0 && (
          <div className="flex gap-[1px] mt-[1px]">
            {tags.map((t) => {
              const tc = getTagColor(t)
              const short = t.length <= 2 ? t : t.slice(0, 2)
              return (
                <span
                  key={t}
                  className="text-[6px] leading-none rounded px-[2px]"
                  style={{ backgroundColor: tc.bg, color: tc.text }}
                >
                  {short}
                </span>
              )
            })}
          </div>
        )}
      </>
    )

    // undefined = all clickable (scheduler), Set = only those staff IDs
    const canPopup = popupStaffIds === undefined || popupStaffIds.has(sch.staff_id)

    if (!canPopup) {
      return (
        <div
          key={sch.id}
          title={`${member.name} ${fullLabel}${tagsTitle}`}
          className="rounded px-[3px] py-[1px] text-[8px] leading-tight font-semibold whitespace-nowrap flex flex-col items-center"
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          {badgeContent}
        </div>
      )
    }

    return (
      <button
        key={sch.id}
        onClick={(e) => {
          const btn = e.currentTarget
          const container = containerRef.current
          if (container) {
            const btnRect = btn.getBoundingClientRect()
            const cRect = container.getBoundingClientRect()
            setPopupInfo({
              sch, name: member.name, label: fullLabel, color,
              anchorTop: btnRect.bottom - cRect.top + container.scrollTop,
              anchorLeft: btnRect.left - cRect.left + container.scrollLeft,
              anchorWidth: btnRect.width,
            })
          } else {
            setPopupInfo({ sch, name: member.name, label: fullLabel, color, anchorTop: 0, anchorLeft: 0, anchorWidth: 0 })
          }
        }}
        title={`${member.name} ${fullLabel}${tagsTitle}`}
        className="rounded px-[3px] py-[1px] text-[8px] leading-tight font-semibold whitespace-nowrap active:opacity-70 flex flex-col items-center"
        style={{ backgroundColor: color.bg, color: color.text }}
      >
        {badgeContent}
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
    <div ref={containerRef} className="overflow-x-auto px-2 pb-4 relative">
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
            let hasCompanyOff = false
            let hasWorkShift = false

            daySchedules.forEach((sch) => {
              const at = sch.attendance_type || 'work'
              if (at === 'company_off') { hasCompanyOff = true; return }
              if (at !== 'work') return // hide other leaves from calendar
              hasWorkShift = true
              const period = isAfternoonShift(sch, shiftMap)
              if (period === false) evening.push(sch)
              else afternoon.push(sch)
            })

            sortByStaff(afternoon)
            sortByStaff(evening)

            // 全員公休且無任何工作班次 → 顯示公休橫幅
            const isAllCompanyOff = hasCompanyOff && !hasWorkShift

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

                {isAllCompanyOff ? (
                  /* 公休橫幅 */
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-gray-400">公休</span>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            )
          })}
        </div>
      ))}
      </div>

      {/* Compact info popup — anchored below clicked badge */}
      {popupInfo && (
        <div
          ref={popupRef}
          className="absolute z-50 rounded-lg bg-white shadow-lg border border-gray-200 p-2 w-40"
          style={{
            top: popupInfo.anchorTop + 4,
            left: Math.max(4, Math.min(popupInfo.anchorLeft - 60 + popupInfo.anchorWidth / 2, (containerRef.current?.scrollWidth ?? 700) - 168)),
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="inline-block rounded px-1.5 py-px text-[10px] font-semibold"
              style={{ backgroundColor: popupInfo.color.bg, color: popupInfo.color.text }}
            >
              {popupInfo.name}
            </span>
            <button onClick={() => setPopupInfo(null)} className="p-0.5 rounded active:bg-gray-100">
              <X size={12} className="text-gray-400" />
            </button>
          </div>
          <div className="text-[11px] text-brand-oak font-medium">{popupInfo.label}</div>
          {popupInfo.sch.note && (
            <div className="text-[10px] text-gray-500 mt-0.5">{popupInfo.sch.note}</div>
          )}
          {canSchedule && (
            <button
              onClick={() => {
                const s = popupInfo.sch
                setPopupInfo(null)
                onCellClick?.(s.staff_id, s.date, s)
              }}
              className="mt-1.5 flex items-center gap-1 px-2 py-1 rounded-md bg-brand-oak text-white text-[10px] font-medium active:scale-95 transition-transform"
            >
              <Pencil size={10} />
              編輯
            </button>
          )}
        </div>
      )}
    </div>
  )
}
