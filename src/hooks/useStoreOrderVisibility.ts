import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface UseStoreOrderVisibilityResult {
  hiddenIds: Set<string>
  loading: boolean
  toggleHidden: (productId: string) => Promise<void>
  filterProducts: <T extends { id: string }>(products: T[]) => T[]
}

export function useStoreOrderVisibility(storeId: string): UseStoreOrderVisibilityResult {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    setLoading(true)

    supabase
      .from('store_order_hidden')
      .select('product_id')
      .eq('store_id', storeId)
      .then(({ data }) => {
        setHiddenIds(new Set((data || []).map(r => r.product_id)))
        setLoading(false)
      })
  }, [storeId])

  const toggleHidden = useCallback(async (productId: string) => {
    if (!supabase || !storeId) return

    const isHidden = hiddenIds.has(productId)
    if (isHidden) {
      await supabase
        .from('store_order_hidden')
        .delete()
        .eq('store_id', storeId)
        .eq('product_id', productId)
      setHiddenIds(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    } else {
      await supabase
        .from('store_order_hidden')
        .insert({ store_id: storeId, product_id: productId })
      setHiddenIds(prev => new Set(prev).add(productId))
    }
  }, [storeId, hiddenIds])

  const filterProducts = useCallback(<T extends { id: string }>(products: T[]): T[] => {
    return products.filter(p => !hiddenIds.has(p.id))
  }, [hiddenIds])

  return { hiddenIds, loading, toggleHidden, filterProducts }
}

// Bulk version for admin page (load all stores at once)
interface UseAllStoreOrderVisibilityResult {
  hiddenMap: Record<string, Set<string>>
  loading: boolean
  toggleHidden: (storeId: string, productId: string) => Promise<void>
}

export function useAllStoreOrderVisibility(): UseAllStoreOrderVisibilityResult {
  const [hiddenMap, setHiddenMap] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    supabase
      .from('store_order_hidden')
      .select('store_id, product_id')
      .then(({ data }) => {
        const map: Record<string, Set<string>> = {}
        ;(data || []).forEach(r => {
          if (!map[r.store_id]) map[r.store_id] = new Set()
          map[r.store_id].add(r.product_id)
        })
        setHiddenMap(map)
        setLoading(false)
      })
  }, [])

  const toggleHidden = useCallback(async (storeId: string, productId: string) => {
    if (!supabase) return

    const storeSet = hiddenMap[storeId] || new Set()
    const isHidden = storeSet.has(productId)

    if (isHidden) {
      await supabase
        .from('store_order_hidden')
        .delete()
        .eq('store_id', storeId)
        .eq('product_id', productId)
      setHiddenMap(prev => {
        const next = new Set(prev[storeId] || [])
        next.delete(productId)
        return { ...prev, [storeId]: next }
      })
    } else {
      await supabase
        .from('store_order_hidden')
        .insert({ store_id: storeId, product_id: productId })
      setHiddenMap(prev => {
        const next = new Set(prev[storeId] || [])
        next.add(productId)
        return { ...prev, [storeId]: next }
      })
    }
  }, [hiddenMap])

  return { hiddenMap, loading, toggleHidden }
}
