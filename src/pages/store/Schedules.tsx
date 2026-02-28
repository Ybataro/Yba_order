import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { MonthNav } from '@/components/MonthNav'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { CalendarGrid } from '@/components/CalendarGrid'
import { ShiftPickerModal } from '@/components/ShiftPickerModal'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
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
import type { Schedule } from '@/lib/schedule'

export default function StoreSchedules() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('calendar')
  const staffList = useStaffStore((s) => s.getStoreStaff(storeId || ''))
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
  const staffIds = useMemo(() => staffList.map((s) => s.id), [staffList])

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerExisting, setPickerExisting] = useState<Schedule | undefined>()

  // Leave request state
  const [leaveModalOpen, setLeaveModalOpen] = useState(false)
  const session = getSession()
  const { requests: myLeaveRequests, fetchByStaff: fetchMyLeave, remove: removeLeave } = useLeaveStore()

  useEffect(() => {
    if (session?.staffId) fetchMyLeave(session.staffId)
  }, [session?.staffId, fetchMyLeave])

  // Month schedules (shared between both views)
  const [monthSchedules, setMonthSchedules] = useState<Schedule[]>([])

  useEffect(() => {
    if (storeId) {
      fetchShiftTypes(storeId)
      fetchPositions(storeId)
    }
  }, [storeId, fetchShiftTypes, fetchPositions])

  // Fetch month schedules (shared for both views)
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
    const session = getSession()
    upsertSchedule({
      staff_id: pickerStaffId,
      date: pickerDate,
      ...data,
      created_by: session?.staffId ?? null,
    })
    refreshMonthSchedules()
  }

  const handleRemove = () => {
    if (pickerExisting) {
      removeSchedule(pickerExisting.id)
      refreshMonthSchedules()
    }
  }

  const pickerStaffName = staffList.find((s) => s.id === pickerStaffId)?.name || ''

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
          title: `${storeName} 排班表`,
          dateRange: `${calYear}年${calMonth}月（${firstDate} ~ ${lastDate}）`,
          weekDates: monthDates,
          staff: staffList,
          schedules: pdfSchedules,
          shiftTypes,
          fileName: `${storeName}_月檢視_${calYear}年${calMonth}月.pdf`,
        })
      } else {
        await exportCalendarScheduleToPdf({
          title: `${storeName} 排班表`,
          year: calYear,
          month: calMonth,
          staff: staffList,
          schedules: pdfSchedules,
          shiftTypes,
          fileName: `${storeName}_排班表_${calYear}年${calMonth}月.pdf`,
        })
      }
    } catch (e) {
      console.error('[PDF export error]', e)
      showToast('PDF 匯出失敗', 'error')
    }
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 排班表`} backTo={`/store/${storeId}`} />

      {/* View mode tabs — only show for schedule managers */}
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

      {/* Navigation (shared MonthNav) */}
      <div className="no-print">
        <MonthNav year={calYear} month={calMonth} onChange={(y, m) => { setCalYear(y); setCalMonth(m) }} />
      </div>

      {/* Action buttons */}
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

      {/* Grid — non-schedulers always see calendar */}
      {canSchedule && viewMode === 'grid' ? (
        <ScheduleGrid
          dates={monthDates}
          staff={staffList}
          schedules={monthSchedules}
          shiftTypes={shiftTypes}
          canSchedule={canSchedule}
          onCellClick={handleCellClick}
        />
      ) : (
        <CalendarGrid
          year={calYear}
          month={calMonth}
          staff={staffList}
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

      {/* 我的請假申請 */}
      {session?.staffId && myLeaveRequests.length > 0 && (
        <div className="px-4 py-3 space-y-2 no-print">
          <h3 className="text-sm font-bold text-brand-oak">我的請假申請</h3>
          {myLeaveRequests.map((req) => (
            <LeaveRequestCard
              key={req.id}
              request={req}
              onDelete={req.status === 'pending' ? async () => {
                if (confirm('確定要刪除這筆請假申請嗎？')) {
                  const ok = await removeLeave(req.id)
                  if (ok) showToast('已刪除')
                  else showToast('刪除失敗', 'error')
                }
              } : undefined}
            />
          ))}
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
      />
    </div>
  )
}
