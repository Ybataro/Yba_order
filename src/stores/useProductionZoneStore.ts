import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

// ── Types ──

export interface FieldDef {
  id: string
  item_id: string
  field_key: string
  label: string
  field_type: 'numeric' | 'select' | 'text' | 'sugar_select'
  unit: string
  options: string[]
  sort_order: number
  is_active: boolean
}

export interface ItemDef {
  id: string
  zone_id: string
  name: string
  sort_order: number
  is_active: boolean
  fields: FieldDef[]
}

export interface ZoneDef {
  id: string
  name: string
  icon: string
  notice: string
  sort_order: number
  is_active: boolean
  items: ItemDef[]
}

export interface SugarTypeDef {
  id: string
  name: string
  unit: string
  sort_order: number
  is_active: boolean
}

interface ProductionZoneState {
  zones: ZoneDef[]
  sugarTypes: SugarTypeDef[]
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>

  // Zone CRUD
  addZone: (zone: Omit<ZoneDef, 'items'>) => void
  updateZone: (id: string, partial: Partial<Pick<ZoneDef, 'name' | 'icon' | 'notice' | 'is_active'>>) => void
  removeZone: (id: string) => void
  swapZoneOrder: (idA: string, idB: string) => void

  // Item CRUD
  addItem: (item: Omit<ItemDef, 'fields'>) => void
  updateItem: (id: string, partial: Partial<Pick<ItemDef, 'name' | 'is_active'>>) => void
  removeItem: (id: string) => void
  swapItemOrder: (idA: string, idB: string) => void

  // Field CRUD
  addField: (field: FieldDef) => void
  updateField: (id: string, partial: Partial<Pick<FieldDef, 'label' | 'field_type' | 'unit' | 'options' | 'is_active'>>) => void
  removeField: (id: string) => void
  swapFieldOrder: (idA: string, idB: string) => void

  // Sugar CRUD
  addSugarType: (sugar: SugarTypeDef) => void
  updateSugarType: (id: string, partial: Partial<Pick<SugarTypeDef, 'name' | 'unit' | 'is_active'>>) => void
  removeSugarType: (id: string) => void
  swapSugarTypeOrder: (idA: string, idB: string) => void
}

// ── Helper: swap sort_order between two items in an array ──
function swapSortOrder<T extends { id: string; sort_order: number }>(arr: T[], idA: string, idB: string): T[] {
  const a = arr.find((x) => x.id === idA)
  const b = arr.find((x) => x.id === idB)
  if (!a || !b) return arr
  return arr.map((x) => {
    if (x.id === idA) return { ...x, sort_order: b.sort_order }
    if (x.id === idB) return { ...x, sort_order: a.sort_order }
    return x
  }).sort((x, y) => x.sort_order - y.sort_order)
}

export const useProductionZoneStore = create<ProductionZoneState>()((set, get) => ({
  zones: [],
  sugarTypes: [],
  loading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized || !supabase) return
    set({ loading: true })

    const [zoneRes, itemRes, fieldRes, sugarRes] = await Promise.all([
      supabase.from('production_zone_defs').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('production_item_defs').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('production_field_defs').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('sugar_types').select('*').eq('is_active', true).order('sort_order'),
    ])

    const rawZones = zoneRes.data ?? []
    const rawItems = itemRes.data ?? []
    const rawFields = fieldRes.data ?? []
    const sugarTypes: SugarTypeDef[] = (sugarRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit ?? '',
      sort_order: s.sort_order ?? 0,
      is_active: s.is_active ?? true,
    }))

    // Group fields by item_id
    const fieldsByItem: Record<string, FieldDef[]> = {}
    rawFields.forEach((f) => {
      const fd: FieldDef = {
        id: f.id,
        item_id: f.item_id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type ?? 'numeric',
        unit: f.unit ?? '',
        options: f.options ?? [],
        sort_order: f.sort_order ?? 0,
        is_active: f.is_active ?? true,
      }
      if (!fieldsByItem[f.item_id]) fieldsByItem[f.item_id] = []
      fieldsByItem[f.item_id].push(fd)
    })

    // Group items by zone_id
    const itemsByZone: Record<string, ItemDef[]> = {}
    rawItems.forEach((i) => {
      const item: ItemDef = {
        id: i.id,
        zone_id: i.zone_id,
        name: i.name,
        sort_order: i.sort_order ?? 0,
        is_active: i.is_active ?? true,
        fields: fieldsByItem[i.id] ?? [],
      }
      if (!itemsByZone[i.zone_id]) itemsByZone[i.zone_id] = []
      itemsByZone[i.zone_id].push(item)
    })

    const zones: ZoneDef[] = rawZones.map((z) => ({
      id: z.id,
      name: z.name,
      icon: z.icon ?? '',
      notice: z.notice ?? '',
      sort_order: z.sort_order ?? 0,
      is_active: z.is_active ?? true,
      items: itemsByZone[z.id] ?? [],
    }))

    set({ zones, sugarTypes, loading: false, initialized: true })
  },

  // ── Zone CRUD ──
  addZone: (zone) => {
    set((s) => ({ zones: [...s.zones, { ...zone, items: [] }] }))
    supabase?.from('production_zone_defs').insert({
      id: zone.id, name: zone.name, icon: zone.icon, notice: zone.notice,
      sort_order: zone.sort_order, is_active: zone.is_active,
    }).then()
  },

  updateZone: (id, partial) => {
    set((s) => ({
      zones: s.zones.map((z) => z.id === id ? { ...z, ...partial } : z),
    }))
    supabase?.from('production_zone_defs').update(partial).eq('id', id).then()
  },

  removeZone: (id) => {
    set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }))
    supabase?.from('production_zone_defs').delete().eq('id', id).then()
  },

  swapZoneOrder: (idA, idB) => {
    const { zones } = get()
    const a = zones.find((z) => z.id === idA)
    const b = zones.find((z) => z.id === idB)
    if (!a || !b) return
    const newZones = swapSortOrder(zones, idA, idB)
    set({ zones: newZones })
    supabase?.from('production_zone_defs').update({ sort_order: b.sort_order }).eq('id', idA).then()
    supabase?.from('production_zone_defs').update({ sort_order: a.sort_order }).eq('id', idB).then()
  },

  // ── Item CRUD ──
  addItem: (item) => {
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === item.zone_id ? { ...z, items: [...z.items, { ...item, fields: [] }] } : z
      ),
    }))
    supabase?.from('production_item_defs').insert({
      id: item.id, zone_id: item.zone_id, name: item.name,
      sort_order: item.sort_order, is_active: item.is_active,
    }).then()
  },

  updateItem: (id, partial) => {
    set((s) => ({
      zones: s.zones.map((z) => ({
        ...z,
        items: z.items.map((i) => i.id === id ? { ...i, ...partial } : i),
      })),
    }))
    supabase?.from('production_item_defs').update(partial).eq('id', id).then()
  },

  removeItem: (id) => {
    set((s) => ({
      zones: s.zones.map((z) => ({
        ...z,
        items: z.items.filter((i) => i.id !== id),
      })),
    }))
    supabase?.from('production_item_defs').delete().eq('id', id).then()
  },

  swapItemOrder: (idA, idB) => {
    set((s) => {
      const newZones = s.zones.map((z) => {
        const a = z.items.find((i) => i.id === idA)
        const b = z.items.find((i) => i.id === idB)
        if (!a || !b) return z
        return { ...z, items: swapSortOrder(z.items, idA, idB) }
      })
      return { zones: newZones }
    })
    const allItems = get().zones.flatMap((z) => z.items)
    const a = allItems.find((i) => i.id === idA)
    const b = allItems.find((i) => i.id === idB)
    if (a && b) {
      supabase?.from('production_item_defs').update({ sort_order: b.sort_order }).eq('id', idA).then()
      supabase?.from('production_item_defs').update({ sort_order: a.sort_order }).eq('id', idB).then()
    }
  },

  // ── Field CRUD ──
  addField: (field) => {
    set((s) => ({
      zones: s.zones.map((z) => ({
        ...z,
        items: z.items.map((i) =>
          i.id === field.item_id ? { ...i, fields: [...i.fields, field] } : i
        ),
      })),
    }))
    supabase?.from('production_field_defs').insert({
      id: field.id, item_id: field.item_id, field_key: field.field_key,
      label: field.label, field_type: field.field_type, unit: field.unit,
      options: field.options, sort_order: field.sort_order, is_active: field.is_active,
    }).then()
  },

  updateField: (id, partial) => {
    set((s) => ({
      zones: s.zones.map((z) => ({
        ...z,
        items: z.items.map((i) => ({
          ...i,
          fields: i.fields.map((f) => f.id === id ? { ...f, ...partial } : f),
        })),
      })),
    }))
    supabase?.from('production_field_defs').update(partial).eq('id', id).then()
  },

  removeField: (id) => {
    set((s) => ({
      zones: s.zones.map((z) => ({
        ...z,
        items: z.items.map((i) => ({
          ...i,
          fields: i.fields.filter((f) => f.id !== id),
        })),
      })),
    }))
    supabase?.from('production_field_defs').delete().eq('id', id).then()
  },

  swapFieldOrder: (idA, idB) => {
    set((s) => {
      const newZones = s.zones.map((z) => ({
        ...z,
        items: z.items.map((i) => {
          const a = i.fields.find((f) => f.id === idA)
          const b = i.fields.find((f) => f.id === idB)
          if (!a || !b) return i
          return { ...i, fields: swapSortOrder(i.fields, idA, idB) }
        }),
      }))
      return { zones: newZones }
    })
    const allFields = get().zones.flatMap((z) => z.items.flatMap((i) => i.fields))
    const a = allFields.find((f) => f.id === idA)
    const b = allFields.find((f) => f.id === idB)
    if (a && b) {
      supabase?.from('production_field_defs').update({ sort_order: b.sort_order }).eq('id', idA).then()
      supabase?.from('production_field_defs').update({ sort_order: a.sort_order }).eq('id', idB).then()
    }
  },

  // ── Sugar CRUD ──
  addSugarType: (sugar) => {
    set((s) => ({ sugarTypes: [...s.sugarTypes, sugar] }))
    supabase?.from('sugar_types').insert({
      id: sugar.id, name: sugar.name, unit: sugar.unit, sort_order: sugar.sort_order, is_active: sugar.is_active,
    }).then()
  },

  updateSugarType: (id, partial) => {
    set((s) => ({
      sugarTypes: s.sugarTypes.map((st) => st.id === id ? { ...st, ...partial } : st),
    }))
    supabase?.from('sugar_types').update(partial).eq('id', id).then()
  },

  removeSugarType: (id) => {
    set((s) => ({ sugarTypes: s.sugarTypes.filter((st) => st.id !== id) }))
    supabase?.from('sugar_types').delete().eq('id', id).then()
  },

  swapSugarTypeOrder: (idA, idB) => {
    const { sugarTypes } = get()
    const a = sugarTypes.find((st) => st.id === idA)
    const b = sugarTypes.find((st) => st.id === idB)
    if (!a || !b) return
    set({ sugarTypes: swapSortOrder(sugarTypes, idA, idB) })
    supabase?.from('sugar_types').update({ sort_order: b.sort_order }).eq('id', idA).then()
    supabase?.from('sugar_types').update({ sort_order: a.sort_order }).eq('id', idB).then()
  },
}))
