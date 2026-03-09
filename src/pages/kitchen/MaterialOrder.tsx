import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { DualUnitInput } from '@/components/DualUnitInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { supabase } from '@/lib/supabase'
import { materialOrderSessionId, getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { Send, UserCheck, RefreshCw } from 'lucide-react'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreSortOrder } from '@/hooks/useStoreSortOrder'
import { buildSortedByCategory } from '@/lib/sortByStore'

export default function MaterialOrder() {
  const { showToast } = useToast()
  const rawMaterials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const sessionId = materialOrderSessionId(selectedDate)

  const [orders, setOrders] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    rawMaterials.forEach(m => { init[m.id] = '' })
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load existing session
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const initOrders: Record<string, string> = {}
    rawMaterials.forEach(m => { initOrders[m.id] = '' })
    setOrders(initOrders)
    setIsEdit(false)
    setConfirmBy('')

    supabase
      .from('material_order_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        if (session.submitted_by) setConfirmBy(session.submitted_by)

        supabase!
          .from('material_order_items')
          .select('*')
          .eq('session_id', sessionId)
          .then(({ data: items }) => {
            if (items && items.length > 0) {
              const loaded: Record<string, string> = { ...initOrders }
              items.forEach(item => {
                loaded[item.material_id] = item.quantity > 0 ? String(item.quantity) : ''
              })
              setOrders(loaded)
            }
            setLoading(false)
          })
      })
  }, [selectedDate])

  // 最新原物料庫存（from material_stock_items）
  const [matStock, setMatStock] = useState<Record<string, number>>({})
  const [matStockLoading, setMatStockLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setMatStockLoading(false); return }
    const load = async () => {
      setMatStockLoading(true)
      const { data: sessions } = await supabase!
        .from('material_stock_sessions')
        .select('id')
        .order('date', { ascending: false })
        .limit(1)

      if (!sessions || sessions.length === 0) { setMatStockLoading(false); return }

      const { data: items } = await supabase!
        .from('material_stock_items')
        .select('material_id, stock_qty, bulk_qty')
        .eq('session_id', sessions[0].id)

      if (items) {
        const totals: Record<string, number> = {}
        items.forEach(item => {
          totals[item.material_id] = (item.stock_qty || 0) + (item.bulk_qty || 0)
        })
        setMatStock(totals)
      }
      setMatStockLoading(false)
    }
    load()
  }, [])

  // 週用 = 前一次盤點庫存 + 期間所有叫貨量合計 - 最新一次盤點庫存
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({})
  const [weeklyLoading, setWeeklyLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setWeeklyLoading(false); return }
    const load = async () => {
      setWeeklyLoading(true)

      // 取最近兩次盤點 session（按日期降序）
      const { data: stockSessions } = await supabase!
        .from('material_stock_sessions')
        .select('id, date')
        .order('date', { ascending: false })
        .limit(2)

      if (!stockSessions || stockSessions.length < 2) { setWeeklyLoading(false); return }

      const [latestSession, prevSession] = stockSessions

      // 取兩次盤點之間的所有叫貨 session
      const { data: orderSessions } = await supabase!
        .from('material_order_sessions')
        .select('id')
        .gte('date', prevSession.date)
        .lte('date', latestSession.date)

      const orderSessionIds = orderSessions?.map(s => s.id) || []

      // 並行查：前次盤點品項 + 最新盤點品項 + 所有叫貨品項
      const [prevItemsRes, latestItemsRes, orderItemsRes] = await Promise.all([
        supabase!
          .from('material_stock_items')
          .select('material_id, stock_qty, bulk_qty')
          .eq('session_id', prevSession.id),
        supabase!
          .from('material_stock_items')
          .select('material_id, stock_qty, bulk_qty')
          .eq('session_id', latestSession.id),
        orderSessionIds.length > 0
          ? supabase!
              .from('material_order_items')
              .select('material_id, quantity')
              .in('session_id', orderSessionIds)
          : Promise.resolve({ data: [] as { material_id: string; quantity: number }[] }),
      ])

      const prevStock: Record<string, number> = {}
      prevItemsRes.data?.forEach(item => {
        prevStock[item.material_id] = (item.stock_qty || 0) + (item.bulk_qty || 0)
      })

      const latestStock: Record<string, number> = {}
      latestItemsRes.data?.forEach(item => {
        latestStock[item.material_id] = (item.stock_qty || 0) + (item.bulk_qty || 0)
      })

      const totalOrders: Record<string, number> = {}
      const orderItems = 'data' in orderItemsRes ? orderItemsRes.data : orderItemsRes
      if (Array.isArray(orderItems)) {
        orderItems.forEach((item: { material_id: string; quantity: number }) => {
          totalOrders[item.material_id] = (totalOrders[item.material_id] || 0) + item.quantity
        })
      }

      // 週用 = 前一次庫存 + 期間所有叫貨合計 - 最新一次庫存
      const allIds = new Set([...Object.keys(prevStock), ...Object.keys(latestStock)])
      const result: Record<string, number> = {}
      allIds.forEach(mid => {
        const prev = prevStock[mid] || 0
        const order = totalOrders[mid] || 0
        const latest = latestStock[mid] || 0
        const usage = prev + order - latest
        if (usage > 0) {
          result[mid] = Math.round(usage * 10) / 10
        }
      })
      setWeeklyUsage(result)
      setWeeklyLoading(false)
    }
    load()
  }, [today])

  const { sortCategories, sortItems } = useStoreSortOrder('kitchen', 'material')
  const materialsByCategory = useMemo(() =>
    buildSortedByCategory(materialCategories, rawMaterials, sortCategories, sortItems),
    [materialCategories, rawMaterials, sortCategories, sortItems])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-mo]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  // 歷史編輯確認
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)

  const doSubmit = async () => {
    if (!confirmBy) {
      showToast('請先選擇叫貨人員', 'error')
      return
    }
    if (!supabase) {
      const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
      showToast(`原物料叫貨單已提交！叫貨人：${staffName}`)
      return
    }

    setSubmitting(true)

    const { error: sessionErr } = await supabase
      .from('material_order_sessions')
      .upsert({
        id: sessionId,
        date: selectedDate,
        submitted_by: confirmBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' })

    if (sessionErr) {
      showToast('提交失敗：' + sessionErr.message, 'error')
      setSubmitting(false)
      return
    }

    const items = rawMaterials
      .filter(m => orders[m.id] && orders[m.id] !== '')
      .map(m => ({
        session_id: sessionId,
        material_id: m.id,
        quantity: parseFloat(orders[m.id]) || 0,
      }))

    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from('material_order_items')
        .upsert(items, { onConflict: 'session_id,material_id' })

      if (itemErr) {
        showToast('提交失敗：' + itemErr.message, 'error')
        setSubmitting(false)
        return
      }
    }

    const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
    setIsEdit(true)
    setSubmitting(false)
    showToast(`原物料叫貨單已提交！叫貨人：${staffName}`)
  }

  const handleSubmit = () => {
    if (!isToday) {
      setShowHistoryConfirm(true)
    } else {
      doSubmit()
    }
  }

  return (
    <div className="page-container">
      <TopNav title="原物料叫貨" />

      {/* 日期選擇器 */}
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : formatDate(selectedDate)}叫貨紀錄，可修改後重新提交</span>
        </div>
      )}

      {(loading || matStockLoading || weeklyLoading) ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 叫貨人員 */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
            <UserCheck size={16} className="text-brand-mocha shrink-0" />
            <span className="text-sm text-brand-oak font-medium shrink-0">叫貨人員</span>
            <select
              value={confirmBy}
              onChange={(e) => setConfirmBy(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-gray-200 bg-surface-input px-2 text-sm text-brand-oak outline-none focus:border-brand-lotus"
            >
              <option value="">請選擇</option>
              {kitchenStaff.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="sticky top-14 z-10 flex items-center px-4 py-1.5 text-[11px] text-brand-lotus bg-white border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[38px] shrink-0 text-center">庫存</span>
            <span className="w-[38px] shrink-0 text-center">週用</span>
            <span className="w-[130px] shrink-0 text-center">叫貨量</span>
          </div>

          {Array.from(materialsByCategory.entries()).map(([category, materials]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" sticky={false} />
              <div className="bg-white">
                {materials.map((material, idx) => (
                  <div key={material.id} className={`flex items-center px-4 py-2.5 ${idx < materials.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0 pr-1">
                      <span className="text-sm font-medium text-brand-oak">{material.name}</span>
                      {material.spec && <p className="text-[10px] text-brand-lotus">{material.spec}</p>}
                      {material.notes && <p className="text-[10px] text-brand-camel">{material.notes}</p>}
                    </div>
                    <span className={`w-[38px] shrink-0 text-center text-xs font-num ${matStock[material.id] != null && matStock[material.id] <= 1 ? 'text-status-danger font-bold' : 'text-brand-oak'}`}>{matStock[material.id] != null ? matStock[material.id] : '-'}</span>
                    <span className="w-[38px] shrink-0 text-center text-xs font-num text-brand-lotus">{weeklyUsage[material.id] || '-'}</span>
                    <div className="w-[130px] shrink-0 flex justify-end">
                      <DualUnitInput value={orders[material.id]} onChange={(v) => setOrders(prev => ({ ...prev, [material.id]: v }))} unit={material.unit} box_unit={material.box_unit} box_ratio={material.box_ratio} isFilled onNext={focusNext} data-mo="" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新原物料叫貨單' : '提交原物料叫貨單'}
            onClick={handleSubmit}
            icon={<Send size={18} />}
            disabled={submitting}
          />
        </>
      )}

      {/* 歷史編輯確認對話框 */}
      {showHistoryConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-oak text-center mb-2">修改歷史資料</h3>
            <p className="text-sm text-brand-lotus text-center mb-5">
              你正在修改 <span className="font-semibold text-brand-oak">{formatDate(selectedDate)}</span> 的原物料叫貨紀錄，確定要提交嗎？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHistoryConfirm(false)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-brand-lotus"
              >
                取消
              </button>
              <button
                onClick={() => { setShowHistoryConfirm(false); doSubmit() }}
                className="flex-1 h-10 rounded-xl bg-status-warning text-white text-sm font-semibold"
              >
                確定修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
