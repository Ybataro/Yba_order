import { useState, useEffect, useRef } from 'react'
import type { ShiftType, Position } from '@/lib/schedule'
import { formatTime, ATTENDANCE_TYPES } from '@/lib/schedule'
import { X, Trash2, Clock } from 'lucide-react'

interface ShiftPickerModalProps {
  open: boolean
  onClose: () => void
  shiftTypes: ShiftType[]
  positions?: Position[]
  /** 目前選中的班次資料 */
  current?: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
    attendance_type?: string
    position_id?: string | null
  }
  staffName: string
  date: string
  onSelect: (data: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
    attendance_type: string
    position_id: string | null
  }) => void
  onRemove?: () => void
}

export function ShiftPickerModal({
  open, onClose, shiftTypes, positions, current, staffName, date, onSelect, onRemove,
}: ShiftPickerModalProps) {
  const [mode, setMode] = useState<'preset' | 'leave' | 'custom'>('preset')
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [note, setNote] = useState('')
  const [positionId, setPositionId] = useState<string | null>(null)
  // 選取狀態（不立刻存，等按確認）
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const leaveTypes = ATTENDANCE_TYPES.filter((t) => t.category !== 'work')

  useEffect(() => {
    if (open) {
      const at = current?.attendance_type || 'work'
      if (at !== 'work' && at !== 'late_early') {
        setMode('leave')
        setSelectedLeaveId(at)
        setSelectedShiftId(null)
      } else if (current?.custom_start && current?.custom_end && !current?.shift_type_id) {
        setMode('custom')
        setCustomStart(current.custom_start)
        setCustomEnd(current.custom_end)
        setSelectedShiftId(null)
        setSelectedLeaveId(null)
      } else {
        setMode('preset')
        setSelectedShiftId(current?.shift_type_id ?? null)
        setSelectedLeaveId(null)
      }
      setNote(current?.note || '')
      setPositionId(current?.position_id ?? null)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open, current])

  if (!open) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleConfirm = () => {
    if (mode === 'leave' && selectedLeaveId) {
      onSelect({
        shift_type_id: null,
        custom_start: null,
        custom_end: null,
        note,
        attendance_type: selectedLeaveId,
        position_id: null,
      })
      onClose()
    } else if (mode === 'preset' && selectedShiftId) {
      onSelect({
        shift_type_id: selectedShiftId,
        custom_start: null,
        custom_end: null,
        note,
        attendance_type: 'work',
        position_id: positionId,
      })
      onClose()
    } else if (mode === 'custom') {
      onSelect({
        shift_type_id: null,
        custom_start: customStart,
        custom_end: customEnd,
        note,
        attendance_type: 'work',
        position_id: positionId,
      })
      onClose()
    }
  }

  const canConfirm =
    (mode === 'leave' && selectedLeaveId !== null) ||
    (mode === 'preset' && selectedShiftId !== null) ||
    mode === 'custom'

  const handleRemove = () => {
    onRemove?.()
    onClose()
  }

  const shortDate = (() => {
    const d = new Date(date + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  })()

  const hasPositions = positions && positions.length > 0

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-t-2xl max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-brand-oak">{staffName} · {shortDate}</h3>
            <p className="text-xs text-brand-lotus mt-0.5">選擇班次</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={20} className="text-brand-mocha" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tab 切換 */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('preset')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'preset' ? 'bg-brand-lotus text-white' : 'bg-gray-100 text-brand-mocha'
              }`}
            >
              預設班次
            </button>
            <button
              onClick={() => setMode('leave')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'leave' ? 'bg-brand-lotus text-white' : 'bg-gray-100 text-brand-mocha'
              }`}
            >
              假別
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'custom' ? 'bg-brand-lotus text-white' : 'bg-gray-100 text-brand-mocha'
              }`}
            >
              自訂時段
            </button>
          </div>

          {mode === 'preset' ? (
            <div className="space-y-2">
              {shiftTypes.length === 0 ? (
                <div className="text-center py-6 text-sm text-brand-lotus">
                  尚未設定班次類型，請至後台新增
                </div>
              ) : (
                shiftTypes.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setSelectedShiftId(st.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border active:scale-[0.98] transition-transform ${
                      selectedShiftId === st.id
                        ? 'border-brand-lotus bg-brand-lotus/5'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium text-brand-oak">{st.name}</span>
                    </div>
                    <span className="text-xs text-brand-lotus">
                      {formatTime(st.start_time)} - {formatTime(st.end_time)}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : mode === 'leave' ? (
            <div className="grid grid-cols-3 gap-2">
              {leaveTypes.map((lt) => (
                <button
                  key={lt.id}
                  onClick={() => setSelectedLeaveId(lt.id)}
                  className={`px-2 py-2.5 rounded-lg text-xs font-medium text-center active:scale-[0.96] transition-transform border ${
                    selectedLeaveId === lt.id
                      ? 'border-brand-lotus ring-2 ring-brand-lotus'
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
            </div>
          )}

          {/* 崗位下拉（上班 tab 才顯示） */}
          {mode !== 'leave' && hasPositions && (
            <div>
              <label className="text-xs font-medium text-brand-oak block mb-1.5">崗位（選填）</label>
              <select
                value={positionId || ''}
                onChange={(e) => setPositionId(e.target.value || null)}
                className="w-full h-10 rounded-lg border border-gray-200 bg-surface-input px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus"
              >
                <option value="">不指定</option>
                {positions!.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 備註 */}
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

          {/* 確認儲存 */}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="w-full py-3 rounded-xl bg-brand-lotus text-white text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            確認儲存
          </button>

          {/* 清除排班 */}
          {current && onRemove && (
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
