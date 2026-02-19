import { useState, useCallback, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { useZoneFilteredProducts } from '@/hooks/useZoneFilteredProducts'
import { supabase } from '@/lib/supabase'
import { inventorySessionId, getTodayTW } from '@/lib/session'
import { Send, RefreshCw } from 'lucide-react'

interface InventoryEntry {
  onShelf: string
  stock: string
  discarded: string
}

export default function Inventory() {
  const { storeId } = useParams<{ storeId: string }>()
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const { products: storeProducts, categories: productCategories, storeZones, currentZone, setZone } = useZoneFilteredProducts(storeId || '')

  const hasMultipleZones = storeZones.length > 1
  const currentZoneObj = storeZones.find((z) => z.zoneCode === currentZone)
  const zoneLabel = currentZoneObj ? ` ${currentZoneObj.zoneName}` : ''

  const today = getTodayTW()
  const sessionId = inventorySessionId(storeId || '', today, currentZone || '')

  const [data, setData] = useState<Record<string, InventoryEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    const sid = inventorySessionId(storeId, today, currentZone || '')
    setLoading(true)
    supabase
      .from('inventory_sessions')
      .select('id')
      .eq('id', sid)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        supabase!
          .from('inventory_items')
          .select('*')
          .eq('session_id', sid)
          .then(({ data: items }) => {
            if (items && items.length > 0) {
              const loaded: Record<string, InventoryEntry> = {}
              items.forEach((item) => {
                loaded[item.product_id] = {
                  onShelf: item.on_shelf != null ? String(item.on_shelf) : '',
                  stock: item.stock != null ? String(item.stock) : '',
                  discarded: item.discarded != null ? String(item.discarded) : '',
                }
              })
              setData(loaded)
            }
            setLoading(false)
          })
      })
  }, [storeId, currentZone, today])

  const getEntry = useCallback((productId: string): InventoryEntry => {
    return data[productId] ?? { onShelf: '', stock: '', discarded: '' }
  }, [data])

  const updateField = useCallback((productId: string, field: keyof InventoryEntry, value: string) => {
    setData(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? { onShelf: '', stock: '', discarded: '' }), [field]: value }
    }))
  }, [])

  const focusNext = useCallback(() => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-inv]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) {
      arr[idx + 1].focus()
    }
  }, [])

  const completedCount = useMemo(() => {
    return storeProducts.filter(p => {
      const e = getEntry(p.id)
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data, storeProducts, getEntry])

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [storeProducts, productCategories])

  const getCategoryCompleted = useCallback((products: typeof storeProducts) => {
    return products.filter(p => {
      const e = getEntry(p.id)
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data, getEntry])

  const handleSubmit = async () => {
    if (!supabase || !storeId) {
      showToast('盤點資料已提交成功！')
      return
    }

    setSubmitting(true)

    // Upsert session
    const { error: sessionErr } = await supabase
      .from('inventory_sessions')
      .upsert({
        id: sessionId,
        store_id: storeId,
        date: today,
        zone_code: currentZone || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      setSubmitting(false)
      return
    }

    // Build items (only those with at least one value)
    const items = storeProducts
      .filter(p => {
        const e = getEntry(p.id)
        return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
      })
      .map(p => {
        const e = getEntry(p.id)
        return {
          session_id: sessionId,
          product_id: p.id,
          on_shelf: e.onShelf !== '' ? parseFloat(e.onShelf) : null,
          stock: e.stock !== '' ? parseFloat(e.stock) : null,
          discarded: e.discarded !== '' ? parseFloat(e.discarded) : null,
        }
      })

    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from('inventory_items')
        .upsert(items, { onConflict: 'session_id,product_id' })

      if (itemErr) {
        showToast('提交失敗：' + itemErr.message, 'error')
        setSubmitting(false)
        return
      }
    }

    setIsEdit(true)
    setSubmitting(false)
    showToast(isEdit ? '盤點資料已更新！' : '盤點資料已提交成功！')
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName}${zoneLabel} 物料盤點`} />

      {/* Edit badge */}
      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入今日盤點紀錄，修改後可重新提交</span>
        </div>
      )}

      {/* Zone selector pills */}
      {hasMultipleZones && !currentZone && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="text-sm text-amber-800 font-medium mb-2">請選擇盤點樓層</p>
          <div className="flex gap-2">
            {storeZones.map((zone) => (
              <button
                key={zone.id}
                onClick={() => setZone(zone.zoneCode)}
                className="flex-1 py-2 px-4 rounded-full text-sm font-semibold bg-white border-2 border-brand-oak text-brand-oak active:scale-95 transition-transform"
              >
                {zone.zoneName}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasMultipleZones && currentZone && (
        <div className="flex items-center gap-2 px-4 py-2 bg-surface-section border-b border-gray-100">
          {storeZones.map((zone) => (
            <button
              key={zone.id}
              onClick={() => setZone(zone.zoneCode)}
              className={`py-1 px-4 rounded-full text-sm font-semibold transition-colors ${
                zone.zoneCode === currentZone
                  ? 'bg-brand-oak text-white'
                  : 'bg-white text-brand-oak border border-brand-oak/30'
              }`}
            >
              {zone.zoneName}
            </button>
          ))}
          <button
            onClick={() => setZone(null)}
            className="py-1 px-3 rounded-full text-xs text-brand-lotus border border-gray-200 bg-white ml-auto"
          >
            全部
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          <ProgressBar current={completedCount} total={storeProducts.length} />

          {Array.from(productsByCategory.entries()).map(([category, products]) => (
            <div key={category}>
              <SectionHeader
                title={category}
                icon="■"
                completed={getCategoryCompleted(products)}
                total={products.length}
              />
              {/* 欄位標題列 */}
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[60px] text-center">架上</span>
                <span className="w-[60px] text-center">庫存</span>
                <span className="w-[60px] text-center">倒掉</span>
              </div>
              <div className="bg-white">
                {products.map((product, idx) => {
                  const entry = getEntry(product.id)
                  const isFilled = entry.onShelf !== '' || entry.stock !== '' || entry.discarded !== ''

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''} ${isFilled ? 'bg-surface-filled/30' : ''}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-brand-oak leading-tight">{product.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">
                          {product.shelfLifeDays ? `期效${product.shelfLifeDays}` : ''}
                          {product.baseStock ? ` · ${product.baseStock}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <NumericInput
                          value={entry.onShelf}
                          onChange={(v) => updateField(product.id, 'onShelf', v)}
                          isFilled
                          onNext={focusNext}
                          data-inv=""
                        />
                        <NumericInput
                          value={entry.stock}
                          onChange={(v) => updateField(product.id, 'stock', v)}
                          isFilled
                          onNext={focusNext}
                          data-inv=""
                        />
                        <NumericInput
                          value={entry.discarded}
                          onChange={(v) => updateField(product.id, 'discarded', v)}
                          isFilled
                          className={entry.discarded && parseFloat(entry.discarded) > 0 ? '!text-status-danger' : ''}
                          onNext={focusNext}
                          data-inv=""
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新盤點資料' : '預覽並提交盤點'}
            onClick={handleSubmit}
            icon={<Send size={18} />}
            disabled={submitting}
          />
        </>
      )}
    </div>
  )
}
