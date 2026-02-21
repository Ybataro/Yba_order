import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { formatCurrency } from '@/lib/utils'
import { exportToExcel } from '@/lib/exportExcel'
import { exportToPdf } from '@/lib/exportPdf'
import ExportButtons from '@/components/ExportButtons'

type DateRange = 'today' | 'week' | 'month' | 'custom'

interface ExpenseRow {
  id: string
  store_id: string
  date: string
  item_name: string
  amount: number
  note: string
  submitted_by: string | null
  created_at: string
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

export default function ExpenseManagement() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)

  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [storeFilter, setStoreFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [items, setItems] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(false)

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
    setItems([])

    let query = supabase
      .from('daily_expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })

    if (storeFilter !== 'all') {
      query = query.eq('store_id', storeFilter)
    }

    query.then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }, [startDate, endDate, storeFilter])

  const formatDateDisplay = (d: string) => {
    const [y, m, day] = d.split('-')
    const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(d + 'T00:00:00').getDay()]
    return `${y}/${m}/${day}（${wd}）`
  }

  const getEntityName = (sid: string) => {
    if (sid === 'kitchen') return '央廚'
    return getStoreName(sid)
  }

  // Monthly summary per store
  const monthlySummary = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((r) => {
      map.set(r.store_id, (map.get(r.store_id) || 0) + r.amount)
    })
    return Array.from(map.entries())
      .map(([storeId, total]) => ({ storeId, name: getEntityName(storeId), total }))
      .sort((a, b) => b.total - a.total)
  }, [items])

  const grandTotal = useMemo(() => items.reduce((sum, r) => sum + r.amount, 0), [items])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="雜支管理" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="雜支管理" backTo="/admin" />

      {/* Filters */}
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
          <span className="text-xs text-brand-lotus shrink-0">單位：</span>
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none"
          >
            <option value="all">全部</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="kitchen">央廚</option>
          </select>
        </div>
      </div>

      {/* Export + summary */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <span className="text-xs text-brand-lotus">
          共 {items.length} 筆，合計 {formatCurrency(grandTotal)}
        </span>
        <ExportButtons
          onExportExcel={() => {
            const rows = items.map((r) => ({
              '日期': r.date,
              '單位': getEntityName(r.store_id),
              '品項': r.item_name,
              '金額': r.amount,
              '備註': r.note || '',
            }))
            exportToExcel({
              data: rows,
              fileName: `雜支紀錄_${startDate}_${endDate}.xlsx`,
              sheetName: '雜支紀錄',
            })
          }}
          onExportPdf={() => {
            const rows = items.map((r) => ({
              date: r.date,
              store: getEntityName(r.store_id),
              item: r.item_name,
              amount: r.amount,
              note: r.note || '',
            }))
            exportToPdf({
              title: '雜支紀錄',
              dateRange: `${startDate} ~ ${endDate}`,
              columns: [
                { header: '日期', dataKey: 'date' },
                { header: '單位', dataKey: 'store' },
                { header: '品項', dataKey: 'item' },
                { header: '金額', dataKey: 'amount' },
                { header: '備註', dataKey: 'note' },
              ],
              data: rows,
              fileName: `雜支紀錄_${startDate}_${endDate}.pdf`,
            })
          }}
        />
      </div>

      {/* Monthly summary cards */}
      {monthlySummary.length > 0 && (
        <>
          <SectionHeader title="各單位雜支摘要" icon="■" />
          <div className="bg-white">
            <div className="grid grid-cols-2 gap-px bg-gray-100">
              {monthlySummary.map((s) => (
                <div key={s.storeId} className="bg-white px-4 py-3">
                  <p className="text-xs text-brand-lotus">{s.name}</p>
                  <p className="text-lg font-bold text-brand-oak font-num mt-0.5">{formatCurrency(s.total)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Detail list */}
      <SectionHeader title="雜支明細" icon="■" />
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">此期間無雜支紀錄</div>
      ) : (
        <div className="bg-white">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`px-4 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-brand-lotus shrink-0">{formatDateDisplay(item.date)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-brand-mocha/10 text-brand-mocha shrink-0">
                    {getEntityName(item.store_id)}
                  </span>
                  <span className="text-sm text-brand-oak truncate">{item.item_name}</span>
                </div>
                <span className="text-sm font-bold font-num text-brand-oak shrink-0 ml-2">
                  {formatCurrency(item.amount)}
                </span>
              </div>
              {item.note && (
                <p className="text-xs text-brand-lotus mt-0.5 pl-16 truncate">{item.note}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
