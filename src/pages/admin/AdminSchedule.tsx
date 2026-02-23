import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { GroupTabs } from '@/components/schedule/GroupTabs'
import { AdminScheduleToolbar, type PaintBrush } from '@/components/schedule/AdminScheduleToolbar'
import { AdminScheduleGrid } from '@/components/schedule/AdminScheduleGrid'
import { ScheduleEditModal } from '@/components/schedule/ScheduleEditModal'
import { ScheduleLegend } from '@/components/schedule/ScheduleLegend'
import { WeekNav } from '@/components/WeekNav'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { getWeekDates } from '@/lib/schedule'
import { getTodayString } from '@/lib/utils'
import { getSession } from '@/lib/auth'
import type { Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'
import { ArrowLeft } from 'lucide-react'

const KITCHEN_GROUP = { id: 'kitchen', label: '央廚' }

export default function AdminSchedule() {
  const navigate = useNavigate()
  const stores = useStoreStore((s) => s.items)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const storeStaff = useStaffStore((s) => s.storeStaff)

  const groups = useMemo(
    () => [KITCHEN_GROUP, ...stores.map((s) => ({ id: s.id, label: s.name }))],
    [stores]
  )

  const [activeGroup, setActiveGroup] = useState('kitchen')
  const [refDate, setRefDate] = useState(getTodayString())

  const {
    shiftTypes, schedules, positions, tagPresets,
    fetchShiftTypes, fetchSchedules, fetchPositions, fetchTagPresets,
    upsertSchedule, removeSchedule,
  } = useScheduleStore()

  // Current staff list based on active group
  const currentStaff: StaffMember[] = useMemo(() => {
    if (activeGroup === 'kitchen') return kitchenStaff
    return storeStaff[activeGroup] || []
  }, [activeGroup, kitchenStaff, storeStaff])

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate])
  const staffIds = useMemo(() => currentStaff.map((s) => s.id), [currentStaff])

  // Fetch tag presets once
  useEffect(() => { fetchTagPresets() }, [fetchTagPresets])

  // Fetch data when group/week changes
  useEffect(() => {
    fetchShiftTypes(activeGroup)
    fetchPositions(activeGroup)
  }, [activeGroup, fetchShiftTypes, fetchPositions])

  useEffect(() => {
    if (staffIds.length > 0) {
      fetchSchedules(staffIds, weekDates[0], weekDates[6])
    }
  }, [staffIds, weekDates, fetchSchedules])

  // Paint brush mode
  const [paintBrush, setPaintBrush] = useState<PaintBrush | null>(null)

  // ESC 鍵退出快速排班模式
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paintBrush) setPaintBrush(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [paintBrush])

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStaffId, setModalStaffId] = useState('')
  const [modalDate, setModalDate] = useState('')
  const [modalExisting, setModalExisting] = useState<Schedule | undefined>()

  const handleCellClick = useCallback((staffId: string, date: string, existing?: Schedule) => {
    if (paintBrush) {
      // Quick paint mode - directly upsert
      const session = getSession()
      upsertSchedule({
        staff_id: staffId,
        date,
        shift_type_id: paintBrush.shiftTypeId,
        custom_start: null,
        custom_end: null,
        note: '',
        attendance_type: paintBrush.attendanceType,
        position_id: paintBrush.positionId,
        tags: paintBrush.tags,
        created_by: session?.staffId ?? null,
      })
    } else {
      // Normal mode - open modal
      setModalStaffId(staffId)
      setModalDate(date)
      setModalExisting(existing)
      setModalOpen(true)
    }
  }, [paintBrush, upsertSchedule])

  const handleSave = useCallback((data: {
    shift_type_id: string | null
    custom_start: string | null
    custom_end: string | null
    note: string
    attendance_type: string
    position_id: string | null
    tags?: string[]
  }) => {
    const session = getSession()
    upsertSchedule({
      staff_id: modalStaffId,
      date: modalDate,
      ...data,
      created_by: session?.staffId ?? null,
    })
  }, [modalStaffId, modalDate, upsertSchedule])

  const handleRemove = useCallback(() => {
    if (modalExisting) {
      removeSchedule(modalExisting.id)
    }
  }, [modalExisting, removeSchedule])

  const modalStaffName = currentStaff.find((s) => s.id === modalStaffId)?.name || ''

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-brand-oak text-white">
        <button onClick={() => navigate('/admin')} className="p-1 rounded-lg hover:bg-white/20">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">排班管理</h1>
      </div>

      {/* Group tabs */}
      <GroupTabs groups={groups} activeGroup={activeGroup} onChange={setActiveGroup} />

      {/* Week navigation */}
      <WeekNav refDate={refDate} onChange={setRefDate} />

      {/* Toolbar */}
      <AdminScheduleToolbar
        shiftTypes={shiftTypes}
        positions={positions}
        tagPresets={tagPresets}
        paintBrush={paintBrush}
        onStartPaint={setPaintBrush}
        onClearPaint={() => setPaintBrush(null)}
      />

      {/* Grid */}
      <AdminScheduleGrid
        refDate={refDate}
        staff={currentStaff}
        schedules={schedules}
        shiftTypes={shiftTypes}
        positions={positions}
        paintBrush={paintBrush}
        onCellClick={handleCellClick}
      />

      {/* Legend */}
      <ScheduleLegend />

      {/* Edit modal */}
      <ScheduleEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        shiftTypes={shiftTypes}
        positions={positions}
        tagPresets={tagPresets}
        existing={modalExisting}
        staffName={modalStaffName}
        date={modalDate}
        onSave={handleSave}
        onRemove={modalExisting ? handleRemove : undefined}
      />
    </div>
  )
}
