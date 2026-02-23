import { useState, useRef, useEffect, useMemo } from 'react'
import type { ShiftType, Position, AttendanceTypeDef } from '@/lib/schedule'
import { ATTENDANCE_TYPES, formatTime } from '@/lib/schedule'
import { Paintbrush, X, Tag, ChevronDown } from 'lucide-react'

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

/** 多選標籤下拉元件 */
function TagMultiSelect({
  allTags,
  selected,
  onChange,
}: {
  allTags: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  // 點外面關閉 = 放棄變更
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // 開啟時用目前 selected 初始化 draft
  const handleOpen = () => {
    if (!open) setDraft([...selected])
    setOpen(!open)
  }

  const toggleDraft = (tag: string) => {
    setDraft((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleConfirm = () => {
    onChange(draft)
    setOpen(false)
  }

  const handleClear = () => {
    onChange([])
    setDraft([])
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleOpen}
        className="h-9 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus flex items-center gap-1.5 min-w-[90px]"
      >
        <Tag size={14} className="text-brand-mocha shrink-0" />
        <span className="truncate">
          {selected.length > 0 ? `${selected.length} 標籤` : '選標籤'}
        </span>
        <ChevronDown size={14} className={`text-brand-mocha shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-10 left-0 z-30 bg-white rounded-lg shadow-lg border border-gray-200 min-w-[180px] max-h-[300px] flex flex-col">
          <div className="flex-1 overflow-y-auto py-1">
          {allTags.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">尚無標籤（請至班次管理新增）</div>
          ) : (
            allTags.map((tag) => (
              <label
                key={tag}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={draft.includes(tag)}
                  onChange={() => toggleDraft(tag)}
                  className="w-4 h-4 rounded border-gray-300 text-brand-lotus accent-brand-lotus"
                />
                <span className="text-sm text-brand-oak">{tag}</span>
              </label>
            ))
          )}
          </div>
          {/* 確認 / 清除 按鈕列 */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClear}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-brand-mocha bg-gray-100 hover:bg-gray-200"
            >
              清除
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-lotus hover:opacity-90"
            >
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
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

  const handleTagsChange = (tags: string[]) => {
    if (paintBrush) {
      onStartPaint({ ...paintBrush, tags })
    }
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
        <TagMultiSelect
          allTags={allTags}
          selected={paintBrush?.tags ?? []}
          onChange={handleTagsChange}
        />
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
