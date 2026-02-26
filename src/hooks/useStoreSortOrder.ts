import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface SortRow {
  item_type: 'category' | 'item'
  item_key: string
  sort_order: number
}

interface UseStoreSortOrderResult {
  sortCategories: (categories: string[]) => string[]
  sortItems: <T extends { id: string }>(items: T[]) => T[]
  loading: boolean
}

export function useStoreSortOrder(
  storeId: string,
  scope: 'product' | 'material',
): UseStoreSortOrderResult {
  const [rows, setRows] = useState<SortRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('store_item_sort')
      .select('item_type, item_key, sort_order')
      .eq('store_id', storeId)
      .eq('scope', scope)
      .then(({ data }) => {
        if (!cancelled && data) setRows(data as SortRow[])
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [storeId, scope])

  const categoryOrder = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.item_type === 'category') map.set(r.item_key, r.sort_order)
    }
    return map
  }, [rows])

  const itemOrder = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) {
      if (r.item_type === 'item') map.set(r.item_key, r.sort_order)
    }
    return map
  }, [rows])

  const sortCategories = useCallback(
    (categories: string[]): string[] => {
      if (categoryOrder.size === 0) return categories
      return [...categories].sort((a, b) => {
        const oa = categoryOrder.get(a)
        const ob = categoryOrder.get(b)
        if (oa == null && ob == null) return 0
        if (oa == null) return 1
        if (ob == null) return 1
        return oa - ob
      })
    },
    [categoryOrder],
  )

  const sortItems = useCallback(
    <T extends { id: string }>(items: T[]): T[] => {
      if (itemOrder.size === 0) return items
      return [...items].sort((a, b) => {
        const oa = itemOrder.get(a.id)
        const ob = itemOrder.get(b.id)
        if (oa == null && ob == null) return 0
        if (oa == null) return 1
        if (ob == null) return 1
        return oa - ob
      })
    },
    [itemOrder],
  )

  return { sortCategories, sortItems, loading }
}
