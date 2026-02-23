import { useState, useEffect, useRef, useMemo } from 'react'
import type { ShiftType, Schedule, Position } from '@/lib/schedule'
import { formatTime, ATTENDANCE_TYPES } from '@/lib/schedule'
import { X, Trash2, Clock } from 'lucide-react'

interface ScheduleEditModalProps {
  open: boolean
  onClose: () => void
  shiftTypes: ShiftType[]
  positions: Position[]
  tagPresets: string[]
  existing?: Schedule
  staffName: string
  date: string
  onSave: (data: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
    attendance_type: string
    position_id: string | null
    tags?: string[]
  }) => void
  onRemove?: () => void
}

export function ScheduleEditModal({
  open, onClose, shiftTypes, positions, tagPresets, existing, staffName, date, onSave, onRemove,
}: ScheduleEditModalProps) {
  const [tab, setTab] = useState<'preset' | 'leave' | 'custom'>('preset')
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [note, setNote] = useState('')
  const [positionId, setPositionId] = useState<string | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)

  const leaveTypes = ATTENDANCE_TYPES.filter((t) => t.category !== 'work')

  // 合併班次標籤 + 預設標籤
  const allTags = useMemo(() => {
    const set = new Set<string>()
    shiftTypes.forEach((st) => st.tags?.forEach((t) => set.add(t)))
    tagPresets.forEach((t) => set.add(t))
    return Array.from(set)
  }, [shiftTypes, tagPresets])

  useEffect(() => {
    if (open) {
      if (existing) {
        const at = existing.attendance_type || 'work'
        if (at !== 'work' && at !== 'late_early') {
          setTab('leave')
        } else if (existing.custom_start && existing.custom_end && !existing.shift_type_id) {
          setTab('custom')
          setCustomStart(existing.custom_start)
          setCustomEnd(existing.custom_end)
        } else {
          setTab('preset')
        }
        setNote(existing.note || '')
        setPositionId(existing.position_id ?? null)
        setSelectedTags(existing.tags || [])
      } else {
        setTab('preset')
        setNote('')
        setPositionId(null)
        setSelectedTags([])
        setCustomStart('08:00')
        setCustomEnd('16:00')
      }
    }
  }, [open, existing])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSelectShift = (st: ShiftType) => {
    onSave({
      shift_type_id: st.id,
      custom_start: null,
      custom_end: null,
      note,
      attendance_type: 'work',
      position_id: positionId,
      tags: selectedTags,
    })
    onClose()
  }

  const handleSelectLeave = (leaveId: string) => {
    onSave({
      shift_type_id: null,
      custom_start: null,
      custom_end: null,
      note,
      attendance_type: leaveId,
      position_id: null,
      tags: [],
    })
    onClose()
  }

  const handleCustomSubmit = () => {
    onSave({
      shift_type_id: null,
      custom_start: customStart,
      custom_end: customEnd,
      note,
      attendance_type: 'work',
      position_id: positionId,
      tags: selectedTags,
    })
    onClose()
  }

  const handleRemove = () => {
    onRemove?.()
    onClose()
  }

  const shortDate = (() => {
    const d = new Date(date + 'T00:00:00')
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`
  })()

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="relative bg-white rounded-2xl max-w-md w-full mx-4 max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-brand-oak">{staffName} · {shortDate}</h3>
            <p className="text-xs text-brand-lotus mt-0.5">編輯排班</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-brand-mocha" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['preset', 'leave', 'custom'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  tab === t ? 'bg-brand-lotus text-white' : 'bg-gray-100 text-brand-mocha'
                }`}
              >
                {t === 'preset' ? '預設班次' : t === 'leave' ? '假別' : '自訂時段'}
              </button>
            ))}
          </div>

          {tab === 'preset' ? (
            <div className="space-y-2">
              {shiftTypes.length === 0 ? (
                <div className="text-center py-6 text-sm text-brand-lotus">尚未設定班次類型</div>
              ) : (
                shiftTypes.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => handleSelectShift(st)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border active:scale-[0.98] transition-transform ${
                      existing?.shift_type_id === st.id && (existing?.attendance_type || 'work') === 'work'
                        ? 'border-brand-lotus bg-brand-lotus/5'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium text-brand-oak">{st.name}</span>
                      {st.tags && st.tags.length > 0 && (
                        <span className="ml-2">
                          {st.tags.map((t) => (
                            <span key={t} className="inline-block ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-brand-mocha">{t}</span>
                          ))}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-brand-lotus">
                      {formatTime(st.start_time)} - {formatTime(st.end_time)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : tab === 'leave' ? (
            <div className="grid grid-cols-3 gap-2">
              {leaveTypes.map((lt) => (
                <button
                  key={lt.id}
                  onClick={() => handleSelectLeave(lt.id)}
                  className={`px-2 py-2.5 rounded-lg text-xs font-medium text-center active:scale-[0.96] transition-transform border ${
                    existing?.attendance_type === lt.id
                      ? 'border-brand-lotus ring-1 ring-brand-lotus'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: lt.color, color: lt.textColor }}
                >
                  {lt.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-brand-mocha shrink-0" />
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="h-10 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus flex-1"
                  />
                  <span className="text-brand-mocha text-sm">~</span>
                  <input
                    type="time"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="h-10 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus flex-1"
                  />
                </div>
              </div>
              <button onClick={handleCustomSubmit} className="btn-primary w-full !h-11">
                確認
              </button>
            </div>
          )}

          {/* 標籤選擇（上班 tab 才顯示） */}
          {tab !== 'leave' && allTags.length > 0 && (
            <div>
              <label className="text-xs font-medium text-brand-oak block mb-1.5">標籤（選填，可多選）</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-brand-lotus text-white border-brand-lotus'
                        : 'bg-gray-50 text-brand-mocha border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Position dropdown (work tabs only) */}
          {tab !== 'leave' && positions.length > 0 && (
            <div>
              <label className="text-xs font-medium text-brand-oak block mb-1.5">崗位（選填）</label>
              <select
                value={positionId || ''}
                onChange={(e) => setPositionId(e.target.value || null)}
                className="w-full h-10 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus"
              >
                <option value="">不指定</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="text-xs font-medium text-brand-oak block mb-1.5">備註（選填）</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：換班、請假"
              className="w-full h-10 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus"
            />
          </div>

          {/* Remove */}
          {existing && onRemove && (
            <button
              onClick={handleRemove}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-status-danger/20 text-status-danger text-sm font-medium active:bg-status-danger/5"
            >
              <Trash2 size={16} />
              清除此日排班
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
