export interface FrozenProduct {
  key: string       // DB product_key
  name: string      // 顯示名稱
  spec: string      // 規格
  price: number     // 售價
}

export const FROZEN_PRODUCTS: FrozenProduct[] = [
  { key: 'taro_ball',       name: '芋圓',       spec: '包 300g',    price: 135 },
  { key: 'white_ball',      name: '白玉',       spec: '包 300g',    price: 135 },
  { key: 'peanut_ice',      name: '花生冰淇淋', spec: '杯',         price: 235 },
  { key: 'sesame_ice',      name: '芝麻冰淇淋', spec: '杯',         price: 235 },
  { key: 'strawberry_ice',  name: '草莓冰淇淋', spec: '杯',         price: 280 },
  { key: 'almond_tea_300',  name: '杏仁茶',     spec: '袋 300g',    price: 65 },
  { key: 'almond_tea_1000', name: '杏仁茶',     spec: '袋 1000g',   price: 180 },
]
