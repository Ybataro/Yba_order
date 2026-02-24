import { useMemo } from 'react'
import type { ShiftType, Position, AttendanceTypeDef } from '@/lib/schedule'
import { ATTENDANCE_TYPES, formatTime } from '@/lib/schedule'
import { Paintbrush, X } from 'lucide-react'

export interface PaintBrush {
  shiftTypeId: string | null
  attendanceType: string
  positionId: string | null
  tags: string[]
}

interface AdminScheduleToolbarProps {
  shiftTypes: ShiftType[]
  positions: Position[]
  tagPresets: string[]
  paintBrush: PaintBrush | null
  onStartPaint: (brush: PaintBrush) => void
  onClearPaint: () => void
}

export function AdminScheduleToolbar({
  shiftTypes, positions, tagPresets, paintBrush, onStartPaint, onClearPaint,
}: AdminScheduleToolbarProps) {
  const leaveTypes = ATTENDANCE_TYPES.filter((t) => t.category !== 'work')

  // 合併班次標籤 + 預設標籤做為可選清單
  const allTags = useMemo(() => {
    const set = new Set<string>()
    shiftTypes.forEach((st) => st.tags?.forEach((t) => set.add(t)))
    tagPresets.forEach((t) => set.add(t))
    return Array.from(set)
  }, [shiftTypes, tagPresets])

  const handleShiftSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    onStartPaint({
      shiftTypeId: val,
      attendanceType: 'work',
      positionId: paintBrush?.positionId ?? null,
      tags: paintBrush?.tags ?? [],
    })
  }

  const handleLeaveSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    onStartPaint({
      shiftTypeId: null,
      attendanceType: val,
      positionId: null,
      tags: [],
    })
  }

  const handlePositionSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value || null
    if (paintBrush) {
      onStartPaint({ ...paintBrush, positionId: val })
    }
  }

  const handleTagSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) return
    onStartPaint({
      shiftTypeId: null,
      attendanceType: 'work',
      positionId: null,
      tags: [val],
    })
  }

  const getLabel = (): string => {
    if (!paintBrush) return ''
    const parts: string[] = []
    if (paintBrush.attendanceType !== 'work') {
      const at = ATTENDANCE_TYPES.find((t) => t.id === paintBrush.attendanceType) as AttendanceTypeDef | undefined
      parts.push(at?.name || paintBrush.attendanceType)
    } else if (paintBrush.shiftTypeId) {
      const st = shiftTypes.find((s) => s.id === paintBrush.shiftTypeId)
      if (st) parts.push(`${st.name} ${formatTime(st.start_time)}-${formatTime(st.end_time)}`)
    }
    if (paintBrush.positionId) {
      const pos = positions.find((p) => p.id === paintBrush.positionId)
      if (pos) parts.push(pos.name)
    }
    if (paintBrush.tags.length > 0) {
      parts.push(paintBrush.tags.join('、'))
    }
    return parts.join(' · ')
  }

  return (
    <div className="px-4 py-3 bg-white border-b border-gray-100">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-brand-oak shrink-0">快速排班：</span>
        <select
          onChange={handleShiftSelect}
          value=""
          className="h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
        >
          <option value="">選班次</option>
          {shiftTypes.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name} ({formatTime(st.start_time)}-{formatTime(st.end_time)})
            </option>
          ))}
        </select>
        <select
          onChange={handleLeaveSelect}
          value=""
          className="h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
        >
          <option value="">選假別</option>
          {leaveTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>{lt.name}</option>
          ))}
        </select>
        {positions.length > 0 && (
          <select
            onChange={handlePositionSelect}
            value={paintBrush?.positionId || ''}
            className="h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">選崗位</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}
        <select
          onChange={handleTagSelect}
          value=""
          className="h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
        >
          <option value="">選標籤</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {paintBrush && (
        <div className="flex items-center gap-3 mt-2 px-3 py-2 rounded-lg bg-brand-lotus/10">
          <Paintbrush size={16} className="text-brand-lotus shrink-0" />
          <span className="text-sm text-brand-oak font-medium flex-1">
            目前：{getLabel()}
          </span>
          <button
            onClick={onClearPaint}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white text-sm font-medium text-brand-mocha hover:bg-gray-100 border border-gray-200"
          >
            <X size={14} />
            結束排班
          </button>
          <span className="text-[10px] text-brand-lotus hidden sm:block">按 ESC 退出</span>
        </div>
      )}
    </div>
  )
}
