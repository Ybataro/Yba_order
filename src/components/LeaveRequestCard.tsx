import { getLeaveTypeName, DAY_PARTS } from '@/lib/leave'
import type { LeaveRequest } from '@/lib/leave'

const STATUS_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  pending:          { label: '待主管審核', bg: 'bg-amber-100', text: 'text-amber-700' },
  manager_approved: { label: '待最終審核', bg: 'bg-blue-100', text: 'text-blue-700' },
  approved:         { label: '已核准', bg: 'bg-green-100', text: 'text-green-700' },
  rejected:         { label: '已駁回', bg: 'bg-red-100', text: 'text-red-700' },
}

interface Props {
  request: LeaveRequest
  showStaffName?: string
  // 主管審核按鈕
  onManagerApprove?: () => void
  onManagerReject?: () => void
  // 後台最終審核按鈕
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
}

export default function LeaveRequestCard({
  request,
  showStaffName,
  onManagerApprove,
  onManagerReject,
  onApprove,
  onReject,
  onDelete,
}: Props) {
  const status = STATUS_STYLES[request.status] ?? STATUS_STYLES.pending
  const dayPartLabel = DAY_PARTS.find((d) => d.id === request.day_part)?.name ?? ''
  const dateRange = request.start_date === request.end_date
    ? request.start_date
    : `${request.start_date} ~ ${request.end_date}`

  return (
    <div className="card !p-3">
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {showStaffName && (
            <span className="text-sm font-bold text-brand-oak">{showStaffName}</span>
          )}
          <span className="text-sm font-medium text-brand-oak">
            {getLeaveTypeName(request.leave_type)}
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
          {status.label}
        </span>
      </div>

      <div className="text-xs text-brand-lotus space-y-0.5">
        <p>📅 {dateRange} {dayPartLabel !== '全天' ? `（${dayPartLabel}）` : ''} — {request.leave_days} 天</p>
        {request.reason && <p>💬 {request.reason}</p>}
        {request.status === 'rejected' && request.reject_reason && (
          <p className="text-red-500">❌ 駁回原因：{request.reject_reason}</p>
        )}
      </div>

      {/* 主管審核按鈕 */}
      {(onManagerApprove || onManagerReject) && request.status === 'pending' && (
        <div className="flex gap-2 mt-2">
          {onManagerApprove && (
            <button
              onClick={onManagerApprove}
              className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium active:scale-95 transition-transform"
            >
              核准（轉後台）
            </button>
          )}
          {onManagerReject && (
            <button
              onClick={onManagerReject}
              className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium active:scale-95 transition-transform"
            >
              駁回
            </button>
          )}
        </div>
      )}

      {/* 後台最終審核按鈕 */}
      {(onApprove || onReject || onDelete) && (
        <div className="flex gap-2 mt-2">
          {onApprove && request.status === 'manager_approved' && (
            <button
              onClick={onApprove}
              className="flex-1 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium active:scale-95 transition-transform"
            >
              核准
            </button>
          )}
          {onReject && request.status === 'manager_approved' && (
            <button
              onClick={onReject}
              className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium active:scale-95 transition-transform"
            >
              駁回
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex-1 py-1.5 rounded-lg bg-gray-400 text-white text-xs font-medium active:scale-95 transition-transform"
            >
              刪除
            </button>
          )}
        </div>
      )}
    </div>
  )
}
