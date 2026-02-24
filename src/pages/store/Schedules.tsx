import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { WeekNav } from '@/components/WeekNav'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { ShiftPickerModal } from '@/components/ShiftPickerModal'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import { getWeekDates, formatShortDate, getWeekdayLabel } from '@/lib/schedule'
import { getTodayString } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import { exportScheduleToPdf } from '@/lib/exportSchedulePdf'
import { FileText, Printer } from 'lucide-react'
import type { Schedule } from '@/lib/schedule'

export default function StoreSchedules() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const [refDate, setRefDate] = useState(getTodayString())
  const staffList = useStaffStore((s) => s.getStoreStaff(storeId || ''))
  const staffInitialized = useStaffStore((s) => s.initialized)
  const { shiftTypes, schedules, positions, fetchShiftTypes, fetchSchedules, fetchPositions, upsertSchedule, removeSchedule } = useScheduleStore()
  const canSchedule = useCanSchedule()

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const staffIds = useMemo(() => staffList.map((s) => s.id), [staffList])

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerExisting, setPickerExisting] = useState<Schedule | undefined>()

  useEffect(() => {
    if (storeId) {
      fetchShiftTypes(storeId)
      fetchPositions(storeId)
    }
  }, [storeId, fetchShiftTypes, fetchPositions])

  useEffect(() => {
    if (staffInitialized && staffIds.length > 0) {
      fetchSchedules(staffIds, weekDates[0], weekDates[6])
    }
  }, [staffInitialized, staffIds, weekDates, fetchSchedules])

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
  }

  const handleRemove = () => {
    if (pickerExisting) {
      removeSchedule(pickerExisting.id)
    }
  }

  const pickerStaffName = staffList.find((s) => s.id === pickerStaffId)?.name || ''

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 排班表`} backTo={`/store/${storeId}`} />
      <div className="no-print">
        <WeekNav refDate={refDate} onChange={setRefDate} />
      </div>

      <div className="flex items-center justify-end gap-1.5 px-4 py-2 no-print">
        <button
          onClick={() => {
            const mon = weekDates[0]
            const sun = weekDates[6]
            const range = `${formatShortDate(mon)}（${getWeekdayLabel(mon)}）～ ${formatShortDate(sun)}（${getWeekdayLabel(sun)}）`
            exportScheduleToPdf({
              title: `${storeName} 排班表`,
              dateRange: range,
              weekDates,
              staff: staffList,
              schedules,
              shiftTypes,
              fileName: `${storeName}_排班表_${mon}_${sun}.pdf`,
            })
          }}
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

      <ScheduleGrid
        refDate={refDate}
        staff={staffList}
        schedules={schedules}
        shiftTypes={shiftTypes}
        canSchedule={canSchedule}
        onCellClick={handleCellClick}
      />

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
