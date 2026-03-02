// 每日生產紀錄 — 7 區 18 品項靜態定義

export type FieldType = 'numeric' | 'select' | 'text' | 'sugar_select'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  unit?: string
  options?: string[] // for select type
}

export interface ItemDef {
  key: string
  name: string
  fields: FieldDef[]
}

export interface ZoneDef {
  key: string
  name: string
  icon: string
  notice?: string // 注意事項（黃色提醒條）
  items: ItemDef[]
}

export const PRODUCTION_ZONES: ZoneDef[] = [
  {
    key: 'paste',
    name: '漿區',
    icon: '🫙',
    notice: '甜度需達標準值方可出貨，稠度以攪拌棒測試',
    items: [
      {
        key: 'taro_paste',
        name: '芋泥漿',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'thickness', label: '稠度', type: 'numeric' },
          { key: 'bucket_count', label: '桶數', type: 'numeric', unit: '桶' },
        ],
      },
      {
        key: 'grass_jelly',
        name: '嫩仙草',
        fields: [
          { key: 'dongcheng', label: '東城', type: 'numeric', unit: 'g' },
          { key: 'zhuangyuan', label: '狀元', type: 'numeric', unit: 'g' },
          { key: 'starch_water', label: '粉水', type: 'numeric', unit: 'ml' },
          { key: 'solidification', label: '凝固', type: 'numeric' },
          { key: 'bucket_count', label: '桶數', type: 'numeric', unit: '桶' },
        ],
      },
      {
        key: 'silver_ear_soup',
        name: '銀耳湯',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'red_date', label: '紅棗', type: 'numeric', unit: 'g' },
          { key: 'goji', label: '枸杞', type: 'numeric', unit: 'g' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'bucket_count', label: '桶數', type: 'numeric', unit: '桶' },
        ],
      },
    ],
  },
  {
    key: 'ball',
    name: '球區',
    icon: '⚪',
    notice: '豆花洞洞數須記錄，芝麻糊/杏仁茶甜度需達標',
    items: [
      {
        key: 'tofu',
        name: '豆花',
        fields: [
          { key: 'powder', label: '粉', type: 'numeric', unit: 'g' },
          { key: 'gypsum', label: '石膏', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'holes', label: '洞洞', type: 'numeric' },
          { key: 'bucket_count', label: '桶數', type: 'numeric', unit: '桶' },
        ],
      },
      {
        key: 'sesame_paste',
        name: '芝麻糊',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'portion', label: '份量', type: 'numeric', unit: '份' },
        ],
      },
      {
        key: 'almond_tea',
        name: '杏仁茶',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'portion', label: '份量', type: 'numeric', unit: '份' },
        ],
      },
      {
        key: 'taro_ball',
        name: '芋泥球',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
        ],
      },
    ],
  },
  {
    key: 'ingredient',
    name: '料區',
    icon: '🫘',
    notice: '各料甜度需達標準值，盒數需與生產排程一致',
    items: [
      {
        key: 'peanut',
        name: '花生',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
        ],
      },
      {
        key: 'red_bean',
        name: '紅豆',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
        ],
      },
      {
        key: 'mung_bean',
        name: '綠豆',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
        ],
      },
      {
        key: 'barley',
        name: '小薏仁',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
        ],
      },
    ],
  },
  {
    key: 'ice',
    name: '製冰區',
    icon: '🧊',
    notice: '牛奶需確認保存期限，甜度依標準配比',
    items: [
      {
        key: 'peanut_ice',
        name: '花生冰',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
          { key: 'milk', label: '牛奶', type: 'numeric', unit: 'ml' },
        ],
      },
      {
        key: 'sesame_ice',
        name: '芝麻冰',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
          { key: 'milk', label: '牛奶', type: 'numeric', unit: 'ml' },
        ],
      },
      {
        key: 'strawberry_ice',
        name: '草莓冰',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'box_count', label: '盒數', type: 'numeric', unit: '盒' },
          { key: 'milk', label: '牛奶', type: 'numeric', unit: 'ml' },
        ],
      },
    ],
  },
  {
    key: 'syrup',
    name: '糖水區',
    icon: '🍯',
    notice: '糖水甜度需每批測量，蔗片糖水桶數需記錄',
    items: [
      {
        key: 'fried_syrup',
        name: '炒糖水',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'portion', label: '份量', type: 'numeric', unit: '份' },
        ],
      },
      {
        key: 'tapioca_syrup',
        name: '粉圓糖水',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'portion', label: '份量', type: 'numeric', unit: '份' },
        ],
      },
      {
        key: 'sugarcane_syrup',
        name: '蔗片糖水',
        fields: [
          { key: 'sugar', label: '糖', type: 'numeric', unit: 'g' },
          { key: 'water', label: '水', type: 'numeric', unit: 'ml' },
          { key: 'sweetness', label: '甜度', type: 'numeric', unit: '°' },
          { key: 'bucket_count', label: '桶數', type: 'numeric', unit: '桶' },
        ],
      },
    ],
  },
  {
    key: 'dumpling',
    name: '圓仔區',
    icon: '🟤',
    notice: '麵團狀態需準確記錄，加水量影響口感',
    items: [
      {
        key: 'taro_dumpling',
        name: '芋圓',
        fields: [
          { key: 'water_ml', label: '加水量', type: 'numeric', unit: 'ml' },
          { key: 'dough_state', label: '麵團狀態', type: 'select', options: ['偏軟', '適中', '偏硬'] },
          { key: 'bag_count', label: '包裝袋數', type: 'numeric', unit: '包' },
        ],
      },
      {
        key: 'white_ball',
        name: '白玉',
        fields: [
          { key: 'water_ml', label: '加水量', type: 'numeric', unit: 'ml' },
          { key: 'dough_state', label: '麵團狀態', type: 'select', options: ['偏軟', '適中', '偏硬'] },
          { key: 'bag_count', label: '包裝袋數', type: 'numeric', unit: '包' },
        ],
      },
    ],
  },
]
