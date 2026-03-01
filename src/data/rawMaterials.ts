export interface RawMaterial {
  id: string
  name: string
  category: string
  spec: string
  unit: string
  notes?: string
  box_unit?: string
  box_ratio?: number
  purchase_price?: number | null
  net_weight_g?: number | null
}

export const materialCategories = [
  '雜糧類',
  '堅果類',
  '乾貨類',
  '罐裝/袋裝類',
  '其他供應商',
] as const

export const rawMaterials: RawMaterial[] = [
  { id: 'm001', name: '綠豆(天鶴牌)', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm002', name: '紅豆(台灣)', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm003', name: '小薏仁(珍珠麥)', category: '雜糧類', spec: '25斤/袋', unit: '袋' },
  { id: 'm004', name: '二砂', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm005', name: '大PS紅糖(黑糖)', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm006', name: '精製特砂(白砂)', category: '雜糧類', spec: '', unit: '袋' },
  { id: 'm007', name: '冰糖', category: '雜糧類', spec: '50斤/袋(10包)', unit: '包', box_unit: '袋', box_ratio: 10 },
  { id: 'm008', name: '三花樹薯粉(太白粉)', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm009', name: '光中杏仁粉(杏仁茶)', category: '雜糧類', spec: '1箱8包', unit: '包', box_unit: '箱', box_ratio: 8 },
  { id: 'm010', name: '長糯米', category: '雜糧類', spec: '50斤/袋', unit: '袋' },
  { id: 'm011', name: '圓糯米', category: '雜糧類', spec: '', unit: '袋' },
  { id: 'm012', name: '紫米', category: '雜糧類', spec: '', unit: '袋' },
  { id: 'm013', name: '聖旻陣薏仁片', category: '雜糧類', spec: '50斤/袋', unit: '袋' },

  { id: 'm014', name: '部落米', category: '堅果類', spec: '20斤/袋', unit: '袋' },
  { id: 'm015', name: '進口(生)花生片', category: '堅果類', spec: '', unit: '袋', notes: '一次訂貨量最少100斤' },
  { id: 'm016', name: '大黑芝麻(粒)', category: '堅果類', spec: '10斤/包', unit: '包' },

  { id: 'm017', name: '3號銀耳', category: '乾貨類', spec: '半斤/包', unit: '包', notes: '乾貨滿7000免運' },
  { id: 'm018', name: '1.5紅棗', category: '乾貨類', spec: '5斤/包', unit: '包' },
  { id: 'm019', name: '0.5枸杞', category: '乾貨類', spec: '', unit: '包' },

  { id: 'm020', name: '狀元仙草', category: '罐裝/袋裝類', spec: '1箱6瓶', unit: '瓶', box_unit: '箱', box_ratio: 6, notes: '叫貨最少7箱' },
  { id: 'm021', name: '東城門仙草', category: '罐裝/袋裝類', spec: '1箱4袋', unit: '袋', notes: '一次8箱' },
  { id: 'm022', name: '新地瓜粉', category: '罐裝/袋裝類', spec: '20公斤', unit: '包' },
  { id: 'm023', name: '粉粿粉', category: '罐裝/袋裝類', spec: '20公斤', unit: '包' },

  { id: 'm024', name: 'A2', category: '其他供應商', spec: '', unit: '包' },
  { id: 'm025', name: '天然熟石灰', category: '其他供應商', spec: '1公斤/袋裝', unit: '包' },
  { id: 'm026', name: '甘蔗原汁', category: '其他供應商', spec: '6瓶/箱', unit: '瓶', box_unit: '箱', box_ratio: 6 },
  { id: 'm027', name: '花生醬', category: '其他供應商', spec: '', unit: '包' },
  { id: 'm028', name: '鮮奶', category: '其他供應商', spec: '1箱20瓶', unit: '瓶', box_unit: '箱', box_ratio: 20 },
  { id: 'm029', name: '冰淇淋液', category: '其他供應商', spec: '1箱12瓶', unit: '瓶', box_unit: '箱', box_ratio: 12 },
]

export function getMaterialsByCategory(): Map<string, RawMaterial[]> {
  const map = new Map<string, RawMaterial[]>()
  for (const cat of materialCategories) {
    map.set(cat, rawMaterials.filter(m => m.category === cat))
  }
  return map
}
