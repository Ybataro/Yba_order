import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ShiftType, Schedule, Position } from '@/lib/schedule'

interface ScheduleState {
  shiftTypes: ShiftType[]
  schedules: Schedule[]
  positions: Position[]
  tagPresets: string[]
  loading: boolean

  fetchShiftTypes: (groupId: string) => Promise<void>
  fetchSchedules: (staffIds: string[], startDate: string, endDate: string) => Promise<void>
  upsertSchedule: (schedule: Partial<Schedule> & { staff_id: string; date: string }) => Promise<void>
  removeSchedule: (id: string) => Promise<void>
  batchUpsertSchedules: (records: Array<Partial<Schedule> & { staff_id: string; date: string }>) => Promise<void>

  // Admin CRUD for shift types
  addShiftType: (st: Omit<ShiftType, 'id'>) => Promise<void>
  updateShiftType: (id: string, partial: Partial<ShiftType>) => Promise<void>
  removeShiftType: (id: string) => Promise<void>

  // Positions CRUD
  fetchPositions: (groupId: string) => Promise<void>
  addPosition: (p: Omit<Position, 'id'>) => Promise<void>
  updatePosition: (id: string, partial: Partial<Position>) => Promise<void>
  removePosition: (id: string) => Promise<void>

  // Tag presets CRUD
  fetchTagPresets: () => Promise<void>
  addTagPreset: (name: string) => Promise<void>
  removeTagPreset: (name: string) => Promise<void>
}

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  shiftTypes: [],
  schedules: [],
  positions: [],
  tagPresets: [],
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
      set({ shiftTypes: data.map((d: Record<string, unknown>) => ({ ...d, tags: d.tags || [] })) as ShiftType[] })
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
    set({
      schedules: (data as Schedule[] | null)?.map((s) => ({
        ...s,
        position_id: s.position_id ?? null,
        attendance_type: s.attendance_type ?? 'work',
        tags: s.tags || [],
      })) || [],
      loading: false,
    })
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
      position_id: schedule.position_id ?? null,
      attendance_type: schedule.attendance_type ?? 'work',
      tags: schedule.tags ?? [],
      updated_at: new Date().toISOString(),
    }

    // Optimistic update
    set((s) => ({
      schedules: existing
        ? s.schedules.map((sc) => (sc.id === existing.id ? { ...sc, ...record } as Schedule : sc))
        : [...s.schedules, record as Schedule],
    }))

    const { error } = await supabase
      .from('schedules')
      .upsert(record, { onConflict: 'staff_id,date' })

    if (error) {
      console.error('排班儲存失敗:', error.message)
    }
  },

  batchUpsertSchedules: async (records) => {
    if (!supabase || records.length === 0) return

    const now = new Date().toISOString()
    const existingSchedules = get().schedules
    const upsertRecords = records.map((schedule) => {
      const existing = existingSchedules.find(
        (s) => s.staff_id === schedule.staff_id && s.date === schedule.date
      )
      return {
        id: existing?.id || `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        staff_id: schedule.staff_id,
        date: schedule.date,
        shift_type_id: schedule.shift_type_id ?? null,
        custom_start: schedule.custom_start ?? null,
        custom_end: schedule.custom_end ?? null,
        note: schedule.note ?? '',
        created_by: schedule.created_by ?? null,
        position_id: schedule.position_id ?? null,
        attendance_type: schedule.attendance_type ?? 'work',
        tags: schedule.tags ?? [],
        updated_at: now,
      }
    })

    // Optimistic update
    set((s) => {
      const newSchedules = [...s.schedules]
      upsertRecords.forEach((rec) => {
        const idx = newSchedules.findIndex(
          (sc) => sc.staff_id === rec.staff_id && sc.date === rec.date
        )
        if (idx >= 0) {
          newSchedules[idx] = { ...newSchedules[idx], ...rec }
        } else {
          newSchedules.push(rec as Schedule)
        }
      })
      return { schedules: newSchedules }
    })

    const { error } = await supabase
      .from('schedules')
      .upsert(upsertRecords, { onConflict: 'staff_id,date' })

    if (error) {
      console.error('批量排班儲存失敗:', error.message)
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
      .insert({ ...st, tags: st.tags || [] })
      .select()
      .single()
    if (error) {
      console.error('班次新增失敗:', error.message)
      return
    }
    if (data) {
      set((s) => ({ shiftTypes: [...s.shiftTypes, { ...data, tags: data.tags || [] } as ShiftType] }))
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

  // ── Positions CRUD ───────────────────────────────
  fetchPositions: async (groupId) => {
    if (!supabase) return
    const { data } = await supabase
      .from('positions')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order')
    if (data) {
      set({ positions: data as Position[] })
    }
  },

  addPosition: async (p) => {
    if (!supabase) return
    const { data, error } = await supabase
      .from('positions')
      .insert(p)
      .select()
      .single()
    if (error) {
      console.error('職位新增失敗:', error.message)
      return
    }
    if (data) {
      set((s) => ({ positions: [...s.positions, data as Position] }))
    }
  },

  updatePosition: async (id, partial) => {
    if (!supabase) return
    set((s) => ({
      positions: s.positions.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    }))
    const { error } = await supabase.from('positions').update(partial).eq('id', id)
    if (error) console.error('職位更新失敗:', error.message)
  },

  removePosition: async (id) => {
    if (!supabase) return
    set((s) => ({ positions: s.positions.filter((p) => p.id !== id) }))
    const { error } = await supabase
      .from('positions')
      .update({ is_active: false })
      .eq('id', id)
    if (error) console.error('職位刪除失敗:', error.message)
  },

  // ── Tag Presets CRUD ───────────────────────────────
  fetchTagPresets: async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('tag_presets')
      .select('name')
      .order('created_at')
    if (data) {
      set({ tagPresets: data.map((d: { name: string }) => d.name) })
    }
  },

  addTagPreset: async (name) => {
    if (!supabase || !name.trim()) return
    const trimmed = name.trim()
    if (get().tagPresets.includes(trimmed)) return
    set((s) => ({ tagPresets: [...s.tagPresets, trimmed] }))
    const { error } = await supabase
      .from('tag_presets')
      .insert({ name: trimmed })
    if (error) console.error('標籤新增失敗:', error.message)
  },

  removeTagPreset: async (name) => {
    if (!supabase) return
    set((s) => ({ tagPresets: s.tagPresets.filter((t) => t !== name) }))
    const { error } = await supabase
      .from('tag_presets')
      .delete()
      .eq('name', name)
    if (error) console.error('標籤刪除失敗:', error.message)
  },
}))
