import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Recipe, RecipeIngredient, MenuItem, MenuItemIngredient } from '@/lib/costAnalysis'

interface CostState {
  recipes: Recipe[]
  menuItems: MenuItem[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  // Recipe CRUD
  addRecipe: (recipe: Recipe) => void
  updateRecipe: (id: string, partial: Partial<Omit<Recipe, 'ingredients'>>) => void
  removeRecipe: (id: string) => void
  setRecipeIngredients: (recipeId: string, ingredients: RecipeIngredient[]) => void
  // MenuItem CRUD
  addMenuItem: (item: MenuItem) => void
  updateMenuItem: (id: string, partial: Partial<Omit<MenuItem, 'ingredients'>>) => void
  removeMenuItem: (id: string) => void
  setMenuItemIngredients: (menuItemId: string, ingredients: MenuItemIngredient[]) => void
}

function buildRecipeIngRow(ri: RecipeIngredient) {
  return {
    id: ri.id,
    recipe_id: ri.recipe_id,
    material_id: ri.material_id ?? null,
    custom_name: ri.custom_name ?? null,
    custom_price_per_g: ri.custom_price_per_g ?? null,
    amount_g: ri.amount_g,
    sort_order: ri.sort_order,
  }
}

function buildMenuIngRow(mii: MenuItemIngredient) {
  return {
    id: mii.id,
    menu_item_id: mii.menu_item_id,
    recipe_id: mii.recipe_id ?? null,
    material_id: mii.material_id ?? null,
    custom_name: mii.custom_name ?? null,
    custom_cost: mii.custom_cost ?? null,
    amount_g: mii.amount_g,
    sort_order: mii.sort_order,
  }
}

export const useCostStore = create<CostState>()((set, get) => ({
  recipes: [],
  menuItems: [],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })

    const [recipeRes, riRes, miRes, miiRes] = await Promise.all([
      supabase.from('recipes').select('*').order('sort_order'),
      supabase.from('recipe_ingredients').select('*').order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
      supabase.from('menu_item_ingredients').select('*').order('sort_order'),
    ])

    const recipes: Recipe[] = (recipeRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      unit: r.unit,
      total_weight_g: Number(r.total_weight_g) || 0,
      solid_weight_g: r.solid_weight_g != null ? Number(r.solid_weight_g) : null,
      liquid_weight_g: r.liquid_weight_g != null ? Number(r.liquid_weight_g) : null,
      store_product_id: r.store_product_id ?? null,
      notes: r.notes ?? '',
      sort_order: r.sort_order ?? 0,
      ingredients: (riRes.data ?? [])
        .filter((ri) => ri.recipe_id === r.id)
        .map((ri) => ({
          id: ri.id,
          recipe_id: ri.recipe_id,
          material_id: ri.material_id ?? null,
          custom_name: ri.custom_name ?? null,
          custom_price_per_g: ri.custom_price_per_g != null ? Number(ri.custom_price_per_g) : null,
          amount_g: Number(ri.amount_g) || 0,
          sort_order: ri.sort_order ?? 0,
        })),
    }))

    const menuItems: MenuItem[] = (miRes.data ?? []).map((mi) => ({
      id: mi.id,
      name: mi.name,
      serving_g: mi.serving_g != null ? Number(mi.serving_g) : null,
      selling_price: Number(mi.selling_price) || 0,
      notes: mi.notes ?? '',
      sort_order: mi.sort_order ?? 0,
      ingredients: (miiRes.data ?? [])
        .filter((mii) => mii.menu_item_id === mi.id)
        .map((mii) => ({
          id: mii.id,
          menu_item_id: mii.menu_item_id,
          recipe_id: mii.recipe_id ?? null,
          material_id: mii.material_id ?? null,
          custom_name: mii.custom_name ?? null,
          custom_cost: mii.custom_cost != null ? Number(mii.custom_cost) : null,
          amount_g: Number(mii.amount_g) || 0,
          sort_order: mii.sort_order ?? 0,
        })),
    }))

    set({ recipes, menuItems, loading: false, initialized: true })
  },

  // ─── Recipe ───

  addRecipe: (recipe) => {
    set((s) => ({ recipes: [...s.recipes, recipe] }))
    if (supabase) {
      // 必須先 insert recipe，再 insert ingredients（FK 依賴）
      supabase.from('recipes').insert({
        id: recipe.id,
        name: recipe.name,
        unit: recipe.unit,
        total_weight_g: recipe.total_weight_g,
        solid_weight_g: recipe.solid_weight_g ?? null,
        liquid_weight_g: recipe.liquid_weight_g ?? null,
        store_product_id: recipe.store_product_id ?? null,
        notes: recipe.notes,
        sort_order: recipe.sort_order,
      }).then(({ error }) => {
        if (error) { console.error('addRecipe error:', error); return }
        if (recipe.ingredients.length > 0) {
          supabase!.from('recipe_ingredients')
            .insert(recipe.ingredients.map(buildRecipeIngRow))
            .then(({ error: e2 }) => { if (e2) console.error('addRecipeIngredients error:', e2) })
        }
      })
    }
  },

  updateRecipe: (id, partial) => {
    set((s) => ({
      recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.name !== undefined) db.name = partial.name
      if (partial.unit !== undefined) db.unit = partial.unit
      if (partial.total_weight_g !== undefined) db.total_weight_g = partial.total_weight_g
      if (partial.solid_weight_g !== undefined) db.solid_weight_g = partial.solid_weight_g ?? null
      if (partial.liquid_weight_g !== undefined) db.liquid_weight_g = partial.liquid_weight_g ?? null
      if (partial.store_product_id !== undefined) db.store_product_id = partial.store_product_id ?? null
      if (partial.notes !== undefined) db.notes = partial.notes
      if (partial.sort_order !== undefined) db.sort_order = partial.sort_order
      if (Object.keys(db).length > 0) {
        supabase.from('recipes').update(db).eq('id', id).then()
      }
    }
  },

  removeRecipe: (id) => {
    set((s) => ({ recipes: s.recipes.filter((r) => r.id !== id) }))
    if (supabase) {
      supabase.from('recipes').delete().eq('id', id).then()
    }
  },

  setRecipeIngredients: (recipeId, ingredients) => {
    set((s) => ({
      recipes: s.recipes.map((r) =>
        r.id === recipeId ? { ...r, ingredients } : r
      ),
    }))
    if (supabase) {
      // 必須先 delete 完成，再 insert（避免 PK 衝突或資料遺失）
      supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
        .then(({ error }) => {
          if (error) { console.error('deleteRecipeIngredients error:', error); return }
          if (ingredients.length > 0) {
            supabase!.from('recipe_ingredients')
              .insert(ingredients.map(buildRecipeIngRow))
              .then(({ error: e2 }) => { if (e2) console.error('insertRecipeIngredients error:', e2) })
          }
        })
    }
  },

  // ─── MenuItem ───

  addMenuItem: (item) => {
    set((s) => ({ menuItems: [...s.menuItems, item] }))
    if (supabase) {
      // 必須先 insert menu_item，再 insert ingredients（FK 依賴）
      supabase.from('menu_items').insert({
        id: item.id,
        name: item.name,
        serving_g: item.serving_g ?? null,
        selling_price: item.selling_price,
        notes: item.notes,
        sort_order: item.sort_order,
      }).then(({ error }) => {
        if (error) { console.error('addMenuItem error:', error); return }
        if (item.ingredients.length > 0) {
          supabase!.from('menu_item_ingredients')
            .insert(item.ingredients.map(buildMenuIngRow))
            .then(({ error: e2 }) => { if (e2) console.error('addMenuItemIngredients error:', e2) })
        }
      })
    }
  },

  updateMenuItem: (id, partial) => {
    set((s) => ({
      menuItems: s.menuItems.map((mi) => (mi.id === id ? { ...mi, ...partial } : mi)),
    }))
    if (supabase) {
      const db: Record<string, unknown> = {}
      if (partial.name !== undefined) db.name = partial.name
      if (partial.serving_g !== undefined) db.serving_g = partial.serving_g ?? null
      if (partial.selling_price !== undefined) db.selling_price = partial.selling_price
      if (partial.notes !== undefined) db.notes = partial.notes
      if (partial.sort_order !== undefined) db.sort_order = partial.sort_order
      if (Object.keys(db).length > 0) {
        supabase.from('menu_items').update(db).eq('id', id).then()
      }
    }
  },

  removeMenuItem: (id) => {
    set((s) => ({ menuItems: s.menuItems.filter((mi) => mi.id !== id) }))
    if (supabase) {
      supabase.from('menu_items').delete().eq('id', id).then()
    }
  },

  setMenuItemIngredients: (menuItemId, ingredients) => {
    set((s) => ({
      menuItems: s.menuItems.map((mi) =>
        mi.id === menuItemId ? { ...mi, ingredients } : mi
      ),
    }))
    if (supabase) {
      // 必須先 delete 完成，再 insert
      supabase.from('menu_item_ingredients').delete().eq('menu_item_id', menuItemId)
        .then(({ error }) => {
          if (error) { console.error('deleteMenuItemIngredients error:', error); return }
          if (ingredients.length > 0) {
            supabase!.from('menu_item_ingredients')
              .insert(ingredients.map(buildMenuIngRow))
              .then(({ error: e2 }) => { if (e2) console.error('insertMenuItemIngredients error:', e2) })
          }
        })
    }
  },
}))
