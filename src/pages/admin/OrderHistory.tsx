import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import ExportButtons from '@/components/ExportButtons'

type OrderType = 'store' | 'material'
type ViewMode = 'detail' | 'stats'
type DateRange = 'today' | 'week' | 'month' | 'custom'

interface OrderSession {
  id: string
  store_id?: string
  date: string
  submitted_by?: string
  note?: string
  almond_1000?: string
  almond_300?: string
  bowl_k520?: string
  bowl_750?: string
  order_items?: OrderItem[]
  material_order_items?: MaterialOrderItem[]
}

interface OrderItem {
  product_id: string
  quantity: number
}

interface MaterialOrderItem {
  material_id: string
  quantity: number
}

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

function getFirstOfMonth(dateStr: string): string {
  return dateStr.slice(0, 8) + '01'
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
}

export default function OrderHistory() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)
  const allProducts = useProductStore((s) => s.items)
  const products = useMemo(() => allProducts.filter(p => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'), [allProducts])
  const productCategories = useProductStore((s) => s.categories)
  const materials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)

  const [orderType, setOrderType] = useState<OrderType>('store')
  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [sessions, setSessions] = useState<OrderSession[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const today = getTodayTW()

  const { startDate, endDate } = useMemo(() => {
    switch (dateRange) {
      case 'today':
        return { startDate: today, endDate: today }
      case 'week':
        return { startDate: getMonday(today), endDate: today }
      case 'month':
        return { startDate: getFirstOfMonth(today), endDate: today }
      case 'custom':
        return { startDate: customStart || today, endDate: customEnd || today }
    }
  }, [dateRange, today, customStart, customEnd])

  // Fetch data
  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    setSessions([])
    setExpandedIds(new Set())

    if (orderType === 'store') {
      let query = supabase
        .from('order_sessions')
        .select('*, order_items(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })

      if (storeFilter !== 'all') {
        query = query.eq('store_id', storeFilter)
      }

      query.then(({ data }) => {
        setSessions(data || [])
        setLoading(false)
      })
    } else {
      supabase
        .from('material_order_sessions')
        .select('*, material_order_items(*)')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false })
        .then(({ data }) => {
          setSessions(data || [])
          setLoading(false)
        })
    }
  }, [orderType, startDate, endDate, storeFilter])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Product / Material lookup helpers
  const getProductName = (id: string) => products.find((p) => p.id === id)?.name ?? id
  const getProductUnit = (id: string) => products.find((p) => p.id === id)?.unit ?? ''
  const getProductCategory = (id: string) => products.find((p) => p.id === id)?.category ?? '其他'
  const getMaterialName = (id: string) => materials.find((m) => m.id === id)?.name ?? id
  const getMaterialUnit = (id: string) => materials.find((m) => m.id === id)?.unit ?? ''
  const getMaterialCategory = (id: string) => materials.find((m) => m.id === id)?.category ?? '其他'

  // Stats computation
  const stats = useMemo(() => {
    if (viewMode !== 'stats') return null

    const days = daysBetween(startDate, endDate)

    if (orderType === 'store') {
      const agg: Record<string, { total: number; count: number }> = {}
      sessions.forEach((s) => {
        const items = s.order_items || []
        const sessionProducts = new Set<string>()
        items.forEach((item) => {
          if (!agg[item.product_id]) agg[item.product_id] = { total: 0, count: 0 }
          agg[item.product_id].total += item.quantity
          sessionProducts.add(item.product_id)
        })
        sessionProducts.forEach((pid) => {
          agg[pid].count += 1
        })
      })

      const categories = productCategories.filter((cat) =>
        Object.keys(agg).some((pid) => getProductCategory(pid) === cat)
      )

      return {
        totalSessions: sessions.length,
        days,
        categories: categories.map((cat) => ({
          name: cat,
          items: Object.entries(agg)
            .filter(([pid]) => getProductCategory(pid) === cat)
            .map(([pid, { total, count }]) => ({
              id: pid,
              name: getProductName(pid),
              unit: getProductUnit(pid),
              total,
              avg: Math.round((total / days) * 10) / 10,
              count,
            }))
            .sort((a, b) => b.total - a.total),
        })),
      }
    } else {
      const agg: Record<string, { total: number; count: number }> = {}
      sessions.forEach((s) => {
        const items = s.material_order_items || []
        const sessionMaterials = new Set<string>()
        items.forEach((item) => {
          if (!agg[item.material_id]) agg[item.material_id] = { total: 0, count: 0 }
          agg[item.material_id].total += item.quantity
          sessionMaterials.add(item.material_id)
        })
        sessionMaterials.forEach((mid) => {
          agg[mid].count += 1
        })
      })

      const categories = materialCategories.filter((cat) =>
        Object.keys(agg).some((mid) => getMaterialCategory(mid) === cat)
      )

      return {
        totalSessions: sessions.length,
        days,
        categories: categories.map((cat) => ({
          name: cat,
          items: Object.entries(agg)
            .filter(([mid]) => getMaterialCategory(mid) === cat)
            .map(([mid, { total, count }]) => ({
              id: mid,
              name: getMaterialName(mid),
              unit: getMaterialUnit(mid),
              total,
              avg: Math.round((total / days) * 10) / 10,
              count,
            }))
            .sort((a, b) => b.total - a.total),
        })),
      }
    }
  }, [sessions, viewMode, orderType, startDate, endDate])

  const formatDateDisplay = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${y}/${m}/${day}`
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="歷史叫貨查詢" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無歷史資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="歷史叫貨查詢" backTo="/admin" />

      {/* Type tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {([['store', '門店叫貨'], ['material', '原物料叫貨']] as const).map(([type, label]) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              orderType === type
                ? 'text-brand-mocha border-b-2 border-brand-mocha'
                : 'text-brand-lotus'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          {([['today', '今日'], ['week', '本週'], ['month', '本月'], ['custom', '自訂']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                dateRange === key
                  ? 'bg-brand-mocha text-white'
                  : 'bg-gray-100 text-brand-lotus'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
            />
            <span className="text-xs text-brand-lotus">～</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
            />
          </div>
        )}

        {/* Store filter (only for store orders) */}
        {orderType === 'store' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-brand-lotus shrink-0">門店：</span>
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none"
            >
              <option value="all">全部</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* View mode tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {([['detail', '明細'], ['stats', '統計']] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              viewMode === mode
                ? 'text-brand-mocha border-b-2 border-brand-mocha'
                : 'text-brand-lotus'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : viewMode === 'detail' ? (
        /* Detail view */
        <div>
          {sessions.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              此期間無叫貨紀錄
            </div>
          ) : (
            sessions.map((session) => {
              const expanded = expandedIds.has(session.id)
              const items = orderType === 'store' ? session.order_items || [] : session.material_order_items || []
              const filledItems = orderType === 'store'
                ? (items as OrderItem[]).filter((i) => i.quantity > 0)
                : (items as MaterialOrderItem[]).filter((i) => i.quantity > 0)

              return (
                <div key={session.id} className="border-b border-gray-100">
                  <button
                    onClick={() => toggleExpand(session.id)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white active:bg-gray-50 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-brand-oak">
                          {formatDateDisplay(session.date)}
                        </span>
                        {orderType === 'store' && session.store_id && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-mocha/10 text-brand-mocha">
                            {getStoreName(session.store_id)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-brand-lotus mt-0.5">
                        {filledItems.length} 品項
                        {session.note && ` · 備註：${session.note}`}
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronUp size={18} className="text-brand-lotus shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-brand-lotus shrink-0" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-4 pb-3 bg-white">
                      {filledItems.length === 0 ? (
                        <p className="text-xs text-brand-lotus py-2">無品項資料</p>
                      ) : (
                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                          {orderType === 'store'
                            ? (filledItems as OrderItem[]).map((item, idx) => (
                                <div
                                  key={item.product_id}
                                  className={`flex items-center justify-between px-3 py-2 ${
                                    idx < filledItems.length - 1 ? 'border-b border-gray-50' : ''
                                  }`}
                                >
                                  <span className="text-sm text-brand-oak">{getProductName(item.product_id)}</span>
                                  <span className="text-sm font-num text-brand-mocha">
                                    {item.quantity} {getProductUnit(item.product_id)}
                                  </span>
                                </div>
                              ))
                            : (filledItems as MaterialOrderItem[]).map((item, idx) => (
                                <div
                                  key={item.material_id}
                                  className={`flex items-center justify-between px-3 py-2 ${
                                    idx < filledItems.length - 1 ? 'border-b border-gray-50' : ''
                                  }`}
                                >
                                  <span className="text-sm text-brand-oak">{getMaterialName(item.material_id)}</span>
                                  <span className="text-sm font-num text-brand-mocha">
                                    {item.quantity} {getMaterialUnit(item.material_id)}
                                  </span>
                                </div>
                              ))}
                        </div>
                      )}

                      {/* Extra notes for store orders */}
                      {orderType === 'store' && (session.almond_1000 || session.almond_300 || session.bowl_k520 || session.bowl_750) && (
                        <div className="mt-2 text-xs text-brand-lotus space-y-0.5">
                          {(session.almond_1000 || session.almond_300) && (
                            <p>杏仁茶瓶：{session.almond_1000 ? `1000ml ${session.almond_1000}個` : ''}{session.almond_1000 && session.almond_300 ? '、' : ''}{session.almond_300 ? `300ml ${session.almond_300}個` : ''}</p>
                          )}
                          {(session.bowl_k520 || session.bowl_750) && (
                            <p>紙碗：{session.bowl_k520 ? `K520 ${session.bowl_k520}箱` : ''}{session.bowl_k520 && session.bowl_750 ? '、' : ''}{session.bowl_750 ? `750 ${session.bowl_750}箱` : ''}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      ) : (
        /* Stats view */
        <div>
          {!stats || stats.totalSessions === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              此期間無叫貨紀錄
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-brand-oak">
                    {formatDateDisplay(startDate)} ~ {formatDateDisplay(endDate)}
                  </p>
                  <p className="text-xs text-brand-lotus mt-0.5">
                    共 {stats.totalSessions} 筆叫貨紀錄，{stats.days} 天
                  </p>
                </div>
                <ExportButtons
                  onExportExcel={() => {
                    const rows = stats.categories.flatMap(cat =>
                      cat.items.map(item => ({
                        '分類': cat.name,
                        '品名': item.name,
                        '單位': item.unit,
                        '合計': item.total,
                        '日均': item.avg,
                        '次數': item.count,
                      }))
                    )
                    exportToExcel({
                      data: rows,
                      fileName: `叫貨統計_${startDate}_${endDate}.xlsx`,
                      sheetName: '叫貨統計',
                    })
                  }}
                  onExportPdf={() => {
                    const rows = stats.categories.flatMap(cat =>
                      cat.items.map(item => ({
                        category: cat.name,
                        name: item.name,
                        unit: item.unit,
                        total: item.total,
                        avg: item.avg,
                        count: item.count,
                      }))
                    )
                    exportToPdf({
                      title: '叫貨統計',
                      dateRange: `${startDate} ~ ${endDate}`,
                      columns: [
                        { header: '分類', dataKey: 'category' },
                        { header: '品名', dataKey: 'name' },
                        { header: '單位', dataKey: 'unit' },
                        { header: '合計', dataKey: 'total' },
                        { header: '日均', dataKey: 'avg' },
                        { header: '次數', dataKey: 'count' },
                      ],
                      data: rows,
                      fileName: `叫貨統計_${startDate}_${endDate}.pdf`,
                    })
                  }}
                />
              </div>

              {/* Column header */}
              <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[60px] text-right">合計</span>
                <span className="w-[50px] text-right">日均</span>
                <span className="w-[40px] text-right">次數</span>
              </div>

              {stats.categories.map((cat) => (
                <div key={cat.name}>
                  <SectionHeader title={cat.name} icon="■" />
                  <div className="bg-white">
                    {cat.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className={`flex items-center px-4 py-2 ${
                          idx < cat.items.length - 1 ? 'border-b border-gray-50' : ''
                        }`}
                      >
                        <span className="flex-1 text-sm text-brand-oak truncate">{item.name}</span>
                        <span className="w-[60px] text-right text-sm font-num text-brand-oak">
                          {item.total}{item.unit}
                        </span>
                        <span className="w-[50px] text-right text-xs font-num text-brand-lotus">
                          {item.avg}
                        </span>
                        <span className="w-[40px] text-right text-xs font-num text-brand-lotus">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
