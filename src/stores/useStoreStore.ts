import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { stores, type Store } from '@/data/stores'

interface StoreState {
  items: Store[]
  add: (store: Store) => void
  update: (id: string, partial: Partial<Store>) => void
  remove: (id: string) => void
  getById: (id: string) => Store | undefined
  getName: (id: string) => string
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: stores,

      add: (store) => set((s) => ({ items: [...s.items, store] })),

      update: (id, partial) =>
        set((s) => ({
          items: s.items.map((st) => (st.id === id ? { ...st, ...partial } : st)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((st) => st.id !== id) })),

      getById: (id) => get().items.find((s) => s.id === id),

      getName: (id) => get().items.find((s) => s.id === id)?.name ?? '未知門店',
    }),
    { name: 'yba-store-store' }
  )
)
