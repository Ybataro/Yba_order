import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { DateNav } from '@/components/DateNav'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { useProductionZoneStore } from '@/stores/useProductionZoneStore'
import { PRODUCTION_ZONES } from '@/data/productionZones'
import type { ZoneDef as StaticZoneDef, FieldDef as StaticFieldDef } from '@/data/productionZones'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type ViewMode = 'day' | 'month' | 'year'

// Quantity field keys — these get summed as "產量"
const QTY_KEYS = new Set(['bucket_count', 'box_count', 'bag_count', 'portion'])

// Measurement field keys — 測量值，跟產量無關，不做除以產量計算
const MEASURE_KEYS = new Set(['sweetness', 'thickness', 'solidification', 'holes', 'temperature'])

interface SessionRow {
  id: string
  zone_key: string
  date: string
}

interface ItemRow {
  session_id: string
  item_key: string
  field_key: string
  field_value: string
}

// Unified zone shape for display
interface DisplayField {
  key: string
  label: string
  type: 'numeric' | 'select' | 'text' | 'sugar_select'
  unit?: string
  options?: string[]
}

interface DisplayItem {
  key: string
  name: string
  fields: DisplayField[]
}

interface DisplayZone {
  key: string
  name: string
  icon: string
  items: DisplayItem[]
}

// Convert DB zone to display shape
function dbZoneToDisplay(dbZone: ReturnType<typeof useProductionZoneStore.getState>['zones'][number]): DisplayZone {
  return {
    key: dbZone.id,
    name: dbZone.name,
    icon: dbZone.icon,
    items: dbZone.items.map((item) => ({
      key: item.id,
      name: item.name,
      fields: item.fields.map((f) => ({
        key: f.field_key,
        label: f.label,
        type: f.field_type,
        unit: f.unit || undefined,
        options: f.options.length > 0 ? f.options : undefined,
      })),
    })),
  }
}

function staticZoneToDisplay(z: StaticZoneDef): DisplayZone {
  return {
    key: z.key,
    name: z.name,
    icon: z.icon,
    items: z.items.map((item) => ({
      key: item.key,
      name: item.name,
      fields: item.fields.map((f: StaticFieldDef) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        unit: f.unit,
        options: f.options,
      })),
    })),
  }
}

// Stats for a select field
type SelectStats = Record<string, number>

// Parse sugar_select JSON value → { sugarName: grams } or empty if legacy/invalid
function parseSugarValue(val: string): Record<string, number> {
  if (!val) return {}
  try {
    const parsed = JSON.parse(val)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const result: Record<string, number> = {}
      for (const [k, v] of Object.entries(parsed)) {
        const n = Number(v)
        if (!isNaN(n) && n > 0) result[k] = n
      }
      return result
    }
  } catch { /* not JSON */ }
  // Legacy plain number
  const n = Number(val)
  if (!isNaN(n) && n > 0) return { '糖（未分類）': n }
  return {}
}

// Sugar sub-row for display
interface SugarSubRow {
  name: string
  count: number
  simpleAvg: number
  simpleMin: number
  simpleMax: number
  unitAvg: number | null
  weightedAvg: number | null
}

function fmt(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

export default function ProductionStats() {
  const today = getTodayTW()
  const now = new Date()
  const [viewMode, setViewMode] = useState<ViewMode>('day')
  const [selectedDate, setSelectedDate] = useState(today)
  const [monthYear, setMonthYear] = useState(now.getFullYear())
  const [monthMonth, setMonthMonth] = useState(now.getMonth() + 1)
  const [yearValue, setYearValue] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [items, setItems] = useState<ItemRow[]>([])
  const [activeZone, setActiveZone] = useState<string>('all')

  // DB-driven zones
  const dbZones = useProductionZoneStore((s) => s.zones)
  const storeInitialized = useProductionZoneStore((s) => s.initialized)

  const displayZones: DisplayZone[] = useMemo(() => {
    if (storeInitialized && dbZones.length > 0) {
      return dbZones.map(dbZoneToDisplay)
    }
    return PRODUCTION_ZONES.map(staticZoneToDisplay)
  }, [storeInitialized, dbZones])

  // Date range
  const dateRange = useMemo((): { start: string; end: string } => {
    if (viewMode === 'day') return { start: selectedDate, end: selectedDate }
    if (viewMode === 'month') {
      const firstDay = `${monthYear}-${String(monthMonth).padStart(2, '0')}-01`
      const daysInMonth = new Date(monthYear, monthMonth, 0).getDate()
      const lastDay = `${monthYear}-${String(monthMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
      return { start: firstDay, end: lastDay }
    }
    return { start: `${yearValue}-01-01`, end: `${yearValue}-12-31` }
  }, [viewMode, selectedDate, monthYear, monthMonth, yearValue])

  // Load data
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    const load = async () => {
      const { data: sessionRows } = await supabase!
        .from('production_log_sessions')
        .select('id, zone_key, date')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)

      const sess = sessionRows || []
      setSessions(sess)

      if (sess.length === 0) {
        setItems([])
        setLoading(false)
        return
      }

      const sessionIds = sess.map((s) => s.id)
      const { data: itemRows } = await supabase!
        .from('production_log_items')
        .select('session_id, item_key, field_key, field_value')
        .in('session_id', sessionIds)

      setItems(itemRows || [])
      setLoading(false)
    }
    load()
  }, [dateRange.start, dateRange.end])

  // Filtered sessions by zone
  const filteredSessions = useMemo(() => {
    if (activeZone === 'all') return sessions
    return sessions.filter((s) => s.zone_key === activeZone)
  }, [sessions, activeZone])

  const filteredSessionIds = useMemo(() => new Set(filteredSessions.map((s) => s.id)), [filteredSessions])

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((i) => filteredSessionIds.has(i.session_id))
  }, [items, filteredSessionIds])

  // Build session → zone_key lookup
  const sessionZoneMap = useMemo(() => {
    const m: Record<string, string> = {}
    sessions.forEach((s) => { m[s.id] = s.zone_key })
    return m
  }, [sessions])

  // Group items per (zone_key, item_key, session_id) → { field_key → value }
  // This allows us to pair each record's fields with its quantity for per-unit calculation
  const recordMap = useMemo(() => {
    const map: Record<string, Record<string, Record<string, Record<string, string>>>> = {}
    // map[zoneKey][itemKey][sessionId][fieldKey] = value

    filteredItems.forEach((row) => {
      const zoneKey = sessionZoneMap[row.session_id]
      if (!zoneKey) return
      if (!map[zoneKey]) map[zoneKey] = {}
      if (!map[zoneKey][row.item_key]) map[zoneKey][row.item_key] = {}
      if (!map[zoneKey][row.item_key][row.session_id]) map[zoneKey][row.item_key][row.session_id] = {}
      map[zoneKey][row.item_key][row.session_id][row.field_key] = row.field_value
    })

    return map
  }, [filteredItems, sessionZoneMap])

  // Find the quantity field for an item (first QTY_KEYS field that exists in its definition)
  function findQtyField(item: DisplayItem): DisplayField | undefined {
    return item.fields.find((f) => QTY_KEYS.has(f.key))
  }

  // Compute select stats
  function computeSelect(values: string[]): SelectStats {
    const counts: SelectStats = {}
    values.forEach((v) => {
      if (v) counts[v] = (counts[v] || 0) + 1
    })
    return counts
  }

  // Unique dates count
  const uniqueDates = useMemo(() => {
    return new Set(filteredSessions.map((s) => s.date)).size
  }, [filteredSessions])

  // Total items with data
  const totalItemsWithData = useMemo(() => {
    const itemKeys = new Set<string>()
    filteredItems.forEach((row) => itemKeys.add(`${sessionZoneMap[row.session_id]}_${row.item_key}`))
    return itemKeys.size
  }, [filteredItems, sessionZoneMap])

  // Month nav
  const prevMonth = () => {
    if (monthMonth === 1) { setMonthYear(monthYear - 1); setMonthMonth(12) }
    else setMonthMonth(monthMonth - 1)
  }
  const nextMonth = () => {
    if (monthMonth === 12) { setMonthYear(monthYear + 1); setMonthMonth(1) }
    else setMonthMonth(monthMonth + 1)
  }

  // Period label
  const periodLabel = useMemo(() => {
    if (viewMode === 'day') return selectedDate
    if (viewMode === 'month') return `${monthYear} 年 ${monthMonth} 月`
    return `${yearValue} 年`
  }, [viewMode, selectedDate, monthYear, monthMonth, yearValue])

  // Zones that have data
  const zonesWithData = useMemo(() => {
    const keys = new Set<string>()
    filteredSessions.forEach((s) => keys.add(s.zone_key))
    return keys
  }, [filteredSessions])

  // Filter displayZones to show
  const visibleZones = useMemo(() => {
    if (activeZone === 'all') return displayZones
    return displayZones.filter((z) => z.key === activeZone)
  }, [displayZones, activeZone])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="生產紀錄總表" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="生產紀錄總表" backTo="/admin" />

      {/* View mode tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white border-b border-gray-100">
        {(['day', 'month', 'year'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              viewMode === mode
                ? 'bg-brand-oak text-white'
                : 'text-brand-mocha hover:bg-gray-100'
            }`}
          >
            {{ day: '日', month: '月', year: '年' }[mode]}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      {viewMode === 'day' && (
        <DateNav value={selectedDate} onChange={setSelectedDate} />
      )}
      {viewMode === 'month' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
          <button onClick={prevMonth} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronLeft size={18} className="text-brand-oak" />
          </button>
          <span className="flex-1 text-center text-sm font-medium text-brand-oak">
            {monthYear} 年 {monthMonth} 月
          </span>
          <button onClick={nextMonth} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronRight size={18} className="text-brand-oak" />
          </button>
        </div>
      )}
      {viewMode === 'year' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100">
          <button onClick={() => setYearValue(yearValue - 1)} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronLeft size={18} className="text-brand-oak" />
          </button>
          <span className="flex-1 text-center text-sm font-medium text-brand-oak">
            {yearValue} 年
          </span>
          <button onClick={() => setYearValue(yearValue + 1)} className="p-1 rounded-lg active:bg-gray-100">
            <ChevronRight size={18} className="text-brand-oak" />
          </button>
        </div>
      )}

      {/* Zone tabs */}
      <div className="overflow-x-auto scrollbar-hide border-b border-gray-100 bg-white">
        <div className="flex min-w-max px-2">
          <button
            onClick={() => setActiveZone('all')}
            className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeZone === 'all'
                ? 'border-brand-mocha text-brand-oak'
                : 'border-transparent text-brand-lotus hover:text-brand-oak'
            }`}
          >
            全部
          </button>
          {displayZones.map((zone) => (
            <button
              key={zone.key}
              onClick={() => setActiveZone(zone.key)}
              className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeZone === zone.key
                  ? 'border-brand-mocha text-brand-oak'
                  : 'border-transparent text-brand-lotus hover:text-brand-oak'
              }`}
            >
              <span>{zone.icon}</span>
              <span>{zone.name}</span>
              {zonesWithData.has(zone.key) && <span className="text-status-success text-xs">●</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          {periodLabel} 尚無生產紀錄
        </div>
      ) : (
        <>
          {/* Summary card */}
          <div className="mx-4 mt-3 card !p-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-brand-lotus">{uniqueDates}</p>
                <p className="text-[11px] text-brand-mocha">統計天數</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">{filteredSessions.length}</p>
                <p className="text-[11px] text-brand-mocha">紀錄筆數</p>
              </div>
              <div>
                <p className="text-lg font-bold text-brand-lotus">{totalItemsWithData}</p>
                <p className="text-[11px] text-brand-mocha">品項數量</p>
              </div>
            </div>
          </div>

          {/* Stats per zone → item */}
          {visibleZones.map((zone) => {
            const zoneRecords = recordMap[zone.key]
            if (!zoneRecords) return null

            return (
              <div key={zone.key} className="mt-3">
                <SectionHeader title={`${zone.icon} ${zone.name}`} icon="■" />

                {zone.items.map((item) => {
                  const itemRecords = zoneRecords[item.key]
                  if (!itemRecords) return null

                  const sessionEntries = Object.values(itemRecords) // each is { fieldKey → value }
                  if (sessionEntries.length === 0) return null

                  const qtyField = findQtyField(item)
                  const qtyUnit = qtyField?.unit || qtyField?.label || ''

                  // Compute qty totals
                  let qtySum = 0
                  if (qtyField) {
                    sessionEntries.forEach((rec) => {
                      const v = Number(rec[qtyField.key])
                      if (!isNaN(v)) qtySum += v
                    })
                  }

                  // Build stats for numeric fields (non-qty)
                  interface FieldRow {
                    field: DisplayField
                    count: number
                    simpleAvg: number
                    simpleMin: number
                    simpleMax: number
                    // per-unit stats (only when qtyField exists)
                    unitAvg: number | null   // simple avg of (value/qty) per record
                    weightedAvg: number | null // totalValue / totalQty
                  }

                  const numericRows: FieldRow[] = []
                  const selectRows: { field: DisplayField; stats: SelectStats }[] = []
                  const sugarRows: { field: DisplayField; subRows: SugarSubRow[]; totalRow: SugarSubRow } [] = []

                  item.fields.forEach((field) => {
                    if (QTY_KEYS.has(field.key)) return // skip qty field itself

                    if (field.type === 'sugar_select') {
                      // Parse each session's sugar JSON and aggregate per sugar type
                      const sugarMap: Record<string, { values: number[]; perUnit: number[]; totalVal: number; totalQty: number }> = {}
                      const totalValues: number[] = []
                      const totalPerUnit: number[] = []
                      let grandTotalVal = 0
                      let grandTotalQty = 0

                      sessionEntries.forEach((rec) => {
                        const parsed = parseSugarValue(rec[field.key])
                        if (Object.keys(parsed).length === 0) return

                        let recTotal = 0
                        for (const [name, grams] of Object.entries(parsed)) {
                          if (!sugarMap[name]) sugarMap[name] = { values: [], perUnit: [], totalVal: 0, totalQty: 0 }
                          sugarMap[name].values.push(grams)
                          recTotal += grams

                          if (qtyField) {
                            const q = Number(rec[qtyField.key])
                            if (!isNaN(q) && q > 0) {
                              sugarMap[name].perUnit.push(grams / q)
                              sugarMap[name].totalVal += grams
                              sugarMap[name].totalQty += q
                            }
                          }
                        }

                        totalValues.push(recTotal)
                        if (qtyField) {
                          const q = Number(rec[qtyField.key])
                          if (!isNaN(q) && q > 0) {
                            totalPerUnit.push(recTotal / q)
                            grandTotalVal += recTotal
                            grandTotalQty += q
                          }
                        }
                      })

                      if (Object.keys(sugarMap).length === 0) return

                      const subRows: SugarSubRow[] = Object.entries(sugarMap).map(([name, data]) => {
                        const sum = data.values.reduce((a, b) => a + b, 0)
                        return {
                          name,
                          count: data.values.length,
                          simpleAvg: sum / data.values.length,
                          simpleMin: Math.min(...data.values),
                          simpleMax: Math.max(...data.values),
                          unitAvg: data.perUnit.length > 0 ? data.perUnit.reduce((a, b) => a + b, 0) / data.perUnit.length : null,
                          weightedAvg: data.totalQty > 0 ? data.totalVal / data.totalQty : null,
                        }
                      })

                      const tSum = totalValues.reduce((a, b) => a + b, 0)
                      const totalRow: SugarSubRow = {
                        name: '糖合計',
                        count: totalValues.length,
                        simpleAvg: tSum / totalValues.length,
                        simpleMin: Math.min(...totalValues),
                        simpleMax: Math.max(...totalValues),
                        unitAvg: totalPerUnit.length > 0 ? totalPerUnit.reduce((a, b) => a + b, 0) / totalPerUnit.length : null,
                        weightedAvg: grandTotalQty > 0 ? grandTotalVal / grandTotalQty : null,
                      }

                      sugarRows.push({ field, subRows, totalRow })
                      return
                    }

                    if (field.type === 'numeric') {
                      const isMeasure = MEASURE_KEYS.has(field.key)
                      const rawValues: number[] = []
                      const perUnitValues: number[] = []
                      let totalFieldValue = 0
                      let totalQtyForField = 0

                      sessionEntries.forEach((rec) => {
                        const v = Number(rec[field.key])
                        if (isNaN(v) || v === 0) return
                        rawValues.push(v)

                        // 測量值（甜度/稠度/凝固等）不做除以產量
                        if (!isMeasure && qtyField) {
                          const q = Number(rec[qtyField.key])
                          if (!isNaN(q) && q > 0) {
                            perUnitValues.push(v / q)
                            totalFieldValue += v
                            totalQtyForField += q
                          }
                        }
                      })

                      if (rawValues.length === 0) return

                      const sum = rawValues.reduce((a, b) => a + b, 0)

                      numericRows.push({
                        field,
                        count: rawValues.length,
                        simpleAvg: sum / rawValues.length,
                        simpleMin: Math.min(...rawValues),
                        simpleMax: Math.max(...rawValues),
                        unitAvg: perUnitValues.length > 0
                          ? perUnitValues.reduce((a, b) => a + b, 0) / perUnitValues.length
                          : null,
                        weightedAvg: totalQtyForField > 0
                          ? totalFieldValue / totalQtyForField
                          : null,
                      })
                    } else if (field.type === 'select') {
                      const values: string[] = []
                      sessionEntries.forEach((rec) => {
                        const v = rec[field.key]
                        if (v) values.push(v)
                      })
                      const ss = computeSelect(values)
                      if (Object.keys(ss).length > 0) {
                        selectRows.push({ field, stats: ss })
                      }
                    }
                  })

                  if (numericRows.length === 0 && !qtyField && selectRows.length === 0 && sugarRows.length === 0) return null

                  const hasPerUnit = qtyField && numericRows.some((r) => r.unitAvg !== null)
                  const hasSugarPerUnit = qtyField && sugarRows.some((sr) => sr.subRows.some((r) => r.unitAvg !== null))

                  return (
                    <div key={item.key} className="mx-4 mb-3 card !p-3">
                      <h4 className="text-sm font-semibold text-brand-oak mb-2">{item.name}</h4>

                      {/* Quantity totals */}
                      {qtyField && qtySum > 0 && (
                        <div className="flex flex-wrap gap-3 mb-2">
                          <div className="bg-brand-oak/10 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-brand-mocha">{qtyField.label} 合計</span>
                            <span className="ml-2 text-sm font-bold text-brand-oak">{fmt(qtySum)}</span>
                            {qtyUnit && <span className="text-xs text-brand-lotus ml-0.5">{qtyUnit}</span>}
                          </div>
                        </div>
                      )}

                      {/* Numeric field stats table */}
                      {numericRows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-brand-mocha">
                                <th className="text-left py-1 pr-2 font-medium">欄位</th>
                                <th className="text-center py-1 px-1 font-medium">筆數</th>
                                <th className="text-center py-1 px-1 font-medium">總量平均</th>
                                <th className="text-center py-1 px-1 font-medium">最小</th>
                                <th className="text-center py-1 px-1 font-medium">最大</th>
                              </tr>
                            </thead>
                            <tbody>
                              {numericRows.map((row) => (
                                <tr key={row.field.key} className="border-t border-gray-50">
                                  <td className="py-1.5 pr-2 text-brand-oak font-medium">
                                    {row.field.label}
                                    {row.field.unit && <span className="text-brand-lotus ml-0.5">({row.field.unit})</span>}
                                  </td>
                                  <td className="py-1.5 px-1 text-center text-brand-mocha">{row.count}</td>
                                  <td className="py-1.5 px-1 text-center font-semibold text-brand-oak">
                                    {fmt(row.simpleAvg)}
                                  </td>
                                  <td className="py-1.5 px-1 text-center text-brand-mocha">
                                    {fmt(row.simpleMin)}
                                  </td>
                                  <td className="py-1.5 px-1 text-center text-brand-mocha">
                                    {fmt(row.simpleMax)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Sugar select field stats */}
                      {sugarRows.map(({ field, subRows, totalRow }) => (
                        <div key={field.key} className="mt-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-brand-mocha">
                                  <th className="text-left py-1 pr-2 font-medium">糖種</th>
                                  <th className="text-center py-1 px-1 font-medium">筆數</th>
                                  <th className="text-center py-1 px-1 font-medium">總量平均</th>
                                  <th className="text-center py-1 px-1 font-medium">最小</th>
                                  <th className="text-center py-1 px-1 font-medium">最大</th>
                                </tr>
                              </thead>
                              <tbody>
                                {subRows.map((row) => (
                                  <tr key={row.name} className="border-t border-gray-50">
                                    <td className="py-1.5 pr-2 text-brand-oak font-medium">
                                      {row.name} <span className="text-brand-lotus">(g)</span>
                                    </td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{row.count}</td>
                                    <td className="py-1.5 px-1 text-center font-semibold text-brand-oak">{fmt(row.simpleAvg)}</td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{fmt(row.simpleMin)}</td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{fmt(row.simpleMax)}</td>
                                  </tr>
                                ))}
                                {subRows.length > 1 && (
                                  <tr className="border-t-2 border-gray-200">
                                    <td className="py-1.5 pr-2 text-brand-oak font-bold">{totalRow.name} <span className="text-brand-lotus font-medium">(g)</span></td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{totalRow.count}</td>
                                    <td className="py-1.5 px-1 text-center font-bold text-brand-oak">{fmt(totalRow.simpleAvg)}</td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{fmt(totalRow.simpleMin)}</td>
                                    <td className="py-1.5 px-1 text-center text-brand-mocha">{fmt(totalRow.simpleMax)}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* Sugar per-unit averages */}
                      {hasSugarPerUnit && sugarRows.map(({ field, subRows, totalRow }) => (
                        <div key={`${field.key}-unit`} className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[11px] text-brand-mocha mb-1.5">
                            每{qtyUnit}糖用量（標準化平均）
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-brand-mocha">
                                  <th className="text-left py-1 pr-2 font-medium">糖種</th>
                                  <th className="text-center py-1 px-1 font-medium">
                                    <span className="block">單位平均</span>
                                    <span className="block text-[9px] font-normal text-brand-lotus">逐筆÷{qtyUnit}</span>
                                  </th>
                                  <th className="text-center py-1 px-1 font-medium">
                                    <span className="block">加權平均</span>
                                    <span className="block text-[9px] font-normal text-brand-lotus">總量÷總{qtyUnit}</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {subRows.map((row) => {
                                  if (row.unitAvg === null && row.weightedAvg === null) return null
                                  return (
                                    <tr key={row.name} className="border-t border-gray-50">
                                      <td className="py-1.5 pr-2 text-brand-oak font-medium">{row.name} <span className="text-brand-lotus">(g)</span></td>
                                      <td className="py-1.5 px-1 text-center font-semibold text-status-info">{row.unitAvg !== null ? fmt(row.unitAvg) : '-'}</td>
                                      <td className="py-1.5 px-1 text-center font-semibold text-brand-amber">{row.weightedAvg !== null ? fmt(row.weightedAvg) : '-'}</td>
                                    </tr>
                                  )
                                })}
                                {subRows.length > 1 && (totalRow.unitAvg !== null || totalRow.weightedAvg !== null) && (
                                  <tr className="border-t-2 border-gray-200">
                                    <td className="py-1.5 pr-2 text-brand-oak font-bold">{totalRow.name} <span className="text-brand-lotus font-medium">(g)</span></td>
                                    <td className="py-1.5 px-1 text-center font-bold text-status-info">{totalRow.unitAvg !== null ? fmt(totalRow.unitAvg) : '-'}</td>
                                    <td className="py-1.5 px-1 text-center font-bold text-brand-amber">{totalRow.weightedAvg !== null ? fmt(totalRow.weightedAvg) : '-'}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}

                      {/* Per-unit averages */}
                      {hasPerUnit && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-[11px] text-brand-mocha mb-1.5">
                            每{qtyUnit}用量（標準化平均）
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-brand-mocha">
                                  <th className="text-left py-1 pr-2 font-medium">欄位</th>
                                  <th className="text-center py-1 px-1 font-medium">
                                    <span className="block">單位平均</span>
                                    <span className="block text-[9px] font-normal text-brand-lotus">逐筆÷{qtyUnit}</span>
                                  </th>
                                  <th className="text-center py-1 px-1 font-medium">
                                    <span className="block">加權平均</span>
                                    <span className="block text-[9px] font-normal text-brand-lotus">總量÷總{qtyUnit}</span>
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {numericRows.map((row) => {
                                  if (row.unitAvg === null && row.weightedAvg === null) return null
                                  return (
                                    <tr key={row.field.key} className="border-t border-gray-50">
                                      <td className="py-1.5 pr-2 text-brand-oak font-medium">
                                        {row.field.label}
                                        {row.field.unit && <span className="text-brand-lotus ml-0.5">({row.field.unit})</span>}
                                      </td>
                                      <td className="py-1.5 px-1 text-center font-semibold text-status-info">
                                        {row.unitAvg !== null ? fmt(row.unitAvg) : '-'}
                                      </td>
                                      <td className="py-1.5 px-1 text-center font-semibold text-brand-amber">
                                        {row.weightedAvg !== null ? fmt(row.weightedAvg) : '-'}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Select field stats */}
                      {selectRows.map(({ field, stats: ss }) => (
                        <div key={field.key} className="mt-2">
                          <p className="text-xs text-brand-mocha font-medium mb-1">{field.label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(ss).sort(([, a], [, b]) => b - a).map(([option, count]) => (
                              <span
                                key={option}
                                className="inline-flex items-center gap-1 text-xs bg-surface-section rounded-tag px-2 py-1"
                              >
                                <span className="text-brand-oak">{option}</span>
                                <span className="font-semibold text-brand-lotus">{count}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
