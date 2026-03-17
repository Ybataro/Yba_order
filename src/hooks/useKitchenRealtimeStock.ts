import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ShipmentDeduction {
  product_id?: string  // 出貨扣除（原有）
  type?: 'order_note'  // 叫貨備註扣除
  field?: string       // order_sessions 欄位名 (bowl_k520, bowl_750, almond_1000, almond_300)
  ratio: number        // 1 單位 → 扣 ratio 單位庫存
}

export interface KitchenRealtimeItem {
  id: string
  name: string
  unit: string
  sort_order: number
  shipment_deductions: ShipmentDeduction[]
  is_active: boolean
}

interface UseKitchenRealtimeStockParams {
  selectedDate: string
}

interface UseKitchenRealtimeStockResult {
  items: KitchenRealtimeItem[]
  restockValues: Record<string, string>
  remainingValues: Record<string, number>
  updateRestock: (itemKey: string, value: string) => void
  saveItem: (itemKey: string, staffId: string) => Promise<boolean>
  loading: boolean
}

// BASE_DATE: first trusted baseline for chain calculation
const BASE_DATE = '2026-03-10'

function parseDeductions(raw: unknown): ShipmentDeduction[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((d) => d && (typeof d.product_id === 'string' || d.type === 'order_note'))
    .map((d) => ({
      ...(d.product_id ? { product_id: d.product_id } : {}),
      ...(d.type ? { type: d.type } : {}),
      ...(d.field ? { field: d.field } : {}),
      ratio: Number(d.ratio) || 1,
    }))
}

export function useKitchenRealtimeStock({
  selectedDate,
}: UseKitchenRealtimeStockParams): UseKitchenRealtimeStockResult {
  const [items, setItems] = useState<KitchenRealtimeItem[]>([])
  const [yesterdayRemaining, setYesterdayRemaining] = useState<Record<string, number>>({})
  const [restockValues, setRestockValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Load item definitions + chain-calculate remaining + load today's restock
  useEffect(() => {
    const load = async () => {
      if (!supabase) { setLoading(false); return }
      setLoading(true)
      setRestockValues({})
      setYesterdayRemaining({})
      try {
        // 1. Load item definitions
        const { data: itemData } = await supabase!
          .from('kitchen_realtime_items')
          .select('*')
          .eq('is_active', true)
          .order('sort_order')

        const activeItems: KitchenRealtimeItem[] = (itemData || []).map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          sort_order: r.sort_order,
          shipment_deductions: parseDeductions(r.shipment_deductions),
          is_active: r.is_active,
        }))
        setItems(activeItems)

        if (activeItems.length === 0) { setLoading(false); return }

        // 2. Previous date
        const d = new Date(selectedDate + 'T00:00:00+08:00')
        d.setDate(d.getDate() - 1)
        const prevDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

        // Helper: date range (inclusive)
        const dateRange = (start: string, end: string): string[] => {
          const dates: string[] = []
          const cur = new Date(start + 'T00:00:00+08:00')
          const endD = new Date(end + 'T00:00:00+08:00')
          while (cur <= endD) {
            dates.push(cur.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }))
            cur.setDate(cur.getDate() + 1)
          }
          return dates
        }

        // Collect all shipment product_ids for deduction lookup
        const allProductIds = new Set<string>()
        const allNoteFields = new Set<string>()
        activeItems.forEach((item) => {
          item.shipment_deductions.forEach((d) => {
            if (d.type === 'order_note' && d.field) {
              allNoteFields.add(d.field)
            } else if (d.product_id) {
              allProductIds.add(d.product_id)
            }
          })
        })

        if (prevDate < BASE_DATE) {
          setYesterdayRemaining({})
        } else {
          // 2a. Load BASE_DATE remaining (trusted baseline)
          const { data: baseRows } = await supabase!
            .from('kitchen_realtime_tracker')
            .select('item_key, remaining_qty')
            .eq('date', BASE_DATE)

          const baseMap: Record<string, number> = {}
          if (baseRows) {
            baseRows.forEach((r) => {
              baseMap[r.item_key] = Number(r.remaining_qty) || 0
            })
          }

          if (prevDate === BASE_DATE) {
            setYesterdayRemaining(baseMap)
          } else {
            // 2b. Chain calculate from BASE_DATE+1 to prevDate
            const nextDay = new Date(new Date(BASE_DATE + 'T00:00:00+08:00').getTime() + 86400000)
              .toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
            const chainDates = dateRange(nextDay, prevDate)

            if (chainDates.length === 0) {
              setYesterdayRemaining(baseMap)
            } else {
              // Load chain restock data
              const { data: chainTracker } = await supabase!
                .from('kitchen_realtime_tracker')
                .select('date, item_key, restock_qty')
                .gte('date', chainDates[0])
                .lte('date', chainDates[chainDates.length - 1])

              // Load shipment deductions: sum actual_qty across ALL stores for each date
              const shipmentByDate: Record<string, Record<string, number>> = {}
              if (allProductIds.size > 0) {
                const { data: shipData } = await supabase!
                  .from('shipment_items')
                  .select('session_id, product_id, actual_qty')
                  .in('product_id', Array.from(allProductIds))

                if (shipData) {
                  shipData.forEach((r) => {
                    const parts = r.session_id.split('_')
                    const shipDate = parts.slice(1).join('_')
                    if (shipDate >= chainDates[0] && shipDate <= chainDates[chainDates.length - 1]) {
                      if (!shipmentByDate[shipDate]) shipmentByDate[shipDate] = {}
                      shipmentByDate[shipDate][r.product_id] =
                        (shipmentByDate[shipDate][r.product_id] || 0) + (r.actual_qty || 0)
                    }
                  })
                }
              }

              // Load order_note deductions: sum note fields from order_sessions across ALL stores
              const noteByDate: Record<string, Record<string, number>> = {}
              if (allNoteFields.size > 0) {
                const noteFieldsArr = Array.from(allNoteFields)
                const selectFields = ['date', ...noteFieldsArr].join(',')
                const { data: noteData } = await supabase!
                  .from('order_sessions')
                  .select(selectFields)
                  .gte('date', chainDates[0])
                  .lte('date', chainDates[chainDates.length - 1])

                if (noteData) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(noteData as any[]).forEach((r) => {
                    const d = r.date as string
                    if (!noteByDate[d]) noteByDate[d] = {}
                    noteFieldsArr.forEach((f) => {
                      noteByDate[d][f] = (noteByDate[d][f] || 0) + (Number(r[f]) || 0)
                    })
                  })
                }
              }

              // Build restock by date
              const restockByDate: Record<string, Record<string, number>> = {}
              if (chainTracker) {
                chainTracker.forEach((r) => {
                  if (!restockByDate[r.date]) restockByDate[r.date] = {}
                  restockByDate[r.date][r.item_key] = Number(r.restock_qty) || 0
                })
              }

              // Chain calculate with ratio
              let running: Record<string, number> = { ...baseMap }
              for (const dd of chainDates) {
                const nextRunning: Record<string, number> = {}
                activeItems.forEach((item) => {
                  const prev = running[item.id] || 0
                  const restock = restockByDate[dd]?.[item.id] || 0
                  let deduction = 0
                  item.shipment_deductions.forEach((ded) => {
                    if (ded.type === 'order_note' && ded.field) {
                      const noteQty = noteByDate[dd]?.[ded.field] || 0
                      deduction += noteQty * ded.ratio
                    } else if (ded.product_id) {
                      const shipped = shipmentByDate[dd]?.[ded.product_id] || 0
                      deduction += shipped * ded.ratio
                    }
                  })
                  nextRunning[item.id] = parseFloat((prev + restock - deduction).toFixed(2))
                })
                running = nextRunning
              }
              setYesterdayRemaining(running)
            }
          }
        }

        // 3. Load today's restock
        const { data: todayRows } = await supabase!
          .from('kitchen_realtime_tracker')
          .select('item_key, restock_qty')
          .eq('date', selectedDate)

        const todayRestock: Record<string, string> = {}
        if (todayRows) {
          todayRows.forEach((r) => {
            const qty = Number(r.restock_qty) || 0
            if (qty !== 0) todayRestock[r.item_key] = String(qty)
          })
        }
        setRestockValues(todayRestock)
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [selectedDate])

  // Calculate today's deductions from shipment_items + order_sessions
  const [todayShipments, setTodayShipments] = useState<Record<string, number>>({})
  const [todayNotes, setTodayNotes] = useState<Record<string, number>>({})

  useEffect(() => {
    const loadShipments = async () => {
      if (!supabase || items.length === 0) return
      const allProductIds = new Set<string>()
      const allNoteFields = new Set<string>()
      items.forEach((item) => {
        item.shipment_deductions.forEach((d) => {
          if (d.type === 'order_note' && d.field) {
            allNoteFields.add(d.field)
          } else if (d.product_id) {
            allProductIds.add(d.product_id)
          }
        })
      })

      // Shipment deductions
      if (allProductIds.size === 0) {
        setTodayShipments({})
      } else {
        const { data } = await supabase!
          .from('shipment_items')
          .select('session_id, product_id, actual_qty')
          .in('product_id', Array.from(allProductIds))

        const result: Record<string, number> = {}
        if (data) {
          data.forEach((r) => {
            const parts = r.session_id.split('_')
            const shipDate = parts.slice(1).join('_')
            if (shipDate === selectedDate) {
              result[r.product_id] = (result[r.product_id] || 0) + (r.actual_qty || 0)
            }
          })
        }
        setTodayShipments(result)
      }

      // Order note deductions
      if (allNoteFields.size === 0) {
        setTodayNotes({})
      } else {
        const noteFieldsArr = Array.from(allNoteFields)
        const selectFields = ['date', ...noteFieldsArr].join(',')
        const { data: noteData } = await supabase!
          .from('order_sessions')
          .select(selectFields)
          .eq('date', selectedDate)

        const result: Record<string, number> = {}
        if (noteData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(noteData as any[]).forEach((r) => {
            noteFieldsArr.forEach((f) => {
              result[f] = (result[f] || 0) + (Number(r[f]) || 0)
            })
          })
        }
        setTodayNotes(result)
      }
    }
    loadShipments()
  }, [selectedDate, items])

  // Calculate deductions with ratio
  const deductions = useMemo(() => {
    const result: Record<string, number> = {}
    items.forEach((item) => {
      let total = 0
      item.shipment_deductions.forEach((ded) => {
        if (ded.type === 'order_note' && ded.field) {
          const noteQty = todayNotes[ded.field] || 0
          total += noteQty * ded.ratio
        } else if (ded.product_id) {
          const shipped = todayShipments[ded.product_id] || 0
          total += shipped * ded.ratio
        }
      })
      result[item.id] = total
    })
    return result
  }, [items, todayShipments, todayNotes])

  // remaining = yesterday remaining + restock - deductions
  const remainingValues = useMemo(() => {
    const result: Record<string, number> = {}
    items.forEach((item) => {
      const prev = yesterdayRemaining[item.id] || 0
      const restock = parseFloat(restockValues[item.id] || '0') || 0
      const deduction = deductions[item.id] || 0
      result[item.id] = parseFloat((prev + restock - deduction).toFixed(2))
    })
    return result
  }, [items, yesterdayRemaining, restockValues, deductions])

  const updateRestock = useCallback((itemKey: string, value: string) => {
    // Allow negative numbers for adjustments
    if (value !== '' && value !== '-' && !/^-?\d*\.?\d*$/.test(value)) return
    setRestockValues((prev) => ({ ...prev, [itemKey]: value }))
  }, [])

  const saveItem = useCallback(async (itemKey: string, staffId: string): Promise<boolean> => {
    if (!supabase) return false

    const restock = parseFloat(restockValues[itemKey] || '0') || 0
    const remaining = remainingValues[itemKey] || 0

    const { error } = await supabase.from('kitchen_realtime_tracker').upsert({
      date: selectedDate,
      item_key: itemKey,
      restock_qty: restock,
      remaining_qty: remaining,
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'date,item_key' })

    if (error) {
      console.error('儲存即時庫存失敗:', error.message)
      return false
    }
    return true
  }, [selectedDate, restockValues, remainingValues])

  return { items, restockValues, remainingValues, updateRestock, saveItem, loading }
}
