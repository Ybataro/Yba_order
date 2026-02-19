import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProductStore } from '@/stores/useProductStore'
import { useZoneStore } from '@/stores/useZoneStore'
import type { StoreProduct } from '@/data/storeProducts'
import type { StoreZone } from '@/data/zones'

interface ZoneFilterResult {
  products: StoreProduct[]
  categories: string[]
  storeZones: StoreZone[]
  currentZone: string | null
  setZone: (zoneCode: string | null) => void
}

export function useZoneFilteredProducts(storeId: string): ZoneFilterResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const allProducts = useProductStore((s) => s.items)
  const allCategories = useProductStore((s) => s.categories)
  const zones = useZoneStore((s) => s.zones)
  const zoneProducts = useZoneStore((s) => s.zoneProducts)

  const currentZone = searchParams.get('zone')

  const setZone = useCallback((zoneCode: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (zoneCode) {
        next.set('zone', zoneCode)
      } else {
        next.delete('zone')
      }
      return next
    }, { replace: true })
  }, [setSearchParams])

  const storeZones = useMemo(() => {
    return zones
      .filter((z) => z.storeId === storeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [zones, storeId])

  const matchedZone = useMemo(() => {
    if (!currentZone) return null
    return storeZones.find((z) => z.zoneCode === currentZone) ?? null
  }, [currentZone, storeZones])

  const products = useMemo(() => {
    if (!matchedZone) return allProducts
    const productIds = zoneProducts
      .filter((zp) => zp.zoneId === matchedZone.id)
      .map((zp) => zp.productId)
    const idSet = new Set(productIds)
    return allProducts.filter((p) => idSet.has(p.id))
  }, [matchedZone, allProducts, zoneProducts])

  const categories = useMemo(() => {
    const productCats = new Set(products.map((p) => p.category))
    return allCategories.filter((c) => productCats.has(c))
  }, [products, allCategories])

  return { products, categories, storeZones, currentZone, setZone }
}
