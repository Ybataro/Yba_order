import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { FrozenProduct } from '@/lib/frozenProducts'
import { FROZEN_PRODUCTS as defaults } from '@/lib/frozenProducts'

interface FrozenProductState {
  items: FrozenProduct[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  add: (item: FrozenProduct) => void
  update: (key: string, partial: Partial<FrozenProduct>) => void
  remove: (key: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
}

export const useFrozenProductStore = create<FrozenProductState>()((set, get) => ({
  items: defaults,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const { data } = await supabase
      .from('frozen_product_defs')
      .select('*')
      .order('sort_order')
    if (data && data.length > 0) {
      set({
        items: data.map((d) => ({
          key: d.id,
          name: d.name,
          spec: d.spec,
          price: d.price,
        })),
      })
    }
    set({ loading: false, initialized: true })
  },

  add: (item) => {
    set((s) => ({ items: [...s.items, item] }))
    if (supabase) {
      supabase.from('frozen_product_defs').insert({
        id: item.key,
        name: item.name,
        spec: item.spec,
        price: item.price,
        sort_order: get().items.length - 1,
      }).then(({ error }) => {
        if (error) console.error('[frozen_product_defs] insert failed:', error.message)
      })
    }
  },

  update: (key, partial) => {
    set((s) => ({
      items: s.items.map((p) => (p.key === key ? { ...p, ...partial } : p)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.name !== undefined) db.name = partial.name
      if (partial.spec !== undefined) db.spec = partial.spec
      if (partial.price !== undefined) db.price = partial.price
      if (partial.key !== undefined) db.id = partial.key
      if (Object.keys(db).length > 0) {
        supabase.from('frozen_product_defs').update(db).eq('id', key).then(({ error }) => {
          if (error) console.error('[frozen_product_defs] update failed:', error.message)
        })
      }
    }
  },

  remove: (key) => {
    set((s) => ({ items: s.items.filter((p) => p.key !== key) }))
    if (supabase) {
      supabase.from('frozen_product_defs').delete().eq('id', key).then(({ error }) => {
        if (error) console.error('[frozen_product_defs] delete failed:', error.message)
      })
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
      const sb = supabase
      const items = get().items
      const updates = items.map((item, i) =>
        sb.from('frozen_product_defs').update({ sort_order: i }).eq('id', item.key)
      )
      Promise.all(updates).then()
    }
  },
}))
