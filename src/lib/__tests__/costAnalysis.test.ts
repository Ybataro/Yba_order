import { describe, it, expect } from 'vitest'
import type { RawMaterial } from '@/data/rawMaterials'
import {
  getMaterialCostPerG,
  getRecipeCost,
  getMenuItemCost,
  getProductRecipeCost,
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
    yield_qty: 1,
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

  // 為何重要：原料合計是「整批」成本，一批做 N 盒時若不除 N，每克成本放大 N 倍，
  // 連帶販售品成本（用 costPerG）全部偏高。實例：金鳳茶王冰淇淋 3 盒 × 1600g，原料 $97.98
  it('一批產出多單位時，每單位與每克成本須除以產出數', () => {
    const recipe = makeRecipe({
      total_weight_g: 1600,
      yield_qty: 3,
      ingredients: [
        { id: 'i1', recipe_id: 'r1', custom_name: '原料', custom_price_per_g: 97.98, amount_g: 1, sort_order: 0 },
      ],
    })
    const result = getRecipeCost(recipe, new Map())

    expect(result.totalCost).toBeCloseTo(97.98, 6)
    expect(result.costPerUnit).toBeCloseTo(32.66, 6) // 97.98 / 3
    expect(result.costPerG).toBeCloseTo(97.98 / 4800, 10)
    expect(result.costPerG! * 380).toBeCloseTo(7.76, 2) // 1 杯 380g
  })

  it('yield_qty 預設 1 時與舊算法一致（既有配方不受影響）', () => {
    const recipe = makeRecipe({
      total_weight_g: 500,
      yield_qty: 1,
      ingredients: [
        { id: 'i1', recipe_id: 'r1', custom_name: 'x', custom_price_per_g: 0.1, amount_g: 250, sort_order: 0 },
      ],
    })
    const result = getRecipeCost(recipe, new Map())
    expect(result.costPerUnit).toBe(result.totalCost)
    expect(result.costPerG).toBe(25 / 500)
  })

  // 為何重要：缺價原料原本被靜默略過，合計偏低卻無提示（鮮奶/冰淇淋液、豆花孤兒原料事件）
  it('未設價、原物料已刪除的原料計入 missingPriceCount', () => {
    const priced = makeMaterial({ id: 'm1', purchase_price: 100, net_weight_g: 1000 })
    const noPrice = makeMaterial({ id: 'm2', purchase_price: null })
    const recipe = makeRecipe({
      ingredients: [
        { id: 'i1', recipe_id: 'r1', material_id: 'm1', amount_g: 100, sort_order: 0 },
        { id: 'i2', recipe_id: 'r1', material_id: 'm2', amount_g: 100, sort_order: 1 },
        { id: 'i3', recipe_id: 'r1', material_id: 'deleted', amount_g: 100, sort_order: 2 },
      ],
    })
    const result = getRecipeCost(recipe, new Map([['m1', priced], ['m2', noPrice]]))
    expect(result.totalCost).toBe(10)
    expect(result.missingPriceCount).toBe(2)
  })

  it('total_weight_g 為 0 時 costPerG 為 null', () => {
    const recipe = makeRecipe({ total_weight_g: 0, ingredients: [] })
    const result = getRecipeCost(recipe, new Map())

    expect(result.costPerG).toBeNull()
  })
})

// ─── getProductRecipeCost ───

// 為何重要：同一配方對應多個叫貨品項（盒/杯），每個品項依自己 1 單位的克數換算；
// 數字會被一鍵套用成 our_cost 進叫貨金額與盈餘統計，算錯即錢算錯
describe('getProductRecipeCost', () => {
  const recipe = makeRecipe({
    id: 'r1',
    total_weight_g: 1600,
    yield_qty: 3,
    ingredients: [
      { id: 'i1', recipe_id: 'r1', custom_name: '原料', custom_price_per_g: 97.98, amount_g: 1, sort_order: 0 },
    ],
  })
  const recipesMap = new Map([['r1', recipe]])

  it('盒/杯各依自己克數換算', () => {
    expect(getProductRecipeCost({ recipe_id: 'r1', unit_grams: 1600 }, recipesMap, new Map())).toBe(32.66)
    expect(getProductRecipeCost({ recipe_id: 'r1', unit_grams: 380 }, recipesMap, new Map())).toBe(7.7568)
  })

  it('以克計價品項保留 4 位小數（2 位會有 >1% 誤差）', () => {
    expect(getProductRecipeCost({ recipe_id: 'r1', unit_grams: 1 }, recipesMap, new Map())).toBe(0.0204)
  })

  // 為何重要：門店「鮮奶」對應原物料「鮮奶」，價格只在原物料維護一處（SSOT），叫貨價自原物料換算
  it('對應原物料：採購價 ÷ 淨重 × 每單位克數', () => {
    const milk = makeMaterial({ id: 'm028', purchase_price: 65, net_weight_g: 936 })
    const mats = new Map([['m028', milk]])
    expect(getProductRecipeCost({ material_id: 'm028', unit_grams: 936 }, recipesMap, mats)).toBe(65)
    // 原物料未設採購價 → null，不顯示錯誤的 $0
    const noPrice = new Map([['m028', makeMaterial({ id: 'm028', purchase_price: null })]])
    expect(getProductRecipeCost({ material_id: 'm028', unit_grams: 936 }, recipesMap, noPrice)).toBeNull()
  })

  it('未綁定、克數缺漏、配方已刪除 → null（不給錯誤建議值）', () => {
    expect(getProductRecipeCost({}, recipesMap, new Map())).toBeNull()
    expect(getProductRecipeCost({ recipe_id: 'r1', unit_grams: null }, recipesMap, new Map())).toBeNull()
    expect(getProductRecipeCost({ recipe_id: 'gone', unit_grams: 100 }, recipesMap, new Map())).toBeNull()
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
