import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { RefreshCw } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  staff_id: string | null
  staff_name: string | null
  store_id: string | null
  session_id: string | null
  details: Record<string, unknown>
  created_at: string
}

type DateRange = 'today' | 'week' | 'month' | 'custom'

function getStartDate(range: DateRange, customStart: string): string {
  const today = getTodayTW()
  switch (range) {
    case 'today': return today
    case 'week': {
      const d = new Date(today + 'T00:00:00')
      d.setDate(d.getDate() - 7)
      return d.toISOString().split('T')[0]
    }
    case 'month': {
      const d = new Date(today + 'T00:00:00')
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().split('T')[0]
    }
    case 'custom': return customStart || today
  }
}

const actionLabels: Record<string, string> = {
  'inventory_submit': '盤點提交',
  'order_submit': '叫貨提交',
  'settlement_submit': '結帳提交',
  'shipment_submit': '出貨提交',
  'receive_submit': '收貨確認',
}

export default function AuditLog() {
  const stores = useStoreStore((s) => s.items)
  const getStoreName = useStoreStore((s) => s.getName)
  const today = getTodayTW()

  const [dateRange, setDateRange] = useState<DateRange>('today')
  const [customStart, setCustomStart] = useState(today)
  const [customEnd, setCustomEnd] = useState(today)
  const [storeFilter, setStoreFilter] = useState('all')
  const [staffFilter, setStaffFilter] = useState('')

  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const startDate = getStartDate(dateRange, customStart)
  const endDate = dateRange === 'custom' ? customEnd : today

  // Fetch logs
  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    setLoading(true)

    let query = supabase
      .from('audit_logs')
      .select('*')
      .gte('created_at', `${startDate}T00:00:00+08:00`)
      .lte('created_at', `${endDate}T23:59:59+08:00`)
      .order('created_at', { ascending: false })
      .limit(200)

    if (storeFilter !== 'all') {
      query = query.eq('store_id', storeFilter)
    }

    query.then(({ data }) => {
      setLogs((data as AuditEntry[] | null) || [])
      setLoading(false)
    })
  }, [startDate, endDate, storeFilter])

  // Filter by staff name
  const filteredLogs = useMemo(() => {
    if (!staffFilter) return logs
    return logs.filter((log) =>
      log.staff_name?.toLowerCase().includes(staffFilter.toLowerCase()) ||
      log.staff_id?.toLowerCase().includes(staffFilter.toLowerCase())
    )
  }, [logs, staffFilter])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, AuditEntry[]> = {}
    filteredLogs.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
      if (!groups[date]) groups[date] = []
      groups[date].push(log)
    })
    return groups
  }, [filteredLogs])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="操作記錄" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="操作記錄" backTo="/admin" />

      {/* Filters */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 space-y-2">
        <div className="flex gap-2">
          {([['today', '今日'], ['week', '本週'], ['month', '本月'], ['custom', '自訂']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                dateRange === key ? 'bg-brand-mocha text-white' : 'bg-gray-100 text-brand-lotus'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none" />
            <span className="text-xs text-brand-lotus">～</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none" />
          </div>
        )}

        <div className="flex gap-2">
          <select
            value={storeFilter}
            onChange={(e) => setStoreFilter(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none"
          >
            <option value="all">全部門市</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            placeholder="搜尋人員"
            className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-sm text-brand-lotus">
          <RefreshCw size={16} className="animate-spin" />
          載入中...
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
          此期間無操作記錄
        </div>
      ) : (
        Object.entries(grouped).map(([date, entries]) => (
          <div key={date}>
            <SectionHeader title={date} icon="■" />
            <div className="bg-white divide-y divide-gray-50">
              {entries.map((log) => (
                <div key={log.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-brand-oak">
                        {actionLabels[log.action] || log.action}
                      </p>
                      <p className="text-[11px] text-brand-lotus mt-0.5">
                        {log.staff_name || '未知'}
                        {log.store_id && <> · {getStoreName(log.store_id)}</>}
                      </p>
                    </div>
                    <span className="text-[11px] text-gray-400 font-num shrink-0">
                      {new Date(log.created_at).toLocaleTimeString('zh-TW', {
                        timeZone: 'Asia/Taipei',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
