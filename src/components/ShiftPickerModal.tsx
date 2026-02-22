import { useState, useEffect, useRef } from 'react'
import type { ShiftType } from '@/lib/schedule'
import { formatTime } from '@/lib/schedule'
import { X, Trash2, Clock } from 'lucide-react'

interface ShiftPickerModalProps {
  open: boolean
  onClose: () => void
  shiftTypes: ShiftType[]
  /** 目前選中的班次資料 */
  current?: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
  }
  staffName: string
  date: string
  onSelect: (data: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
  }) => void
  onRemove?: () => void
}

export function ShiftPickerModal({
  open, onClose, shiftTypes, current, staffName, date, onSelect, onRemove,
}: ShiftPickerModalProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset')
  const [customStart, setCustomStart] = useState('08:00')
  const [customEnd, setCustomEnd] = useState('16:00')
  const [note, setNote] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      if (current?.custom_start && current?.custom_end && !current?.shift_type_id) {
        setMode('custom')
        setCustomStart(current.custom_start)
        setCustomEnd(current.custom_end)
      } else {
        setMode('preset')
      }
      setNote(current?.note || '')
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

  const handleSelectShift = (st: ShiftType) => {
    onSelect({
      shift_type_id: st.id,
      custom_start: null,
      custom_end: null,
      note,
    })
    onClose()
  }

  const handleCustomSubmit = () => {
    onSelect({
      shift_type_id: null,
      custom_start: customStart,
      custom_end: customEnd,
      note,
    })
    onClose()
  }

  const handleRemove = () => {
    onRemove?.()
    onClose()
  }

  const shortDate = (() => {
    const d = new Date(date + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  })()

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
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
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
                mode === 'preset'
                  ? 'bg-brand-lotus text-white'
                  : 'bg-gray-100 text-brand-mocha'
              }`}
            >
              預設班次
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mode === 'custom'
                  ? 'bg-brand-lotus text-white'
                  : 'bg-gray-100 text-brand-mocha'
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
                    onClick={() => handleSelectShift(st)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border active:scale-[0.98] transition-transform ${
                      current?.shift_type_id === st.id
                        ? 'border-brand-lotus bg-brand-lotus/5'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: st.color }}
                    />
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
              <button
                onClick={handleCustomSubmit}
                className="btn-primary w-full !h-11"
              >
                確認
              </button>
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
