import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { settlementFields, settlementGroups, type SettlementField } from '@/data/settlementFields'

interface SettlementState {
  items: SettlementField[]
  groups: string[]
  add: (field: SettlementField) => void
  update: (id: string, partial: Partial<SettlementField>) => void
  remove: (id: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  getByGroup: () => Map<string, SettlementField[]>
  renameGroup: (oldName: string, newName: string) => void
  addGroup: (name: string) => void
  removeGroup: (name: string) => void
}

export const useSettlementStore = create<SettlementState>()(
  persist(
    (set, get) => ({
      items: settlementFields,
      groups: [...settlementGroups],

      add: (field) => set((s) => ({ items: [...s.items, field] })),

      update: (id, partial) =>
        set((s) => ({
          items: s.items.map((f) => (f.id === id ? { ...f, ...partial } : f)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((f) => f.id !== id) })),

      reorder: (fromIdx, toIdx) =>
        set((s) => {
          const arr = [...s.items]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, moved)
          return { items: arr }
        }),

      getByGroup: () => {
        const { items, groups } = get()
        const map = new Map<string, SettlementField[]>()
        for (const g of groups) {
          map.set(g, items.filter((f) => f.group === g))
        }
        return map
      },

      renameGroup: (oldName, newName) =>
        set((s) => ({
          groups: s.groups.map((g) => (g === oldName ? newName : g)),
          items: s.items.map((f) => (f.group === oldName ? { ...f, group: newName } : f)),
        })),

      addGroup: (name) =>
        set((s) => ({ groups: [...s.groups, name] })),

      removeGroup: (name) =>
        set((s) => ({
          groups: s.groups.filter((g) => g !== name),
          items: s.items.filter((f) => f.group !== name),
        })),
    }),
    { name: 'yba-settlement-store' }
  )
)
