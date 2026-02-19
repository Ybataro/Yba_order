import { create } from 'zustand'
import { defaultZones, defaultZoneProducts, type StoreZone, type ZoneProduct } from '@/data/zones'
import { supabase } from '@/lib/supabase'

interface ZoneState {
  zones: StoreZone[]
  zoneProducts: ZoneProduct[]
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  getStoreZones: (storeId: string) => StoreZone[]
  getZoneProductIds: (zoneId: string) => string[]
  addZone: (zone: StoreZone) => void
  removeZone: (zoneId: string) => void
  assignProduct: (zoneId: string, productId: string) => void
  unassignProduct: (zoneId: string, productId: string) => void
  getAssignedZoneIds: (storeId: string, productId: string) => string[]
}

export const useZoneStore = create<ZoneState>()((set, get) => ({
  zones: defaultZones,
  zoneProducts: defaultZoneProducts,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })
    const [zoneRes, zpRes] = await Promise.all([
      supabase.from('store_zones').select('*').order('sort_order'),
      supabase.from('zone_products').select('*').order('sort_order'),
    ])
    if (zoneRes.data && zoneRes.data.length > 0) {
      set({
        zones: zoneRes.data.map((d) => ({
          id: d.id,
          storeId: d.store_id,
          zoneCode: d.zone_code,
          zoneName: d.zone_name,
          sortOrder: d.sort_order ?? 0,
        })),
      })
    }
    if (zpRes.data && zpRes.data.length > 0) {
      set({
        zoneProducts: zpRes.data.map((d) => ({
          zoneId: d.zone_id,
          productId: d.product_id,
          sortOrder: d.sort_order ?? 0,
        })),
      })
    }
    set({ loading: false, initialized: true })
  },

  getStoreZones: (storeId) => {
    return get().zones
      .filter((z) => z.storeId === storeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },

  getZoneProductIds: (zoneId) => {
    return get().zoneProducts
      .filter((zp) => zp.zoneId === zoneId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((zp) => zp.productId)
  },

  addZone: (zone) => {
    set((s) => ({ zones: [...s.zones, zone] }))
    if (supabase) {
      supabase.from('store_zones').insert({
        id: zone.id,
        store_id: zone.storeId,
        zone_code: zone.zoneCode,
        zone_name: zone.zoneName,
        sort_order: zone.sortOrder,
      }).then()
    }
  },

  removeZone: (zoneId) => {
    set((s) => ({
      zones: s.zones.filter((z) => z.id !== zoneId),
      zoneProducts: s.zoneProducts.filter((zp) => zp.zoneId !== zoneId),
    }))
    if (supabase) {
      supabase.from('store_zones').delete().eq('id', zoneId).then()
    }
  },

  assignProduct: (zoneId, productId) => {
    const exists = get().zoneProducts.some(
      (zp) => zp.zoneId === zoneId && zp.productId === productId
    )
    if (exists) return
    set((s) => ({
      zoneProducts: [...s.zoneProducts, { zoneId, productId, sortOrder: 0 }],
    }))
    if (supabase) {
      supabase.from('zone_products').insert({
        zone_id: zoneId,
        product_id: productId,
        sort_order: 0,
      }).then()
    }
  },

  unassignProduct: (zoneId, productId) => {
    set((s) => ({
      zoneProducts: s.zoneProducts.filter(
        (zp) => !(zp.zoneId === zoneId && zp.productId === productId)
      ),
    }))
    if (supabase) {
      supabase.from('zone_products').delete()
        .eq('zone_id', zoneId)
        .eq('product_id', productId)
        .then()
    }
  },

  getAssignedZoneIds: (storeId, productId) => {
    const storeZoneIds = get().zones
      .filter((z) => z.storeId === storeId)
      .map((z) => z.id)
    return get().zoneProducts
      .filter((zp) => storeZoneIds.includes(zp.zoneId) && zp.productId === productId)
      .map((zp) => zp.zoneId)
  },
}))
