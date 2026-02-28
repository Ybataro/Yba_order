export interface SupplyItem {
  key: string
  name: string
  unit: string
  deductionKeys: string[] // frozen_sales product_keys
}

export const SUPPLY_ITEMS: SupplyItem[] = [
  { key: 'almond_bottle_300',  name: '杏仁茶瓶 300ml',  unit: '瓶', deductionKeys: ['almond_tea_300'] },
  { key: 'almond_bottle_1000', name: '杏仁茶瓶 1000ml', unit: '瓶', deductionKeys: ['almond_tea_1000'] },
  { key: 'bottle_cap',         name: '瓶蓋',             unit: '個', deductionKeys: ['almond_tea_300', 'almond_tea_1000'] },
  { key: 'taro_ball_sticker',  name: '冷凍芋圓貼紙',     unit: '張', deductionKeys: ['taro_ball'] },
  { key: 'white_ball_sticker', name: '冷凍白玉貼紙',     unit: '張', deductionKeys: ['white_ball'] },
]
