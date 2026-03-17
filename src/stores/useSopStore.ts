import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ── Types ──

export interface SopCategory {
  id: string
  name: string
  image_url: string
  sort_order: number
  is_active: boolean
  recipes: SopRecipe[]
}

export interface SopRecipe {
  id: string
  category_id: string
  name: string
  image_url: string
  batch_sizes: string[]
  notes: string
  sort_order: number
  is_active: boolean
  ingredients: SopIngredient[]
  steps: SopStep[]
}

export interface SopIngredient {
  id: string
  recipe_id: string
  name: string
  unit: string
  amounts: Record<string, number>
  notes: string
  sort_order: number
}

export interface SopStep {
  id: string
  recipe_id: string
  step_number: number
  title: string
  description: string
  duration_min: number
  notes: string
  sort_order: number
}

interface SopState {
  categories: SopCategory[]
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>

  // Category CRUD
  addCategory: (cat: Omit<SopCategory, 'recipes'>) => void
  updateCategory: (id: string, partial: Partial<Pick<SopCategory, 'name' | 'image_url' | 'is_active'>>) => void
  removeCategory: (id: string) => void
  swapCategoryOrder: (idA: string, idB: string) => void

  // Recipe CRUD
  addRecipe: (recipe: Omit<SopRecipe, 'ingredients' | 'steps'>) => void
  updateRecipe: (id: string, partial: Partial<Pick<SopRecipe, 'name' | 'image_url' | 'batch_sizes' | 'notes' | 'is_active' | 'category_id'>>) => void
  removeRecipe: (id: string) => void
  swapRecipeOrder: (idA: string, idB: string) => void

  // Ingredient CRUD
  addIngredient: (ing: SopIngredient) => void
  updateIngredient: (id: string, partial: Partial<Pick<SopIngredient, 'name' | 'unit' | 'amounts' | 'notes'>>) => void
  removeIngredient: (id: string) => void
  swapIngredientOrder: (idA: string, idB: string) => void

  // Step CRUD
  addStep: (step: SopStep) => void
  updateStep: (id: string, partial: Partial<Pick<SopStep, 'step_number' | 'title' | 'description' | 'duration_min' | 'notes'>>) => void
  removeStep: (id: string) => void
  swapStepOrder: (idA: string, idB: string) => void
}

// ── Helper: swap sort_order ──
function swapSortOrder<T extends { id: string; sort_order: number }>(arr: T[], idA: string, idB: string): T[] {
  const a = arr.find((x) => x.id === idA)
  const b = arr.find((x) => x.id === idB)
  if (!a || !b) return arr
  return arr.map((x) => {
    if (x.id === idA) return { ...x, sort_order: b.sort_order }
    if (x.id === idB) return { ...x, sort_order: a.sort_order }
    return x
  }).sort((x, y) => x.sort_order - y.sort_order)
}

export const useSopStore = create<SopState>()((set, get) => ({
  categories: [],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })

    const [catRes, recRes, ingRes, stpRes] = await Promise.all([
      supabase.from('sop_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('sop_recipes').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('sop_ingredients').select('*').order('sort_order'),
      supabase.from('sop_steps').select('*').order('sort_order'),
    ])

    const rawCats = catRes.data ?? []
    const rawRecipes = recRes.data ?? []
    const rawIngs = ingRes.data ?? []
    const rawSteps = stpRes.data ?? []

    // Group ingredients by recipe_id
    const ingsByRecipe: Record<string, SopIngredient[]> = {}
    rawIngs.forEach((i) => {
      const ing: SopIngredient = {
        id: i.id,
        recipe_id: i.recipe_id,
        name: i.name,
        unit: i.unit ?? '',
        amounts: i.amounts ?? {},
        notes: i.notes ?? '',
        sort_order: i.sort_order ?? 0,
      }
      if (!ingsByRecipe[i.recipe_id]) ingsByRecipe[i.recipe_id] = []
      ingsByRecipe[i.recipe_id].push(ing)
    })

    // Group steps by recipe_id
    const stepsByRecipe: Record<string, SopStep[]> = {}
    rawSteps.forEach((s) => {
      const step: SopStep = {
        id: s.id,
        recipe_id: s.recipe_id,
        step_number: s.step_number ?? 1,
        title: s.title ?? '',
        description: s.description ?? '',
        duration_min: s.duration_min ?? 0,
        notes: s.notes ?? '',
        sort_order: s.sort_order ?? 0,
      }
      if (!stepsByRecipe[s.recipe_id]) stepsByRecipe[s.recipe_id] = []
      stepsByRecipe[s.recipe_id].push(step)
    })

    // Group recipes by category_id
    const recipesByCat: Record<string, SopRecipe[]> = {}
    rawRecipes.forEach((r) => {
      const recipe: SopRecipe = {
        id: r.id,
        category_id: r.category_id,
        name: r.name,
        image_url: r.image_url ?? '',
        batch_sizes: r.batch_sizes ?? ['1份'],
        notes: r.notes ?? '',
        sort_order: r.sort_order ?? 0,
        is_active: r.is_active ?? true,
        ingredients: ingsByRecipe[r.id] ?? [],
        steps: stepsByRecipe[r.id] ?? [],
      }
      if (!recipesByCat[r.category_id]) recipesByCat[r.category_id] = []
      recipesByCat[r.category_id].push(recipe)
    })

    const categories: SopCategory[] = rawCats.map((c) => ({
      id: c.id,
      name: c.name,
      image_url: c.image_url ?? '',
      sort_order: c.sort_order ?? 0,
      is_active: c.is_active ?? true,
      recipes: recipesByCat[c.id] ?? [],
    }))

    set({ categories, loading: false, initialized: true })
  },

  // ── Category CRUD ──
  addCategory: (cat) => {
    set((s) => ({ categories: [...s.categories, { ...cat, recipes: [] }] }))
    supabase?.from('sop_categories').insert({
      id: cat.id, name: cat.name, image_url: cat.image_url,
      sort_order: cat.sort_order, is_active: cat.is_active,
    }).then()
  },

  updateCategory: (id, partial) => {
    set((s) => ({
      categories: s.categories.map((c) => c.id === id ? { ...c, ...partial } : c),
    }))
    supabase?.from('sop_categories').update(partial).eq('id', id).then()
  },

  removeCategory: (id) => {
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }))
    supabase?.from('sop_categories').delete().eq('id', id).then()
  },

  swapCategoryOrder: (idA, idB) => {
    const { categories } = get()
    const a = categories.find((c) => c.id === idA)
    const b = categories.find((c) => c.id === idB)
    if (!a || !b) return
    set({ categories: swapSortOrder(categories, idA, idB) })
    supabase?.from('sop_categories').update({ sort_order: b.sort_order }).eq('id', idA).then()
    supabase?.from('sop_categories').update({ sort_order: a.sort_order }).eq('id', idB).then()
  },

  // ── Recipe CRUD ──
  addRecipe: (recipe) => {
    set((s) => ({
      categories: s.categories.map((c) =>
        c.id === recipe.category_id
          ? { ...c, recipes: [...c.recipes, { ...recipe, ingredients: [], steps: [] }] }
          : c
      ),
    }))
    supabase?.from('sop_recipes').insert({
      id: recipe.id, category_id: recipe.category_id, name: recipe.name,
      image_url: recipe.image_url, batch_sizes: recipe.batch_sizes,
      notes: recipe.notes, sort_order: recipe.sort_order, is_active: recipe.is_active,
    }).then()
  },

  updateRecipe: (id, partial) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => r.id === id ? { ...r, ...partial } : r),
      })),
    }))
    supabase?.from('sop_recipes').update(partial).eq('id', id).then()
  },

  removeRecipe: (id) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.filter((r) => r.id !== id),
      })),
    }))
    supabase?.from('sop_recipes').delete().eq('id', id).then()
  },

  swapRecipeOrder: (idA, idB) => {
    set((s) => {
      const newCats = s.categories.map((c) => {
        const a = c.recipes.find((r) => r.id === idA)
        const b = c.recipes.find((r) => r.id === idB)
        if (!a || !b) return c
        return { ...c, recipes: swapSortOrder(c.recipes, idA, idB) }
      })
      return { categories: newCats }
    })
    const allRecipes = get().categories.flatMap((c) => c.recipes)
    const a = allRecipes.find((r) => r.id === idA)
    const b = allRecipes.find((r) => r.id === idB)
    if (a && b) {
      supabase?.from('sop_recipes').update({ sort_order: b.sort_order }).eq('id', idA).then()
      supabase?.from('sop_recipes').update({ sort_order: a.sort_order }).eq('id', idB).then()
    }
  },

  // ── Ingredient CRUD ──
  addIngredient: (ing) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) =>
          r.id === ing.recipe_id ? { ...r, ingredients: [...r.ingredients, ing] } : r
        ),
      })),
    }))
    supabase?.from('sop_ingredients').insert({
      id: ing.id, recipe_id: ing.recipe_id, name: ing.name,
      unit: ing.unit, amounts: ing.amounts, notes: ing.notes, sort_order: ing.sort_order,
    }).then()
  },

  updateIngredient: (id, partial) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => ({
          ...r,
          ingredients: r.ingredients.map((i) => i.id === id ? { ...i, ...partial } : i),
        })),
      })),
    }))
    supabase?.from('sop_ingredients').update(partial).eq('id', id).then()
  },

  removeIngredient: (id) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => ({
          ...r,
          ingredients: r.ingredients.filter((i) => i.id !== id),
        })),
      })),
    }))
    supabase?.from('sop_ingredients').delete().eq('id', id).then()
  },

  swapIngredientOrder: (idA, idB) => {
    set((s) => {
      const newCats = s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => {
          const a = r.ingredients.find((i) => i.id === idA)
          const b = r.ingredients.find((i) => i.id === idB)
          if (!a || !b) return r
          return { ...r, ingredients: swapSortOrder(r.ingredients, idA, idB) }
        }),
      }))
      return { categories: newCats }
    })
    const allIngs = get().categories.flatMap((c) => c.recipes.flatMap((r) => r.ingredients))
    const a = allIngs.find((i) => i.id === idA)
    const b = allIngs.find((i) => i.id === idB)
    if (a && b) {
      supabase?.from('sop_ingredients').update({ sort_order: b.sort_order }).eq('id', idA).then()
      supabase?.from('sop_ingredients').update({ sort_order: a.sort_order }).eq('id', idB).then()
    }
  },

  // ── Step CRUD ──
  addStep: (step) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) =>
          r.id === step.recipe_id ? { ...r, steps: [...r.steps, step] } : r
        ),
      })),
    }))
    supabase?.from('sop_steps').insert({
      id: step.id, recipe_id: step.recipe_id, step_number: step.step_number,
      title: step.title, description: step.description,
      duration_min: step.duration_min, notes: step.notes, sort_order: step.sort_order,
    }).then()
  },

  updateStep: (id, partial) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => ({
          ...r,
          steps: r.steps.map((st) => st.id === id ? { ...st, ...partial } : st),
        })),
      })),
    }))
    supabase?.from('sop_steps').update(partial).eq('id', id).then()
  },

  removeStep: (id) => {
    set((s) => ({
      categories: s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => ({
          ...r,
          steps: r.steps.filter((st) => st.id !== id),
        })),
      })),
    }))
    supabase?.from('sop_steps').delete().eq('id', id).then()
  },

  swapStepOrder: (idA, idB) => {
    set((s) => {
      const newCats = s.categories.map((c) => ({
        ...c,
        recipes: c.recipes.map((r) => {
          const a = r.steps.find((st) => st.id === idA)
          const b = r.steps.find((st) => st.id === idB)
          if (!a || !b) return r
          return { ...r, steps: swapSortOrder(r.steps, idA, idB) }
        }),
      }))
      return { categories: newCats }
    })
    const allSteps = get().categories.flatMap((c) => c.recipes.flatMap((r) => r.steps))
    const a = allSteps.find((st) => st.id === idA)
    const b = allSteps.find((st) => st.id === idB)
    if (a && b) {
      supabase?.from('sop_steps').update({ sort_order: b.sort_order }).eq('id', idA).then()
      supabase?.from('sop_steps').update({ sort_order: a.sort_order }).eq('id', idB).then()
    }
  },
}))
