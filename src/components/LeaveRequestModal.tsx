import { useState, useEffect, useMemo, useRef } from 'react'
import { TRACKED_LEAVE_TYPES, DAY_PARTS, calcLeaveDays, isPhotoRequired } from '@/lib/leave'
import { useLeaveStore } from '@/stores/useLeaveStore'
import { useLeaveBalance } from '@/hooks/useLeaveBalance'
import { useToast } from '@/components/Toast'
import { toLocalDateString } from '@/lib/schedule'
import type { LeaveType, DayPart, LeaveRequest } from '@/lib/leave'

interface Props {
  open: boolean
  onClose: () => void
  staffId: string
  staffName: string
  storeContext?: string  // 'lehua' | 'xingnan' | 'kitchen'
  /** 若傳入 rejectedRequest，進入「重送模式」，表單預填駁回的假單資料 */
  rejectedRequest?: LeaveRequest
}

export default function LeaveRequestModal({ open, onClose, staffId, staffName, storeContext, rejectedRequest }: Props) {
  const { submit, resubmit } = useLeaveStore()
  const { showToast } = useToast()
  const currentYear = new Date().getFullYear()
  const { balances } = useLeaveBalance(open ? staffId : null, currentYear)

  const today = toLocalDateString(new Date())
  const isResubmit = !!rejectedRequest

  const [leaveType, setLeaveType] = useState<LeaveType>('annual_leave')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)
  const [dayPart, setDayPart] = useState<DayPart>('full')
  const [reason, setReason] = useState('')
  const [proxyName, setProxyName] = useState('')
  const [otherLeaveTypeName, setOtherLeaveTypeName] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Reset / prefill on open
  useEffect(() => {
    if (open) {
      if (rejectedRequest) {
        // 重送模式：預填駁回假單
        setLeaveType(rejectedRequest.leave_type)
        setStartDate(rejectedRequest.start_date)
        setEndDate(rejectedRequest.end_date)
        setDayPart(rejectedRequest.day_part)
        setReason(rejectedRequest.reason)
        setProxyName(rejectedRequest.proxy_name ?? '')
        setOtherLeaveTypeName(rejectedRequest.other_leave_type_name ?? '')
      } else {
        setLeaveType('annual_leave')
        setStartDate(today)
        setEndDate(today)
        setDayPart('full')
        setReason('')
        setProxyName('')
        setOtherLeaveTypeName('')
      }
      setPhotos([])
    }
  }, [open, today, rejectedRequest])

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

  const needsPhoto = isPhotoRequired(leaveType)
  const isOtherLeave = leaveType === 'other_leave'

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
    if (!proxyName.trim()) {
      showToast('請填寫代理人姓名', 'error')
      return
    }
    if (!reason.trim()) {
      showToast('請填寫請假事由', 'error')
      return
    }
    if (isOtherLeave && !otherLeaveTypeName.trim()) {
      showToast('請填寫其他假別名稱', 'error')
      return
    }

    setSubmitting(true)

    const payload = {
      staff_id: staffId,
      staff_name: staffName,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      day_part: dayPart,
      reason,
      proxy_name: proxyName.trim(),
      other_leave_type_name: isOtherLeave ? otherLeaveTypeName.trim() : '',
      photos: photos.length > 0 ? photos : undefined,
      store_context: storeContext,
    }

    const result = isResubmit
      ? await resubmit(rejectedRequest!.id, payload)
      : await submit(payload)

    setSubmitting(false)

    if (result.ok) {
      showToast(isResubmit ? '假單已重新送出' : '請假申請已送出')
      onClose()
    } else {
      showToast(result.error ?? '提交失敗，請重試', 'error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-[90%] max-w-md mx-auto p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 標題 */}
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-brand-oak flex-1">
            {isResubmit ? '重送假單' : '請假申請'}
          </h2>
          {isResubmit && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              修改後重送
            </span>
          )}
        </div>

        {/* 駁回原因提示（重送模式） */}
        {isResubmit && rejectedRequest?.reject_reason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-4">
            <p className="text-xs font-medium text-red-600 mb-0.5">駁回原因</p>
            <p className="text-sm text-red-700">{rejectedRequest.reject_reason}</p>
          </div>
        )}

        {/* 假別 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">假別</label>
        <select
          value={leaveType}
          onChange={(e) => {
            setLeaveType(e.target.value as LeaveType)
            setOtherLeaveTypeName('')
          }}
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
        {!remaining && <div className="mb-3" />}

        {/* 其他假別名稱（選「其他」時顯示） */}
        {isOtherLeave && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-brand-mocha mb-1">
              假別名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={otherLeaveTypeName}
              onChange={(e) => setOtherLeaveTypeName(e.target.value)}
              placeholder="請填寫假別名稱（例如：婚假、陪產假）"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
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

        {/* 代理人 */}
        <label className="block text-sm font-medium text-brand-mocha mb-1">
          代理人 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={proxyName}
          onChange={(e) => setProxyName(e.target.value)}
          placeholder="請假期間代理人姓名（必填）"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
        />

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

        {/* 附件照片（僅病假顯示） */}
        {needsPhoto && (
          <>
            <label className="block text-sm font-medium text-brand-mocha mb-1">
              診斷書照片
              <span className="text-brand-lotus font-normal">（最多 3 張）</span>
            </label>
            <p className="text-xs text-brand-lotus mb-2">
              建議上傳診斷書，可事後至假單補傳
            </p>
            <div className="flex gap-2 mb-4 flex-wrap">
              {photos.map((photo, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img
                    src={URL.createObjectURL(photo)}
                    alt={`診斷書 ${i + 1}`}
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
          </>
        )}

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
            disabled={
              submitting ||
              leaveDays <= 0 ||
              !proxyName.trim() ||
              !reason.trim() ||
              (isOtherLeave && !otherLeaveTypeName.trim())
            }
            className="flex-1 py-2 rounded-lg bg-brand-oak text-white text-sm font-medium disabled:opacity-50"
          >
            {submitting ? '提交中...' : isResubmit ? '重新送出' : '提交申請'}
          </button>
        </div>
      </div>
    </div>
  )
}
