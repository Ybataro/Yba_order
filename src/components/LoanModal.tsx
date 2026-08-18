import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Check } from 'lucide-react'
import { fetchLoanSummary, upsertLoan, deleteLoan, type Loan } from '@/lib/loans'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/components/Toast'

interface Props {
  open: boolean
  onClose: () => void
  yearMonth: string
  onSaved: () => void
}

type Draft = Record<string, string>

const FIELDS: { key: keyof Loan; label: string; kind: 'text' | 'int' | 'rate' }[] = [
  { key: 'bank', label: '貸款銀行', kind: 'text' },
  { key: 'name', label: '名稱', kind: 'text' },
  { key: 'total_amount', label: '貸款總金額', kind: 'int' },
  { key: 'rate', label: '利率 (%)', kind: 'rate' },
  { key: 'periods', label: '期數', kind: 'int' },
  { key: 'remaining_amount', label: '剩餘貸款總額', kind: 'int' },
  { key: 'monthly_principal', label: '月繳本金費用', kind: 'int' },
  { key: 'monthly_interest', label: '月繳利息費用', kind: 'int' },
]

export function LoanModal({ open, onClose, yearMonth, onSaved }: Props) {
  const { showToast } = useToast()
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      load()
    } else {
      document.body.style.overflow = ''
      setExpandedId(null)
      setDeleting(null)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const load = async () => {
    setLoading(true)
    const s = await fetchLoanSummary(yearMonth)
    setLoans(s.loans)
    setLoading(false)
  }

  const openEdit = (loan: Loan) => {
    if (expandedId === loan.id) { setExpandedId(null); return }
    setExpandedId(loan.id)
    setDraft({
      bank: loan.bank,
      name: loan.name,
      total_amount: String(loan.total_amount),
      rate: loan.rate != null ? String(+(loan.rate * 100).toFixed(4)) : '',
      periods: loan.periods != null ? String(loan.periods) : '',
      remaining_amount: String(loan.remaining_amount),
      monthly_principal: String(loan.monthly_principal),
      monthly_interest: String(loan.monthly_interest),
      remaining_as_of: loan.remaining_as_of,
      note: loan.note || '',
    })
  }

  const handleSave = async (loan: Loan) => {
    if (saving) return
    if (!draft.bank?.trim() || !draft.name?.trim()) {
      showToast('銀行與名稱不可空白', 'error'); return
    }
    if (!/^\d{4}-\d{2}$/.test(draft.remaining_as_of || '')) {
      showToast('餘額基準月格式必須是 YYYY-MM', 'error'); return
    }
    const ratePercent = draft.rate.trim() === '' ? null : parseFloat(draft.rate)
    if (ratePercent != null && (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100)) {
      showToast('利率需為 0~100 的數字', 'error'); return
    }
    setSaving(true)
    try {
      const updated: Loan = {
        ...loan,
        bank: draft.bank.trim(),
        name: draft.name.trim(),
        total_amount: parseInt(draft.total_amount) || 0,
        rate: ratePercent == null ? null : ratePercent / 100,
        periods: draft.periods.trim() === '' ? null : parseInt(draft.periods) || 0,
        remaining_amount: parseInt(draft.remaining_amount) || 0,
        remaining_as_of: draft.remaining_as_of,
        monthly_principal: parseInt(draft.monthly_principal) || 0,
        monthly_interest: parseInt(draft.monthly_interest) || 0,
        note: draft.note.trim(),
      }
      if (!(await upsertLoan(updated))) { showToast('儲存失敗', 'error'); return }
      showToast('已儲存')
      setExpandedId(null)
      await load()
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    const now = new Date()
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const newLoan: Loan = {
      id: `loan_${Date.now()}`,
      bank: '銀行', name: '新增貸款',
      total_amount: 0, rate: null, periods: null,
      remaining_amount: 0, remaining_as_of: ym,
      monthly_principal: 0, monthly_interest: 0,
      is_active: true,
      sort_order: loans.length > 0 ? Math.max(...loans.map((l) => l.sort_order)) + 1 : 1,
      note: '',
    }
    if (!(await upsertLoan(newLoan))) { showToast('新增失敗', 'error'); return }
    await load()
    openEdit(newLoan)
    onSaved()
  }

  const handleDelete = async (id: string) => {
    if (!(await deleteLoan(id))) { showToast('刪除失敗', 'error'); return }
    setDeleting(null)
    setExpandedId(null)
    await load()
    onSaved()
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-lg bg-white rounded-t-sheet max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-oak">管理貸款</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200">
            <X size={20} className="text-brand-lotus" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-brand-lotus">載入中...</div>
          ) : loans.length === 0 ? (
            <div className="text-center py-10 text-sm text-brand-lotus">尚無貸款資料</div>
          ) : (
            <div className="space-y-1.5">
              {loans.map((loan) => (
                <div key={loan.id} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => openEdit(loan)}
                    className="w-full flex items-center justify-between px-3 py-2.5 active:bg-gray-50"
                  >
                    <div className="min-w-0 text-left">
                      <p className="text-sm text-brand-oak truncate">{loan.name}</p>
                      <p className="text-[11px] text-brand-lotus mt-0.5">
                        {loan.bank} · 月繳 {formatCurrency(loan.monthly_principal + loan.monthly_interest)}
                      </p>
                    </div>
                    <span className="text-xs font-num text-brand-lotus shrink-0 ml-2">
                      {formatCurrency(loan.remaining_amount)}
                    </span>
                  </button>

                  {expandedId === loan.id && (
                    <div className="px-3 pb-3 pt-1 bg-gray-50 space-y-2">
                      {FIELDS.map((f) => (
                        <div key={f.key as string} className="flex items-center gap-2">
                          <label className="text-[11px] text-brand-lotus w-24 shrink-0">{f.label}</label>
                          <input
                            type="text"
                            inputMode={f.kind === 'text' ? 'text' : f.kind === 'rate' ? 'decimal' : 'numeric'}
                            value={draft[f.key as string] ?? ''}
                            onChange={(ev) => {
                              const v = ev.target.value
                              if (f.kind === 'int' && v !== '' && !/^\d+$/.test(v)) return
                              if (f.kind === 'rate' && v !== '' && !/^\d*\.?\d*$/.test(v)) return
                              setDraft((p) => ({ ...p, [f.key as string]: v }))
                            }}
                            className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus font-num text-right"
                          />
                        </div>
                      ))}

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-brand-lotus w-24 shrink-0">餘額基準月</label>
                        <input
                          type="text"
                          value={draft.remaining_as_of ?? ''}
                          onChange={(ev) => setDraft((p) => ({ ...p, remaining_as_of: ev.target.value }))}
                          placeholder="2026-08"
                          className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus font-num text-right"
                        />
                      </div>
                      <p className="text-[10px] text-brand-lotus/70 leading-relaxed">
                        剩餘餘額以基準月為準，之後每月自動減去月繳本金。銀行對帳後更新這兩個欄位即可。
                      </p>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-brand-lotus w-24 shrink-0">備註</label>
                        <input
                          type="text"
                          value={draft.note ?? ''}
                          onChange={(ev) => setDraft((p) => ({ ...p, note: ev.target.value }))}
                          className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleSave(loan)}
                          disabled={saving}
                          className="flex-1 h-9 rounded-lg bg-brand-oak text-white text-xs font-medium active:opacity-80 disabled:opacity-50"
                        >
                          儲存
                        </button>
                        {deleting === loan.id ? (
                          <>
                            <span className="text-xs text-status-danger">確定?</span>
                            <button onClick={() => handleDelete(loan.id)} className="p-2 rounded-lg hover:bg-red-50">
                              <Check size={16} className="text-status-danger" />
                            </button>
                            <button onClick={() => setDeleting(null)} className="p-2 rounded-lg hover:bg-gray-100">
                              <X size={16} className="text-brand-lotus" />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setDeleting(loan.id)} className="p-2 rounded-lg hover:bg-red-50">
                            <Trash2 size={14} className="text-status-danger" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={handleAdd} className="btn-primary w-full !h-11 flex items-center justify-center gap-1.5">
            <Plus size={16} />
            新增貸款
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
