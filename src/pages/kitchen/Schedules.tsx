import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { WeekNav } from '@/components/WeekNav'
import { ScheduleGrid } from '@/components/ScheduleGrid'
import { ShiftPickerModal } from '@/components/ShiftPickerModal'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import { getWeekDates } from '@/lib/schedule'
import { getTodayString } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import type { Schedule } from '@/lib/schedule'

export default function KitchenSchedules() {
  const [refDate, setRefDate] = useState(getTodayString())
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const staffInitialized = useStaffStore((s) => s.initialized)
  const { shiftTypes, schedules, positions, fetchShiftTypes, fetchSchedules, fetchPositions, upsertSchedule, removeSchedule } = useScheduleStore()
  const canSchedule = useCanSchedule()

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const staffIds = useMemo(() => kitchenStaff.map((s) => s.id), [kitchenStaff])

  // Modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerStaffId, setPickerStaffId] = useState('')
  const [pickerDate, setPickerDate] = useState('')
  const [pickerExisting, setPickerExisting] = useState<Schedule | undefined>()

  useEffect(() => {
    fetchShiftTypes('kitchen')
    fetchPositions('kitchen')
  }, [fetchShiftTypes, fetchPositions])

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

  const pickerStaffName = kitchenStaff.find((s) => s.id === pickerStaffId)?.name || ''

  return (
    <div className="page-container">
      <TopNav title="央廚排班表" backTo="/kitchen" />
      <WeekNav refDate={refDate} onChange={setRefDate} />

      <ScheduleGrid
        refDate={refDate}
        staff={kitchenStaff}
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
