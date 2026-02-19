import { useState, useMemo, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { supabase } from '@/lib/supabase'
import { materialStockSessionId, getTodayTW } from '@/lib/session'
import { Save, AlertTriangle, UserCheck, RefreshCw } from 'lucide-react'
import { useStaffStore } from '@/stores/useStaffStore'

export default function MaterialStock() {
  const { showToast } = useToast()
  const rawMaterials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const [confirmBy, setConfirmBy] = useState('')

  const today = getTodayTW()
  const sessionId = materialStockSessionId(today)

  const [stock, setStock] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    rawMaterials.forEach(m => { init[m.id] = '' })
    return init
  })

  const [bulk, setBulk] = useState<Record<string, string>>(() => {
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
      .from('material_stock_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data: session }) => {
        if (!session) { setLoading(false); return }
        setIsEdit(true)
        if (session.submitted_by) setConfirmBy(session.submitted_by)

        supabase!
          .from('material_stock_items')
          .select('*')
          .eq('session_id', sessionId)
          .then(({ data: items }) => {
            if (items && items.length > 0) {
              const loadedStock: Record<string, string> = {}
              const loadedBulk: Record<string, string> = {}
              rawMaterials.forEach(m => { loadedStock[m.id] = ''; loadedBulk[m.id] = '' })
              items.forEach(item => {
                loadedStock[item.material_id] = item.stock_qty != null ? String(item.stock_qty) : ''
                loadedBulk[item.material_id] = item.bulk_qty != null ? String(item.bulk_qty) : ''
              })
              setStock(loadedStock)
              setBulk(loadedBulk)
            }
            setLoading(false)
          })
      })
  }, [today])

  // 近 7 日原物料叫貨日均
  const [weeklyUsage, setWeeklyUsage] = useState<Record<string, number>>({})
  const [weeklyLoading, setWeeklyLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setWeeklyLoading(false); return }
    const load = async () => {
      setWeeklyLoading(true)
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const sevenDaysAgo = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

      const { data: sessions } = await supabase!
        .from('material_order_sessions')
        .select('id, date')
        .gte('date', sevenDaysAgo)
        .lte('date', today)

      if (!sessions || sessions.length === 0) { setWeeklyLoading(false); return }

      const uniqueDays = new Set(sessions.map(s => s.date)).size
      const sids = sessions.map(s => s.id)

      const { data: items } = await supabase!
        .from('material_order_items')
        .select('material_id, quantity')
        .in('session_id', sids)

      if (items) {
        const totals: Record<string, number> = {}
        items.forEach(item => {
          totals[item.material_id] = (totals[item.material_id] || 0) + item.quantity
        })
        const result: Record<string, number> = {}
        Object.entries(totals).forEach(([mid, total]) => {
          result[mid] = Math.round((total / uniqueDays) * 10) / 10
        })
        setWeeklyUsage(result)
      }
      setWeeklyLoading(false)
    }
    load()
  }, [today])

  const materialsByCategory = useMemo(() => {
    const map = new Map<string, typeof rawMaterials>()
    for (const cat of materialCategories) {
      map.set(cat, rawMaterials.filter(m => m.category === cat))
    }
    return map
  }, [])

  const getStatus = (id: string): 'ok' | 'low' | 'danger' => {
    const qty = parseFloat(stock[id]) || 0
    if (!stock[id]) return 'ok'
    if (qty <= 0.5) return 'danger'
    if (qty <= 1) return 'low'
    return 'ok'
  }

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-mat]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSubmit = async () => {
    if (!confirmBy) {
      showToast('請先選擇盤點人員', 'error')
      return
    }
    if (!supabase) {
      const staffName = kitchenStaff.find(s => s.id === confirmBy)?.name
      showToast(`原物料庫存已儲存！盤點人：${staffName}`)
      return
    }

    setSubmitting(true)

    const { error: sessionErr } = await supabase
      .from('material_stock_sessions')
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
      .filter(m => stock[m.id] !== '' || bulk[m.id] !== '')
      .map(m => ({
        session_id: sessionId,
        material_id: m.id,
        stock_qty: stock[m.id] !== '' ? parseFloat(stock[m.id]) : null,
        bulk_qty: bulk[m.id] !== '' ? parseFloat(bulk[m.id]) : null,
      }))

    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from('material_stock_items')
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
    showToast(`原物料庫存已儲存！盤點人：${staffName}`)
  }

  return (
    <div className="page-container">
      <TopNav title="原物料庫存盤點" />

      {isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入今日盤點紀錄，可修改後重新提交</span>
        </div>
      )}

      {(loading || weeklyLoading) ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* 確認人員 */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-100">
            <UserCheck size={16} className="text-brand-mocha shrink-0" />
            <span className="text-sm text-brand-oak font-medium shrink-0">盤點人員</span>
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

          {Array.from(materialsByCategory.entries()).map(([category, materials]) => (
            <div key={category}>
              <SectionHeader title={category} icon="■" />
              <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
                <span className="flex-1">品名</span>
                <span className="w-[56px] text-center">庫存</span>
                <span className="w-[56px] text-center">散裝</span>
                <span className="w-[36px] text-center">週用</span>
                <span className="w-[18px]"></span>
              </div>
              <div className="bg-white">
                {materials.map((material, idx) => {
                  const status = getStatus(material.id)
                  return (
                    <div
                      key={material.id}
                      className={`flex items-center px-4 py-1.5 ${idx < materials.length - 1 ? 'border-b border-gray-50' : ''} ${
                        status === 'danger' && stock[material.id] ? 'bg-status-danger/5' : status === 'low' && stock[material.id] ? 'bg-status-warning/5' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-1">
                        <p className="text-sm font-medium text-brand-oak leading-tight">{material.name}</p>
                        {material.spec && <p className="text-[10px] text-brand-lotus leading-tight">{material.spec}</p>}
                      </div>
                      <NumericInput value={stock[material.id]} onChange={(v) => setStock(prev => ({ ...prev, [material.id]: v }))} isFilled onNext={focusNext} data-mat="" />
                      <div className="w-2 shrink-0"></div>
                      <NumericInput value={bulk[material.id]} onChange={(v) => setBulk(prev => ({ ...prev, [material.id]: v }))} isFilled onNext={focusNext} data-mat="" />
                      <span className="w-[36px] text-center text-[11px] font-num text-brand-lotus">{weeklyUsage[material.id] || '-'}</span>
                      <div className="w-[18px] flex justify-center">
                        {status === 'danger' && stock[material.id] && <AlertTriangle size={13} className="text-status-danger" />}
                        {status === 'low' && stock[material.id] && <AlertTriangle size={13} className="text-status-warning" />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <BottomAction
            label={submitting ? '提交中...' : isEdit ? '更新庫存資料' : '儲存庫存 & 前往叫貨'}
            onClick={handleSubmit}
            icon={<Save size={18} />}
            disabled={submitting}
          />
        </>
      )}
    </div>
  )
}
