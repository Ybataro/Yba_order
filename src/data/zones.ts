export interface StoreZone {
  id: string
  storeId: string
  zoneCode: string
  zoneName: string
  sortOrder: number
}

export interface ZoneProduct {
  zoneId: string
  productId: string
  sortOrder: number
}

// Fallback data (used when Supabase is unavailable)
export const defaultZones: StoreZone[] = [
  { id: 'lehua_1f', storeId: 'lehua', zoneCode: '1F', zoneName: '1樓', sortOrder: 0 },
  { id: 'lehua_2f', storeId: 'lehua', zoneCode: '2F', zoneName: '2樓', sortOrder: 1 },
  { id: 'xingnan_1f', storeId: 'xingnan', zoneCode: '1F', zoneName: '1樓', sortOrder: 0 },
]
