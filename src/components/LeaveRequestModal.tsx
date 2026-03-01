import { useState, useEffect, useMemo, useRef } from 'react'
import { TRACKED_LEAVE_TYPES, DAY_PARTS, calcLeaveDays } from '@/lib/leave'
import { useLeaveStore } from '@/stores/useLeaveStore'
import { useLeaveBalance } from '@/hooks/useLeaveBalance'
import { useToast } from '@/components/Toast'
import { toLocalDateString } from '@/lib/schedule'
import type { LeaveType, DayPart } from '@/lib/leave'

interface Props {
  open: boolean
  onClose: () => void
  staffId: string
  staffName: string
}

export default function LeaveRequestModal({ open, onClose, staffId, staffName }: Props) {
  const { submit } = useLeaveStore()
  const { showToast } = useToast()
  const currentYear = new Date().getFullYear()
  const { balances } = useLeaveBalance(open ? staffId : null, currentYear)

  const today = toLocalDateString(new Date())

  const [leaveType, setLeaveType] = useState<LeaveType>('annual_leave')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [dayPart, setDayPart] = useState<DayPart>('full')
  const [reason, setReason] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setLeaveType('annual_leave')
      setStartDate(today)
      setEndDate(today)
      setDayPart('full')
      setReason('')
      setPhotos([])
    }
  }, [open, today])

  // 半天只能單日
  useEffect(() => {
    if (dayPart !== 'full') {
      setEndDate(startDate)
    }
  }, [dayPart, startDate])

  const leaveDays = useMemo(() => calcLeaveDays(startDate, endDate, dayPart), [startDate, endDate, dayPart])

  const balance = balances.find((b) => b.leave_type === leaveType)
  const remaining = balance ? balance.total_days - balance.used_days : null
  const overLimit = remaining !== null && leaveDays > remaining

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newPhotos = [...photos]
    for (let i = 0; i < files.length && newPhotos.length < 3; i++) {
      newPhotos.push(files[i])
    }
    setPhotos(newPhotos)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (leaveDays <= 0) {
      showToast('日期範圍不正確', 'error')
      return
    }
    if (!reason.trim()) {
      showToast('請填寫請假事由', 'error')
      return
    }
    if (photos.length === 0) {
      showToast('請上傳至少一張照片', 'error')
      return
    }
    setSubmitting(true)
    const ok = await submit({
      staff_id: staffId,
      staff_name: staffName,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      day_part: dayPart,
      reason,
      photos: photos.length > 0 ? photos : undefined,
    })
    setSubmitting(false)
    if (ok) {
      showToast('請假申請已送出')
      onClose()
    } else {
      showToast('提交失敗，請重試', 'error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[90%] max-w-md mx-auto p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-brand-oak mb-4">請假申請</h2>

        {/* 假別 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">假別</label>
        <select
          value={leaveType}
          onChange={(e) => setLeaveType(e.target.value as LeaveType)}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-1"
        >
          {TRACKED_LEAVE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {remaining !== null && (
          <p className={`text-xs mb-3 ${overLimit ? 'text-red-500 font-medium' : 'text-brand-lotus'}`}>
            剩餘 {remaining} 天{overLimit ? ' ⚠️ 超過可用天數' : ''}
          </p>
        )}

        {/* 全天/半天 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">時段</label>
        <div className="flex gap-2 mb-3">
          {DAY_PARTS.map((dp) => (
            <button
              key={dp.id}
              onClick={() => setDayPart(dp.id as DayPart)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dayPart === dp.id
                  ? 'bg-brand-oak text-white'
                  : 'bg-gray-100 text-brand-mocha'
              }`}
            >
              {dp.name}
            </button>
          ))}
        </div>

        {/* 日期 */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-brand-mocha mb-1">開始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-brand-mocha mb-1">結束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              disabled={dayPart !== 'full'}
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
        </div>

        {/* 請假天數 */}
        <div className="text-sm text-brand-oak font-medium mb-3">
          請假天數：<span className="text-brand-lotus">{leaveDays} 天</span>
        </div>

        {/* 事由 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">
          事由 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="請填寫請假事由（必填）"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3 resize-none"
        />

        {/* 附件照片 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">
          附件照片 <span className="text-red-500">*</span>
          <span className="text-brand-lotus font-normal">（最多 3 張）</span>
        </label>
        <div className="flex gap-2 mb-4 flex-wrap">
          {photos.map((photo, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
              <img
                src={URL.createObjectURL(photo)}
                alt={`附件 ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(i)}
                className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center rounded-bl-lg"
              >
                ✕
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-oak hover:text-brand-oak transition-colors"
              >
                <span className="text-2xl leading-none">📷</span>
                <span className="text-[10px] mt-0.5">拍照</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-brand-oak hover:text-brand-oak transition-colors"
              >
                <span className="text-2xl leading-none">🖼</span>
                <span className="text-[10px] mt-0.5">相簿</span>
              </button>
            </>
          )}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleAddPhoto}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAddPhoto}
            className="hidden"
          />
        </div>

        {/* 按鈕 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-gray-100 text-brand-mocha text-sm font-medium"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || leaveDays <= 0 || !reason.trim() || photos.length === 0}
            className="flex-1 py-2 rounded-lg bg-brand-oak text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? '提交中...' : '提交申請'}
          </button>
        </div>
      </div>
    </div>
  )
}
