import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { WeekNav } from '@/components/WeekNav'
import { MonthNav } from '@/components/MonthNav'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { CalendarGrid } from '@/components/CalendarGrid'
import { ShiftPickerModal } from '@/components/ShiftPickerModal'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import { getWeekDates, getMonthDates, formatShortDate, getWeekdayLabel, toLocalDateString } from '@/lib/schedule'
import { getTodayString } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import { exportScheduleToPdf, exportCalendarScheduleToPdf } from '@/lib/exportSchedulePdf'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'
import { FileText, Printer, CalendarDays, LayoutGrid } from 'lucide-react'
import type { Schedule } from '@/lib/schedule'

export default function KitchenSchedules() {
  const [viewMode, setViewMode] = useState<'week' | 'calendar'>('week')
  const [refDate, setRefDate] = useState(getTodayString())
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const staffInitialized = useStaffStore((s) => s.initialized)
  const { shiftTypes, schedules, positions, fetchShiftTypes, fetchSchedules, fetchPositions, upsertSchedule, removeSchedule } = useScheduleStore()
  const canSchedule = useCanSchedule()
  const { showToast } = useToast()

  // Month state for calendar view
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const monthDates = useMemo(() => getMonthDates(calYear, calMonth), [calYear, calMonth])
  const staffIds = useMemo(() => kitchenStaff.map((s) => s.id), [kitchenStaff])

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerExisting, setPickerExisting] = useState<Schedule | undefined>()

  // Month schedules
  const [monthSchedules, setMonthSchedules] = useState<Schedule[]>([])

  useEffect(() => {
    fetchShiftTypes('kitchen')
    fetchPositions('kitchen')
  }, [fetchShiftTypes, fetchPositions])

  // Fetch week schedules
  useEffect(() => {
    if (viewMode === 'week' && staffInitialized && staffIds.length > 0) {
      fetchSchedules(staffIds, weekDates[0], weekDates[6])
    }
  }, [viewMode, staffInitialized, staffIds, weekDates, fetchSchedules])

  // Fetch month schedules
  useEffect(() => {
    if (viewMode === 'calendar' && staffInitialized && staffIds.length > 0 && monthDates.length > 0) {
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
      } else {
        fetchSchedules(staffIds, from, to)
      }
    }
  }, [viewMode, staffInitialized, staffIds, monthDates, fetchSchedules])

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
    // Refresh month schedules after edit
    if (viewMode === 'calendar' && staffIds.length > 0 && monthDates.length > 0 && supabase) {
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
          .then(({ data: refreshData }) => {
            if (refreshData) {
              setMonthSchedules(refreshData.map((s: Record<string, unknown>) => ({
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

  const handleRemove = () => {
    if (pickerExisting) {
      removeSchedule(pickerExisting.id)
      // Refresh month schedules after delete
      if (viewMode === 'calendar' && staffIds.length > 0 && monthDates.length > 0 && supabase) {
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
            .then(({ data: refreshData }) => {
              if (refreshData) {
                setMonthSchedules(refreshData.map((s: Record<string, unknown>) => ({
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
  }

  const pickerStaffName = kitchenStaff.find((s) => s.id === pickerStaffId)?.name || ''

  const handleWeekPdf = async () => {
    try {
      const week1 = weekDates
      const nextMon = new Date(week1[6] + 'T00:00:00+08:00')
      nextMon.setDate(nextMon.getDate() + 1)
      const week2 = getWeekDates(toLocalDateString(nextMon))
      const allDates = [...week1, ...week2]

      let allSchedules = schedules
      if (supabase && staffIds.length > 0) {
        const { data } = await supabase
          .from('schedules')
          .select('*')
          .in('staff_id', staffIds)
          .gte('date', allDates[0])
          .lte('date', allDates[allDates.length - 1])
        if (data) {
          allSchedules = data.map((s: Record<string, unknown>) => ({
            ...s,
            position_id: (s.position_id as string) ?? null,
            attendance_type: (s.attendance_type as string) ?? 'work',
            tags: (s.tags as string[]) || [],
          })) as Schedule[]
        }
      }

      const first = allDates[0]
      const last = allDates[allDates.length - 1]
      const range = `${formatShortDate(first)}（${getWeekdayLabel(first)}）～ ${formatShortDate(last)}（${getWeekdayLabel(last)}）`
      await exportScheduleToPdf({
        title: '央廚排班表',
        dateRange: range,
        weekDates: allDates,
        staff: kitchenStaff,
        schedules: allSchedules,
        shiftTypes,
        fileName: `央廚_排班表_${first}_${last}.pdf`,
      })
    } catch (e) {
      console.error('[PDF export error]', e)
      showToast('PDF 匯出失敗', 'error')
    }
  }

  const handleCalendarPdf = async () => {
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

      await exportCalendarScheduleToPdf({
        title: '央廚排班表',
        year: calYear,
        month: calMonth,
        staff: kitchenStaff,
        schedules: pdfSchedules,
        shiftTypes,
        fileName: `央廚_排班表_${calYear}年${calMonth}月.pdf`,
      })
    } catch (e) {
      console.error('[PDF export error]', e)
      showToast('PDF 匯出失敗', 'error')
    }
  }

  return (
    <div className="page-container">
      <TopNav title="央廚排班表" backTo="/kitchen" />

      {/* View mode tabs */}
      <div className="flex items-center gap-1 px-4 pt-2 no-print">
        <button
          onClick={() => setViewMode('week')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === 'week'
              ? 'bg-brand-oak text-white'
              : 'bg-gray-100 text-brand-mocha active:bg-gray-200'
          }`}
        >
          <LayoutGrid size={13} />
          週檢視
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

      {/* Navigation */}
      <div className="no-print">
        {viewMode === 'week' ? (
          <WeekNav refDate={refDate} onChange={setRefDate} />
        ) : (
          <MonthNav year={calYear} month={calMonth} onChange={(y, m) => { setCalYear(y); setCalMonth(m) }} />
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-1.5 px-4 py-2 no-print">
        <button
          onClick={viewMode === 'week' ? handleWeekPdf : handleCalendarPdf}
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
      </div>

      {/* Grid */}
      {viewMode === 'week' ? (
        <ScheduleGrid
          refDate={refDate}
          staff={kitchenStaff}
          schedules={schedules}
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
        />
      )}

      {!canSchedule && (
        <div className="mx-4 mt-4 px-3 py-2 rounded-lg bg-brand-lotus/10 text-brand-lotus text-xs font-medium text-center">
          唯讀模式 — 需排班權限才能編輯
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
    </div>
  )
}
