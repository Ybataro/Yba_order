import { getLeaveTypeName, getLeaveStatusLabel, DAY_PARTS } from '@/lib/leave'
import type { LeaveRequest, LeaveStatus } from '@/lib/leave'

const STATUS_STYLES: Record<LeaveStatus, { bg: string; text: string }> = {
  pending:            { bg: 'bg-amber-100',  text: 'text-amber-700'  },
  approver1_approved: { bg: 'bg-sky-100',    text: 'text-sky-700'    },
  manager_approved:   { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  approved:           { bg: 'bg-green-100',  text: 'text-green-700'  },
  rejected:           { bg: 'bg-red-100',    text: 'text-red-700'    },
}

interface Props {
  request: LeaveRequest
  showStaffName?: string
  /** 目前登入者 staffId，用來判斷是否顯示本人的重送按鈕 */
  currentStaffId?: string
  // 主管審核按鈕（第一或第二主管皆用這組）
  onManagerApprove?: () => void
  onManagerReject?: () => void
  // 後台最終審核按鈕
  onApprove?: () => void
  onReject?: () => void
  onDelete?: () => void
  /** 重送（員工本人且已駁回時顯示） */
  onResubmit?: () => void
  /** 補傳診斷書（病假且 photo_submitted=false 時顯示） */
  onSubmitPhoto?: () => void
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mn = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mn}`
}

export default function LeaveRequestCard({
  request,
  showStaffName,
  currentStaffId,
  onManagerApprove,
  onManagerReject,
  onApprove,
  onReject,
  onDelete,
  onResubmit,
  onSubmitPhoto,
}: Props) {
  const statusStyle = STATUS_STYLES[request.status] ?? STATUS_STYLES.pending
  const dayPartLabel = DAY_PARTS.find((d) => d.id === request.day_part)?.name ?? ''
  const dateRange = request.start_date === request.end_date
    ? request.start_date
    : `${request.start_date} ~ ${request.end_date}`

  const isOwnRejected = request.status === 'rejected' && currentStaffId === request.staff_id
  const needsPhoto = request.leave_type === 'sick_leave' && !request.photo_submitted

  return (
    <div className="card !p-3.5">
      {/* 頂部：假別 + 狀態標籤 */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {showStaffName && (
            <span className="text-sm font-bold text-brand-oak">{showStaffName}</span>
          )}
          <span className="text-sm font-semibold text-brand-oak">
            {request.leave_type === 'other_leave' && request.other_leave_type_name
              ? request.other_leave_type_name
              : getLeaveTypeName(request.leave_type)}
          </span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          {getLeaveStatusLabel(request.status)}
        </span>
      </div>

      {/* 基本資料 */}
      <div className="text-xs text-brand-lotus space-y-0.5 mb-2">
        <p>📅 {dateRange}{dayPartLabel !== '全天' ? `（${dayPartLabel}）` : ''} — {request.leave_days} 天</p>
        {request.proxy_name && (
          <p>👤 代理人：{request.proxy_name}</p>
        )}
        {request.reason && <p>💬 {request.reason}</p>}
      </div>

      {/* 診斷書補傳提醒（病假未補傳） */}
      {needsPhoto && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
          <p className="text-xs text-amber-700">⚠️ 診斷書尚未補傳</p>
          {onSubmitPhoto && (
            <button
              onClick={onSubmitPhoto}
              className="text-xs text-amber-700 font-medium underline"
            >
              立即補傳
            </button>
          )}
        </div>
      )}

      {/* 簽核記錄 */}
      {(request.approver1_id || request.approver2_id || request.reviewed_by || request.rejected_by) && (
        <div className="border-t border-gray-100 pt-2 mt-1 mb-2 space-y-1.5">
          {request.approver1_id && request.approver1_at && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">第一主管</span>
              <div className="text-xs text-brand-lotus leading-tight">
                <span className="text-green-600 font-medium">✓ 核准</span>
                <span className="mx-1 text-gray-300">·</span>
                <span>{formatDateTime(request.approver1_at)}</span>
                {request.approver1_note && (
                  <p className="text-gray-500 mt-0.5">{request.approver1_note}</p>
                )}
              </div>
            </div>
          )}

          {request.approver2_id && request.approver2_at && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">第二主管</span>
              <div className="text-xs text-brand-lotus leading-tight">
                <span className="text-green-600 font-medium">✓ 核准</span>
                <span className="mx-1 text-gray-300">·</span>
                <span>{formatDateTime(request.approver2_at)}</span>
                {request.approver2_note && (
                  <p className="text-gray-500 mt-0.5">{request.approver2_note}</p>
                )}
              </div>
            </div>
          )}

          {request.reviewed_by && request.reviewed_at && request.status === 'approved' && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">最終核准</span>
              <div className="text-xs text-brand-lotus leading-tight">
                <span className="text-green-600 font-medium">✓ 核准</span>
                <span className="mx-1 text-gray-300">·</span>
                <span>{formatDateTime(request.reviewed_at)}</span>
                {request.admin_approve_note && (
                  <p className="text-gray-500 mt-0.5">{request.admin_approve_note}</p>
                )}
              </div>
            </div>
          )}

          {request.rejected_by && request.rejected_at && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">駁回</span>
              <div className="text-xs leading-tight">
                <span className="text-red-500 font-medium">✕ 駁回</span>
                <span className="mx-1 text-gray-300">·</span>
                <span className="text-brand-lotus">{formatDateTime(request.rejected_at)}</span>
                {request.reject_reason && (
                  <p className="text-red-500 mt-0.5">{request.reject_reason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 操作按鈕區 */}
      <div className="flex flex-col gap-2">
        {/* 主管審核按鈕 */}
        {(onManagerApprove || onManagerReject) &&
          (request.status === 'pending' || request.status === 'approver1_approved') && (
          <div className="flex gap-2">
            {onManagerApprove && (
              <button
                onClick={onManagerApprove}
                className="flex-1 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium active:scale-95 transition-transform"
              >
                核准
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
          <div className="flex gap-2">
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

        {/* 員工本人：重送按鈕（已駁回時） */}
        {isOwnRejected && onResubmit && (
          <button
            onClick={onResubmit}
            className="w-full py-1.5 rounded-lg bg-brand-oak text-white text-xs font-medium active:scale-95 transition-transform"
          >
            修改後重送
          </button>
        )}
      </div>
    </div>
  )
}
