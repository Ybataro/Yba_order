import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { supabase } from '@/lib/supabase'
import { calcHours, getMonthDates, getAttendanceType } from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface StaffRow {
  id: string
  name: string
  group: string
  employment_type: string
  hourly_rate: number
  shifts: number
  hours: number
  estimated_pay: number
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: '正職',
  part_time: '兼職',
  hourly: '工讀',
}

export default function ScheduleStats() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [staffExtra, setStaffExtra] = useState<Record<string, { employment_type: string; hourly_rate: number }>>({})

  const { kitchenStaff, storeStaff } = useStaffStore()
  const stores = useStoreStore((s) => s.items)

  // All staff flat
  const allStaff = useMemo(() => {
    const list: { id: string; name: string; group: string }[] = []
    kitchenStaff.forEach((s) => list.push({ id: s.id, name: s.name, group: '央廚' }))
    Object.entries(storeStaff).forEach(([storeId, members]) => {
      const name = stores.find((st) => st.id === storeId)?.name || storeId
      members.forEach((s) => list.push({ id: s.id, name: s.name, group: name }))
    })
    return list
  }, [kitchenStaff, storeStaff, stores])

  const allStaffIds = useMemo(() => allStaff.map((s) => s.id), [allStaff])

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month])
  const startDate = monthDates[0]
  const endDate = monthDates[monthDates.length - 1]

  useEffect(() => {
    if (!supabase || allStaffIds.length === 0) { setLoading(false); return }

    const load = async () => {
      setLoading(true)
      const [schRes, stRes, staffRes] = await Promise.all([
        supabase!.from('schedules').select('*').in('staff_id', allStaffIds).gte('date', startDate).lte('date', endDate),
        supabase!.from('shift_types').select('*').eq('is_active', true),
        supabase!.from('staff').select('id, employment_type, hourly_rate').in('id', allStaffIds),
      ])
      setSchedules((schRes.data as Schedule[] | null) || [])
      setShiftTypes((stRes.data as ShiftType[] | null) || [])

      const extra: Record<string, { employment_type: string; hourly_rate: number }> = {}
      ;(staffRes.data || []).forEach((d: { id: string; employment_type: string; hourly_rate: number }) => {
        extra[d.id] = { employment_type: d.employment_type || 'full_time', hourly_rate: d.hourly_rate || 0 }
      })
      setStaffExtra(extra)
      setLoading(false)
    }
    load()
  }, [allStaffIds, startDate, endDate])

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftType> = {}
    shiftTypes.forEach((st) => { m[st.id] = st })
    return m
  }, [shiftTypes])

  // Calculate stats
  const rows: StaffRow[] = useMemo(() => {
    return allStaff.map((staff) => {
      const ext = staffExtra[staff.id] || { employment_type: 'full_time', hourly_rate: 0 }
      const staffSchedules = schedules.filter((s) => s.staff_id === staff.id)
      let totalHours = 0
      let workShifts = 0
      staffSchedules.forEach((s) => {
        // 只計算 countsAsWork 的出勤類型
        const at = (s as Schedule & { attendance_type?: string }).attendance_type || 'work'
        const atDef = getAttendanceType(at)
        if (atDef && !atDef.countsAsWork) return // 假別不計工時

        workShifts++
        if (s.shift_type_id && shiftMap[s.shift_type_id]) {
          const st = shiftMap[s.shift_type_id]
          totalHours += calcHours(st.start_time, st.end_time)
        } else if (s.custom_start && s.custom_end) {
          totalHours += calcHours(s.custom_start, s.custom_end)
        }
      })
      return {
        id: staff.id,
        name: staff.name,
        group: staff.group,
        employment_type: ext.employment_type,
        hourly_rate: ext.hourly_rate,
        shifts: workShifts,
        hours: Math.round(totalHours * 10) / 10,
        estimated_pay: Math.round(totalHours * ext.hourly_rate),
      }
    }).filter((r) => r.shifts > 0)
  }, [allStaff, schedules, shiftMap, staffExtra])

  // Group by employment type
  const grouped = useMemo(() => {
    const g: Record<string, StaffRow[]> = { full_time: [], part_time: [], hourly: [] }
    rows.forEach((r) => {
      if (!g[r.employment_type]) g[r.employment_type] = []
      g[r.employment_type].push(r)
    })
    return g
  }, [rows])

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  const totalShifts = rows.reduce((a, r) => a + r.shifts, 0)
  const totalHours = rows.reduce((a, r) => a + r.hours, 0)
  const totalPay = rows.reduce((a, r) => a + r.estimated_pay, 0)

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="工時統計" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="工時統計" backTo="/admin" />

      {/* Month picker */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
        <button onClick={prevMonth} className="p-1 rounded-lg active:bg-gray-100">
          <ChevronLeft size={18} className="text-brand-oak" />
        </button>
        <span className="flex-1 text-center text-sm font-medium text-brand-oak">
          {year} 年 {month} 月
        </span>
        <button onClick={nextMonth} className="p-1 rounded-lg active:bg-gray-100">
          <ChevronRight size={18} className="text-brand-oak" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">本月尚無排班資料</div>
      ) : (
        <>
          {Object.entries(grouped).map(([type, items]) => {
            if (items.length === 0) return null
            const subtotalShifts = items.reduce((a, r) => a + r.shifts, 0)
            const subtotalHours = items.reduce((a, r) => a + r.hours, 0)
            const subtotalPay = items.reduce((a, r) => a + r.estimated_pay, 0)

            return (
              <div key={type}>
                <SectionHeader title={`${EMPLOYMENT_LABELS[type] || type} (${items.length} 人)`} icon="■" />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px]">
                    <thead>
                      <tr className="bg-surface-section text-xs text-brand-mocha">
                        <th className="px-3 py-2 text-left font-medium">姓名</th>
                        <th className="px-2 py-2 text-center font-medium">單位</th>
                        <th className="px-2 py-2 text-right font-medium">班數</th>
                        <th className="px-2 py-2 text-right font-medium">工時</th>
                        <th className="px-2 py-2 text-right font-medium">時薪</th>
                        <th className="px-3 py-2 text-right font-medium">估算薪資</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-t border-gray-50">
                          <td className="px-3 py-2.5 text-sm font-medium text-brand-oak">{r.name}</td>
                          <td className="px-2 py-2.5 text-xs text-center text-brand-lotus">{r.group}</td>
                          <td className="px-2 py-2.5 text-sm text-right text-brand-oak">{r.shifts}</td>
                          <td className="px-2 py-2.5 text-sm text-right text-brand-oak">{r.hours}h</td>
                          <td className="px-2 py-2.5 text-sm text-right text-brand-mocha">${r.hourly_rate}</td>
                          <td className="px-3 py-2.5 text-sm text-right font-medium text-brand-oak">${r.estimated_pay.toLocaleString()}</td>
                        </tr>
                      ))}
                      {/* Subtotal */}
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-brand-mocha">小計</td>
                        <td className="px-2 py-2 text-sm text-right font-semibold text-brand-oak">{subtotalShifts}</td>
                        <td className="px-2 py-2 text-sm text-right font-semibold text-brand-oak">{Math.round(subtotalHours * 10) / 10}h</td>
                        <td className="px-2 py-2"></td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-brand-oak">${subtotalPay.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {/* Grand total */}
          <div className="mx-4 mt-4 mb-6 card !p-4">
            <h3 className="text-sm font-semibold text-brand-oak mb-2">全部合計</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-brand-lotus">{totalShifts}</p>
                <p className="text-[11px] text-brand-mocha">總班數</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">{Math.round(totalHours * 10) / 10}h</p>
                <p className="text-[11px] text-brand-mocha">總工時</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">${totalPay.toLocaleString()}</p>
                <p className="text-[11px] text-brand-mocha">估算薪資</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
