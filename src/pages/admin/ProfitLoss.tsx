import { useState, useEffect, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import ExportButtons from '@/components/ExportButtons'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  computeMonthlyPnL,
  computeYearlyPnL,
  upsertMonthlyExpense,
  type PnLResult,
} from '@/lib/profitLoss'

type ViewMode = 'month' | 'year'
type EntityId = string // 'lehua' | 'xingnan' | 'kitchen'

export default function ProfitLoss() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)

  const today = getTodayTW()
  const currentYear = parseInt(today.slice(0, 4))
  const currentMonth = today.slice(0, 7) // '2026-02'

  const [entity, setEntity] = useState<EntityId>(stores[0]?.id || 'lehua')
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [yearMonth, setYearMonth] = useState(currentMonth)
  const [year, setYear] = useState(currentYear)

  const [loading, setLoading] = useState(false)
  const [pnl, setPnl] = useState<PnLResult | null>(null)

  // Manual expense editing
  const [editValues, setEditValues] = useState<Record<string, string>>({})

  // Year view
  const [yearData, setYearData] = useState<{
    months: { yearMonth: string; revenue: number; totalExpense: number; surplus: number }[]
    totals: { revenue: number; totalExpense: number; surplus: number }
  } | null>(null)

  // Cumulative surplus
  const [cumulativeSurplus, setCumulativeSurplus] = useState<number>(0)

  const isKitchen = entity === 'kitchen'

  const entityName = isKitchen ? '央廚' : getStoreName(entity)

  // ── Fetch month data ──
  const fetchMonth = useCallback(async () => {
    setLoading(true)
    const result = await computeMonthlyPnL(entity, yearMonth)
    setPnl(result)

    // Initialize edit values from manual expenses
    if (result) {
      const vals: Record<string, string> = {}
      result.manualExpenses.forEach((e) => {
        vals[e.id] = e.amount > 0 ? String(e.amount) : ''
      })
      setEditValues(vals)
    }

    // Compute cumulative surplus: sum of all months from Jan to current month
    const [y, m] = yearMonth.split('-').map(Number)
    let cumulative = 0
    for (let i = 1; i <= m; i++) {
      const ym = `${y}-${String(i).padStart(2, '0')}`
      if (ym === yearMonth && result) {
        cumulative += result.revenue - result.totalExpense
      } else {
        const r = await computeMonthlyPnL(entity, ym)
        if (r) cumulative += r.revenue - r.totalExpense
      }
    }
    setCumulativeSurplus(cumulative)

    setLoading(false)
  }, [entity, yearMonth])

  // ── Fetch year data ──
  const fetchYear = useCallback(async () => {
    setLoading(true)
    const result = await computeYearlyPnL(entity, year)
    setYearData(result)
    setLoading(false)
  }, [entity, year])

  useEffect(() => {
    if (viewMode === 'month') fetchMonth()
    else fetchYear()
  }, [viewMode, fetchMonth, fetchYear])

  // ── Month navigation ──
  const prevMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const nm = m === 1 ? 12 : m - 1
    const ny = m === 1 ? y - 1 : y
    setYearMonth(`${ny}-${String(nm).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const [y, m] = yearMonth.split('-').map(Number)
    const nm = m === 12 ? 1 : m + 1
    const ny = m === 12 ? y + 1 : y
    setYearMonth(`${ny}-${String(nm).padStart(2, '0')}`)
  }

  // ── Manual expense save on blur ──
  const handleBlur = async (categoryId: string) => {
    const raw = editValues[categoryId] || ''
    const amount = parseInt(raw) || 0
    await upsertMonthlyExpense(entity, yearMonth, categoryId, amount)
    // Update local pnl without full refetch
    if (pnl) {
      const updated = { ...pnl }
      updated.manualExpenses = updated.manualExpenses.map((e) =>
        e.id === categoryId ? { ...e, amount } : e,
      )
      updated.totalExpense =
        updated.autoExpenses.reduce((s, e) => s + e.amount, 0) +
        updated.manualExpenses.reduce((s, e) => s + e.amount, 0)
      updated.surplus = updated.revenue - updated.totalExpense
      updated.taxReserve = updated.surplus > 0 ? Math.round(updated.surplus * 0.15) : 0
      updated.netSurplus = updated.surplus - updated.taxReserve
      setPnl(updated)
    }
  }

  // ── Month display ──
  const monthLabel = (() => {
    const [y, m] = yearMonth.split('-').map(Number)
    return `${y}年${m}月`
  })()

  // ── Export handlers ──
  const handleMonthExcel = () => {
    if (!pnl) return
    const rows: Record<string, unknown>[] = []
    rows.push({ '項目': '營業收入', '金額': pnl.revenue })
    rows.push({ '項目': '---', '金額': '---' })
    pnl.autoExpenses.forEach((e) => rows.push({ '項目': e.label, '金額': e.amount }))
    rows.push({ '項目': '---', '金額': '---' })
    pnl.manualExpenses.forEach((e) => rows.push({ '項目': e.label, '金額': e.amount }))
    rows.push({ '項目': '---', '金額': '---' })
    rows.push({ '項目': '總費用', '金額': pnl.totalExpense })
    rows.push({ '項目': '餘額', '金額': pnl.surplus })
    if (!isKitchen) {
      rows.push({ '項目': '預扣15%', '金額': pnl.taxReserve })
      rows.push({ '項目': '總盈餘', '金額': pnl.netSurplus })
    }
    exportToExcel({
      data: rows,
      fileName: `${entityName}_盈餘統計_${yearMonth}.xlsx`,
      sheetName: '盈餘統計',
    })
  }

  const handleMonthPdf = () => {
    if (!pnl) return
    const rows: Record<string, unknown>[] = []
    if (!isKitchen) rows.push({ item: '總營業額', amount: pnl.revenue })
    pnl.autoExpenses.forEach((e) => rows.push({ item: e.label, amount: e.amount }))
    pnl.manualExpenses.forEach((e) => rows.push({ item: e.label, amount: e.amount }))
    rows.push({ item: '總費用', amount: pnl.totalExpense })
    if (!isKitchen) {
      rows.push({ item: '餘額', amount: pnl.surplus })
      rows.push({ item: '預扣15%', amount: pnl.taxReserve })
      rows.push({ item: '總盈餘', amount: pnl.netSurplus })
    }
    exportToPdf({
      title: `${entityName} — ${monthLabel} 盈餘統計`,
      columns: [
        { header: '項目', dataKey: 'item' },
        { header: '金額', dataKey: 'amount' },
      ],
      data: rows,
      fileName: `${entityName}_盈餘統計_${yearMonth}.pdf`,
    })
  }

  const handleYearExcel = () => {
    if (!yearData) return
    const rows = yearData.months.map((m) => ({
      '月份': m.yearMonth,
      '營業額': m.revenue,
      '總費用': m.totalExpense,
      '盈餘': m.surplus,
    }))
    rows.push({
      '月份': '年度合計',
      '營業額': yearData.totals.revenue,
      '總費用': yearData.totals.totalExpense,
      '盈餘': yearData.totals.surplus,
    })
    exportToExcel({
      data: rows,
      fileName: `${entityName}_年報_${year}.xlsx`,
      sheetName: '年報',
    })
  }

  const handleYearPdf = () => {
    if (!yearData) return
    const rows = yearData.months.map((m) => ({
      month: m.yearMonth,
      revenue: m.revenue,
      expense: m.totalExpense,
      surplus: m.surplus,
    }))
    rows.push({
      month: '年度合計',
      revenue: yearData.totals.revenue,
      expense: yearData.totals.totalExpense,
      surplus: yearData.totals.surplus,
    })
    exportToPdf({
      title: `${entityName} — ${year}年 年度報表`,
      columns: [
        { header: '月份', dataKey: 'month' },
        { header: '營業額', dataKey: 'revenue' },
        { header: '總費用', dataKey: 'expense' },
        { header: '盈餘', dataKey: 'surplus' },
      ],
      data: rows,
      fileName: `${entityName}_年報_${year}.pdf`,
    })
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="盈餘統計" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="盈餘統計" backTo="/admin" />

      {/* Entity tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {stores.map((s) => (
          <button
            key={s.id}
            onClick={() => setEntity(s.id)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              entity === s.id ? 'text-brand-mocha border-b-2 border-brand-mocha' : 'text-brand-lotus'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => setEntity('kitchen')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            entity === 'kitchen' ? 'text-brand-mocha border-b-2 border-brand-mocha' : 'text-brand-lotus'
          }`}
        >
          央廚
        </button>
      </div>

      {/* View mode tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {([['month', '月報'], ['year', '年報']] as const).map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              viewMode === mode ? 'text-brand-mocha border-b-2 border-brand-mocha' : 'text-brand-lotus'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <button
          onClick={viewMode === 'month' ? prevMonth : () => setYear((y) => y - 1)}
          className="p-1 rounded active:bg-gray-100"
        >
          <ChevronLeft size={20} className="text-brand-oak" />
        </button>
        <span className="text-sm font-semibold text-brand-oak">
          {viewMode === 'month' ? monthLabel : `${year}年`}
        </span>
        <button
          onClick={viewMode === 'month' ? nextMonth : () => setYear((y) => y + 1)}
          className="p-1 rounded active:bg-gray-100"
        >
          <ChevronRight size={20} className="text-brand-oak" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">計算中...</div>
      ) : viewMode === 'month' ? (
        /* ─── Month view ─── */
        pnl ? (
          <>
            {/* Export */}
            <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100">
              <ExportButtons onExportExcel={handleMonthExcel} onExportPdf={handleMonthPdf} />
            </div>

            {/* Revenue (stores only) */}
            {!isKitchen && (
              <>
                <SectionHeader title="營業收入" icon="■" />
                <div className="bg-white">
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-sm text-brand-oak">總營業額</span>
                    <span className="text-sm font-bold font-num text-brand-oak">{formatCurrency(pnl.revenue)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Auto expenses */}
            {pnl.autoExpenses.length > 0 && (
              <>
                <SectionHeader title="自動計算費用" icon="■" />
                <div className="bg-white">
                  {pnl.autoExpenses.map((e, idx) => (
                    <div
                      key={e.id}
                      className={`flex items-center justify-between px-4 py-2.5 ${
                        idx < pnl.autoExpenses.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <span className="text-sm text-brand-oak">{e.label}</span>
                      <span className="text-sm font-num text-brand-oak">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Manual expenses */}
            <SectionHeader title={isKitchen ? '營運費用' : '營運費用（手動輸入）'} icon="■" />
            <div className="bg-white">
              {pnl.manualExpenses.map((e, idx) => (
                <div
                  key={e.id}
                  className={`flex items-center justify-between px-4 py-2 ${
                    idx < pnl.manualExpenses.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <span className="text-sm text-brand-oak">{e.label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editValues[e.id] ?? ''}
                      onChange={(ev) => {
                        const v = ev.target.value
                        if (v === '' || /^\d+$/.test(v)) {
                          setEditValues((prev) => ({ ...prev, [e.id]: v }))
                        }
                      }}
                      onBlur={() => handleBlur(e.id)}
                      onFocus={(ev) => ev.target.select()}
                      placeholder="0"
                      className="w-28 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak text-right outline-none focus:border-brand-lotus font-num"
                    />
                    <span className="text-xs text-brand-lotus">元</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Settlement */}
            <SectionHeader title="結算" icon="■" />
            <div className="bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                <span className="text-sm font-semibold text-brand-oak">
                  {isKitchen ? '央廚成本' : '總費用'}
                </span>
                <span className="text-sm font-bold font-num text-status-danger">
                  {formatCurrency(pnl.totalExpense)}
                </span>
              </div>

              {!isKitchen && (
                <>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <span className="text-sm text-brand-oak">餘額</span>
                    <span className={`text-sm font-bold font-num ${pnl.surplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      {formatCurrency(pnl.surplus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
                    <span className="text-sm text-brand-oak">預扣15%</span>
                    <span className="text-sm font-num text-brand-oak">{formatCurrency(pnl.taxReserve)}</span>
                  </div>
                  <div className={`flex items-center justify-between px-4 py-3 ${pnl.netSurplus >= 0 ? 'bg-status-success/10' : 'bg-status-danger/10'}`}>
                    <span className="text-sm font-bold text-brand-oak">總盈餘</span>
                    <span className={`text-base font-bold font-num ${pnl.netSurplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      {formatCurrency(pnl.netSurplus)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-brand-lotus">累計盈餘（至本月）</span>
                    <span className={`text-sm font-bold font-num ${cumulativeSurplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      {formatCurrency(cumulativeSurplus)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="h-6" />
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">無資料</div>
        )
      ) : (
        /* ─── Year view ─── */
        yearData ? (
          <>
            {/* Export */}
            <div className="flex items-center justify-end px-4 py-2 bg-white border-b border-gray-100">
              <ExportButtons onExportExcel={handleYearExcel} onExportPdf={handleYearPdf} />
            </div>

            <SectionHeader title={`${year}年 月度摘要`} icon="■" />
            <div className="bg-white">
              {/* Header */}
              <div className="flex items-center px-4 py-2 border-b border-gray-100 bg-gray-50">
                <span className="w-16 text-xs font-medium text-brand-lotus">月份</span>
                <span className="flex-1 text-xs font-medium text-brand-lotus text-right">
                  {isKitchen ? '成本' : '營業額'}
                </span>
                {!isKitchen && (
                  <span className="flex-1 text-xs font-medium text-brand-lotus text-right">總費用</span>
                )}
                <span className="flex-1 text-xs font-medium text-brand-lotus text-right">
                  {isKitchen ? '' : '盈餘'}
                </span>
              </div>
              {yearData.months.map((m, idx) => {
                const monthNum = parseInt(m.yearMonth.split('-')[1])
                return (
                  <div
                    key={m.yearMonth}
                    className={`flex items-center px-4 py-2 ${
                      idx < 11 ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <span className="w-16 text-sm text-brand-oak">{monthNum}月</span>
                    <span className="flex-1 text-sm font-num text-brand-oak text-right">
                      {isKitchen ? formatCurrency(m.totalExpense) : formatCurrency(m.revenue)}
                    </span>
                    {!isKitchen && (
                      <span className="flex-1 text-sm font-num text-brand-oak text-right">
                        {formatCurrency(m.totalExpense)}
                      </span>
                    )}
                    <span className={`flex-1 text-sm font-num text-right ${
                      isKitchen ? '' : m.surplus >= 0 ? 'text-status-success' : 'text-status-danger'
                    }`}>
                      {isKitchen ? '' : formatCurrency(m.surplus)}
                    </span>
                  </div>
                )
              })}
              {/* Totals */}
              <div className="flex items-center px-4 py-3 border-t-2 border-gray-200 bg-gray-50">
                <span className="w-16 text-sm font-bold text-brand-oak">合計</span>
                <span className="flex-1 text-sm font-bold font-num text-brand-oak text-right">
                  {isKitchen
                    ? formatCurrency(yearData.totals.totalExpense)
                    : formatCurrency(yearData.totals.revenue)}
                </span>
                {!isKitchen && (
                  <span className="flex-1 text-sm font-bold font-num text-brand-oak text-right">
                    {formatCurrency(yearData.totals.totalExpense)}
                  </span>
                )}
                <span className={`flex-1 text-sm font-bold font-num text-right ${
                  isKitchen ? '' : yearData.totals.surplus >= 0 ? 'text-status-success' : 'text-status-danger'
                }`}>
                  {isKitchen ? '' : formatCurrency(yearData.totals.surplus)}
                </span>
              </div>
            </div>

            <div className="h-6" />
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">無資料</div>
        )
      )}
    </div>
  )
}
