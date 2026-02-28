import { useState, useMemo, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { DateNav } from '@/components/DateNav'
import { useSettlementStore } from '@/stores/useSettlementStore'
import { supabase } from '@/lib/supabase'
import { settlementSessionId, getTodayTW } from '@/lib/session'
import { submitWithOffline } from '@/lib/submitWithOffline'
import { logAudit } from '@/lib/auditLog'
import { formatCurrency } from '@/lib/utils'
import { Send, RefreshCw, CheckCircle } from 'lucide-react'
import { sendTelegramNotification } from '@/lib/telegram'

export default function Settlement() {
  const { storeId } = useParams<{ storeId: string }>()
  const [searchParams] = useSearchParams()
  const staffId = searchParams.get('staff') || ''
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const settlementFields = useSettlementStore((s) => s.items)
  const settlementGroups = useSettlementStore((s) => s.groups)

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const sessionId = settlementSessionId(storeId || '', selectedDate)
  const isToday = selectedDate === today

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    settlementFields.forEach(f => { init[f.id] = '' })
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  // Load existing session
  useEffect(() => {
    if (!supabase || !storeId) { setLoading(false); return }
    setLoading(true)
    // Reset form
    const init: Record<string, string> = {}
    settlementFields.forEach(f => { init[f.id] = '' })
    setValues(init)
    setIsEdit(false)

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
  }, [storeId, selectedDate])

  const num = (id: string) => parseFloat(values[id]) || 0

  const computed = useMemo(() => {
    const posTotal = num('posTotal')
    const openCash = num('openCashBills') + num('openCashCoins')
    const prevDay = num('prevDayUndeposited')
    const invoiceRefund = num('invoiceRefund')
    const invoiceRefund2 = num('invoiceRefund2')
    const electronic = num('easyPay') + num('taiwanPay') + num('allPay') + num('linePay')
    const cashOut = num('pettyCash') + num('changeExchange')
    const deliveryFees = num('uberFee') + num('pandaFee')
    const otherExpense = num('otherExpense')
    const nextDayPettyCash = num('nextDayPettyCash')
    const otherIncome = num('otherIncome')
    // 應結總金額 = POS + 開店找零 + 前日未存入 - 電腦發票退款 + 發票退款 - 電子支付 - 現金支出 - 外送費用 - 其他支出 - 次日零用金 + 其他收入
    const expectedTotal = posTotal + openCash + prevDay - invoiceRefund + invoiceRefund2 - electronic - cashOut - deliveryFees - otherExpense - nextDayPettyCash + otherIncome

    // 鈔票總額（僅紙鈔）
    const billTotal = num('cash1000') * 1000 + num('cash500') * 500 + num('cash100') * 100
    // 當日實收現金（紙鈔 + 硬幣）
    const cashTotal = billTotal + num('coin50') * 50 + num('coin10') * 10 + num('coin5') * 5 + num('coin1') * 1

    const diff = cashTotal - expectedTotal

    return { expectedTotal, billTotal, cashTotal, diff }
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
      date: selectedDate,
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
      onConflict: 'session_id,field_id',
      itemIdField: 'field_id',
      onSuccess: () => {
        setIsEdit(true)
        logAudit('settlement_submit', storeId, sessionId, { itemCount: items.length })
        setShowSuccessModal(true)
        sendTelegramNotification(
          `💰 門店結帳完成\n🏪 店家：${storeName}\n📅 日期：${selectedDate}`
        )
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

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : selectedDate}結帳紀錄，修改後可重新提交</span>
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

                  {group === '其它收支' && (
                    <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10">
                      <span className="text-sm font-semibold text-brand-amber">應結總金額</span>
                      <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.expectedTotal)}</span>
                    </div>
                  )}
                  {group === '實收盤點' && (
                    <>
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10">
                        <span className="text-sm font-semibold text-brand-amber">鈔票總額</span>
                        <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.billTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 bg-brand-camel/10 border-t border-brand-camel/20">
                        <span className="text-sm font-semibold text-brand-amber">當日實收現金</span>
                        <span className="text-lg font-bold text-brand-amber font-num">{formatCurrency(computed.cashTotal)}</span>
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

      {/* 送出成功確認框 */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm text-center">
            <CheckCircle size={48} className="text-status-success mx-auto mb-3" />
            <h3 className="text-lg font-bold text-brand-oak mb-1">結帳送出成功</h3>
            <p className="text-sm text-brand-lotus mb-1">{storeName}</p>
            <p className="text-sm text-brand-lotus mb-2">{selectedDate.replace(/-/g, '/')}</p>
            <div className="flex items-center justify-between px-4 py-2 mb-1 rounded-lg bg-surface-section">
              <span className="text-sm text-brand-oak">當日實收現金</span>
              <span className="text-sm font-bold font-num text-brand-amber">{formatCurrency(computed.cashTotal)}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-2 mb-4 rounded-lg bg-surface-section">
              <span className="text-sm text-brand-oak">結帳差額</span>
              <span className={`text-sm font-bold font-num ${computed.diff !== 0 ? 'text-status-danger' : 'text-status-success'}`}>{formatCurrency(computed.diff)}</span>
            </div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full h-11 rounded-xl bg-status-success text-white text-sm font-semibold"
            >
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
