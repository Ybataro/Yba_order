import { create } from 'zustand'
import { stores as defaultStores, type Store } from '@/data/stores'
import { supabase } from '@/lib/supabase'

interface StoreState {
  items: Store[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  add: (store: Store) => void
  update: (id: string, partial: Partial<Store>) => void
  remove: (id: string) => void
  getById: (id: string) => Store | undefined
  getName: (id: string) => string
}

export const useStoreStore = create<StoreState>()((set, get) => ({
  items: defaultStores,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const { data } = await supabase
      .from('stores')
      .select('*')
      .order('sort_order')
    if (data && data.length > 0) {
      set({
        items: data.map((d) => ({ id: d.id, name: d.name, code: d.code })),
      })
    }
    set({ loading: false, initialized: true })
  },

  add: (store) => {
    set((s) => ({ items: [...s.items, store] }))
    if (supabase) {
      supabase.from('stores').insert({
        id: store.id,
        name: store.name,
        code: store.code,
        sort_order: get().items.length - 1,
      }).then()
    }
  },

  update: (id, partial) => {
    set((s) => ({
      items: s.items.map((st) => (st.id === id ? { ...st, ...partial } : st)),
    }))
    if (supabase) {
      const dbPartial: Record<string, unknown> = {}
      if (partial.name !== undefined) dbPartial.name = partial.name
      if (partial.code !== undefined) dbPartial.code = partial.code
      if (Object.keys(dbPartial).length > 0) {
        supabase.from('stores').update(dbPartial).eq('id', id).then()
      }
    }
  },

  remove: (id) => {
    set((s) => ({ items: s.items.filter((st) => st.id !== id) }))
    if (supabase) {
      supabase.from('stores').delete().eq('id', id).then()
    }
  },

  getById: (id) => get().items.find((s) => s.id === id),

  getName: (id) => get().items.find((s) => s.id === id)?.name ?? '未知門店',
}))
