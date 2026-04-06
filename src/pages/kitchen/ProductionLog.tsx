import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { DateNav } from '@/components/DateNav'
import { BottomAction } from '@/components/BottomAction'
import { ProductionZoneForm } from '@/components/ProductionZoneForm'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useProductionZoneStore } from '@/stores/useProductionZoneStore'
import { supabase } from '@/lib/supabase'
import { productionLogSessionId, getTodayTW } from '@/lib/session'
import { formatDate } from '@/lib/utils'
import { PRODUCTION_ZONES } from '@/data/productionZones'
import type { ZoneDef as StaticZoneDef } from '@/data/productionZones'
import { Save, RefreshCw } from 'lucide-react'
import { sendTelegramNotification } from '@/lib/telegram'

// Convert DB zone def to the static ZoneDef shape used by ProductionZoneForm
function toFormZone(dbZone: ReturnType<typeof useProductionZoneStore.getState>['zones'][number]): StaticZoneDef {
  return {
    key: dbZone.id,
    name: dbZone.name,
    icon: dbZone.icon,
    notice: dbZone.notice,
    items: dbZone.items.map((item) => ({
      key: item.id,
      name: item.name,
      fields: item.fields.map((f) => ({
        key: f.field_key,
        label: f.label,
        type: f.field_type,
        unit: f.unit || undefined,
        options: f.options.length > 0 ? f.options : undefined,
      })),
    })),
  }
}

// Per-zone form state
interface ZoneFormState {
  values: Record<string, Record<string, string>> // { itemKey: { fieldKey: value } }
  tastingNote: string
  submittedBy: string
  supervisorBy: string
  isEdit: boolean
}

function emptyZoneState(): ZoneFormState {
  return { values: {}, tastingNote: '', submittedBy: '', supervisorBy: '', isEdit: false }
}

export default function ProductionLog() {
  const { showToast } = useToast()
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)

  // DB-driven zones (from store)
  const dbZones = useProductionZoneStore((s) => s.zones)
  const sugarTypes = useProductionZoneStore((s) => s.sugarTypes)
  const storeInitialized = useProductionZoneStore((s) => s.initialized)

  // Use DB zones if available, else fallback to static
  const formZones: StaticZoneDef[] = useMemo(() => {
    if (storeInitialized && dbZones.length > 0) {
      return dbZones.map(toFormZone)
    }
    return PRODUCTION_ZONES
  }, [storeInitialized, dbZones])

  const today = getTodayTW()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today
  const [activeZone, setActiveZone] = useState(formZones[0]?.key || 'paste')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [showHistoryConfirm, setShowHistoryConfirm] = useState(false)

  // Reset activeZone when formZones change
  useEffect(() => {
    if (formZones.length > 0 && !formZones.find((z) => z.key === activeZone)) {
      setActiveZone(formZones[0].key)
    }
  }, [formZones, activeZone])

  // All zones' form state
  const [zoneStates, setZoneStates] = useState<Record<string, ZoneFormState>>(() => {
    const init: Record<string, ZoneFormState> = {}
    formZones.forEach((z) => { init[z.key] = emptyZoneState() })
    return init
  })

  // Track which zones have data (for ✓ indicator)
  const [filledZones, setFilledZones] = useState<Set<string>>(new Set())

  // Load all zone sessions for the selected date
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)

    // Reset
    const init: Record<string, ZoneFormState> = {}
    formZones.forEach((z) => { init[z.key] = emptyZoneState() })
    setZoneStates(init)
    setFilledZones(new Set())

    const load = async () => {
      try {
        // Load all sessions for this date
        const { data: sessions } = await supabase!
          .from('production_log_sessions')
          .select('*')
          .eq('date', selectedDate)

        if (!sessions || sessions.length === 0) { setLoading(false); return }

        const filled = new Set<string>()
        const newStates = { ...init }

        // Load items for each session
        const sessionIds = sessions.map((s) => s.id)
        const { data: items } = await supabase!
          .from('production_log_items')
          .select('*')
          .in('session_id', sessionIds)

        // Build items map: sessionId → { itemKey → { fieldKey → value } }
        const itemMap: Record<string, Record<string, Record<string, string>>> = {}
        if (items) {
          items.forEach((row) => {
            if (!itemMap[row.session_id]) itemMap[row.session_id] = {}
            if (!itemMap[row.session_id][row.item_key]) itemMap[row.session_id][row.item_key] = {}
            itemMap[row.session_id][row.item_key][row.field_key] = row.field_value
          })
        }

        sessions.forEach((session) => {
          const zoneKey = session.zone_key
          if (!newStates[zoneKey]) return
          filled.add(zoneKey)
          newStates[zoneKey] = {
            values: itemMap[session.id] || {},
            tastingNote: session.tasting_note || '',
            submittedBy: session.submitted_by || '',
            supervisorBy: session.supervisor_by || '',
            isEdit: true,
          }
        })

        setZoneStates(newStates)
        setFilledZones(filled)
      } catch (err) {
        console.error('[ProductionLog] Load failed:', err)
      }
      setLoading(false)
    }

    load()
  }, [selectedDate, formZones])

  // Update a single field value
  const handleFieldChange = useCallback((zoneKey: string, itemKey: string, fieldKey: string, value: string) => {
    setZoneStates((prev) => {
      const zone = prev[zoneKey] || emptyZoneState()
      return {
        ...prev,
        [zoneKey]: {
          ...zone,
          values: {
            ...zone.values,
            [itemKey]: {
              ...zone.values[itemKey],
              [fieldKey]: value,
            },
          },
        },
      }
    })
  }, [])

  const handleZoneMetaChange = useCallback((zoneKey: string, field: 'tastingNote' | 'submittedBy' | 'supervisorBy', value: string) => {
    setZoneStates((prev) => ({
      ...prev,
      [zoneKey]: { ...prev[zoneKey], [field]: value },
    }))
  }, [])

  const doSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)

    const zoneState = zoneStates[activeZone]
    if (!zoneState.submittedBy) {
      showToast('請先選擇簽名人員', 'error')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    if (!supabase) {
      showToast('資料庫連線失敗', 'error')
      submittingRef.current = false
      setSubmitting(false)
      return
    }

    const sessionId = productionLogSessionId(activeZone, selectedDate)

    try {
      // Upsert session
      const { error: sessionErr } = await supabase
        .from('production_log_sessions')
        .upsert({
          id: sessionId,
          zone_key: activeZone,
          date: selectedDate,
          submitted_by: zoneState.submittedBy,
          supervisor_by: zoneState.supervisorBy || null,
          tasting_note: zoneState.tastingNote,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (sessionErr) {
        showToast('提交失敗：' + sessionErr.message, 'error')
        submittingRef.current = false
        setSubmitting(false)
        return
      }

      // Delete-then-insert items
      await supabase
        .from('production_log_items')
        .delete()
        .eq('session_id', sessionId)

      const insertItems: { session_id: string; item_key: string; field_key: string; field_value: string }[] = []
      Object.entries(zoneState.values).forEach(([itemKey, fields]) => {
        Object.entries(fields).forEach(([fieldKey, value]) => {
          if (value !== '') {
            insertItems.push({
              session_id: sessionId,
              item_key: itemKey,
              field_key: fieldKey,
              field_value: value,
            })
          }
        })
      })

      if (insertItems.length > 0) {
        const { error: itemErr } = await supabase
          .from('production_log_items')
          .insert(insertItems)

        if (itemErr) {
          showToast('提交失敗：' + itemErr.message, 'error')
          submittingRef.current = false
          setSubmitting(false)
          return
        }
      }

      // Mark as filled and edited
      setFilledZones((prev) => new Set(prev).add(activeZone))
      setZoneStates((prev) => ({
        ...prev,
        [activeZone]: { ...prev[activeZone], isEdit: true },
      }))

      const zoneDef = formZones.find((z) => z.key === activeZone)
      const staffName = kitchenStaff.find((s) => s.id === zoneState.submittedBy)?.name
      showToast(`${zoneDef?.name || activeZone} 生產紀錄已儲存！`)

      sendTelegramNotification(
        `🏭 生產紀錄提交\n📅 日期：${selectedDate}\n📋 區域：${zoneDef?.name || activeZone}\n👤 填寫人：${staffName}\n📊 欄位數：${insertItems.length} 項`
      )
    } catch (err) {
      console.error('[ProductionLog] Submit error:', err)
      showToast('提交失敗', 'error')
      const { sendCrashReport } = await import('@/lib/crashReport')
      sendCrashReport({ type: 'production_log_submit_error', message: String(err), stack: (err as Error)?.stack })
    } finally {
      // V2.0：永遠解鎖
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (!isToday) {
      setShowHistoryConfirm(true)
    } else {
      doSubmit()
    }
  }

  const currentZoneDef = formZones.find((z) => z.key === activeZone) ?? formZones[0]
  const currentState = zoneStates[activeZone] || emptyZoneState()

  if (!currentZoneDef) {
    return (
      <div className="page-container">
        <TopNav title="每日生產紀錄" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="每日生產紀錄" />
      <DateNav value={selectedDate} onChange={setSelectedDate} />

      {currentState.isEdit && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-status-info/10 text-status-info text-xs">
          <RefreshCw size={12} />
          <span>已載入{isToday ? '今日' : formatDate(selectedDate)}紀錄，可修改後重新提交</span>
        </div>
      )}

      {/* Zone Tab Bar */}
      <div className="overflow-x-auto scrollbar-hide border-b border-gray-100 bg-white">
        <div className="flex min-w-max px-2">
          {formZones.map((zone) => {
            const isActive = activeZone === zone.key
            const isFilled = filledZones.has(zone.key)
            return (
              <button
                key={zone.key}
                onClick={() => setActiveZone(zone.key)}
                className={`flex items-center gap-1 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-brand-mocha text-brand-oak'
                    : 'border-transparent text-brand-lotus hover:text-brand-oak'
                }`}
              >
                <span>{zone.icon}</span>
                <span>{zone.name}</span>
                {isFilled && <span className="text-status-success text-xs">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          <ProductionZoneForm
            zone={currentZoneDef}
            values={currentState.values}
            onChange={(itemKey, fieldKey, value) => handleFieldChange(activeZone, itemKey, fieldKey, value)}
            tastingNote={currentState.tastingNote}
            onTastingNoteChange={(v) => handleZoneMetaChange(activeZone, 'tastingNote', v)}
            submittedBy={currentState.submittedBy}
            onSubmittedByChange={(v) => handleZoneMetaChange(activeZone, 'submittedBy', v)}
            supervisorBy={currentState.supervisorBy}
            onSupervisorByChange={(v) => handleZoneMetaChange(activeZone, 'supervisorBy', v)}
            staff={kitchenStaff}
            sugarTypes={sugarTypes}
          />

          <BottomAction
            label={submitting ? '提交中...' : currentState.isEdit ? `更新${currentZoneDef.name}` : `儲存${currentZoneDef.name}`}
            onClick={handleSubmit}
            icon={<Save size={18} />}
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
              你正在修改 <span className="font-semibold text-brand-oak">{formatDate(selectedDate)}</span> 的生產紀錄，確定要提交嗎？
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
