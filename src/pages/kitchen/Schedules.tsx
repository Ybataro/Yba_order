import { useState, useEffect, useMemo, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { MonthNav } from '@/components/MonthNav'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { CalendarGrid } from '@/components/CalendarGrid'
import { ShiftPickerModal } from '@/components/ShiftPickerModal'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import { getMonthDates } from '@/lib/schedule'
import { getSession } from '@/lib/auth'
import { exportScheduleToPdf, exportCalendarScheduleToPdf } from '@/lib/exportSchedulePdf'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { FileText, Printer, CalendarDays, LayoutGrid, CalendarOff } from 'lucide-react'
import LeaveRequestModal from '@/components/LeaveRequestModal'
import LeaveRequestCard from '@/components/LeaveRequestCard'
import { useLeaveStore } from '@/stores/useLeaveStore'
import type { LeaveRequest } from '@/lib/leave'
import type { Schedule } from '@/lib/schedule'

const SCOPE = 'kitchen'

export default function KitchenSchedules() {
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('calendar')
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const staffInitialized = useStaffStore((s) => s.initialized)
  const { shiftTypes, positions, fetchShiftTypes, fetchPositions, upsertSchedule, removeSchedule } = useScheduleStore()
  const canSchedule = useCanSchedule()
  const { showToast } = useToast()

  // Fetch can_popup staff IDs for calendar popup control
  const [popupStaffIds, setPopupStaffIds] = useState<Set<string> | undefined>(undefined)
  useEffect(() => {
    if (!supabase || canSchedule) return
    supabase.from('user_pins').select('staff_id').eq('can_popup', true).eq('is_active', true)
      .then(({ data }) => {
        setPopupStaffIds(new Set((data || []).map((r: { staff_id: string }) => r.staff_id)))
      })
  }, [canSchedule])

  // Shared month state for both views
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)

  const monthDates = useMemo(() => getMonthDates(calYear, calMonth), [calYear, calMonth])
  const staffIds = useMemo(() => kitchenStaff.map((s) => s.id), [kitchenStaff])

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerExisting, setPickerExisting] = useState<Schedule | undefined>()

  // Leave state
  const session = getSession()
  const {
    requests: myLeaveRequests,
    fetchByStaff: fetchMyLeave,
    remove: removeLeave,
    approver1Approve,
    approver1Reject,
    approver2Approve,
    approver2Reject,
    submitPhoto,
  } = useLeaveStore()

  // 本人的主管層級（第一或第二主管）
  const [approverOrder, setApproverOrder] = useState<1 | 2 | null>(null)

  useEffect(() => {
    if (!supabase || !session?.staffId) return
    supabase
      .from('user_pins')
      .select('leave_approver_order')
      .eq('staff_id', session.staffId)
      .eq('is_leave_approver', true)
      .eq('leave_approver_scope', SCOPE)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.leave_approver_order === 1) setApproverOrder(1)
        else if (data?.leave_approver_order === 2) setApproverOrder(2)
        else setApproverOrder(null)
      })
  }, [session?.staffId])

  // 主管待審核 — 獨立 local state
  const [pendingForManager, setPendingForManager] = useState<LeaveRequest[]>([])

  // 審核 Modal state
  const [approveId, setApproveId] = useState<string | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionSubmitting, setActionSubmitting] = useState(false)

  // 重送 Modal state
  const [resubmitRequest, setResubmitRequest] = useState<LeaveRequest | null>(null)

  // 請假 / 補傳診斷書 modal
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const [photoSubmitId, setPhotoSubmitId] = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoSubmitting, setPhotoSubmitting] = useState(false)

  useEffect(() => {
    if (session?.staffId) fetchMyLeave(session.staffId)
  }, [session?.staffId, fetchMyLeave])

  // 主管抓待審核（依層級決定查哪種 status）
  const loadManagerPending = useCallback(async () => {
    if (!canSchedule || !supabase || staffIds.length === 0 || approverOrder === null) return
    const statusFilter = approverOrder === 1 ? 'pending' : 'approver1_approved'
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', statusFilter)
      .in('staff_id', staffIds)
      .order('created_at', { ascending: false })
    setPendingForManager((data as LeaveRequest[] | null) ?? [])
  }, [canSchedule, staffIds, approverOrder])

  useEffect(() => {
    loadManagerPending()
  }, [loadManagerPending])

  // ── 審核操作 ────────────────────────────────────────────────

  const handleApproveConfirm = async () => {
    if (!approveId || !session || !approveNote.trim()) return
    setActionSubmitting(true)
    const ok = approverOrder === 1
      ? await approver1Approve(approveId, session.staffId, approveNote.trim())
      : await approver2Approve(approveId, session.staffId, approveNote.trim())
    setActionSubmitting(false)
    if (ok) {
      showToast(approverOrder === 1 ? '已核准，轉第二主管審核' : '已核准，轉後台審核')
      setApproveId(null)
      setApproveNote('')
      loadManagerPending()
    } else {
      showToast('核准失敗', 'error')
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectId || !session || !rejectReason.trim()) return
    setActionSubmitting(true)
    const ok = approverOrder === 1
      ? await approver1Reject(rejectId, session.staffId, rejectReason.trim())
      : await approver2Reject(rejectId, session.staffId, rejectReason.trim())
    setActionSubmitting(false)
    if (ok) {
      showToast('已駁回')
      setRejectId(null)
      setRejectReason('')
      loadManagerPending()
    } else {
      showToast('駁回失敗', 'error')
    }
  }

  // ── 補傳診斷書 ──────────────────────────────────────────────

  const handlePhotoSubmit = async () => {
    if (!photoSubmitId || photoFiles.length === 0 || !session) return
    setPhotoSubmitting(true)
    const ok = await submitPhoto(photoSubmitId, photoFiles, session.staffName ?? '', SCOPE)
    setPhotoSubmitting(false)
    if (ok) {
      showToast('診斷書已補傳')
      setPhotoSubmitId(null)
      setPhotoFiles([])
      if (session?.staffId) fetchMyLeave(session.staffId)
    } else {
      showToast('補傳失敗，請重試', 'error')
    }
  }

  // Month schedules (shared between both views)
  const [monthSchedules, setMonthSchedules] = useState<Schedule[]>([])

  useEffect(() => {
    fetchShiftTypes('kitchen')
    fetchPositions('kitchen')
  }, [fetchShiftTypes, fetchPositions])

  useEffect(() => {
    if (staffInitialized && staffIds.length > 0 && monthDates.length > 0) {
      const from = monthDates[0]
      const to = monthDates[monthDates.length - 1]
      if (supabase) {
        supabase
          .from('schedules')
          .select('*')
          .in('staff_id', staffIds)
          .gte('date', from)
          .lte('date', to)
          .then(({ data }) => {
            if (data) {
              setMonthSchedules(data.map((s: Record<string, unknown>) => ({
                ...s,
                position_id: (s.position_id as string) ?? null,
                attendance_type: (s.attendance_type as string) ?? 'work',
                tags: (s.tags as string[]) || [],
              })) as Schedule[])
            }
          })
      }
    }
  }, [staffInitialized, staffIds, monthDates])

  const refreshMonthSchedules = () => {
    if (staffIds.length > 0 && monthDates.length > 0 && supabase) {
      const from = monthDates[0]
      const to = monthDates[monthDates.length - 1]
      const sb = supabase
      setTimeout(() => {
        sb
          .from('schedules')
          .select('*')
          .in('staff_id', staffIds)
          .gte('date', from)
          .lte('date', to)
          .then(({ data }) => {
            if (data) {
              setMonthSchedules(data.map((s: Record<string, unknown>) => ({
                ...s,
                position_id: (s.position_id as string) ?? null,
                attendance_type: (s.attendance_type as string) ?? 'work',
                tags: (s.tags as string[]) || [],
              })) as Schedule[])
            }
          })
      }, 500)
    }
  }

  const handleCellClick = (staffId: string, date: string, existing?: Schedule) => {
    setPickerStaffId(staffId)
    setPickerDate(date)
    setPickerExisting(existing)
    setPickerOpen(true)
  }

  const handleSelect = (data: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
    attendance_type: string
    position_id: string | null
  }) => {
    const s = getSession()
    upsertSchedule({
      staff_id: pickerStaffId,
      date: pickerDate,
      ...data,
      created_by: s?.staffId ?? null,
    })
    refreshMonthSchedules()
  }

  const handleRemove = () => {
    if (pickerExisting) {
      removeSchedule(pickerExisting.id)
      refreshMonthSchedules()
    }
  }

  const pickerStaffName = kitchenStaff.find((s) => s.id === pickerStaffId)?.name || ''

  const handlePdf = async () => {
    try {
      let pdfSchedules = monthSchedules
      if (supabase && staffIds.length > 0 && monthDates.length > 0) {
        const { data } = await supabase
          .from('schedules')
          .select('*')
          .in('staff_id', staffIds)
          .gte('date', monthDates[0])
          .lte('date', monthDates[monthDates.length - 1])
        if (data) {
          pdfSchedules = data.map((s: Record<string, unknown>) => ({
            ...s,
            position_id: (s.position_id as string) ?? null,
            attendance_type: (s.attendance_type as string) ?? 'work',
            tags: (s.tags as string[]) || [],
          })) as Schedule[]
        }
      }

      if (viewMode === 'grid') {
        const firstDate = monthDates[0]
        const lastDate = monthDates[monthDates.length - 1]
        await exportScheduleToPdf({
          title: '央廚排班表',
          dateRange: `${calYear}年${calMonth}月（${firstDate} ~ ${lastDate}）`,
          weekDates: monthDates,
          staff: kitchenStaff,
          schedules: pdfSchedules,
          shiftTypes,
          fileName: `央廚_月檢視_${calYear}年${calMonth}月.pdf`,
        })
      } else {
        await exportCalendarScheduleToPdf({
          title: '央廚排班表',
          year: calYear,
          month: calMonth,
          staff: kitchenStaff,
          schedules: pdfSchedules,
          shiftTypes,
          fileName: `央廚_排班表_${calYear}年${calMonth}月.pdf`,
        })
      }
    } catch (e) {
      console.error('[PDF export error]', e)
      showToast('PDF 匯出失敗', 'error')
    }
  }

  const pendingLabel = approverOrder === 1 ? '第一主管待審核' : '第二主管待審核'

  return (
    <div className="page-container">
      <TopNav title="央廚排班表" backTo="/kitchen" />

      {canSchedule && (
        <div className="flex items-center gap-1 px-4 pt-2 no-print">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'grid'
                ? 'bg-brand-oak text-white'
                : 'bg-gray-100 text-brand-mocha active:bg-gray-200'
            }`}
          >
            <LayoutGrid size={13} />
            月檢視
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              viewMode === 'calendar'
                ? 'bg-brand-oak text-white'
                : 'bg-gray-100 text-brand-mocha active:bg-gray-200'
            }`}
          >
            <CalendarDays size={13} />
            月行事曆
          </button>
        </div>
      )}

      <div className="no-print">
        <MonthNav year={calYear} month={calMonth} onChange={(y, m) => { setCalYear(y); setCalMonth(m) }} />
      </div>

      <div className="flex items-center justify-end gap-1.5 px-4 py-2 no-print">
        <button
          onClick={() => setLeaveModalOpen(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-camel text-white text-xs font-medium active:scale-95 transition-transform"
        >
          <CalendarOff size={14} />
          請假
        </button>
        {canSchedule && (
          <>
            <button
              onClick={handlePdf}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-lotus text-white text-xs font-medium active:scale-95 transition-transform"
            >
              <FileText size={14} />
              PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
            >
              <Printer size={14} />
              列印
            </button>
          </>
        )}
      </div>

      {canSchedule && viewMode === 'grid' ? (
        <ScheduleGrid
          dates={monthDates}
          staff={kitchenStaff}
          schedules={monthSchedules}
          shiftTypes={shiftTypes}
          canSchedule={canSchedule}
          onCellClick={handleCellClick}
        />
      ) : (
        <CalendarGrid
          year={calYear}
          month={calMonth}
          staff={kitchenStaff}
          schedules={monthSchedules}
          shiftTypes={shiftTypes}
          canSchedule={canSchedule}
          onCellClick={handleCellClick}
          popupStaffIds={canSchedule ? undefined : popupStaffIds}
        />
      )}

      {!canSchedule && (
        <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-brand-lotus/10 text-brand-lotus text-xs font-medium text-center">
          唯讀模式 — 需排班權限才能編輯
        </div>
      )}

      {/* 主管待審核請假 */}
      {canSchedule && approverOrder !== null && pendingForManager.length > 0 && (
        <div className="px-4 py-3 space-y-2 no-print">
          <h3 className="text-sm font-bold text-blue-600">
            {pendingLabel}（{pendingForManager.length}）
          </h3>
          {pendingForManager.map((req) => {
            const name = kitchenStaff.find((s) => s.id === req.staff_id)?.name || req.staff_id
            return (
              <LeaveRequestCard
                key={req.id}
                request={req}
                showStaffName={name}
                onManagerApprove={() => { setApproveId(req.id); setApproveNote('') }}
                onManagerReject={() => { setRejectId(req.id); setRejectReason('') }}
              />
            )
          })}
        </div>
      )}

      {/* 我的請假申請 */}
      {session?.staffId && myLeaveRequests.length > 0 && (
        <div className="px-4 py-3 space-y-2 no-print">
          <h3 className="text-sm font-bold text-brand-oak">我的請假申請</h3>
          {myLeaveRequests.map((req) => (
            <LeaveRequestCard
              key={req.id}
              request={req}
              currentStaffId={session.staffId}
              onDelete={req.status === 'pending' ? async () => {
                if (confirm('確定要刪除這筆請假申請嗎？')) {
                  const ok = await removeLeave(req.id)
                  if (ok) showToast('已刪除')
                  else showToast('刪除失敗', 'error')
                }
              } : undefined}
              onResubmit={req.status === 'rejected'
                ? () => setResubmitRequest(req)
                : undefined}
              onSubmitPhoto={
                req.leave_type === 'sick_leave' && !req.photo_submitted
                  ? () => { setPhotoSubmitId(req.id); setPhotoFiles([]) }
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* ── 核准 Modal ── */}
      {approveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setApproveId(null)}>
          <div className="bg-white rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-oak mb-1">核准請假</h3>
            <p className="text-xs text-brand-lotus mb-3">請填寫核准備注（必填）</p>
            <textarea
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              rows={3}
              placeholder="例如：工作已交接安排完畢，同意請假"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setApproveId(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-brand-mocha text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleApproveConfirm}
                disabled={!approveNote.trim() || actionSubmitting}
                className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {actionSubmitting ? '處理中...' : '確認核准'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 駁回 Modal ── */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-oak mb-1">駁回請假</h3>
            <p className="text-xs text-brand-lotus mb-3">請填寫駁回原因（必填）</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="請輸入駁回原因"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-brand-mocha text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || actionSubmitting}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {actionSubmitting ? '處理中...' : '確認駁回'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 補傳診斷書 Modal ── */}
      {photoSubmitId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setPhotoSubmitId(null)}>
          <div className="bg-white rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-oak mb-1">補傳診斷書</h3>
            <p className="text-xs text-brand-lotus mb-3">請上傳診斷書照片（最多 3 張）</p>
            <div className="flex gap-2 flex-wrap mb-4">
              {photoFiles.map((f, i) => (
                <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border">
                  <img src={URL.createObjectURL(f)} alt={`診斷書 ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-0 right-0 w-5 h-5 bg-black/60 text-white text-xs flex items-center justify-center rounded-bl-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {photoFiles.length < 3 && (
                <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-brand-oak hover:text-brand-oak transition-colors">
                  <span className="text-2xl leading-none">📷</span>
                  <span className="text-[10px] mt-0.5">新增照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setPhotoFiles((prev) => [...prev, ...files].slice(0, 3))
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPhotoSubmitId(null)} className="flex-1 py-2 rounded-lg bg-gray-100 text-brand-mocha text-sm font-medium">取消</button>
              <button
                onClick={handlePhotoSubmit}
                disabled={photoFiles.length === 0 || photoSubmitting}
                className="flex-1 py-2 rounded-lg bg-brand-oak text-white text-sm font-medium disabled:opacity-50"
              >
                {photoSubmitting ? '上傳中...' : '確認送出'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShiftPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        shiftTypes={shiftTypes}
        positions={positions}
        current={pickerExisting ? {
          shift_type_id: pickerExisting.shift_type_id,
          custom_start: pickerExisting.custom_start,
          custom_end: pickerExisting.custom_end,
          note: pickerExisting.note,
          attendance_type: pickerExisting.attendance_type,
          position_id: pickerExisting.position_id,
        } : undefined}
        staffName={pickerStaffName}
        date={pickerDate}
        onSelect={handleSelect}
        onRemove={pickerExisting ? handleRemove : undefined}
      />

      <LeaveRequestModal
        open={leaveModalOpen}
        onClose={() => {
          setLeaveModalOpen(false)
          if (session?.staffId) fetchMyLeave(session.staffId)
        }}
        staffId={session?.staffId ?? ''}
        staffName={session?.staffName ?? ''}
        storeContext={SCOPE}
      />

      {/* 重送假單 Modal */}
      {resubmitRequest && (
        <LeaveRequestModal
          open={true}
          onClose={() => {
            setResubmitRequest(null)
            if (session?.staffId) fetchMyLeave(session.staffId)
          }}
          staffId={session?.staffId ?? ''}
          staffName={session?.staffName ?? ''}
          storeContext={SCOPE}
          rejectedRequest={resubmitRequest}
        />
      )}
    </div>
  )
}
