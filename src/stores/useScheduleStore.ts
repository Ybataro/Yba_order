import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ShiftType, Schedule } from '@/lib/schedule'

interface ScheduleState {
  shiftTypes: ShiftType[]
  schedules: Schedule[]
  loading: boolean

  fetchShiftTypes: (groupId: string) => Promise<void>
  fetchSchedules: (staffIds: string[], startDate: string, endDate: string) => Promise<void>
  upsertSchedule: (schedule: Partial<Schedule> & { staff_id: string; date: string }) => Promise<void>
  removeSchedule: (id: string) => Promise<void>

  // Admin CRUD for shift types
  addShiftType: (st: Omit<ShiftType, 'id'>) => Promise<void>
  updateShiftType: (id: string, partial: Partial<ShiftType>) => Promise<void>
  removeShiftType: (id: string) => Promise<void>
}

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  shiftTypes: [],
  schedules: [],
  loading: false,

  fetchShiftTypes: async (groupId) => {
    if (!supabase) return
    const { data } = await supabase
      .from('shift_types')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order')
    if (data) {
      set({ shiftTypes: data as ShiftType[] })
    }
  },

  fetchSchedules: async (staffIds, startDate, endDate) => {
    if (!supabase || staffIds.length === 0) {
      set({ schedules: [] })
      return
    }
    set({ loading: true })
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .in('staff_id', staffIds)
      .gte('date', startDate)
      .lte('date', endDate)
    set({ schedules: (data as Schedule[] | null) || [], loading: false })
  },

  upsertSchedule: async (schedule) => {
    if (!supabase) return
    const existing = get().schedules.find(
      (s) => s.staff_id === schedule.staff_id && s.date === schedule.date
    )

    const id = existing?.id || `sch_${Date.now()}`
    const record = {
      id,
      staff_id: schedule.staff_id,
      date: schedule.date,
      shift_type_id: schedule.shift_type_id ?? null,
      custom_start: schedule.custom_start ?? null,
      custom_end: schedule.custom_end ?? null,
      note: schedule.note ?? '',
      created_by: schedule.created_by ?? null,
      updated_at: new Date().toISOString(),
    }

    // Optimistic update
    set((s) => ({
      schedules: existing
        ? s.schedules.map((sc) => (sc.id === existing.id ? { ...sc, ...record } : sc))
        : [...s.schedules, record as Schedule],
    }))

    const { error } = await supabase
      .from('schedules')
      .upsert(record, { onConflict: 'staff_id,date' })

    if (error) {
      console.error('排班儲存失敗:', error.message)
    }
  },

  removeSchedule: async (id) => {
    if (!supabase) return
    // Optimistic
    set((s) => ({ schedules: s.schedules.filter((sc) => sc.id !== id) }))
    const { error } = await supabase.from('schedules').delete().eq('id', id)
    if (error) console.error('排班刪除失敗:', error.message)
  },

  addShiftType: async (st) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('shift_types')
      .insert(st)
      .select()
      .single()
    if (error) {
      console.error('班次新增失敗:', error.message)
      return
    }
    if (data) {
      set((s) => ({ shiftTypes: [...s.shiftTypes, data as ShiftType] }))
    }
  },

  updateShiftType: async (id, partial) => {
    if (!supabase) return
    set((s) => ({
      shiftTypes: s.shiftTypes.map((st) => (st.id === id ? { ...st, ...partial } : st)),
    }))
    const { error } = await supabase.from('shift_types').update(partial).eq('id', id)
    if (error) console.error('班次更新失敗:', error.message)
  },

  removeShiftType: async (id) => {
    if (!supabase) return
    set((s) => ({ shiftTypes: s.shiftTypes.filter((st) => st.id !== id) }))
    const { error } = await supabase
      .from('shift_types')
      .update({ is_active: false })
      .eq('id', id)
    if (error) console.error('班次刪除失敗:', error.message)
  },
}))
