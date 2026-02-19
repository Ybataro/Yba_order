import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { supabase } from '@/lib/supabase'
import { materialOrderSessionId, getTodayTW } from '@/lib/session'
import { Send, UserCheck, RefreshCw } from 'lucide-react'
import { useStaffStore } from '@/stores/useStaffStore'

export default function MaterialOrder() {
  const { showToast } = useToast()
  const rawMaterials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const sessionId = materialOrderSessionId(today)

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
              const loaded: Record<string, string> = {}
              rawMaterials.forEach(m => { loaded[m.id] = '' })
              items.forEach(item => {
                loaded[item.material_id] = item.quantity > 0 ? String(item.quantity) : ''
              })
              setOrders(loaded)
            }
            setLoading(false)
          })
      })
  }, [today])

  const mockStock = useMemo(() => {
    const d: Record<string, number> = {}
    rawMaterials.forEach(m => { d[m.id] = Math.round(Math.random() * 5 * 10) / 10 })
    return d
  }, [])

  const weeklyUsage = useMemo(() => {
    const d: Record<string, number> = {}
    rawMaterials.forEach(m => { d[m.id] = Math.round(Math.random() * 3 * 10) / 10 })
    return d
  }, [])

  const materialsByCategory = useMemo(() => {
    const map = new Map<string, typeof rawMaterials>()
    for (const cat of materialCategories) {
      map.set(cat, rawMaterials.filter(m => m.category === cat))
    }
    return map
  }, [])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-mo]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSubmit = async () => {
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
        date: today,
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

  return (
    <div className="page-container">
      <TopNav title="原物料叫貨" />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入今日叫貨紀錄，可修改後重新提交</span>
        </div>
      )}

      {loading ? (
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

          <div className="flex items-center justify-end gap-2 px-4 py-1.5 text-[11px] text-brand-lotus bg-white border-b border-gray-100">
            <span className="flex-1">品名</span>
            <span className="w-[50px] text-center">庫存</span>
            <span className="w-[50px] text-center">週用量</span>
            <span className="w-[80px] text-center">叫貨量</span>
          </div>

          {Array.from(materialsByCategory.entries()).map(([category, materials]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="bg-white">
                {materials.map((material, idx) => (
                  <div key={material.id} className={`flex items-center justify-between px-4 py-2.5 ${idx < materials.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0 pr-2">
                      <span className="text-sm font-medium text-brand-oak">{material.name}</span>
                      {material.spec && <p className="text-[10px] text-brand-lotus">{material.spec}</p>}
                      {material.notes && <p className="text-[10px] text-brand-camel">{material.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-[50px] text-center text-xs font-num ${mockStock[material.id] <= 1 ? 'text-status-danger font-bold' : 'text-brand-oak'}`}>{mockStock[material.id]}</span>
                      <span className="w-[50px] text-center text-xs font-num text-brand-lotus">{weeklyUsage[material.id]}</span>
                      <NumericInput value={orders[material.id]} onChange={(v) => setOrders(prev => ({ ...prev, [material.id]: v }))} unit={material.unit} isFilled onNext={focusNext} data-mo="" />
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
    </div>
  )
}
