import { create } from 'zustand'
import { storeProducts, productCategories, type StoreProduct, type VisibleIn } from '@/data/storeProducts'
import { supabase } from '@/lib/supabase'

interface ProductState {
  items: StoreProduct[]
  categories: string[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  add: (item: StoreProduct) => void
  update: (id: string, partial: Partial<StoreProduct>) => void
  remove: (id: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  getByCategory: () => Map<string, StoreProduct[]>
  renameCategory: (oldName: string, newName: string) => void
  addCategory: (name: string) => void
  removeCategory: (name: string) => void
  reorderCategory: (fromIdx: number, toIdx: number) => void
}

export const useProductStore = create<ProductState>()((set, get) => ({
  items: storeProducts,
  categories: [...productCategories],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const [prodRes, catRes] = await Promise.all([
      supabase.from('store_products').select('*').order('sort_order'),
      supabase.from('categories').select('*').eq('scope', 'product').order('sort_order'),
    ])
    if (prodRes.data && prodRes.data.length > 0) {
      set({
        items: prodRes.data.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          unit: d.unit,
          shelfLifeDays: d.shelf_life_days ?? undefined,
          baseStock: d.base_stock ?? undefined,
          ourCost: d.our_cost ?? 0,
          franchisePrice: d.franchise_price ?? 0,
          visibleIn: (d.visible_in as VisibleIn) || 'both',
          linkable: d.linkable || false,
          linkedInventoryIds: d.linked_inventory_ids || [],
        })),
      })
    }
    if (catRes.data && catRes.data.length > 0) {
      set({ categories: catRes.data.map((c) => c.name) })
    }
    set({ loading: false, initialized: true })
  },

  add: (item) => {
    set((s) => ({ items: [...s.items, item] }))
    if (supabase) {
      supabase.from('store_products').insert({
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        shelf_life_days: item.shelfLifeDays != null ? String(item.shelfLifeDays) : null,
        base_stock: item.baseStock ?? null,
        our_cost: item.ourCost ?? 0,
        franchise_price: item.franchisePrice ?? 0,
        visible_in: item.visibleIn || 'both',
        linkable: item.linkable || false,
        linked_inventory_ids: item.linkedInventoryIds || [],
        sort_order: get().items.length - 1,
      }).then(({ error }) => {
        if (error) console.error('[store_products] insert failed:', error.message)
      })
    }
  },

  update: (id, partial) => {
    set((s) => ({
      items: s.items.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.name !== undefined) db.name = partial.name
      if (partial.category !== undefined) db.category = partial.category
      if (partial.unit !== undefined) db.unit = partial.unit
      if (partial.shelfLifeDays !== undefined) db.shelf_life_days = partial.shelfLifeDays != null ? String(partial.shelfLifeDays) : null
      if (partial.baseStock !== undefined) db.base_stock = partial.baseStock ?? null
      if (partial.ourCost !== undefined) db.our_cost = partial.ourCost ?? 0
      if (partial.franchisePrice !== undefined) db.franchise_price = partial.franchisePrice ?? 0
      if (partial.visibleIn !== undefined) db.visible_in = partial.visibleIn || 'both'
      if (partial.linkable !== undefined) db.linkable = partial.linkable
      if (partial.linkedInventoryIds !== undefined) db.linked_inventory_ids = partial.linkedInventoryIds
      if (Object.keys(db).length > 0) {
        supabase.from('store_products').update(db).eq('id', id).then(({ error }) => {
          if (error) console.error('[store_products] update failed:', error.message)
        })
      }
    }
  },

  remove: (id) => {
    set((s) => ({ items: s.items.filter((p) => p.id !== id) }))
    if (supabase) {
      supabase.from('store_products').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('[store_products] delete failed:', error.message)
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
        sb.from('store_products').update({ sort_order: i }).eq('id', item.id)
      )
      Promise.all(updates).then()
    }
  },

  getByCategory: () => {
    const { items, categories } = get()
    const map = new Map<string, StoreProduct[]>()
    for (const cat of categories) {
      map.set(cat, items.filter((p) => p.category === cat))
    }
    return map
  },

  renameCategory: (oldName, newName) => {
    set((s) => ({
      categories: s.categories.map((c) => (c === oldName ? newName : c)),
      items: s.items.map((p) => (p.category === oldName ? { ...p, category: newName } : p)),
    }))
    if (supabase) {
      supabase.from('categories').update({ name: newName }).eq('scope', 'product').eq('name', oldName).then()
      supabase.from('store_products').update({ category: newName }).eq('category', oldName).then()
    }
  },

  addCategory: (name) => {
    set((s) => ({ categories: [...s.categories, name] }))
    if (supabase) {
      supabase.from('categories').insert({
        scope: 'product',
        name,
        sort_order: get().categories.length - 1,
      }).then()
    }
  },

  removeCategory: (name) => {
    set((s) => ({
      categories: s.categories.filter((c) => c !== name),
      items: s.items.filter((p) => p.category !== name),
    }))
    if (supabase) {
      supabase.from('categories').delete().eq('scope', 'product').eq('name', name).then()
      supabase.from('store_products').delete().eq('category', name).then()
    }
  },

  reorderCategory: (fromIdx, toIdx) => {
    set((s) => {
      const arr = [...s.categories]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      return { categories: arr }
    })
    if (supabase) {
      const sb = supabase
      const cats = get().categories
      const updates = cats.map((name, i) =>
        sb.from('categories').update({ sort_order: i }).eq('scope', 'product').eq('name', name)
      )
      Promise.all(updates).then()
    }
  },
}))
