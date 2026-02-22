import { create } from 'zustand'
import { adminStaff as defaultAdmin, kitchenStaff as defaultKitchen, storeStaff as defaultStore, type StaffMember } from '@/data/staff'
import { supabase } from '@/lib/supabase'

interface StaffState {
  adminStaff: StaffMember[]
  kitchenStaff: StaffMember[]
  storeStaff: Record<string, StaffMember[]>
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  addAdmin: (member: StaffMember) => void
  updateAdmin: (id: string, partial: Partial<StaffMember>) => void
  removeAdmin: (id: string) => void
  addKitchen: (member: StaffMember) => void
  updateKitchen: (id: string, partial: Partial<StaffMember>) => void
  removeKitchen: (id: string) => void
  addStore: (storeId: string, member: StaffMember) => void
  updateStore: (storeId: string, id: string, partial: Partial<StaffMember>) => void
  removeStore: (storeId: string, id: string) => void
  getStoreStaff: (storeId: string) => StaffMember[]
  reorderGroup: (groupId: string, members: StaffMember[]) => void
}

export const useStaffStore = create<StaffState>()((set, get) => ({
  adminStaff: defaultAdmin,
  kitchenStaff: defaultKitchen,
  storeStaff: defaultStore,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const { data } = await supabase
      .from('staff')
      .select('*')
      .order('sort_order')
    if (data && data.length > 0) {
      const admin: StaffMember[] = []
      const kitchen: StaffMember[] = []
      const storeMap: Record<string, StaffMember[]> = {}
      for (const d of data) {
        const member = { id: d.id, name: d.name }
        if (d.group_id === 'admin') {
          admin.push(member)
        } else if (d.group_id === 'kitchen') {
          kitchen.push(member)
        } else {
          if (!storeMap[d.group_id]) storeMap[d.group_id] = []
          storeMap[d.group_id].push(member)
        }
      }
      set({ adminStaff: admin, kitchenStaff: kitchen, storeStaff: storeMap })
    }
    set({ loading: false, initialized: true })
  },

  addAdmin: (member) => {
    set((s) => ({ adminStaff: [...s.adminStaff, member] }))
    if (supabase) {
      supabase.from('staff').insert({
        id: member.id,
        name: member.name,
        group_id: 'admin',
        sort_order: get().adminStaff.length - 1,
      }).then()
    }
  },

  updateAdmin: (id, partial) => {
    set((s) => ({
      adminStaff: s.adminStaff.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }))
    if (supabase && partial.name !== undefined) {
      supabase.from('staff').update({ name: partial.name }).eq('id', id).then()
    }
  },

  removeAdmin: (id) => {
    set((s) => ({ adminStaff: s.adminStaff.filter((m) => m.id !== id) }))
    if (supabase) {
      supabase.from('staff').delete().eq('id', id).then()
    }
  },

  addKitchen: (member) => {
    set((s) => ({ kitchenStaff: [...s.kitchenStaff, member] }))
    if (supabase) {
      supabase.from('staff').insert({
        id: member.id,
        name: member.name,
        group_id: 'kitchen',
        sort_order: get().kitchenStaff.length - 1,
      }).then()
    }
  },

  updateKitchen: (id, partial) => {
    set((s) => ({
      kitchenStaff: s.kitchenStaff.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }))
    if (supabase && partial.name !== undefined) {
      supabase.from('staff').update({ name: partial.name }).eq('id', id).then()
    }
  },

  removeKitchen: (id) => {
    set((s) => ({ kitchenStaff: s.kitchenStaff.filter((m) => m.id !== id) }))
    if (supabase) {
      supabase.from('staff').delete().eq('id', id).then()
    }
  },

  addStore: (storeId, member) => {
    set((s) => ({
      storeStaff: {
        ...s.storeStaff,
        [storeId]: [...(s.storeStaff[storeId] || []), member],
      },
    }))
    if (supabase) {
      const list = get().storeStaff[storeId] || []
      supabase.from('staff').insert({
        id: member.id,
        name: member.name,
        group_id: storeId,
        sort_order: list.length - 1,
      }).then()
    }
  },

  updateStore: (storeId, id, partial) => {
    set((s) => ({
      storeStaff: {
        ...s.storeStaff,
        [storeId]: (s.storeStaff[storeId] || []).map((m) =>
          m.id === id ? { ...m, ...partial } : m
        ),
      },
    }))
    if (supabase && partial.name !== undefined) {
      supabase.from('staff').update({ name: partial.name }).eq('id', id).then()
    }
  },

  removeStore: (storeId, id) => {
    set((s) => ({
      storeStaff: {
        ...s.storeStaff,
        [storeId]: (s.storeStaff[storeId] || []).filter((m) => m.id !== id),
      },
    }))
    if (supabase) {
      supabase.from('staff').delete().eq('id', id).then()
    }
  },

  getStoreStaff: (storeId) => get().storeStaff[storeId] || [],

  reorderGroup: (groupId, members) => {
    if (groupId === 'admin') {
      set({ adminStaff: members })
    } else if (groupId === 'kitchen') {
      set({ kitchenStaff: members })
    } else {
      set((s) => ({ storeStaff: { ...s.storeStaff, [groupId]: members } }))
    }
    if (supabase) {
      members.forEach((m, i) => {
        supabase!.from('staff').update({ sort_order: i }).eq('id', m.id).then()
      })
    }
  },
}))
