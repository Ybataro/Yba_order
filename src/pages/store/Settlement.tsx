import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { useSettlementStore } from '@/stores/useSettlementStore'
import { supabase } from '@/lib/supabase'
import { settlementSessionId, getTodayTW } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { formatCurrency } from '@/lib/utils'
import { Send, RefreshCw } from 'lucide-react'

export default function Settlement() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const settlementFields = useSettlementStore((s) => s.items)
  const settlementGroups = useSettlementStore((s) => s.groups)

  const today = getTodayTW()
  const sessionId = settlementSessionId(storeId || '', today)

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    settlementFields.forEach(f => { init[f.id] = '' })
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    setLoading(true)
    supabase
      .from('settlement_sessions')
      .select('id')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        supabase!
          .from('settlement_values')
          .select('*')
          .eq('session_id', sessionId)
          .then(({ data: items }) => {
            if (items && items.length > 0) {
              const loaded: Record<string, string> = {}
              settlementFields.forEach(f => { loaded[f.id] = '' })
              items.forEach((item) => {
                loaded[item.field_id] = item.value || ''
              })
              setValues(loaded)
            }
            setLoading(false)
          })
      })
  }, [storeId, today])

  const num = (id: string) => parseFloat(values[id]) || 0

  const computed = useMemo(() => {
    const posTotal = num('posTotal')
    const deductions = num('invoiceRefund') + num('openCashBills') + num('openCashCoins')
    const payments = num('easyPay') + num('taiwanPay') + num('allPay') + num('linePay') +
      num('pettyCash') + num('invoiceRefund2') + num('prevDayUndeposited') + num('changeExchange')
    const deliveryFees = num('uberFee') + num('pandaFee')
    const otherExpense = num('otherExpense')
    const otherIncome = num('otherIncome')
    const expectedTotal = posTotal - deductions - payments - deliveryFees - otherExpense + otherIncome

    const cashTotal = num('cash1000') * 1000 + num('cash500') * 500 + num('cash100') * 100 +
      num('coin50') * 50 + num('coin10') * 10 + num('coin5') * 5 + num('coin1') * 1

    const safeTotal = num('safe1000') * 1000 + num('safe100') * 100 +
      num('safe50') * 3000 + num('safe10') * 1000 + num('safe5') * 500

    const actualTotal = cashTotal + safeTotal
    const diff = actualTotal - expectedTotal

    return { expectedTotal, cashTotal, safeTotal, actualTotal, diff }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  const updateValue = (id: string, value: string) => {
    setValues(prev => ({ ...prev, [id]: value }))
  }

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-stl]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) {
      arr[idx + 1].focus()
    }
  }

  const handleSubmit = async () => {
    if (!storeId) return

    setSubmitting(true)

    const session = {
      id: sessionId,
      store_id: storeId,
      date: today,
      submitted_by: staffId || null,
      updated_at: new Date().toISOString(),
    }

    const items = settlementFields
      .filter(f => values[f.id] !== '')
      .map(f => ({
        session_id: sessionId,
        field_id: f.id,
        value: values[f.id],
      }))

    const success = await submitWithOffline({
      type: 'settlement',
      storeId,
      sessionId,
      session,
      items,
      onSuccess: (msg) => {
        setIsEdit(true)
        logAudit('settlement_submit', storeId, sessionId, { itemCount: items.length })
        showToast(msg || (isEdit ? '結帳資料已更新！' : '結帳資料已提交成功！'))
      },
      onError: (msg) => showToast(msg, 'error'),
    })

    if (success && !navigator.onLine) {
      setIsEdit(true)
    }

    setSubmitting(false)
  }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 每日結帳`} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入今日結帳紀錄，修改後可重新提交</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {settlementGroups.map(group => {
            const fields = settlementFields.filter(f => f.group === group)
            return (
              <div key={group}>
                <SectionHeader title={group} icon="■" />
                <div className="bg-white">
                  {fields.map(field => {
                    if (field.type === 'text') {
                      return (
                        <div key={field.id} className="flex items-center justify-between px-4 py-1.5 border-b border-gray-50">
                          <span className="text-sm text-brand-oak">{field.label}</span>
                          <input
                            type="text"
                            value={values[field.id]}
                            onChange={e => updateValue(field.id, e.target.value)}
                            placeholder="無"
                            className="input-field !w-[140px] !text-sm !text-left"
                            data-stl=""
                          />
                        </div>
                      )
                    }

                    const calcAmount = field.multiplier && values[field.id]
                      ? parseFloat(values[field.id]) * field.multiplier
                      : null

                    return (
                      <div key={field.id} className="flex items-center justify-between px-4 py-1.5 border-b border-gray-50">
                        <span className="text-sm text-brand-oak">{field.label}</span>
                        <div className="flex items-center gap-2">
                          <NumericInput
                            value={values[field.id]}
                            onChange={(v) => updateValue(field.id, v)}
                            unit={field.unit}
                            isFilled
                            onNext={focusNext}
                            className={field.id === 'posTotal' ? '!w-[90px]' : '!w-[72px]'}
                            data-stl=""
                          />
                          {calcAmount !== null && (
                            <span className="text-xs text-brand-lotus min-w-[60px] text-right">
                              ={formatCurrency(calcAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {group === '結帳金額' && (
                    <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10">
                      <span className="text-sm font-semibold text-brand-amber">應結總金額</span>
                      <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.expectedTotal)}</span>
                    </div>
                  )}
                  {group === '實收盤點' && (
                    <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10">
                      <span className="text-sm font-semibold text-brand-amber">鈔票總額</span>
                      <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.cashTotal)}</span>
                    </div>
                  )}
                  {group === '鐵櫃內盤點' && (
                    <>
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10">
                        <span className="text-sm font-semibold text-brand-amber">鐵櫃總額</span>
                        <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.safeTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10 border-t border-brand-camel/20">
                        <span className="text-sm font-semibold text-brand-amber">實收總結金額</span>
                        <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.actualTotal)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          <SectionHeader title="結算摘要" icon="■" />
          <div className="bg-white">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-brand-oak">當日結帳差額</span>
              <span className={`text-lg font-bold font-num ${computed.diff !== 0 ? 'text-status-danger' : 'text-status-success'}`}>
                {formatCurrency(computed.diff)}
              </span>
            </div>
          </div>

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新結帳資料' : '提交結帳資料'}
            onClick={handleSubmit}
            icon={<Send size={18} />}
            disabled={submitting}
          />
        </>
      )}
    </div>
  )
}
