import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { getSession } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import { useAllowedPages } from '@/hooks/useAllowedPages'
import { Trash2, Plus, Pencil, Check, X } from 'lucide-react'

interface ExpenseRow {
  id: string
  date: string
  item_name: string
  amount: number
  note: string
  submitted_by: string | null
  created_at: string
}

const STORE_ID = 'kitchen'
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function getWeekday(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00+08:00')
  return WEEKDAYS[d.getDay()]
}

export default function KitchenDailyExpense() {
  const today = getTodayTW()
  const [date, setDate] = useState(today)
  const session = getSession()
  const allowedPages = useAllowedPages('kitchen')
  const canEditAll = session?.role === 'admin' || allowedPages === null || (allowedPages?.includes('expense-edit') ?? false)

  // Month items (main data)
  const [monthItems, setMonthItems] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // New item form
  const [itemName, setItemName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')

  const monthKey = date.slice(0, 7) // YYYY-MM

  // Fetch month items
  useEffect(() => {
    if (!supabase) return
    setLoading(true)
    const monthStart = monthKey + '-01'
    const lastDay = new Date(parseInt(monthKey.slice(0, 4)), parseInt(monthKey.slice(5, 7)), 0)
    const monthEnd = `${monthKey}-${String(lastDay.getDate()).padStart(2, '0')}`
    supabase
      .from('daily_expenses')
      .select('*')
      .eq('store_id', STORE_ID)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: false })
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMonthItems(data || [])
        setLoading(false)
      })
  }, [monthKey, refreshKey])

  // Group by date (descending)
  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>()
    for (const item of monthItems) {
      const list = map.get(item.date) || []
      list.push(item)
      map.set(item.date, list)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [monthItems])

  const monthTotal = useMemo(() => monthItems.reduce((sum, r) => sum + r.amount, 0), [monthItems])

  const handleAdd = async () => {
    if (!supabase || !itemName.trim() || !amount) return
    setSubmitting(true)
    const session = getSession()
    const { error } = await supabase
      .from('daily_expenses')
      .insert({
        store_id: STORE_ID,
        date,
        item_name: itemName.trim(),
        amount: parseInt(amount) || 0,
        note: note.trim(),
        submitted_by: session?.staffId || null,
      })

    if (!error) {
      setItemName('')
      setAmount('')
      setNote('')
      setRefreshKey((k) => k + 1)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    await supabase.from('daily_expenses').delete().eq('id', id)
    setRefreshKey((k) => k + 1)
  }

  const startEdit = (item: ExpenseRow) => {
    setEditingId(item.id)
    setEditName(item.item_name)
    setEditAmount(String(item.amount))
    setEditNote(item.note || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleUpdate = async () => {
    if (!supabase || !editingId || !editName.trim() || !editAmount) return
    const { error } = await supabase
      .from('daily_expenses')
      .update({
        item_name: editName.trim(),
        amount: parseInt(editAmount) || 0,
        note: editNote.trim(),
      })
      .eq('id', editingId)

    if (!error) {
      setEditingId(null)
      setRefreshKey((k) => k + 1)
    }
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="雜支申報" backTo="/kitchen" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="雜支申報" backTo="/kitchen" />

      {/* New item form with date selector */}
      <div className="mx-4 mt-3 card space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-brand-oak">新增雜支</p>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-7 rounded-lg border border-gray-200 px-2 text-xs text-brand-oak outline-none"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="品項名稱"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2.5 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          />
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="金額"
              value={amount}
              onChange={(e) => {
                if (e.target.value === '' || /^\d+$/.test(e.target.value)) setAmount(e.target.value)
              }}
              className="w-20 h-9 rounded-lg border border-gray-200 bg-surface-input px-2.5 text-sm text-brand-oak outline-none focus:border-brand-lotus text-right"
            />
            <span className="text-xs text-brand-lotus">元</span>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="備註（選填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2.5 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !itemName.trim() || !amount}
            className="flex items-center gap-1 px-4 h-9 rounded-lg bg-brand-mocha text-white text-sm font-medium active:scale-95 transition-transform disabled:opacity-40"
          >
            <Plus size={16} />
            新增
          </button>
        </div>
      </div>

      {/* Month detail list grouped by date */}
      <div className="mx-4 mt-3">
        {loading ? (
          <div className="py-10 text-center text-sm text-brand-lotus">載入中...</div>
        ) : grouped.length === 0 ? (
          <div className="py-10 text-center text-sm text-brand-lotus">本月尚無雜支紀錄</div>
        ) : (
          <div className="space-y-3">
            {grouped.map(([groupDate, groupItems]) => {
              const dayTotal = groupItems.reduce((s, r) => s + r.amount, 0)
              return (
                <div key={groupDate}>
                  {/* Date header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-brand-oak">
                      {groupDate.replace(/-/g, '/')}（{getWeekday(groupDate)}）
                    </span>
                    <span className="text-xs text-brand-lotus font-num">
                      {groupItems.length} 筆・{formatCurrency(dayTotal)}
                    </span>
                  </div>
                  {/* Items */}
                  <div className="space-y-1.5">
                    {groupItems.map((item) =>
                      editingId === item.id ? (
                        /* Editing mode */
                        <div key={item.id} className="card space-y-2 border-brand-mocha/30">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={editAmount}
                                onChange={(e) => {
                                  if (e.target.value === '' || /^\d+$/.test(e.target.value)) setEditAmount(e.target.value)
                                }}
                                className="w-20 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus text-right"
                              />
                              <span className="text-xs text-brand-lotus">元</span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="備註"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="flex-1 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
                            />
                            <button
                              onClick={handleUpdate}
                              disabled={!editName.trim() || !editAmount}
                              className="p-1.5 rounded-lg text-status-success hover:bg-status-success/10 active:scale-90 transition-transform disabled:opacity-40"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded-lg text-brand-lotus hover:bg-gray-100 active:scale-90 transition-transform"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Display mode */
                        <div key={item.id} className="card flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-brand-oak truncate">{item.item_name}</span>
                              <span className="text-sm font-bold font-num text-brand-mocha">{formatCurrency(item.amount)}</span>
                            </div>
                            {item.note && <p className="text-xs text-brand-lotus mt-0.5 truncate">{item.note}</p>}
                          </div>
                          {(canEditAll || item.submitted_by === session?.staffId) && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1.5 rounded-lg text-brand-lotus hover:bg-gray-100 active:scale-90 transition-transform"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 rounded-lg text-status-danger/60 hover:bg-status-danger/10 active:scale-90 transition-transform"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Month total footer */}
      <div className="mx-4 mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-brand-mocha/10">
        <span className="text-xs text-brand-oak font-medium">
          {monthKey.replace('-', '年')}月 累計
        </span>
        <span className="text-sm font-bold text-brand-mocha font-num">
          {monthItems.length} 筆・{formatCurrency(monthTotal)}
        </span>
      </div>

      <div className="h-6" />
    </div>
  )
}
