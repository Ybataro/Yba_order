import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { rawMaterials, materialCategories, type RawMaterial } from '@/data/rawMaterials'

interface MaterialState {
  items: RawMaterial[]
  categories: string[]
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

export const useMaterialStore = create<MaterialState>()(
  persist(
    (set, get) => ({
      items: rawMaterials,
      categories: [...materialCategories],

      add: (item) => set((s) => ({ items: [...s.items, item] })),

      update: (id, partial) =>
        set((s) => ({
          items: s.items.map((m) => (m.id === id ? { ...m, ...partial } : m)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((m) => m.id !== id) })),

      reorder: (fromIdx, toIdx) =>
        set((s) => {
          const arr = [...s.items]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, moved)
          return { items: arr }
        }),

      getByCategory: () => {
        const { items, categories } = get()
        const map = new Map<string, RawMaterial[]>()
        for (const cat of categories) {
          map.set(cat, items.filter((m) => m.category === cat))
        }
        return map
      },

      renameCategory: (oldName, newName) =>
        set((s) => ({
          categories: s.categories.map((c) => (c === oldName ? newName : c)),
          items: s.items.map((m) => (m.category === oldName ? { ...m, category: newName } : m)),
        })),

      addCategory: (name) =>
        set((s) => ({ categories: [...s.categories, name] })),

      removeCategory: (name) =>
        set((s) => ({
          categories: s.categories.filter((c) => c !== name),
          items: s.items.filter((m) => m.category !== name),
        })),

      reorderCategory: (fromIdx, toIdx) =>
        set((s) => {
          const arr = [...s.categories]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, moved)
          return { categories: arr }
        }),
    }),
    { name: 'yba-material-store' }
  )
)
