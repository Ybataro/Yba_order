import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { kitchenStaff, storeStaff, type StaffMember } from '@/data/staff'

interface StaffState {
  kitchenStaff: StaffMember[]
  storeStaff: Record<string, StaffMember[]>
  addKitchen: (member: StaffMember) => void
  updateKitchen: (id: string, partial: Partial<StaffMember>) => void
  removeKitchen: (id: string) => void
  addStore: (storeId: string, member: StaffMember) => void
  updateStore: (storeId: string, id: string, partial: Partial<StaffMember>) => void
  removeStore: (storeId: string, id: string) => void
  getStoreStaff: (storeId: string) => StaffMember[]
}

export const useStaffStore = create<StaffState>()(
  persist(
    (set, get) => ({
      kitchenStaff: kitchenStaff,
      storeStaff: storeStaff,

      addKitchen: (member) =>
        set((s) => ({ kitchenStaff: [...s.kitchenStaff, member] })),

      updateKitchen: (id, partial) =>
        set((s) => ({
          kitchenStaff: s.kitchenStaff.map((m) => (m.id === id ? { ...m, ...partial } : m)),
        })),

      removeKitchen: (id) =>
        set((s) => ({ kitchenStaff: s.kitchenStaff.filter((m) => m.id !== id) })),

      addStore: (storeId, member) =>
        set((s) => ({
          storeStaff: {
            ...s.storeStaff,
            [storeId]: [...(s.storeStaff[storeId] || []), member],
          },
        })),

      updateStore: (storeId, id, partial) =>
        set((s) => ({
          storeStaff: {
            ...s.storeStaff,
            [storeId]: (s.storeStaff[storeId] || []).map((m) =>
              m.id === id ? { ...m, ...partial } : m
            ),
          },
        })),

      removeStore: (storeId, id) =>
        set((s) => ({
          storeStaff: {
            ...s.storeStaff,
            [storeId]: (s.storeStaff[storeId] || []).filter((m) => m.id !== id),
          },
        })),

      getStoreStaff: (storeId) => get().storeStaff[storeId] || [],
    }),
    { name: 'yba-staff-store' }
  )
)
