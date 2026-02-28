import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { SUPPLY_ITEMS } from '@/lib/supplyItems'

interface FrozenEntry { takeout: string; delivery: string }

interface UseSupplyTrackerParams {
  storeId: string
  selectedDate: string
  currentZone: string | null
  isMergedView: boolean
  frozenData: Record<string, FrozenEntry>
  mergedFrozenData: Record<string, FrozenEntry>
}

interface UseSupplyTrackerResult {
  restockValues: Record<string, string>
  remainingValues: Record<string, number>
  updateRestock: (key: string, value: string) => void
  saveSupplyData: (staffId: string) => Promise<void>
  loading: boolean
}

export function useSupplyTracker({
  storeId,
  selectedDate,
  currentZone,
  isMergedView,
  frozenData,
  mergedFrozenData,
}: UseSupplyTrackerParams): UseSupplyTrackerResult {
  const [yesterdayRemaining, setYesterdayRemaining] = useState<Record<string, number>>({})
  const [restockValues, setRestockValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Load yesterday's remaining (chain-calculated from BASE_DATE) + today's restock
  // DB remaining_qty snapshots may be stale if earlier days were re-submitted,
  // so we chain-calculate from 2026-02-25 (first trusted baseline) forward.
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    setLoading(true)
    setRestockValues({})
    setYesterdayRemaining({})

    const BASE_DATE = '2026-02-25'

    const load = async () => {
      try {
        const zoneCode = currentZone || ''

        // Previous date
        const d = new Date(selectedDate + 'T00:00:00+08:00')
        d.setDate(d.getDate() - 1)
        const prevDate = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

        // Helper: generate date strings from startDate to endDate (inclusive)
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

        if (prevDate < BASE_DATE) {
          // selectedDate is BASE_DATE or earlier, no chain needed
          setYesterdayRemaining({})
        } else if (isMergedView) {
          // --- Merged view ---

          // 1. Load BASE_DATE remaining (trusted baseline, sum across zones)
          const { data: baseRows } = await supabase!
            .from('supply_tracker')
            .select('supply_key, remaining_qty')
            .eq('store_id', storeId)
            .eq('date', BASE_DATE)

          const baseMap: Record<string, number> = {}
          if (baseRows) {
            baseRows.forEach((r) => {
              baseMap[r.supply_key] = (baseMap[r.supply_key] || 0) + r.remaining_qty
            })
          }

          if (prevDate === BASE_DATE) {
            // selectedDate is day after BASE_DATE, just use base
            setYesterdayRemaining(baseMap)
          } else {
            // 2. Load all supply_tracker restock from BASE_DATE+1 to prevDate
            const chainDates = dateRange(
              new Date(new Date(BASE_DATE + 'T00:00:00+08:00').getTime() + 86400000)
                .toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
              prevDate
            )

            const { data: chainSupply } = await supabase!
              .from('supply_tracker')
              .select('date, supply_key, restock_qty')
              .eq('store_id', storeId)
              .gte('date', chainDates[0])
              .lte('date', chainDates[chainDates.length - 1])

            // 3. Load all frozen_sales from BASE_DATE+1 to prevDate
            const { data: chainFrozen } = await supabase!
              .from('frozen_sales')
              .select('date, product_key, takeout, delivery')
              .eq('store_id', storeId)
              .gte('date', chainDates[0])
              .lte('date', chainDates[chainDates.length - 1])

            // Build per-date restock map: { date: { supply_key: qty } }
            const restockByDate: Record<string, Record<string, number>> = {}
            if (chainSupply) {
              chainSupply.forEach((r) => {
                if (!restockByDate[r.date]) restockByDate[r.date] = {}
                restockByDate[r.date][r.supply_key] = (restockByDate[r.date][r.supply_key] || 0) + r.restock_qty
              })
            }

            // Build per-date frozen sales map: { date: { product_key: qty } }
            const frozenByDate: Record<string, Record<string, number>> = {}
            if (chainFrozen) {
              chainFrozen.forEach((r) => {
                if (!frozenByDate[r.date]) frozenByDate[r.date] = {}
                const key = r.product_key
                frozenByDate[r.date][key] = (frozenByDate[r.date][key] || 0) + (r.takeout || 0) + (r.delivery || 0)
              })
            }

            // Chain calculate: day by day from BASE_DATE
            let running: Record<string, number> = { ...baseMap }
            for (const dd of chainDates) {
              const nextRunning: Record<string, number> = {}
              SUPPLY_ITEMS.forEach((item) => {
                const prev = running[item.key] || 0
                const restock = restockByDate[dd]?.[item.key] || 0
                let deduction = 0
                item.deductionKeys.forEach((pk) => {
                  deduction += frozenByDate[dd]?.[pk] || 0
                })
                nextRunning[item.key] = prev + restock - deduction
              })
              running = nextRunning
            }
            setYesterdayRemaining(running)
          }

          // Load today's restock for merged (sum across zones)
          const { data: todayRows } = await supabase!
            .from('supply_tracker')
            .select('supply_key, restock_qty')
            .eq('store_id', storeId)
            .eq('date', selectedDate)

          const restockMap: Record<string, string> = {}
          if (todayRows) {
            const sums: Record<string, number> = {}
            todayRows.forEach((r) => {
              sums[r.supply_key] = (sums[r.supply_key] || 0) + r.restock_qty
            })
            Object.entries(sums).forEach(([k, v]) => {
              if (v > 0) restockMap[k] = String(v)
            })
          }
          setRestockValues(restockMap)
        } else {
          // --- Single zone ---

          // 1. Load BASE_DATE remaining (trusted baseline)
          const { data: baseRows } = await supabase!
            .from('supply_tracker')
            .select('supply_key, remaining_qty')
            .eq('store_id', storeId)
            .eq('date', BASE_DATE)
            .eq('zone_code', zoneCode)

          const baseMap: Record<string, number> = {}
          if (baseRows) {
            baseRows.forEach((r) => {
              baseMap[r.supply_key] = r.remaining_qty
            })
          }

          if (prevDate === BASE_DATE) {
            setYesterdayRemaining(baseMap)
          } else {
            // 2. Load chain data from BASE_DATE+1 to prevDate
            const chainDates = dateRange(
              new Date(new Date(BASE_DATE + 'T00:00:00+08:00').getTime() + 86400000)
                .toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' }),
              prevDate
            )

            const { data: chainSupply } = await supabase!
              .from('supply_tracker')
              .select('date, supply_key, restock_qty')
              .eq('store_id', storeId)
              .eq('zone_code', zoneCode)
              .gte('date', chainDates[0])
              .lte('date', chainDates[chainDates.length - 1])

            const { data: chainFrozen } = await supabase!
              .from('frozen_sales')
              .select('date, product_key, takeout, delivery')
              .eq('store_id', storeId)
              .eq('zone_code', zoneCode)
              .gte('date', chainDates[0])
              .lte('date', chainDates[chainDates.length - 1])

            const restockByDate: Record<string, Record<string, number>> = {}
            if (chainSupply) {
              chainSupply.forEach((r) => {
                if (!restockByDate[r.date]) restockByDate[r.date] = {}
                restockByDate[r.date][r.supply_key] = r.restock_qty
              })
            }

            const frozenByDate: Record<string, Record<string, number>> = {}
            if (chainFrozen) {
              chainFrozen.forEach((r) => {
                if (!frozenByDate[r.date]) frozenByDate[r.date] = {}
                frozenByDate[r.date][r.product_key] = (r.takeout || 0) + (r.delivery || 0)
              })
            }

            let running: Record<string, number> = { ...baseMap }
            for (const dd of chainDates) {
              const nextRunning: Record<string, number> = {}
              SUPPLY_ITEMS.forEach((item) => {
                const prev = running[item.key] || 0
                const restock = restockByDate[dd]?.[item.key] || 0
                let deduction = 0
                item.deductionKeys.forEach((pk) => {
                  deduction += frozenByDate[dd]?.[pk] || 0
                })
                nextRunning[item.key] = prev + restock - deduction
              })
              running = nextRunning
            }
            setYesterdayRemaining(running)
          }

          // Load today's existing restock
          const { data: todayRows } = await supabase!
            .from('supply_tracker')
            .select('supply_key, restock_qty')
            .eq('store_id', storeId)
            .eq('date', selectedDate)
            .eq('zone_code', zoneCode)

          const restockMap: Record<string, string> = {}
          if (todayRows) {
            todayRows.forEach((r) => {
              if (r.restock_qty > 0) restockMap[r.supply_key] = String(r.restock_qty)
            })
          }
          setRestockValues(restockMap)
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, selectedDate, currentZone, isMergedView])

  // Calculate deductions from frozen data
  const deductions = useMemo(() => {
    const fData = isMergedView ? mergedFrozenData : frozenData
    const result: Record<string, number> = {}
    SUPPLY_ITEMS.forEach((item) => {
      let total = 0
      item.deductionKeys.forEach((pk) => {
        const entry = fData[pk]
        if (entry) {
          total += (parseInt(entry.takeout) || 0) + (parseInt(entry.delivery) || 0)
        }
      })
      result[item.key] = total
    })
    return result
  }, [frozenData, mergedFrozenData, isMergedView])

  // Calculate remaining = yesterday remaining + restock - deductions
  const remainingValues = useMemo(() => {
    const result: Record<string, number> = {}
    SUPPLY_ITEMS.forEach((item) => {
      const prev = yesterdayRemaining[item.key] || 0
      const restock = parseInt(restockValues[item.key] || '0') || 0
      const deduction = deductions[item.key] || 0
      result[item.key] = prev + restock - deduction
    })
    return result
  }, [yesterdayRemaining, restockValues, deductions])

  const updateRestock = useCallback((key: string, value: string) => {
    if (value !== '' && !/^\d+$/.test(value)) return
    setRestockValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const saveSupplyData = useCallback(async (staffId: string) => {
    if (!supabase || !storeId || isMergedView) return

    const zoneCode = currentZone || ''
    const rows = SUPPLY_ITEMS.map((item) => ({
      store_id: storeId,
      date: selectedDate,
      zone_code: zoneCode,
      supply_key: item.key,
      restock_qty: parseInt(restockValues[item.key] || '0') || 0,
      remaining_qty: remainingValues[item.key] || 0,
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }))

    await supabase.from('supply_tracker').upsert(rows, {
      onConflict: 'store_id,date,zone_code,supply_key',
    })
  }, [storeId, selectedDate, currentZone, isMergedView, restockValues, remainingValues])

  return { restockValues, remainingValues, updateRestock, saveSupplyData, loading }
}
