import type { RawMaterial } from '@/data/rawMaterials'

// ─── 型別 ───

export interface ServingUnit { label: string; grams: number }
export const SERVING_UNIT_OPTIONS = ['1匙', '1球', '1杯', '1碗', '1份', '1顆']

export interface Recipe {
  id: string
  name: string
  unit: string
  total_weight_g: number
  /** 一批原料產出幾單位（total_weight_g 為每單位重量）；舊資料預設 1 */
  yield_qty: number
  solid_weight_g?: number | null
  liquid_weight_g?: number | null
  store_product_id?: string | null
  notes: string
  sort_order: number
  serving_units: ServingUnit[]
  category: string
  ingredients: RecipeIngredient[]
}

export interface RecipeIngredient {
  id: string
  recipe_id: string
  material_id?: string | null
  custom_name?: string | null
  custom_price_per_g?: number | null
  amount_g: number
  sort_order: number
}

export interface MenuItem {
  id: string
  name: string
  serving_g?: number | null
  selling_price: number
  notes: string
  sort_order: number
  ingredients: MenuItemIngredient[]
}

export interface MenuItemIngredient {
  id: string
  menu_item_id: string
  recipe_id?: string | null
  material_id?: string | null
  custom_name?: string | null
  custom_cost?: number | null
  amount_g: number
  sort_order: number
}

// ─── 計算函式 ───

/** 原料每克成本 */
export function getMaterialCostPerG(m: RawMaterial): number | null {
  if (!m.purchase_price || !m.net_weight_g || m.net_weight_g === 0) return null
  return m.purchase_price / m.net_weight_g
}

/** 成品配方：整批總成本、每單位成本、每克成本 */
export function getRecipeCost(
  recipe: Recipe,
  materialsMap: Map<string, RawMaterial>,
): { totalCost: number; costPerUnit: number; costPerG: number | null; details: { name: string; amountG: number; unitCost: number | null; subtotal: number | null }[] } {
  let totalCost = 0
  const details: { name: string; amountG: number; unitCost: number | null; subtotal: number | null }[] = []

  for (const ing of recipe.ingredients) {
    let unitCost: number | null = null
    let name = '(未知)'

    if (ing.material_id) {
      const mat = materialsMap.get(ing.material_id)
      if (mat) {
        name = mat.name
        unitCost = getMaterialCostPerG(mat)
      }
    } else if (ing.custom_name) {
      name = ing.custom_name
      unitCost = ing.custom_price_per_g ?? null
    }

    const subtotal = unitCost != null ? unitCost * ing.amount_g : null
    if (subtotal != null) totalCost += subtotal

    details.push({ name, amountG: ing.amount_g, unitCost, subtotal })
  }

  const yieldQty = recipe.yield_qty > 0 ? recipe.yield_qty : 1
  const costPerUnit = totalCost / yieldQty
  const costPerG = recipe.total_weight_g > 0 ? costPerUnit / recipe.total_weight_g : null

  return { totalCost, costPerUnit, costPerG, details }
}

/** 叫貨品項的原料成本（每叫貨單位）= 對應配方或原物料的每克成本 × 每單位克數；未綁定或無法計算回傳 null */
export function getProductRecipeCost(
  product: { recipe_id?: string | null; material_id?: string | null; recipe_grams?: number | null },
  recipesMap: Map<string, Recipe>,
  materialsMap: Map<string, RawMaterial>,
): number | null {
  if (!product.recipe_grams || product.recipe_grams <= 0) return null
  let costPerG: number | null = null
  if (product.recipe_id) {
    const recipe = recipesMap.get(product.recipe_id)
    if (recipe) costPerG = getRecipeCost(recipe, materialsMap).costPerG
  } else if (product.material_id) {
    const mat = materialsMap.get(product.material_id)
    if (mat) costPerG = getMaterialCostPerG(mat)
  }
  if (costPerG == null) return null
  // 4 位小數：以克計價的品項（如 0.0204/g）取 2 位會產生 >1% 誤差
  return Math.round(costPerG * product.recipe_grams * 10000) / 10000
}

/** 販售品成本、毛利、毛利率 */
export function getMenuItemCost(
  item: MenuItem,
  recipesMap: Map<string, Recipe>,
  materialsMap: Map<string, RawMaterial>,
): { totalCost: number; profit: number; profitRate: number; details: { name: string; amountG: number; subtotal: number | null }[] } {
  let totalCost = 0
  const details: { name: string; amountG: number; subtotal: number | null }[] = []

  for (const ing of item.ingredients) {
    let subtotal: number | null = null
    let name = '(未知)'

    if (ing.recipe_id) {
      const recipe = recipesMap.get(ing.recipe_id)
      if (recipe) {
        name = recipe.name
        const { costPerG } = getRecipeCost(recipe, materialsMap)
        if (costPerG != null) {
          subtotal = costPerG * ing.amount_g
        }
      }
    } else if (ing.material_id) {
      const mat = materialsMap.get(ing.material_id)
      if (mat) {
        name = mat.name
        const cpg = getMaterialCostPerG(mat)
        if (cpg != null) {
          subtotal = cpg * ing.amount_g
        }
      }
    } else if (ing.custom_name) {
      name = ing.custom_name
      subtotal = ing.custom_cost ?? null
    }

    if (subtotal != null) totalCost += subtotal
    details.push({ name, amountG: ing.amount_g, subtotal })
  }

  const profit = item.selling_price - totalCost
  const profitRate = item.selling_price > 0 ? (profit / item.selling_price) * 100 : 0

  return { totalCost, profit, profitRate, details }
}
