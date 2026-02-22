export type VisibleIn = 'both' | 'inventory_only' | 'order_only'

export interface StoreProduct {
  id: string
  name: string
  category: string
  unit: string
  shelfLifeDays?: number | string
  baseStock?: string
  ourCost?: number
  franchisePrice?: number
  visibleIn?: VisibleIn
  description?: string
  nameEn?: string
  nameJa?: string
  descEn?: string
  descJa?: string
}

export const productCategories = [
  '配料類（盒裝）',
  '加工品類',
  '主食類（袋裝）',
  '液體類',
  '冰品類',
  '其他',
] as const

export const storeProducts: StoreProduct[] = [
  { id: 'p001', name: '紅豆', category: '配料類（盒裝）', unit: '盒', shelfLifeDays: 7, baseStock: '2盒/2天' },
  { id: 'p002', name: '綠豆', category: '配料類（盒裝）', unit: '盒', shelfLifeDays: 7, baseStock: '2盒/2天' },
  { id: 'p003', name: '花生', category: '配料類（盒裝）', unit: '盒', shelfLifeDays: 7, baseStock: '2盒/2天' },
  { id: 'p004', name: '小薏仁', category: '配料類（盒裝）', unit: '盒', shelfLifeDays: 7, baseStock: '2盒/2天' },

  { id: 'p005', name: '芋泥球', category: '加工品類', unit: '盒', shelfLifeDays: 3, baseStock: '1盒/2天' },
  { id: 'p006', name: '芋泥漿', category: '加工品類', unit: '袋', shelfLifeDays: 7, baseStock: '1袋' },
  { id: 'p010', name: '芝麻糊', category: '加工品類', unit: '盒', shelfLifeDays: 7, baseStock: '1盒/2天' },
  { id: 'p007', name: '嫩仙草', category: '加工品類', unit: '桶', shelfLifeDays: 4 },
  { id: 'p021', name: '豆花(冷)', category: '加工品類', unit: '桶', shelfLifeDays: 4, baseStock: '1桶' },
  { id: 'p022', name: '豆花(熱)', category: '加工品類', unit: '桶', shelfLifeDays: 1, baseStock: '1桶' },
  { id: 'p030', name: '紫米紅豆料(0.5桶)', category: '加工品類', unit: '份' },
  { id: 'p031', name: '紫米紅豆料(1桶)', category: '加工品類', unit: '份' },
  { id: 'p008', name: '紫米紅豆湯', category: '加工品類', unit: '桶', baseStock: '1桶/1天' },
  { id: 'p033', name: '芋頭湯材料(0.5桶)', category: '加工品類', unit: '份' },
  { id: 'p034', name: '芋頭湯材料(1桶)', category: '加工品類', unit: '份' },
  { id: 'p009', name: '銀耳湯', category: '加工品類', unit: '桶', shelfLifeDays: 3, baseStock: '1桶' },
  { id: 'p035', name: '薏仁湯', category: '加工品類', unit: '桶', shelfLifeDays: 3, baseStock: '1桶' },
  { id: 'p036', name: '芋頭湯(冷)', category: '加工品類', unit: '桶', shelfLifeDays: 3, baseStock: '1桶' },
  { id: 'p037', name: '芋頭湯(熱)', category: '加工品類', unit: '桶', shelfLifeDays: 1, baseStock: '1桶' },

  { id: 'p011', name: '芋圓', category: '主食類（袋裝）', unit: '袋', shelfLifeDays: '冷凍45天', baseStock: '3000g/袋' },
  { id: 'p012', name: '白玉', category: '主食類（袋裝）', unit: '袋', shelfLifeDays: '冷凍45天', baseStock: '3000g/袋' },
  { id: 'p013', name: '粉圓', category: '主食類（袋裝）', unit: '袋', baseStock: '3000g/袋' },

  { id: 'p014', name: '粉圓糖水', category: '液體類', unit: '袋', baseStock: '4500g/1袋' },
  { id: 'p015', name: '炒糖糖水', category: '液體類', unit: '袋', baseStock: '4500g/1袋' },
  { id: 'p019', name: '微糖豆漿', category: '液體類', unit: '袋', shelfLifeDays: '開封3天', baseStock: '2500g/袋' },
  { id: 'p020', name: '無糖豆漿', category: '液體類', unit: '袋', shelfLifeDays: '開封3天', baseStock: '2500g/袋' },
  { id: 'p023', name: '杏仁茶', category: '液體類', unit: '份', shelfLifeDays: 3 },

  { id: 'p024', name: '花生冰淇淋(盒)', category: '冰品類', unit: '盒', shelfLifeDays: '6個月' },
  { id: 'p025', name: '芝麻冰淇淋(盒)', category: '冰品類', unit: '盒', shelfLifeDays: '6個月' },
  { id: 'p026', name: '花生冰淇淋(杯)', category: '冰品類', unit: '杯', shelfLifeDays: '6個月' },
  { id: 'p027', name: '芝麻冰淇淋(杯)', category: '冰品類', unit: '杯', shelfLifeDays: '6個月' },
  { id: 'p028', name: '草莓冰淇淋(杯)', category: '冰品類', unit: '杯', shelfLifeDays: '6個月' },
  { id: 'p029', name: '蔗片冰', category: '冰品類', unit: '袋', baseStock: '8公斤/袋' },

  { id: 'p016', name: '芝麻湯圓', category: '其他', unit: '盒', baseStock: '盒' },
  { id: 'p017', name: '鮮奶', category: '其他', unit: '瓶', baseStock: '瓶' },
  { id: 'p032', name: '冷凍薑汁', category: '其他', unit: '瓶', shelfLifeDays: '冷藏7天' },
]

export function getProductsByCategory(): Map<string, StoreProduct[]> {
  const map = new Map<string, StoreProduct[]>()
  for (const cat of productCategories) {
    map.set(cat, storeProducts.filter(p => p.category === cat))
  }
  return map
}
