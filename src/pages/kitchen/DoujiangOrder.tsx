import { useState, useEffect, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { NumericInput } from '@/components/NumericInput'
import { Plus, ChevronLeft, Send, RefreshCw, Trash2 } from 'lucide-react'
import { getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import {
  autoFillDoujiangOrder,
  listDoujiangOrders,
  getDoujiangOrder,
  saveDoujiangOrder,
  deleteDoujiangOrder,
  type DoujiangOrderRow,
  type DoujiangVariantData,
} from '@/lib/doujiangOrder'

type Mode = 'list' | 'edit'

interface VariantFormState {
  prevStock: string
  prevReceived: string
  orderStock: number
  discarded: number
  usage: number
  recommended: number
  actualOrdered: string
}

const emptyVariant = (): VariantFormState => ({
  prevStock: '',
  prevReceived: '',
  orderStock: 0,
  discarded: 0,
  usage: 0,
  recommended: 0,
  actualOrdered: '',
})

/** 取得今天那週的週一（台灣時間） */
function getMondayOfCurrentWeek(): string {
  const today = new Date(getTodayTW() + 'T00:00:00')
  const day = today.getDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff)
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
}

export default function DoujiangOrder() {
  const { showToast } = useToast()
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)

  const [mode, setMode] = useState<Mode>('list')
  const [orders, setOrders] = useState<DoujiangOrderRow[]>([])
  const [loadingList, setLoadingList] = useState(true)

  // edit form state
  const [orderDate, setOrderDate] = useState<string>(getMondayOfCurrentWeek())
  const [weitang, setWeitang] = useState<VariantFormState>(emptyVariant())
  const [wutang, setWutang] = useState<VariantFormState>(emptyVariant())
  const [snapshot, setSnapshot] = useState({
    kitchen: { weitang: 0, wutang: 0 },
    lehua: { weitang: 0, wutang: 0 },
    xingnan: { weitang: 0, wutang: 0 },
  })
  const [discardedBreakdown, setDiscardedBreakdown] = useState({
    kitchen: { weitang: 0, wutang: 0 },
    lehua: { weitang: 0, wutang: 0 },
    xingnan: { weitang: 0, wutang: 0 },
  })
  const [isFirstOrder, setIsFirstOrder] = useState(false)
  const [existingStatus, setExistingStatus] = useState<'draft' | 'sent' | null>(null)
  const [note, setNote] = useState('')
  const [confirmBy, setConfirmBy] = useState('')
  const [loadingForm, setLoadingForm] = useState(false)
  const [saving, setSaving] = useState(false)

  // 列表載入
  const reloadList = useCallback(async () => {
    setLoadingList(true)
    const rows = await listDoujiangOrders(20)
    setOrders(rows)
    setLoadingList(false)
  }, [])

  useEffect(() => {
    if (mode === 'list') reloadList()
  }, [mode, reloadList])

  // 進入編輯：載入既有 or 自動帶
  const loadFormForDate = useCallback(async (date: string) => {
    setLoadingForm(true)
    setOrderDate(date)
    const existing = await getDoujiangOrder(date)
    const fill = await autoFillDoujiangOrder(date)
    if (!fill) {
      setLoadingForm(false)
      showToast('自動帶資料失敗', 'error')
      return
    }
    setIsFirstOrder(fill.isFirstOrder)
    setSnapshot(fill.snapshot)
    setDiscardedBreakdown(fill.discardedBreakdown)

    if (existing) {
      setExistingStatus(existing.status)
      setWeitang({
        prevStock: String(existing.weitang_prev_stock || 0),
        prevReceived: String(existing.weitang_prev_received || 0),
        orderStock: existing.weitang_order_stock,
        discarded: existing.weitang_discarded,
        usage: existing.weitang_usage,
        recommended: existing.weitang_recommended,
        actualOrdered: String(existing.weitang_actual_ordered || existing.weitang_recommended || 0),
      })
      setWutang({
        prevStock: String(existing.wutang_prev_stock || 0),
        prevReceived: String(existing.wutang_prev_received || 0),
        orderStock: existing.wutang_order_stock,
        discarded: existing.wutang_discarded,
        usage: existing.wutang_usage,
        recommended: existing.wutang_recommended,
        actualOrdered: String(existing.wutang_actual_ordered || existing.wutang_recommended || 0),
      })
      setNote(existing.note || '')
      setConfirmBy(existing.submitted_by || '')
    } else {
      setExistingStatus(null)
      setWeitang({
        prevStock: String(fill.weitang.prevStock),
        prevReceived: String(fill.weitang.prevReceived),
        orderStock: fill.weitang.orderStock,
        discarded: fill.weitang.discarded,
        usage: fill.weitang.usage,
        recommended: fill.weitang.recommended,
        actualOrdered: String(fill.weitang.recommended),
      })
      setWutang({
        prevStock: String(fill.wutang.prevStock),
        prevReceived: String(fill.wutang.prevReceived),
        orderStock: fill.wutang.orderStock,
        discarded: fill.wutang.discarded,
        usage: fill.wutang.usage,
        recommended: fill.wutang.recommended,
        actualOrdered: String(fill.wutang.recommended),
      })
      setNote('')
    }
    setLoadingForm(false)
  }, [showToast])

  // 重算公式（首次手動修改上週庫存/前次進貨時觸發）
  const recompute = (v: VariantFormState): VariantFormState => {
    const prevStock = parseFloat(v.prevStock) || 0
    const prevReceived = parseFloat(v.prevReceived) || 0
    const usage = prevStock + prevReceived - v.orderStock - v.discarded
    const raw = usage - v.orderStock + (usage / 7) * 3
    // 訂貨量整數四捨五入，保底 5
    const recommended = Math.max(5, Math.round(raw))
    return { ...v, usage: Math.round(usage * 10) / 10, recommended }
  }

  const updateVariant = (which: 'weitang' | 'wutang', patch: Partial<VariantFormState>) => {
    const setter = which === 'weitang' ? setWeitang : setWutang
    setter((prev) => {
      const next = { ...prev, ...patch }
      if ('prevStock' in patch || 'prevReceived' in patch) {
        const recomputed = recompute(next)
        // 若使用者尚未自訂 actualOrdered（仍等於舊 recommended），則同步更新
        if (next.actualOrdered === String(prev.recommended)) {
          return { ...recomputed, actualOrdered: String(recomputed.recommended) }
        }
        return recomputed
      }
      return next
    })
  }

  const handleSave = async (status: 'draft' | 'sent') => {
    if (saving) return
    if (status === 'sent' && !confirmBy) {
      showToast('請先選擇訂貨人員', 'error')
      return
    }
    setSaving(true)
    const toVariant = (v: VariantFormState): DoujiangVariantData & { actualOrdered: number } => ({
      prevStock: parseFloat(v.prevStock) || 0,
      prevReceived: parseFloat(v.prevReceived) || 0,
      orderStock: v.orderStock,
      discarded: v.discarded,
      usage: v.usage,
      recommended: v.recommended,
      actualOrdered: parseFloat(v.actualOrdered) || 0,
    })
    const res = await saveDoujiangOrder({
      orderDate,
      weitang: toVariant(weitang),
      wutang: toVariant(wutang),
      snapshot,
      status,
      note,
      submittedBy: confirmBy || null,
    })
    setSaving(false)
    if (!res.ok) {
      showToast('儲存失敗：' + (res.error || '未知錯誤'), 'error')
      return
    }
    showToast(status === 'sent' ? '訂貨已送出' : '草稿已儲存')
    setMode('list')
  }

  const handleDelete = async () => {
    if (!confirm(`確定刪除 ${formatDate(orderDate)} 的訂貨記錄？`)) return
    const ok = await deleteDoujiangOrder(orderDate)
    if (!ok) { showToast('刪除失敗', 'error'); return }
    showToast('已刪除')
    setMode('list')
  }

  // ─────────── 列表畫面 ───────────
  if (mode === 'list') {
    return (
      <div className="page-container">
        <TopNav title="店內豆漿叫貨" backTo="/kitchen/orders-hub" />
        <div className="px-4 pt-3">
          <button
            onClick={() => { loadFormForDate(getMondayOfCurrentWeek()); setMode('edit') }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-brand-mocha text-white rounded-xl shadow-sm active:opacity-80"
          >
            <Plus size={18} />
            <span className="text-sm font-medium">新增本週訂貨（{formatDate(getMondayOfCurrentWeek())}）</span>
          </button>
        </div>

        <SectionHeader title="歷史訂貨" icon="■" />
        {loadingList ? (
          <div className="text-sm text-brand-lotus text-center py-10">載入中...</div>
        ) : orders.length === 0 ? (
          <div className="text-sm text-brand-lotus text-center py-10">尚無記錄</div>
        ) : (
          <div className="bg-white">
            {orders.map((o, idx) => (
              <button
                key={o.id}
                onClick={() => { loadFormForDate(o.order_date); setMode('edit') }}
                className={`w-full flex items-center px-4 py-3 text-left ${idx < orders.length - 1 ? 'border-b border-gray-50' : ''} active:bg-gray-50`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-oak">{formatDate(o.order_date)}</p>
                  <p className="text-[11px] text-brand-lotus mt-0.5">
                    微糖 {o.weitang_actual_ordered || o.weitang_recommended} ・ 無糖 {o.wutang_actual_ordered || o.wutang_recommended}
                  </p>
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${o.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {o.status === 'sent' ? '已送出' : '草稿'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─────────── 編輯畫面 ───────────
  const variantRow = (
    title: string,
    color: string,
    v: VariantFormState,
    which: 'weitang' | 'wutang',
    snap: { kitchen: number; lehua: number; xingnan: number },
    disc: { kitchen: number; lehua: number; xingnan: number },
  ) => (
    <div className="bg-white rounded-xl border border-gray-100 mb-3 overflow-hidden">
      <div className={`px-4 py-2 ${color} text-white text-sm font-semibold`}>{title}</div>
      <div className="px-4 py-3 space-y-2.5">
        {/* 上週庫存 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-24">上週庫存</span>
          <NumericInput
            value={v.prevStock}
            onChange={(val) => updateVariant(which, { prevStock: val })}
            isFilled
          />
        </div>
        {/* 前次進貨 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-24">前次進貨</span>
          <NumericInput
            value={v.prevReceived}
            onChange={(val) => updateVariant(which, { prevReceived: val })}
            isFilled
          />
        </div>
        {/* 訂貨日庫存（自動）*/}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-24">訂貨日庫存</span>
          <div className="flex-1 flex items-center justify-end gap-1.5 text-[11px] text-brand-mocha">
            <span>央廚 {snap.kitchen}</span>
            <span>+ 樂華 {snap.lehua}</span>
            <span>+ 興南 {snap.xingnan}</span>
            <span className="font-semibold text-brand-oak ml-1">= {v.orderStock}</span>
          </div>
        </div>
        {/* 過期損耗（自動）*/}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-lotus shrink-0 w-24">過期損耗</span>
          <div className="flex-1 flex items-center justify-end gap-1.5 text-[11px] text-brand-mocha">
            <span>央廚 {disc.kitchen}</span>
            <span>+ 樂華 {disc.lehua}</span>
            <span>+ 興南 {disc.xingnan}</span>
            <span className="font-semibold text-brand-oak ml-1">= {v.discarded}</span>
          </div>
        </div>
        <div className="border-t border-gray-100 my-2" />
        {/* 上週使用量 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-mocha shrink-0 w-24">上週使用量</span>
          <span className="text-sm font-num font-semibold text-brand-oak">{v.usage}</span>
        </div>
        {/* 系統推薦 */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-brand-mocha shrink-0 w-24">系統推薦</span>
          <span className="text-sm font-num font-semibold text-status-success">{v.recommended} 袋</span>
        </div>
        {/* 實際訂貨量（可修）*/}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-sm font-semibold text-brand-oak shrink-0 w-24">本週訂貨量</span>
          <NumericInput
            value={v.actualOrdered}
            onChange={(val) => updateVariant(which, { actualOrdered: val })}
            isFilled
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-container">
      <TopNav title={`豆漿訂貨 ${formatDate(orderDate)}`} backTo="/kitchen/orders-hub" />
      <div className="px-4 pt-3 flex items-center justify-between mb-2">
        <button
          onClick={() => setMode('list')}
          className="flex items-center gap-1 text-sm text-brand-lotus active:opacity-60"
        >
          <ChevronLeft size={16} />
          返回列表
        </button>
        <button
          onClick={() => loadFormForDate(orderDate)}
          disabled={loadingForm}
          className="flex items-center gap-1 text-xs text-brand-mocha active:opacity-60 disabled:opacity-30"
        >
          <RefreshCw size={14} className={loadingForm ? 'animate-spin' : ''} />
          重新自動帶
        </button>
      </div>

      {loadingForm ? (
        <div className="text-sm text-brand-lotus text-center py-10">計算中...</div>
      ) : (
        <div className="px-4 pb-32">
          {isFirstOrder && existingStatus === null && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
              首次訂貨：請手動填上週庫存 + 前次進貨，之後系統會自動帶。
            </div>
          )}

          {variantRow(
            '微糖豆漿', 'bg-brand-camel', weitang, 'weitang',
            { kitchen: snapshot.kitchen.weitang, lehua: snapshot.lehua.weitang, xingnan: snapshot.xingnan.weitang },
            { kitchen: discardedBreakdown.kitchen.weitang, lehua: discardedBreakdown.lehua.weitang, xingnan: discardedBreakdown.xingnan.weitang },
          )}
          {variantRow(
            '無糖豆漿', 'bg-brand-mocha', wutang, 'wutang',
            { kitchen: snapshot.kitchen.wutang, lehua: snapshot.lehua.wutang, xingnan: snapshot.xingnan.wutang },
            { kitchen: discardedBreakdown.kitchen.wutang, lehua: discardedBreakdown.lehua.wutang, xingnan: discardedBreakdown.xingnan.wutang },
          )}

          {/* 備註 */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3">
            <p className="text-xs text-brand-lotus mb-1.5">備註</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="可選"
              className="w-full text-sm text-brand-oak rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-lotus resize-none"
            />
          </div>

          {/* 訂貨人員 */}
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-3">
            <p className="text-xs text-brand-lotus mb-1.5">訂貨人員</p>
            <select
              value={confirmBy}
              onChange={(e) => setConfirmBy(e.target.value)}
              className="w-full text-sm text-brand-oak rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand-lotus bg-white"
            >
              <option value="">— 請選擇 —</option>
              {kitchenStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* 刪除按鈕（既有記錄才顯示）*/}
          {existingStatus !== null && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-sm text-status-danger active:opacity-60"
            >
              <Trash2 size={14} />
              刪除此訂貨記錄
            </button>
          )}
        </div>
      )}

      {!loadingForm && (
        <BottomAction
          label={saving ? '送出中...' : existingStatus === 'sent' ? '更新已送出記錄' : '送出本週訂貨'}
          onClick={() => handleSave('sent')}
          icon={<Send size={18} />}
          disabled={saving}
        />
      )}
    </div>
  )
}
