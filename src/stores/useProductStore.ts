import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { storeProducts, productCategories, type StoreProduct } from '@/data/storeProducts'

interface ProductState {
  items: StoreProduct[]
  categories: string[]
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

export const useProductStore = create<ProductState>()(
  persist(
    (set, get) => ({
      items: storeProducts,
      categories: [...productCategories],

      add: (item) => set((s) => ({ items: [...s.items, item] })),

      update: (id, partial) =>
        set((s) => ({
          items: s.items.map((p) => (p.id === id ? { ...p, ...partial } : p)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((p) => p.id !== id) })),

      reorder: (fromIdx, toIdx) =>
        set((s) => {
          const arr = [...s.items]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, moved)
          return { items: arr }
        }),

      getByCategory: () => {
        const { items, categories } = get()
        const map = new Map<string, StoreProduct[]>()
        for (const cat of categories) {
          map.set(cat, items.filter((p) => p.category === cat))
        }
        return map
      },

      renameCategory: (oldName, newName) =>
        set((s) => ({
          categories: s.categories.map((c) => (c === oldName ? newName : c)),
          items: s.items.map((p) => (p.category === oldName ? { ...p, category: newName } : p)),
        })),

      addCategory: (name) =>
        set((s) => ({ categories: [...s.categories, name] })),

      removeCategory: (name) =>
        set((s) => ({
          categories: s.categories.filter((c) => c !== name),
          items: s.items.filter((p) => p.category !== name),
        })),

      reorderCategory: (fromIdx, toIdx) =>
        set((s) => {
          const arr = [...s.categories]
          const [moved] = arr.splice(fromIdx, 1)
          arr.splice(toIdx, 0, moved)
          return { categories: arr }
        }),
    }),
    { name: 'yba-product-store' }
  )
)
