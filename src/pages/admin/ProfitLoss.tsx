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
import { ChevronLeft, ChevronRight, Settings, StickyNote } from 'lucide-react'
import {
  computeMonthlyPnL,
  computeYearlyPnL,
  upsertMonthlyExpense,
  upsertMonthlyExpenseNote,
  setMonthlyOverride,
  setExpenseRate,
  getRateHistory,
  deleteRateVersion,
  type PnLResult,
} from '@/lib/profitLoss'
import { ExpenseCategoryModal } from '@/components/ExpenseCategoryModal'
import { useToast } from '@/components/Toast'

type ViewMode = 'month' | 'year'
type EntityId = string // 'lehua' | 'xingnan' | 'kitchen'

export default function ProfitLoss() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)
  const { showToast } = useToast()

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
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  // 手動費用備註展開狀態
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  // 自動費用展開（編輯費率/覆寫）
  const [expandedAutoId, setExpandedAutoId] = useState<string | null>(null)
  const [overrideInput, setOverrideInput] = useState<string>('')
  const [rateHistory, setRateHistory] = useState<{ effective_from: string; rate: number; note: string }[]>([])
  const [newRateEffectiveFrom, setNewRateEffectiveFrom] = useState<string>('')
  const [newRatePercent, setNewRatePercent] = useState<string>('')
  const [autoOpSaving, setAutoOpSaving] = useState(false)

  // Year view
  const [yearData, setYearData] = useState<{
    months: { yearMonth: string; revenue: number; totalExpense: number; surplus: number }[]
    totals: { revenue: number; totalExpense: number; surplus: number }
  } | null>(null)

  // Cumulative surplus
  const [cumulativeSurplus, setCumulativeSurplus] = useState<number>(0)

  // 總覽：三方數字
  const [overviewMonth, setOverviewMonth] = useState<{
    lehua: { revenue: number; surplus: number } | null
    xingnan: { revenue: number; surplus: number } | null
    kitchen: { cost: number } | null
  } | null>(null)
  const [overviewYear, setOverviewYear] = useState<{
    lehua: { revenue: number; surplus: number } | null
    xingnan: { revenue: number; surplus: number } | null
    kitchen: { cost: number } | null
  } | null>(null)

  const isKitchen = entity === 'kitchen'
  const isOverview = entity === 'overview'

  const entityName = isOverview ? '總覽' : isKitchen ? '央廚' : getStoreName(entity)

  // ── Fetch overview (三方加總) ──
  const fetchOverviewMonth = useCallback(async () => {
    setLoading(true)
    const [lh, xn, kc] = await Promise.all([
      computeMonthlyPnL('lehua', yearMonth),
      computeMonthlyPnL('xingnan', yearMonth),
      computeMonthlyPnL('kitchen', yearMonth),
    ])
    setOverviewMonth({
      lehua: lh ? { revenue: lh.revenue, surplus: lh.surplus } : null,
      xingnan: xn ? { revenue: xn.revenue, surplus: xn.surplus } : null,
      kitchen: kc ? { cost: kc.totalExpense } : null,
    })
    setLoading(false)
  }, [yearMonth])

  const fetchOverviewYear = useCallback(async () => {
    setLoading(true)
    const [lh, xn, kc] = await Promise.all([
      computeYearlyPnL('lehua', year),
      computeYearlyPnL('xingnan', year),
      computeYearlyPnL('kitchen', year),
    ])
    setOverviewYear({
      lehua: lh ? { revenue: lh.totals.revenue, surplus: lh.totals.surplus } : null,
      xingnan: xn ? { revenue: xn.totals.revenue, surplus: xn.totals.surplus } : null,
      kitchen: kc ? { cost: kc.totals.totalExpense } : null,
    })
    setLoading(false)
  }, [year])

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
    if (isOverview) {
      if (viewMode === 'month') fetchOverviewMonth()
      else fetchOverviewYear()
    } else {
      if (viewMode === 'month') fetchMonth()
      else fetchYear()
    }
  }, [viewMode, isOverview, fetchMonth, fetchYear, fetchOverviewMonth, fetchOverviewYear])

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

  // ── 展開自動費用編輯面板 ──
  const handleExpandAuto = async (item: NonNullable<PnLResult['autoExpenses']>[number]) => {
    if (expandedAutoId === item.id) {
      setExpandedAutoId(null)
      return
    }
    setExpandedAutoId(item.id)
    setOverrideInput(item.overridden ? String(item.amount) : '')
    setNewRateEffectiveFrom(yearMonth)
    setNewRatePercent('')
    // 只有「比例型」自動費用才查費率歷史（orderCost / dailyExpense 沒費率）
    if (item.rate != null) {
      const history = await getRateHistory(item.id)
      setRateHistory(history)
    } else {
      setRateHistory([])
    }
  }

  // ── 儲存月度覆寫 ──
  const handleSaveOverride = async (categoryId: string) => {
    if (autoOpSaving) return
    setAutoOpSaving(true)
    try {
      const raw = overrideInput.trim()
      const amount = raw === '' ? null : parseInt(raw)
      if (amount != null && (isNaN(amount) || amount < 0)) {
        showToast('金額需為非負整數', 'error')
        return
      }
      const ok = await setMonthlyOverride(entity, yearMonth, categoryId, amount)
      if (!ok) { showToast('儲存失敗', 'error'); return }
      showToast(amount == null ? '已清除覆寫，回到自動計算' : '已套用覆寫金額')
      await fetchMonth()
    } finally {
      setAutoOpSaving(false)
    }
  }

  // ── 新增費率版本 ──
  const handleAddRate = async (categoryId: string) => {
    if (autoOpSaving) return
    const ymRe = /^\d{4}-\d{2}$/
    if (!ymRe.test(newRateEffectiveFrom)) {
      showToast('生效月份格式必須是 YYYY-MM', 'error'); return
    }
    const percent = parseFloat(newRatePercent)
    if (isNaN(percent) || percent < 0 || percent > 100) {
      showToast('費率需為 0~100 之間的數字（百分比）', 'error'); return
    }
    setAutoOpSaving(true)
    try {
      const ok = await setExpenseRate(categoryId, newRateEffectiveFrom, percent / 100)
      if (!ok) { showToast('費率儲存失敗', 'error'); return }
      showToast(`已設定 ${newRateEffectiveFrom} 起費率 ${percent}%`)
      const history = await getRateHistory(categoryId)
      setRateHistory(history)
      setNewRatePercent('')
      await fetchMonth()
    } finally {
      setAutoOpSaving(false)
    }
  }

  // ── 刪除費率版本 ──
  const handleDeleteRate = async (categoryId: string, effectiveFrom: string) => {
    if (autoOpSaving) return
    if (!confirm(`確定刪除 ${effectiveFrom} 生效的費率？\n刪除後此期間將回退到更舊的費率版本。`)) return
    setAutoOpSaving(true)
    try {
      const ok = await deleteRateVersion(categoryId, effectiveFrom)
      if (!ok) { showToast('刪除失敗', 'error'); return }
      showToast('費率已刪除')
      const history = await getRateHistory(categoryId)
      setRateHistory(history)
      await fetchMonth()
    } finally {
      setAutoOpSaving(false)
    }
  }

  // ── 手動費用備註 ──
  const handleToggleNote = (item: { id: string; note?: string }) => {
    if (expandedNoteId === item.id) {
      setExpandedNoteId(null)
      return
    }
    setExpandedNoteId(item.id)
    setNoteInput(item.note || '')
  }

  const handleSaveNote = async (categoryId: string) => {
    if (noteSaving) return
    setNoteSaving(true)
    try {
      const ok = await upsertMonthlyExpenseNote(entity, yearMonth, categoryId, noteInput.trim())
      if (!ok) { showToast('備註儲存失敗', 'error'); return }
      showToast(noteInput.trim() === '' ? '已清除備註' : '已儲存備註')
      // 更新 pnl 本地狀態
      if (pnl) {
        const updated = { ...pnl }
        updated.manualExpenses = updated.manualExpenses.map((e) =>
          e.id === categoryId ? { ...e, note: noteInput.trim() } : e,
        )
        setPnl(updated)
      }
      setExpandedNoteId(null)
    } finally {
      setNoteSaving(false)
    }
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
    if (!isKitchen) {
      rows.push({ '項目': '總盈餘', '金額': pnl.surplus })
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
      rows.push({ item: '總盈餘', amount: pnl.surplus })
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

      {/* Control Panel */}
      <div className="mx-4 mt-3 mb-3 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        {/* Entity selector — pill style */}
        <div className="flex gap-2 px-3 pt-3 pb-2.5">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => setEntity(s.id)}
              className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
                entity === s.id
                  ? 'bg-brand-mocha text-white shadow-sm'
                  : 'bg-gray-100 text-brand-lotus active:bg-gray-200'
              }`}
            >
              {s.name}
            </button>
          ))}
          <button
            onClick={() => setEntity('kitchen')}
            className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
              entity === 'kitchen'
                ? 'bg-brand-mocha text-white shadow-sm'
                : 'bg-gray-100 text-brand-lotus active:bg-gray-200'
            }`}
          >
            央廚
          </button>
          <button
            onClick={() => setEntity('overview')}
            className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-colors ${
              entity === 'overview'
                ? 'bg-brand-mocha text-white shadow-sm'
                : 'bg-gray-100 text-brand-lotus active:bg-gray-200'
            }`}
          >
            總覽
          </button>
        </div>

        <div className="border-t border-gray-100" />

        {/* View mode toggle + Period nav */}
        <div className="flex items-center justify-between px-3 py-2.5">
          {/* Segment control */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([['month', '月報'], ['year', '年報']] as const).map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === mode
                    ? 'bg-white text-brand-oak shadow-sm'
                    : 'text-brand-lotus'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Period nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={viewMode === 'month' ? prevMonth : () => setYear((y) => y - 1)}
              className="p-1 rounded-md active:bg-gray-100"
            >
              <ChevronLeft size={16} className="text-brand-lotus" />
            </button>
            <span className="text-sm font-semibold text-brand-oak min-w-[5rem] text-center">
              {viewMode === 'month' ? monthLabel : `${year}年`}
            </span>
            <button
              onClick={viewMode === 'month' ? nextMonth : () => setYear((y) => y + 1)}
              className="p-1 rounded-md active:bg-gray-100"
            >
              <ChevronRight size={16} className="text-brand-lotus" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">計算中...</div>
      ) : isOverview ? (
        /* ─── Overview view ─── */
        (() => {
          const data = viewMode === 'month' ? overviewMonth : overviewYear
          if (!data) {
            return <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">無資料</div>
          }
          const lehuaSurplus = data.lehua?.surplus || 0
          const xingnanSurplus = data.xingnan?.surplus || 0
          const kitchenCost = data.kitchen?.cost || 0
          const totalNet = lehuaSurplus + xingnanSurplus - kitchenCost
          const periodLabel = viewMode === 'month' ? monthLabel : `${year}年`
          return (
            <>
              {/* 總盈餘大卡 */}
              <div className="mx-4 mb-3 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-3 pb-3">
                  <p className="text-xs text-brand-lotus mb-1">{periodLabel} 總盈餘（樂華 + 興南 − 央廚）</p>
                  <p className={`text-3xl font-bold font-num ${totalNet >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                    {formatCurrency(totalNet)}
                  </p>
                </div>
              </div>

              <SectionHeader title="三方明細" icon="■" />
              <div className="bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-brand-oak">樂華店</p>
                    <p className="text-[11px] text-brand-lotus mt-0.5">營收 {formatCurrency(data.lehua?.revenue || 0)}</p>
                  </div>
                  <span className={`text-base font-bold font-num ${lehuaSurplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                    {formatCurrency(lehuaSurplus)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-brand-oak">興南店</p>
                    <p className="text-[11px] text-brand-lotus mt-0.5">營收 {formatCurrency(data.xingnan?.revenue || 0)}</p>
                  </div>
                  <span className={`text-base font-bold font-num ${xingnanSurplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                    {formatCurrency(xingnanSurplus)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-brand-oak">央廚</p>
                    <p className="text-[11px] text-brand-lotus mt-0.5">成本（從總盈餘扣除）</p>
                  </div>
                  <span className="text-base font-bold font-num text-status-danger">
                    −{formatCurrency(kitchenCost)}
                  </span>
                </div>
              </div>
              <div className="h-6" />
            </>
          )
        })()
      ) : viewMode === 'month' ? (
        /* ─── Month view ─── */
        pnl ? (
          <>
            {/* Summary card + Export */}
            <div className="mx-4 mb-3 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              {!isKitchen ? (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs text-brand-lotus mb-1">營業收入</p>
                  <p className="text-2xl font-bold font-num text-brand-oak">{formatCurrency(pnl.revenue)}</p>
                </div>
              ) : (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs text-brand-lotus mb-1">央廚成本</p>
                  <p className="text-2xl font-bold font-num text-brand-oak">{formatCurrency(pnl.totalExpense)}</p>
                </div>
              )}
              <div className="flex items-center justify-end px-3 pb-2.5">
                <ExportButtons onExportExcel={handleMonthExcel} onExportPdf={handleMonthPdf} />
              </div>
            </div>

            {/* Auto expenses */}
            {pnl.autoExpenses.length > 0 && (
              <>
                <SectionHeader title="自動計算費用" icon="■" />
                <div className="bg-white">
                  {pnl.autoExpenses.map((e, idx) => {
                    const isExpanded = expandedAutoId === e.id
                    const isRateBased = e.rate != null // 有費率的（營業稅/Uber/panda/LinePay）才可改費率
                    return (
                      <div
                        key={e.id}
                        className={`${idx < pnl.autoExpenses.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => handleExpandAuto(e)}
                          className="w-full flex items-center justify-between px-4 py-2.5 active:bg-gray-50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-brand-oak">{e.label}</span>
                            {isRateBased && e.rate != null && (
                              <span className="text-[11px] text-brand-lotus">
                                {(e.rate * 100).toFixed(e.rate * 100 % 1 === 0 ? 0 : 1)}%
                              </span>
                            )}
                            {e.overridden && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                已覆寫
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-num ${e.overridden ? 'text-amber-700 font-semibold' : 'text-brand-oak'}`}>
                              {formatCurrency(e.amount)}
                            </span>
                            <Settings size={14} className="text-brand-lotus/60 shrink-0" />
                          </div>
                        </button>

                        {/* 展開：費率 + 覆寫 */}
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-1 bg-gray-50 space-y-3">
                            {/* 自動算的結果（透明顯示推算過程）*/}
                            {isRateBased && e.rawValue != null && e.rate != null && (
                              <div className="text-[11px] text-brand-lotus bg-white rounded-lg px-3 py-2 border border-gray-100">
                                自動計算：{formatCurrency(e.rawValue)} × {(e.rate * 100).toFixed(e.rate * 100 % 1 === 0 ? 0 : 1)}% = <span className="font-semibold text-brand-oak">{formatCurrency(e.autoAmount || 0)}</span>
                              </div>
                            )}
                            {!isRateBased && (
                              <div className="text-[11px] text-brand-lotus bg-white rounded-lg px-3 py-2 border border-gray-100">
                                自動加總：{formatCurrency(e.autoAmount || 0)}
                              </div>
                            )}

                            {/* 覆寫金額 */}
                            <div>
                              <label className="text-[11px] text-brand-lotus block mb-1">此月實際金額（覆寫）</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={overrideInput}
                                  onChange={(ev) => {
                                    const v = ev.target.value
                                    if (v === '' || /^\d+$/.test(v)) setOverrideInput(v)
                                  }}
                                  placeholder={`空白 = 用自動值 ${formatCurrency(e.autoAmount || 0)}`}
                                  className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-oak font-num outline-none focus:border-brand-lotus"
                                />
                                <button
                                  onClick={() => handleSaveOverride(e.id)}
                                  disabled={autoOpSaving}
                                  className="px-3 h-9 rounded-lg bg-brand-oak text-white text-xs font-medium active:opacity-80 disabled:opacity-50"
                                >
                                  {overrideInput.trim() === '' ? '清除覆寫' : '套用'}
                                </button>
                              </div>
                            </div>

                            {/* 費率歷史（只有比例型才顯示）*/}
                            {isRateBased && (
                              <div>
                                <p className="text-[11px] text-brand-lotus mb-1">費率歷史</p>
                                <div className="space-y-1">
                                  {rateHistory.map((h) => (
                                    <div key={h.effective_from} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-100 text-xs">
                                      <span className="text-brand-oak">
                                        <span className="font-num">{h.effective_from}</span> 起 ·
                                        <span className="font-semibold font-num ml-1">{(h.rate * 100).toFixed(h.rate * 100 % 1 === 0 ? 0 : 1)}%</span>
                                      </span>
                                      <button
                                        onClick={() => handleDeleteRate(e.id, h.effective_from)}
                                        disabled={autoOpSaving}
                                        className="text-[11px] text-status-danger active:opacity-60 disabled:opacity-30"
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  ))}
                                  {rateHistory.length === 0 && (
                                    <p className="text-[11px] text-brand-lotus/60 italic text-center py-1">尚無費率歷史</p>
                                  )}
                                </div>

                                {/* 新增費率版本 */}
                                <div className="mt-2 flex gap-1.5">
                                  <input
                                    type="text"
                                    value={newRateEffectiveFrom}
                                    onChange={(ev) => setNewRateEffectiveFrom(ev.target.value)}
                                    placeholder="2026-07"
                                    className="w-24 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-brand-oak font-num outline-none focus:border-brand-lotus"
                                  />
                                  <span className="text-xs text-brand-lotus self-center">起</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={newRatePercent}
                                    onChange={(ev) => {
                                      const v = ev.target.value
                                      if (v === '' || /^\d*\.?\d*$/.test(v)) setNewRatePercent(v)
                                    }}
                                    placeholder="32"
                                    className="w-20 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-brand-oak font-num outline-none focus:border-brand-lotus text-right"
                                  />
                                  <span className="text-xs text-brand-lotus self-center">%</span>
                                  <button
                                    onClick={() => handleAddRate(e.id)}
                                    disabled={autoOpSaving}
                                    className="flex-1 h-8 rounded-lg bg-brand-mocha text-white text-xs font-medium active:opacity-80 disabled:opacity-50"
                                  >
                                    新增費率
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Manual expenses */}
            <div className="flex items-center justify-between">
              <SectionHeader title={isKitchen ? '營運費用' : '營運費用（手動輸入）'} icon="■" />
              <button
                onClick={() => setCategoryModalOpen(true)}
                className="mr-4 p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200"
              >
                <Settings size={16} className="text-brand-lotus" />
              </button>
            </div>
            <div className="bg-white">
              {pnl.manualExpenses.map((e, idx) => {
                const noteExpanded = expandedNoteId === e.id
                const hasNote = !!(e.note && e.note.trim())
                return (
                <div
                  key={e.id}
                  className={`${
                    idx < pnl.manualExpenses.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleNote(e)}
                      className="flex items-center gap-1.5 min-w-0 active:opacity-70"
                    >
                      <span className="text-sm text-brand-oak">{e.label}</span>
                      <StickyNote
                        size={14}
                        className={hasNote ? 'text-amber-600' : 'text-brand-lotus/40'}
                      />
                      {hasNote && (
                        <span className="text-[11px] text-amber-700 truncate max-w-[140px]">
                          {e.note}
                        </span>
                      )}
                    </button>
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
                  {noteExpanded && (
                    <div className="px-4 pb-3 pt-1 bg-gray-50">
                      <label className="text-[11px] text-brand-lotus block mb-1">備註</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={noteInput}
                          onChange={(ev) => setNoteInput(ev.target.value)}
                          placeholder="輸入備註（例：5/15 添購餐盤一批）"
                          className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm text-brand-oak outline-none focus:border-brand-lotus"
                        />
                        <button
                          onClick={() => handleSaveNote(e.id)}
                          disabled={noteSaving}
                          className="px-3 h-9 rounded-lg bg-brand-oak text-white text-xs font-medium active:opacity-80 disabled:opacity-50"
                        >
                          {noteInput.trim() === '' ? '清除' : '儲存'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                )
              })}
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
                  <div className={`flex items-center justify-between px-4 py-3 ${pnl.surplus >= 0 ? 'bg-status-success/10' : 'bg-status-danger/10'}`}>
                    <span className="text-sm font-bold text-brand-oak">總盈餘</span>
                    <span className={`text-base font-bold font-num ${pnl.surplus >= 0 ? 'text-status-success' : 'text-status-danger'}`}>
                      {formatCurrency(pnl.surplus)}
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
            {/* Year summary header */}
            <div className="mx-4 mb-3 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs text-brand-lotus mb-1">{year}年 {isKitchen ? '總成本' : '總盈餘'}</p>
                <p className={`text-2xl font-bold font-num ${
                  isKitchen ? 'text-brand-oak' : yearData.totals.surplus >= 0 ? 'text-status-success' : 'text-status-danger'
                }`}>
                  {isKitchen ? formatCurrency(yearData.totals.totalExpense) : formatCurrency(yearData.totals.surplus)}
                </p>
              </div>
              <div className="flex items-center justify-end px-3 pb-2.5">
                <ExportButtons onExportExcel={handleYearExcel} onExportPdf={handleYearPdf} />
              </div>
            </div>

            <SectionHeader title="月度摘要" icon="■" />
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

      <ExpenseCategoryModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        storeId={entity as 'lehua' | 'xingnan' | 'kitchen'}
        onSaved={() => { if (viewMode === 'month') fetchMonth() }}
      />
    </div>
  )
}
