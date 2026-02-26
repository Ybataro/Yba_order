import { useState, useEffect, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'

type Tab = 'category' | 'item'

interface SortRow {
  store_id: string
  scope: string
  item_type: string
  item_key: string
  sort_order: number
}

export default function ItemSortManager() {
  const { showToast } = useToast()
  const stores = useStoreStore((s) => s.items)
  const products = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const materials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)

  const tabs: { id: string; name: string }[] = [
    ...stores.map((s) => ({ id: s.id, name: s.name })),
    { id: 'kitchen', name: '央廚' },
  ]

  const [selectedStore, setSelectedStore] = useState(tabs[0]?.id || 'lehua')
  const [activeTab, setActiveTab] = useState<Tab>('category')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [sortData, setSortData] = useState<SortRow[]>([])
  const [loading, setLoading] = useState(false)

  const isKitchen = selectedStore === 'kitchen'
  const scope = isKitchen ? 'material' : 'product'
  const categories = isKitchen ? materialCategories : productCategories
  const items = isKitchen ? materials : products

  // Load sort data
  const loadSortData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('store_item_sort')
      .select('*')
      .eq('store_id', selectedStore)
      .eq('scope', scope)
    setSortData((data as SortRow[]) || [])
    setLoading(false)
  }, [selectedStore, scope])

  useEffect(() => {
    loadSortData()
    setSelectedCat(null)
  }, [loadSortData])

  // Get sorted categories
  const getSortedCategories = (): string[] => {
    const catRows = sortData.filter((r) => r.item_type === 'category')
    if (catRows.length === 0) return [...categories]
    const orderMap = new Map(catRows.map((r) => [r.item_key, r.sort_order]))
    return [...categories].sort((a, b) => {
      const oa = orderMap.get(a)
      const ob = orderMap.get(b)
      if (oa == null && ob == null) return 0
      if (oa == null) return 1
      if (ob == null) return 1
      return oa - ob
    })
  }

  // Get sorted items within a category
  const getSortedItems = (cat: string) => {
    const catItems = items.filter((i) => i.category === cat)
    const itemRows = sortData.filter((r) => r.item_type === 'item')
    if (itemRows.length === 0) return catItems
    const orderMap = new Map(itemRows.map((r) => [r.item_key, r.sort_order]))
    return [...catItems].sort((a, b) => {
      const oa = orderMap.get(a.id)
      const ob = orderMap.get(b.id)
      if (oa == null && ob == null) return 0
      if (oa == null) return 1
      if (ob == null) return 1
      return oa - ob
    })
  }

  // Swap and save
  const swapAndSave = async (
    itemType: 'category' | 'item',
    orderedKeys: string[],
    idx: number,
    direction: 'up' | 'down',
  ) => {
    if (!supabase) return
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= orderedKeys.length) return

    // Build full order with new positions
    const swapped = [...orderedKeys]
    ;[swapped[idx], swapped[newIdx]] = [swapped[newIdx], swapped[idx]]

    const upserts = swapped.map((key, i) => ({
      store_id: selectedStore,
      scope,
      item_type: itemType,
      item_key: key,
      sort_order: i,
    }))

    // Optimistic update
    setSortData((prev) => {
      const others = prev.filter(
        (r) => !(r.item_type === itemType && upserts.some((u) => u.item_key === r.item_key)),
      )
      return [...others, ...upserts]
    })

    const { error } = await supabase.from('store_item_sort').upsert(upserts)
    if (error) {
      showToast('儲存失敗', 'error')
      loadSortData()
    }
  }

  // Reset to default
  const handleReset = async (itemType: 'category' | 'item') => {
    if (!supabase) return
    const { error } = await supabase
      .from('store_item_sort')
      .delete()
      .eq('store_id', selectedStore)
      .eq('scope', scope)
      .eq('item_type', itemType)
    if (error) {
      showToast('重設失敗', 'error')
    } else {
      showToast('已重設為預設排序', 'success')
      loadSortData()
    }
  }

  const sortedCategories = getSortedCategories()
  const currentCatItems = selectedCat ? getSortedItems(selectedCat) : []

  return (
    <div className="page-container">
      <TopNav title="品項排序管理" backTo="/admin" />

      {/* Store selector */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedStore(t.id)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedStore === t.id
                ? 'bg-brand-oak text-white'
                : 'bg-surface-section text-brand-mocha'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Scope indicator */}
      <div className="px-4 pb-2">
        <span className="text-xs text-brand-lotus">
          排序範圍：{isKitchen ? '原物料' : '門店品項'}
        </span>
      </div>

      {/* Tab: category / item */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => setActiveTab('category')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'category'
              ? 'bg-brand-oak text-white'
              : 'bg-surface-section text-brand-mocha'
          }`}
        >
          分類排序
        </button>
        <button
          onClick={() => setActiveTab('item')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'item'
              ? 'bg-brand-oak text-white'
              : 'bg-surface-section text-brand-mocha'
          }`}
        >
          品項排序
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-brand-lotus">載入中...</div>
      ) : activeTab === 'category' ? (
        /* ── Category sort tab ── */
        <div className="px-4 pb-6">
          <div className="card divide-y divide-gray-100">
            {sortedCategories.map((cat, idx) => {
              const count = items.filter((i) => i.category === cat).length
              return (
                <div key={cat} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <button
                      disabled={idx === 0}
                      onClick={() => swapAndSave('category', sortedCategories, idx, 'up')}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-20"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      disabled={idx === sortedCategories.length - 1}
                      onClick={() => swapAndSave('category', sortedCategories, idx, 'down')}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-20"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-brand-oak">{cat}</span>
                    <span className="text-xs text-brand-lotus ml-2">({count} 個品項)</span>
                  </div>
                  <span className="text-xs text-brand-silver shrink-0">#{idx + 1}</span>
                </div>
              )
            })}
          </div>
          <button
            onClick={() => handleReset('category')}
            className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-200 text-sm text-brand-mocha hover:bg-gray-50"
          >
            <RotateCcw size={14} />
            重設為預設排序
          </button>
        </div>
      ) : (
        /* ── Item sort tab ── */
        <div className="px-4 pb-6">
          {/* Category filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-3">
            {sortedCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCat === cat
                    ? 'bg-brand-lotus text-white'
                    : 'bg-surface-section text-brand-mocha'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {!selectedCat ? (
            <div className="text-center py-10 text-sm text-brand-lotus">請選擇分類</div>
          ) : (
            <>
              <div className="card divide-y divide-gray-100">
                {currentCatItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() =>
                          swapAndSave(
                            'item',
                            currentCatItems.map((i) => i.id),
                            idx,
                            'up',
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-20"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        disabled={idx === currentCatItems.length - 1}
                        onClick={() =>
                          swapAndSave(
                            'item',
                            currentCatItems.map((i) => i.id),
                            idx,
                            'down',
                          )
                        }
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-20"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-brand-oak">{item.name}</span>
                      <span className="text-xs text-brand-lotus ml-1">
                        ({'unit' in item ? (item as { unit: string }).unit : ''})
                      </span>
                    </div>
                    <span className="text-xs text-brand-silver shrink-0">#{idx + 1}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleReset('item')}
                className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-gray-200 text-sm text-brand-mocha hover:bg-gray-50"
              >
                <RotateCcw size={14} />
                重設為預設排序
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
