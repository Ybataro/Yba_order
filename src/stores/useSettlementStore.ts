import { create } from 'zustand'
import { settlementFields, settlementGroups, type SettlementField } from '@/data/settlementFields'
import { supabase } from '@/lib/supabase'

interface SettlementState {
  items: SettlementField[]
  groups: string[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  add: (field: SettlementField) => void
  update: (id: string, partial: Partial<SettlementField>) => void
  remove: (id: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  getByGroup: () => Map<string, SettlementField[]>
  renameGroup: (oldName: string, newName: string) => void
  addGroup: (name: string) => void
  removeGroup: (name: string) => void
}

export const useSettlementStore = create<SettlementState>()((set, get) => ({
  items: settlementFields,
  groups: [...settlementGroups],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const [fieldRes, catRes] = await Promise.all([
      supabase.from('settlement_fields').select('*').order('sort_order'),
      supabase.from('categories').select('*').eq('scope', 'settlement').order('sort_order'),
    ])
    if (fieldRes.data && fieldRes.data.length > 0) {
      set({
        items: fieldRes.data.map((d) => ({
          id: d.id,
          label: d.label,
          group: d.group_name,
          type: d.type as 'input' | 'text',
          multiplier: d.multiplier ?? undefined,
          unit: d.unit ?? undefined,
        })),
      })
    }
    if (catRes.data && catRes.data.length > 0) {
      set({ groups: catRes.data.map((c) => c.name) })
    }
    set({ loading: false, initialized: true })
  },

  add: (field) => {
    set((s) => ({ items: [...s.items, field] }))
    if (supabase) {
      supabase.from('settlement_fields').insert({
        id: field.id,
        label: field.label,
        group_name: field.group,
        type: field.type,
        multiplier: field.multiplier ?? null,
        unit: field.unit ?? null,
        sort_order: get().items.length - 1,
      }).then()
    }
  },

  update: (id, partial) => {
    set((s) => ({
      items: s.items.map((f) => (f.id === id ? { ...f, ...partial } : f)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.label !== undefined) db.label = partial.label
      if (partial.group !== undefined) db.group_name = partial.group
      if (partial.type !== undefined) db.type = partial.type
      if (partial.multiplier !== undefined) db.multiplier = partial.multiplier ?? null
      if (partial.unit !== undefined) db.unit = partial.unit ?? null
      if (Object.keys(db).length > 0) {
        supabase.from('settlement_fields').update(db).eq('id', id).then()
      }
    }
  },

  remove: (id) => {
    set((s) => ({ items: s.items.filter((f) => f.id !== id) }))
    if (supabase) {
      supabase.from('settlement_fields').delete().eq('id', id).then()
    }
  },

  reorder: (fromIdx, toIdx) => {
    set((s) => {
      const arr = [...s.items]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return { items: arr }
    })
    if (supabase) {
      const items = get().items
      const updates = items.map((item, i) =>
        supabase.from('settlement_fields').update({ sort_order: i }).eq('id', item.id)
      )
      Promise.all(updates).then()
    }
  },

  getByGroup: () => {
    const { items, groups } = get()
    const map = new Map<string, SettlementField[]>()
    for (const g of groups) {
      map.set(g, items.filter((f) => f.group === g))
    }
    return map
  },

  renameGroup: (oldName, newName) => {
    set((s) => ({
      groups: s.groups.map((g) => (g === oldName ? newName : g)),
      items: s.items.map((f) => (f.group === oldName ? { ...f, group: newName } : f)),
    }))
    if (supabase) {
      supabase.from('categories').update({ name: newName }).eq('scope', 'settlement').eq('name', oldName).then()
      supabase.from('settlement_fields').update({ group_name: newName }).eq('group_name', oldName).then()
    }
  },

  addGroup: (name) => {
    set((s) => ({ groups: [...s.groups, name] }))
    if (supabase) {
      supabase.from('categories').insert({
        scope: 'settlement',
        name,
        sort_order: get().groups.length - 1,
      }).then()
    }
  },

  removeGroup: (name) => {
    set((s) => ({
      groups: s.groups.filter((g) => g !== name),
      items: s.items.filter((f) => f.group !== name),
    }))
    if (supabase) {
      supabase.from('categories').delete().eq('scope', 'settlement').eq('name', name).then()
      supabase.from('settlement_fields').delete().eq('group_name', name).then()
    }
  },
}))
