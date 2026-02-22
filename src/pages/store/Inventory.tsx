import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { DateNav } from '@/components/DateNav'
import { useZoneFilteredProducts } from '@/hooks/useZoneFilteredProducts'
import { supabase } from '@/lib/supabase'
import { inventorySessionId, getTodayTW } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { Send, RefreshCw } from 'lucide-react'

interface InventoryEntry {
  onShelf: string
  stock: string
  discarded: string
}

export default function Inventory() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const { products: allZoneProducts, categories: productCategories, storeZones, currentZone, setZone } = useZoneFilteredProducts(storeId || '')
  const storeProducts = useMemo(() => allZoneProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'inventory_only'), [allZoneProducts])

  const hasMultipleZones = storeZones.length > 1
  const isMergedView = hasMultipleZones && !currentZone
  const currentZoneObj = storeZones.find((z) => z.zoneCode === currentZone)
  const zoneLabel = isMergedView ? '' : currentZoneObj ? ` ${currentZoneObj.zoneName}` : ''

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const sessionId = inventorySessionId(storeId || '', selectedDate, currentZone || '')

  const [data, setData] = useState<Record<string, InventoryEntry>>({})
  const originalData = useRef<Record<string, InventoryEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Merged view state
  const [mergedData, setMergedData] = useState<Record<string, InventoryEntry>>({})
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, boolean>>({})
  const [mergedLoading, setMergedLoading] = useState(false)

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    const sid = inventorySessionId(storeId, selectedDate, currentZone || '')
    setLoading(true)
    setIsEdit(false)
    setData({})
    originalData.current = {}

    const load = async () => {
      try {
        const { data: session } = await supabase!
          .from('inventory_sessions')
          .select('id')
          .eq('id', sid)
          .maybeSingle()

        if (!session) { setLoading(false); return }
        setIsEdit(true)

        const { data: items } = await supabase!
          .from('inventory_items')
          .select('*')
          .eq('session_id', sid)

        if (items && items.length > 0) {
          const loaded: Record<string, InventoryEntry> = {}
          items.forEach((item) => {
            loaded[item.product_id] = {
              onShelf: item.on_shelf != null ? String(item.on_shelf) : '',
              stock: item.stock != null ? String(item.stock) : '',
              discarded: item.discarded != null ? String(item.discarded) : '',
            }
          })
          originalData.current = JSON.parse(JSON.stringify(loaded))
          setData(loaded)
        }
      } catch {
        // ignore fetch errors
      }
      setLoading(false)
    }

    load()
  }, [storeId, currentZone, selectedDate])

  // Load merged data for "全部" view
  useEffect(() => {
    if (!supabase || !storeId || !isMergedView) return
    setMergedLoading(true)

    const load = async () => {
      try {
        const zoneSids = storeZones.map((z) =>
          inventorySessionId(storeId, selectedDate, z.zoneCode)
        )

        // Check which sessions exist
        const { data: sessions } = await supabase!
          .from('inventory_sessions')
          .select('id, zone_code')
          .in('id', zoneSids)

        const existingIds = new Set((sessions || []).map((s) => s.id))
        const statuses: Record<string, boolean> = {}
        storeZones.forEach((z) => {
          const sid = inventorySessionId(storeId, selectedDate, z.zoneCode)
          statuses[z.zoneCode] = existingIds.has(sid)
        })
        setZoneStatuses(statuses)

        // Load all items from existing sessions
        const existingSids = zoneSids.filter((sid) => existingIds.has(sid))
        if (existingSids.length === 0) {
          setMergedData({})
          setMergedLoading(false)
          return
        }

        const { data: items } = await supabase!
          .from('inventory_items')
          .select('*')
          .in('session_id', existingSids)

        // Merge: sum values for same product across zones
        const merged: Record<string, InventoryEntry> = {}
        if (items) {
          items.forEach((item) => {
            const existing = merged[item.product_id]
            if (!existing) {
              merged[item.product_id] = {
                onShelf: item.on_shelf != null ? String(item.on_shelf) : '',
                stock: item.stock != null ? String(item.stock) : '',
                discarded: item.discarded != null ? String(item.discarded) : '',
              }
            } else {
              // Sum values
              const addNum = (a: string, b: number | null): string => {
                if (b == null) return a
                if (a === '') return String(b)
                return String(parseFloat(a) + b)
              }
              merged[item.product_id] = {
                onShelf: addNum(existing.onShelf, item.on_shelf),
                stock: addNum(existing.stock, item.stock),
                discarded: addNum(existing.discarded, item.discarded),
              }
            }
          })
        }
        setMergedData(merged)
      } catch {
        // ignore
      }
      setMergedLoading(false)
    }

    load()
  }, [storeId, isMergedView, storeZones, selectedDate])

  const getEntry = useCallback((productId: string): InventoryEntry => {
    if (isMergedView) return mergedData[productId] ?? { onShelf: '', stock: '', discarded: '' }
    return data[productId] ?? { onShelf: '', stock: '', discarded: '' }
  }, [data, isMergedView, mergedData])

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

  const isItemModified = useCallback((productId: string): boolean => {
    if (!isEdit) return false
    const orig = originalData.current[productId]
    const curr = data[productId]
    if (!orig && !curr) return false
    if (!orig) return !!(curr && (curr.onShelf !== '' || curr.stock !== '' || curr.discarded !== ''))
    if (!curr) return true
    return orig.onShelf !== curr.onShelf || orig.stock !== curr.stock || orig.discarded !== curr.discarded
  }, [isEdit, data])

  const modifiedCount = useMemo(() => {
    if (!isEdit) return 0
    return storeProducts.filter(p => isItemModified(p.id)).length
  }, [isEdit, storeProducts, isItemModified])

  const getCategoryCompleted = useCallback((products: typeof storeProducts) => {
    return products.filter(p => {
      const e = getEntry(p.id)
      return e.onShelf !== '' || e.stock !== '' || e.discarded !== ''
    }).length
  }, [data, getEntry])

  const handleSubmit = async () => {
    if (!storeId) return

    setSubmitting(true)

    const session = {
      id: sessionId,
      store_id: storeId,
      date: selectedDate,
      zone_code: currentZone || '',
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }

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

    const success = await submitWithOffline({
      type: 'inventory',
      storeId,
      sessionId,
      session,
      items,
      onSuccess: (msg) => {
        originalData.current = JSON.parse(JSON.stringify(data))
        setIsEdit(true)
        logAudit('inventory_submit', storeId, sessionId, { itemCount: items.length })
        showToast(msg || (isEdit ? '盤點資料已更新！' : '盤點資料已提交成功！'))
      },
      onError: (msg) => showToast(msg, 'error'),
    })

    if (success && !navigator.onLine) {
      // offline success — still mark as submitted locally
      originalData.current = JSON.parse(JSON.stringify(data))
      setIsEdit(true)
    }

    setSubmitting(false)
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName}${zoneLabel} 物料盤點`} />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {/* Edit badge */}
      {isEdit && !isMergedView && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : selectedDate}盤點紀錄，修改後可重新提交</span>
          {modifiedCount > 0 && (
            <span className="ml-auto font-medium text-brand-lotus">已修改 {modifiedCount} 項</span>
          )}
        </div>
      )}

      {/* Zone selector pills */}
      {hasMultipleZones && (
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
            className={`py-1 px-4 rounded-full text-sm font-semibold transition-colors ml-auto ${
              isMergedView
                ? 'bg-brand-oak text-white'
                : 'bg-white text-brand-oak border border-brand-oak/30'
            }`}
          >
            全部
          </button>
        </div>
      )}

      {/* Merged view status banner */}
      {isMergedView && !mergedLoading && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200">
          <p className="text-xs font-medium text-blue-800 mb-1">📋 合併檢視（唯讀）</p>
          <div className="flex gap-3 text-xs">
            {storeZones.map((zone) => (
              <span key={zone.id} className={zoneStatuses[zone.zoneCode] ? 'text-green-700' : 'text-red-600'}>
                {zoneStatuses[zone.zoneCode] ? '✓' : '✗'} {zone.zoneName} {zoneStatuses[zone.zoneCode] ? '已提交' : '未提交'}
              </span>
            ))}
          </div>
        </div>
      )}

      {(isMergedView ? mergedLoading : loading) ? (
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
                  const modified = isItemModified(product.id)

                  return (
                    <div
                      key={product.id}
                      className={`flex items-center px-4 py-2 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''} ${modified ? 'bg-amber-100 border-l-3 border-l-amber-500' : isFilled ? 'bg-surface-filled/30' : ''}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-semibold text-brand-oak leading-tight">{product.name}</p>
                        <p className="text-[10px] text-brand-lotus leading-tight">
                          {product.shelfLifeDays ? `期效${product.shelfLifeDays}` : ''}
                          {product.baseStock ? ` · ${product.baseStock}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isMergedView ? (
                          <>
                            <span className="w-[60px] text-center text-sm text-brand-oak">{entry.onShelf || '-'}</span>
                            <span className="w-[60px] text-center text-sm text-brand-oak">{entry.stock || '-'}</span>
                            <span className={`w-[60px] text-center text-sm ${entry.discarded && parseFloat(entry.discarded) > 0 ? 'text-status-danger' : 'text-brand-oak'}`}>{entry.discarded || '-'}</span>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {!isMergedView && (
            <BottomAction
              label={submitting ? '提交中...' : isEdit ? '更新盤點資料' : '預覽並提交盤點'}
              onClick={handleSubmit}
              icon={<Send size={18} />}
              disabled={submitting}
            />
          )}
        </>
      )}
    </div>
  )
}
