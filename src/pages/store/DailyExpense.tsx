import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'
import { getSession } from '@/lib/auth'
import { formatCurrency } from '@/lib/utils'
import { Trash2, Plus } from 'lucide-react'

interface ExpenseRow {
  id: string
  item_name: string
  amount: number
  note: string
  created_at: string
}

export default function DailyExpense() {
  const { storeId } = useParams<{ storeId: string }>()
  const today = getTodayTW()
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<ExpenseRow[]>([])
  const [loading, setLoading] = useState(false)

  // New item form
  const [itemName, setItemName] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Month total
  const monthStart = date.slice(0, 8) + '01'
  const [monthItems, setMonthItems] = useState<ExpenseRow[]>([])

  const monthTotal = useMemo(() => monthItems.reduce((sum, r) => sum + r.amount, 0), [monthItems])

  // Fetch day items
  useEffect(() => {
    if (!supabase || !storeId) return
    setLoading(true)
    supabase
      .from('daily_expenses')
      .select('*')
      .eq('store_id', storeId)
      .eq('date', date)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setItems(data || [])
        setLoading(false)
      })
  }, [storeId, date])

  // Fetch month items
  useEffect(() => {
    if (!supabase || !storeId) return
    const lastDay = new Date(parseInt(date.slice(0, 4)), parseInt(date.slice(5, 7)), 0)
    const monthEnd = `${date.slice(0, 8)}${String(lastDay.getDate()).padStart(2, '0')}`
    supabase
      .from('daily_expenses')
      .select('*')
      .eq('store_id', storeId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .then(({ data }) => {
        setMonthItems(data || [])
      })
  }, [storeId, date, monthStart, items])

  const handleAdd = async () => {
    if (!supabase || !storeId || !itemName.trim() || !amount) return
    setSubmitting(true)
    const session = getSession()
    const { data, error } = await supabase
      .from('daily_expenses')
      .insert({
        store_id: storeId,
        date,
        item_name: itemName.trim(),
        amount: parseInt(amount) || 0,
        note: note.trim(),
        submitted_by: session?.staffId || null,
      })
      .select()
      .single()

    if (!error && data) {
      setItems((prev) => [...prev, data])
      setItemName('')
      setAmount('')
      setNote('')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    await supabase.from('daily_expenses').delete().eq('id', id)
    setItems((prev) => prev.filter((r) => r.id !== id))
  }

  const dayTotal = useMemo(() => items.reduce((sum, r) => sum + r.amount, 0), [items])

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="雜支申報" backTo={`/store/${storeId}`} />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="雜支申報" backTo={`/store/${storeId}`} />

      {/* Date selector */}
      <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs text-brand-lotus shrink-0">日期：</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-sm text-brand-oak outline-none"
          />
        </div>
      </div>

      {/* New item form */}
      <div className="mx-4 mt-3 card space-y-2">
        <p className="text-sm font-semibold text-brand-oak">新增雜支</p>
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

      {/* Month total badge */}
      <div className="mx-4 mt-3 flex items-center justify-between px-3 py-2 rounded-lg bg-brand-mocha/10">
        <span className="text-xs text-brand-oak font-medium">
          {date.slice(0, 7).replace('-', '年')}月 累計雜支
        </span>
        <span className="text-sm font-bold text-brand-mocha font-num">{formatCurrency(monthTotal)}</span>
      </div>

      {/* Day items list */}
      <div className="mx-4 mt-3">
        <p className="text-xs text-brand-lotus mb-1">
          當日雜支（{items.length} 筆，合計 {formatCurrency(dayTotal)}）
        </p>
        {loading ? (
          <div className="py-10 text-center text-sm text-brand-lotus">載入中...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-brand-lotus">尚無雜支紀錄</div>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div key={item.id} className="card flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-brand-oak truncate">{item.item_name}</span>
                    <span className="text-sm font-bold font-num text-brand-mocha">{formatCurrency(item.amount)}</span>
                  </div>
                  {item.note && <p className="text-xs text-brand-lotus mt-0.5 truncate">{item.note}</p>}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 rounded-lg text-status-danger/60 hover:bg-status-danger/10 active:scale-90 transition-transform shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-6" />
    </div>
  )
}
