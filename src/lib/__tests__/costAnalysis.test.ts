import { describe, it, expect } from 'vitest'
import type { RawMaterial } from '@/data/rawMaterials'
import {
  getMaterialCostPerG,
  getRecipeCost,
  getMenuItemCost,
  type Recipe,
  type MenuItem,
} from '../costAnalysis'

// ─── helpers ───

function makeMaterial(overrides: Partial<RawMaterial> = {}): RawMaterial {
  return {
    id: 'm1',
    name: '芋頭',
    category: '主料',
    spec: '1kg',
    unit: 'kg',
    purchase_price: 100,
    net_weight_g: 1000,
    ...overrides,
  } as RawMaterial
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: '芋圓',
    unit: 'g',
    total_weight_g: 500,
    notes: '',
    sort_order: 0,
    serving_units: [],
    category: '成品',
    ingredients: [],
    ...overrides,
  }
}

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'mi1',
    name: '芋圓冰',
    selling_price: 60,
    notes: '',
    sort_order: 0,
    ingredients: [],
    ...overrides,
  }
}

// ─── getMaterialCostPerG ───

describe('getMaterialCostPerG', () => {
  it('正常計算每克成本', () => {
    const m = makeMaterial({ purchase_price: 200, net_weight_g: 1000 })
    expect(getMaterialCostPerG(m)).toBe(0.2)
  })

  it('purchase_price 為 null 時回傳 null', () => {
    const m = makeMaterial({ purchase_price: null })
    expect(getMaterialCostPerG(m)).toBeNull()
  })

  it('net_weight_g 為 null 時回傳 null', () => {
    const m = makeMaterial({ net_weight_g: null })
    expect(getMaterialCostPerG(m)).toBeNull()
  })

  it('net_weight_g 為 0 時回傳 null（避免除以零）', () => {
    const m = makeMaterial({ net_weight_g: 0 })
    expect(getMaterialCostPerG(m)).toBeNull()
  })

  it('purchase_price 為 0 時回傳 0', () => {
    const m = makeMaterial({ purchase_price: 0 })
    // purchase_price falsy → null
    expect(getMaterialCostPerG(m)).toBeNull()
  })
})

// ─── getRecipeCost ───

describe('getRecipeCost', () => {
  it('有材料時正確計算總成本與每克成本', () => {
    const mat = makeMaterial({ id: 'm1', purchase_price: 100, net_weight_g: 1000 })
    const recipe = makeRecipe({
      total_weight_g: 500,
      ingredients: [
        { id: 'i1', recipe_id: 'r1', material_id: 'm1', amount_g: 250, sort_order: 0 },
      ],
    })
    const map = new Map([['m1', mat]])
    const result = getRecipeCost(recipe, map)

    expect(result.totalCost).toBe(25) // 0.1 * 250
    expect(result.costPerG).toBe(0.05) // 25 / 500
    expect(result.details).toHaveLength(1)
    expect(result.details[0].name).toBe('芋頭')
  })

  it('無材料時 totalCost = 0', () => {
    const recipe = makeRecipe({ ingredients: [] })
    const result = getRecipeCost(recipe, new Map())

    expect(result.totalCost).toBe(0)
    expect(result.details).toHaveLength(0)
  })

  it('自訂材料使用 custom_price_per_g', () => {
    const recipe = makeRecipe({
      total_weight_g: 100,
      ingredients: [
        {
          id: 'i1',
          recipe_id: 'r1',
          material_id: null,
          custom_name: '特殊配料',
          custom_price_per_g: 0.5,
          amount_g: 100,
          sort_order: 0,
        },
      ],
    })
    const result = getRecipeCost(recipe, new Map())

    expect(result.totalCost).toBe(50) // 0.5 * 100
    expect(result.details[0].name).toBe('特殊配料')
  })

  it('total_weight_g 為 0 時 costPerG 為 null', () => {
    const recipe = makeRecipe({ total_weight_g: 0, ingredients: [] })
    const result = getRecipeCost(recipe, new Map())

    expect(result.costPerG).toBeNull()
  })
})

// ─── getMenuItemCost ───

describe('getMenuItemCost', () => {
  it('計算毛利率', () => {
    const mat = makeMaterial({ id: 'm1', purchase_price: 100, net_weight_g: 1000 })
    const recipe = makeRecipe({
      id: 'r1',
      total_weight_g: 500,
      ingredients: [
        { id: 'i1', recipe_id: 'r1', material_id: 'm1', amount_g: 500, sort_order: 0 },
      ],
    })
    const menuItem = makeMenuItem({
      selling_price: 60,
      ingredients: [
        { id: 'mi1', menu_item_id: 'mi1', recipe_id: 'r1', amount_g: 100, sort_order: 0 },
      ],
    })

    const recipesMap = new Map([['r1', recipe]])
    const materialsMap = new Map([['m1', mat]])
    const result = getMenuItemCost(menuItem, recipesMap, materialsMap)

    // recipe costPerG = (0.1 * 500) / 500 = 0.1
    // menuItem totalCost = 0.1 * 100 = 10
    expect(result.totalCost).toBe(10)
    expect(result.profit).toBe(50) // 60 - 10
    expect(result.profitRate).toBeCloseTo(83.33, 1) // (50/60)*100
  })

  it('selling_price 為 0 時 profitRate 為 0', () => {
    const menuItem = makeMenuItem({ selling_price: 0, ingredients: [] })
    const result = getMenuItemCost(menuItem, new Map(), new Map())

    expect(result.profitRate).toBe(0)
  })

  it('直接使用原料計算', () => {
    const mat = makeMaterial({ id: 'm1', purchase_price: 200, net_weight_g: 1000 })
    const menuItem = makeMenuItem({
      selling_price: 50,
      ingredients: [
        { id: 'mi1', menu_item_id: 'mi1', material_id: 'm1', amount_g: 100, sort_order: 0 },
      ],
    })
    const result = getMenuItemCost(menuItem, new Map(), new Map([['m1', mat]]))

    // 0.2 * 100 = 20
    expect(result.totalCost).toBe(20)
    expect(result.profit).toBe(30)
  })

  it('custom_cost 品項', () => {
    const menuItem = makeMenuItem({
      selling_price: 100,
      ingredients: [
        {
          id: 'mi1',
          menu_item_id: 'mi1',
          custom_name: '包裝費',
          custom_cost: 5,
          amount_g: 0,
          sort_order: 0,
        },
      ],
    })
    const result = getMenuItemCost(menuItem, new Map(), new Map())

    expect(result.totalCost).toBe(5)
    expect(result.profit).toBe(95)
    expect(result.details[0].name).toBe('包裝費')
  })
})
