import { create } from 'zustand'
import { rawMaterials, materialCategories, type RawMaterial } from '@/data/rawMaterials'
import { supabase } from '@/lib/supabase'

interface MaterialState {
  items: RawMaterial[]
  categories: string[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  add: (item: RawMaterial) => void
  update: (id: string, partial: Partial<RawMaterial>) => void
  remove: (id: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  getByCategory: () => Map<string, RawMaterial[]>
  renameCategory: (oldName: string, newName: string) => void
  addCategory: (name: string) => void
  removeCategory: (name: string) => void
  reorderCategory: (fromIdx: number, toIdx: number) => void
}

export const useMaterialStore = create<MaterialState>()((set, get) => ({
  items: rawMaterials,
  categories: [...materialCategories],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const [matRes, catRes] = await Promise.all([
      supabase.from('raw_materials').select('*').order('sort_order'),
      supabase.from('categories').select('*').eq('scope', 'material').order('sort_order'),
    ])
    if (matRes.data && matRes.data.length > 0) {
      set({
        items: matRes.data.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          spec: d.spec ?? '',
          unit: d.unit,
          notes: d.notes ?? undefined,
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
      supabase.from('raw_materials').insert({
        id: item.id,
        name: item.name,
        category: item.category,
        spec: item.spec,
        unit: item.unit,
        notes: item.notes ?? null,
        sort_order: get().items.length - 1,
      }).then()
    }
  },

  update: (id, partial) => {
    set((s) => ({
      items: s.items.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.name !== undefined) db.name = partial.name
      if (partial.category !== undefined) db.category = partial.category
      if (partial.spec !== undefined) db.spec = partial.spec
      if (partial.unit !== undefined) db.unit = partial.unit
      if (partial.notes !== undefined) db.notes = partial.notes ?? null
      if (Object.keys(db).length > 0) {
        supabase.from('raw_materials').update(db).eq('id', id).then()
      }
    }
  },

  remove: (id) => {
    set((s) => ({ items: s.items.filter((m) => m.id !== id) }))
    if (supabase) {
      supabase.from('raw_materials').delete().eq('id', id).then()
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
        supabase.from('raw_materials').update({ sort_order: i }).eq('id', item.id)
      )
      Promise.all(updates).then()
    }
  },

  getByCategory: () => {
    const { items, categories } = get()
    const map = new Map<string, RawMaterial[]>()
    for (const cat of categories) {
      map.set(cat, items.filter((m) => m.category === cat))
    }
    return map
  },

  renameCategory: (oldName, newName) => {
    set((s) => ({
      categories: s.categories.map((c) => (c === oldName ? newName : c)),
      items: s.items.map((m) => (m.category === oldName ? { ...m, category: newName } : m)),
    }))
    if (supabase) {
      supabase.from('categories').update({ name: newName }).eq('scope', 'material').eq('name', oldName).then()
      supabase.from('raw_materials').update({ category: newName }).eq('category', oldName).then()
    }
  },

  addCategory: (name) => {
    set((s) => ({ categories: [...s.categories, name] }))
    if (supabase) {
      supabase.from('categories').insert({
        scope: 'material',
        name,
        sort_order: get().categories.length - 1,
      }).then()
    }
  },

  removeCategory: (name) => {
    set((s) => ({
      categories: s.categories.filter((c) => c !== name),
      items: s.items.filter((m) => m.category !== name),
    }))
    if (supabase) {
      supabase.from('categories').delete().eq('scope', 'material').eq('name', name).then()
      supabase.from('raw_materials').delete().eq('category', name).then()
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
      const cats = get().categories
      const updates = cats.map((name, i) =>
        supabase.from('categories').update({ sort_order: i }).eq('scope', 'material').eq('name', name)
      )
      Promise.all(updates).then()
    }
  },
}))
