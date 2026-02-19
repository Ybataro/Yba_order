import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'
import { exportToExcel } from '@/lib/exportExcel'
import { computeSession, type SettlementValue } from '@/lib/settlement'

type ViewMode = 'detail' | 'stats'
type DateRange = 'today' | 'week' | 'month' | 'custom'

interface SettlementSession {
  id: string
  store_id: string
  date: string
  settlement_values: SettlementValue[]
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

export default function SettlementHistory() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)

  const [viewMode, setViewMode] = useState<ViewMode>('detail')
  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const [sessions, setSessions] = useState<SettlementSession[]>([])
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

  // Fetch
  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    setSessions([])
    setExpandedIds(new Set())

    let query = supabase
      .from('settlement_sessions')
      .select('*, settlement_values(*)')
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
  }, [startDate, endDate, storeFilter])

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const formatDateDisplay = (d: string) => {
    const [y, m, day] = d.split('-')
    return `${y}/${m}/${day}`
  }

  // Group sessions by date for detail view
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SettlementSession[]>()
    sessions.forEach((s) => {
      const arr = map.get(s.date) || []
      arr.push(s)
      map.set(s.date, arr)
    })
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [sessions])

  // Stats computation
  const stats = useMemo(() => {
    if (viewMode !== 'stats' || sessions.length === 0) return null

    let totalRevenue = 0
    let totalOrders = 0
    let normalDays = 0
    let abnormalDays = 0

    // Payment method totals
    const paymentTotals: Record<string, number> = {}

    sessions.forEach((s) => {
      const c = computeSession(s.settlement_values || [])
      totalRevenue += c.posTotal
      totalOrders += c.orderCount

      if (Math.abs(c.diff) <= 10) normalDays++
      else abnormalDays++

      c.paymentBreakdown.forEach((p) => {
        paymentTotals[p.label] = (paymentTotals[p.label] || 0) + p.amount
      })
    })

    const days = sessions.length
    const avgRevenue = days > 0 ? Math.round(totalRevenue / days) : 0
    const avgPrice = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0

    const paymentList = Object.entries(paymentTotals)
      .map(([label, amount]) => ({
        label,
        amount,
        percent: totalRevenue > 0 ? Math.round((amount / totalRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

    return { totalRevenue, totalOrders, days, avgRevenue, avgPrice, normalDays, abnormalDays, paymentList }
  }, [sessions, viewMode])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="結帳歷史查詢" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          尚無歷史資料（需連接 Supabase）
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="結帳歷史查詢" backTo="/admin" />

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
      </div>

      {/* View mode tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {([['detail', '明細'], ['stats', '月報統計']] as const).map(([mode, label]) => (
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
        /* Detail view — grouped by date */
        <div>
          {sessionsByDate.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              此期間無結帳紀錄
            </div>
          ) : (
            sessionsByDate.map(([, daySessions]) => {
              // Multiple stores on same day
              return daySessions.map((session) => {
                const expanded = expandedIds.has(session.id)
                const c = computeSession(session.settlement_values || [])

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
                          <span className="text-xs px-1.5 py-0.5 rounded bg-brand-mocha/10 text-brand-mocha">
                            {getStoreName(session.store_id)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-brand-lotus">
                            營業額 {formatCurrency(c.posTotal)}
                          </span>
                          <span className="text-xs text-brand-lotus">
                            {c.orderCount}號
                          </span>
                          <span className="text-xs text-brand-lotus">
                            客單價 {formatCurrency(c.avgPrice)}
                          </span>
                          <span className={`text-xs font-medium ${Math.abs(c.diff) <= 10 ? 'text-status-success' : 'text-status-danger'}`}>
                            差額 {c.diff >= 0 ? '+' : ''}{c.diff}
                          </span>
                        </div>
                      </div>
                      {expanded ? (
                        <ChevronUp size={18} className="text-brand-lotus shrink-0" />
                      ) : (
                        <ChevronDown size={18} className="text-brand-lotus shrink-0" />
                      )}
                    </button>

                    {expanded && (
                      <div className="px-4 pb-3 bg-white space-y-2">
                        {/* Summary */}
                        <div className="border border-gray-100 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                            <span className="text-sm text-brand-oak">POS結帳金額</span>
                            <span className="text-sm font-num text-brand-oak">{formatCurrency(c.posTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                            <span className="text-sm text-brand-oak">實收（鈔票+鐵櫃）</span>
                            <span className="text-sm font-num text-brand-oak">{formatCurrency(c.actualTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                            <span className="text-sm text-brand-oak">鈔票總額</span>
                            <span className="text-xs font-num text-brand-lotus">{formatCurrency(c.cashTotal)}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50">
                            <span className="text-sm text-brand-oak">鐵櫃總額</span>
                            <span className="text-xs font-num text-brand-lotus">{formatCurrency(c.safeTotal)}</span>
                          </div>
                          <div className={`flex items-center justify-between px-3 py-2 ${Math.abs(c.diff) <= 10 ? 'bg-status-success/10' : 'bg-status-danger/10'}`}>
                            <span className="text-sm font-semibold text-brand-oak">差額</span>
                            <span className={`text-sm font-bold font-num ${Math.abs(c.diff) <= 10 ? 'text-status-success' : 'text-status-danger'}`}>
                              {c.diff >= 0 ? '+' : ''}{formatCurrency(c.diff)}
                            </span>
                          </div>
                        </div>

                        {/* Payment breakdown */}
                        {c.paymentBreakdown.length > 0 && (
                          <div>
                            <p className="text-xs text-brand-lotus mb-1">支付方式明細</p>
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                              {c.paymentBreakdown.map((p, idx) => (
                                <div
                                  key={p.label}
                                  className={`flex items-center justify-between px-3 py-1.5 ${
                                    idx < c.paymentBreakdown.length - 1 ? 'border-b border-gray-50' : ''
                                  }`}
                                >
                                  <span className="text-xs text-brand-oak">{p.label}</span>
                                  <span className="text-xs font-num text-brand-oak">{formatCurrency(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            })
          )}
        </div>
      ) : (
        /* Stats view */
        <div>
          {!stats ? (
            <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
              此期間無結帳紀錄
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100">
                <button
                  onClick={() => {
                    const rows = sessions.map(s => {
                      const c = computeSession(s.settlement_values || [])
                      return {
                        '日期': s.date,
                        '門店': getStoreName(s.store_id),
                        '營業額': c.posTotal,
                        '號數': c.orderCount,
                        '客單價': c.avgPrice,
                        '應結金額': c.expectedTotal,
                        '實收金額': c.actualTotal,
                        '差額': c.diff,
                      }
                    })
                    exportToExcel({
                      data: rows,
                      fileName: `結帳歷史_${startDate}_${endDate}.xlsx`,
                      sheetName: '結帳歷史',
                    })
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
                >
                  <Download size={14} />
                  匯出 Excel
                </button>
              </div>
              <SectionHeader title="月報摘要" icon="■" />
              <div className="bg-white">
                <div className="grid grid-cols-2 gap-px bg-gray-100">
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">總營業額</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(stats.totalRevenue)}</p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">日均營業額</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(stats.avgRevenue)}</p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">總號數</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{stats.totalOrders}</p>
                  </div>
                  <div className="bg-white px-4 py-3">
                    <p className="text-xs text-brand-lotus">平均客單價</p>
                    <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(stats.avgPrice)}</p>
                  </div>
                </div>
              </div>

              <SectionHeader title="各支付方式佔比" icon="■" />
              <div className="bg-white">
                {stats.paymentList.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-brand-lotus">無電子支付紀錄</p>
                ) : (
                  stats.paymentList.map((p, idx) => (
                    <div
                      key={p.label}
                      className={`flex items-center px-4 py-2 ${
                        idx < stats.paymentList.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <span className="flex-1 text-sm text-brand-oak">{p.label}</span>
                      <span className="w-[80px] text-right text-sm font-num text-brand-oak">{formatCurrency(p.amount)}</span>
                      <span className="w-[50px] text-right text-xs font-num text-brand-lotus">{p.percent}%</span>
                    </div>
                  ))
                )}
              </div>

              <SectionHeader title="差額統計" icon="■" />
              <div className="bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <span className="text-sm text-brand-oak">結帳筆數</span>
                  <span className="text-sm font-num text-brand-oak">{stats.days} 筆</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <span className="text-sm text-status-success">正常（差額 ±10 內）</span>
                  <span className="text-sm font-num text-status-success">{stats.normalDays} 筆</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-status-danger">異常（差額 &gt; ±10）</span>
                  <span className="text-sm font-num text-status-danger">{stats.abnormalDays} 筆</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
