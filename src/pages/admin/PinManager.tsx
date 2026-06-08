import { useState, useEffect, useMemo, useRef } from 'react'
import { TopNav } from '@/components/TopNav'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { hashPin } from '@/lib/auth'
import { clearLeaveApproverCache } from '@/lib/telegram'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'

// ── 型別 ────────────────────────────────────────────────────
interface UserPin {
  id: string
  staff_id: string
  pin_hash: string
  role: string
  allowed_stores: string[]
  is_active: boolean
  can_schedule: boolean
  can_popup: boolean
  allowed_pages: string[] | null
  // V2 假單主管欄位
  is_leave_approver: boolean
  leave_approver_scope: string | null
  leave_approver_order: number
}

interface StaffRow {
  id: string
  name: string
  group_id: string
  sort_order: number
  telegram_id: string | null
  is_active: boolean
}

// ── 頁面權限定義 ─────────────────────────────────────────────
const STORE_PAGES = [
  { key: 'inventory',    label: '物料盤點' },
  { key: 'settlement',   label: '每日結帳' },
  { key: 'order',        label: '叫貨' },
  { key: 'receive',      label: '收貨確認' },
  { key: 'expense',      label: '雜支申報' },
  { key: 'expense-edit', label: '雜支改刪（主管）' },
  { key: 'schedule',     label: '排班表' },
]

const KITCHEN_PAGES = [
  { key: 'orders',               label: '各店叫貨總表' },
  { key: 'shipments',            label: '出貨表' },
  { key: 'materials',            label: '原物料庫存' },
  { key: 'products',             label: '成品庫存' },
  { key: 'material-orders',      label: '原物料叫貨' },
  { key: 'production-schedule',  label: '生產排程建議' },
  { key: 'production-log',       label: '每日生產紀錄' },
  { key: 'expense',              label: '雜支申報' },
  { key: 'expense-edit',         label: '雜支改刪（主管）' },
  { key: 'staff-schedule',       label: '排班表' },
]

const STORE_PRESETS: Record<string, string[]> = {
  part_time: ['expense', 'schedule'],
  full_time:  ['expense', 'schedule', 'inventory'],
}

const KITCHEN_PRESETS: Record<string, string[]> = {
  part_time: ['expense', 'staff-schedule'],
  full_time:  ['expense', 'staff-schedule', 'materials', 'products'],
}

// ── 假單主管 scope 選項 ───────────────────────────────────────
const APPROVER_SCOPE_OPTIONS = [
  { value: 'kitchen', label: '央廚' },
  { value: 'lehua',   label: '樂華店' },
  { value: 'xingnan', label: '興南店' },
]

const APPROVER_ORDER_OPTIONS = [
  { value: 1, label: '第一主管（收到初始申請）' },
  { value: 2, label: '第二主管（第一主管核准後）' },
]

// ── 輔助函式 ─────────────────────────────────────────────────
function deriveRole(groupId: string): string {
  if (groupId === 'admin')   return 'admin'
  if (groupId === 'kitchen') return 'kitchen'
  return 'store'
}

function deriveStores(groupId: string): string[] {
  if (groupId === 'admin' || groupId === 'kitchen') return []
  return [groupId]
}

const GROUP_ORDER: Record<string, number> = { admin: 0, kitchen: 1, lehua: 2, xingnan: 3 }

// ── Toggle 元件 ──────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  sublabel,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  sublabel?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`flex items-center justify-between w-full py-2.5 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <div>
        <span className="text-sm text-brand-oak">{label}</span>
        {sublabel && <p className="text-[11px] text-brand-lotus mt-0.5">{sublabel}</p>}
      </div>
      <div className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  )
}

// ── 展開 Card 內的三個 Tab ───────────────────────────────────
type CardTab = 'account' | 'permissions' | 'leave_approver'

// ── 主元件 ──────────────────────────────────────────────────
export default function PinManager() {
  const { showToast } = useToast()
  const { adminStaff, kitchenStaff, storeStaff } = useStaffStore()
  const stores = useStoreStore((s) => s.items)

  const [pins, setPins] = useState<UserPin[]>([])
  const [allStaffRows, setAllStaffRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserPin | null>(null)

  // 展開 card + 當前 tab 狀態
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cardTab, setCardTab] = useState<CardTab>('account')

  // ── 帳號設定 Tab：頁面權限 panel state ──
  const [pagePanelPages, setPagePanelPages] = useState<string[] | null>(null)
  const [pagePanelSaving, setPagePanelSaving] = useState(false)

  // ── 假單主管 Tab：編輯 state ──
  const [approverEditing, setApproverEditing] = useState(false)
  const [approverScope, setApproverScope] = useState<string>('kitchen')
  const [approverOrder, setApproverOrder] = useState<number>(1)
  const [approverTelegramId, setApproverTelegramId] = useState<string>('')
  const [approverSaving, setApproverSaving] = useState(false)
  const [approverHelpOpen, setApproverHelpOpen] = useState(false)

  // ── 新增/編輯 Modal state ──
  const [formStaffId, setFormStaffId] = useState('')
  const [formRole, setFormRole] = useState('store')
  const [formPin, setFormPin] = useState('')
  const [formAllowedStores, setFormAllowedStores] = useState<string[]>([])
  const [formSubmitting, setFormSubmitting] = useState(false)

  // ── 全域寫入鎖（防雙擊 + 並發保護）──
  const writingRef = useRef(false)
  const guardedWrite = async (label: string, fn: () => Promise<void>) => {
    if (writingRef.current) return
    writingRef.current = true
    try {
      await fn()
    } catch (err) {
      console.error(`[PinManager] ${label} 失敗:`, err)
      showToast(`${label}失敗：${(err as Error)?.message || '未知錯誤'}`, 'error')
    } finally {
      writingRef.current = false
    }
  }

  // ── 初始載入 ──────────────────────────────────────────────
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    Promise.allSettled([
      supabase.from('user_pins').select('*').order('role'),
      supabase.from('staff').select('id, name, group_id, sort_order, telegram_id, is_active').order('sort_order'),
    ]).then((results) => {
      const errs: string[] = []
      if (results[0].status === 'fulfilled') {
        setPins((results[0].value.data as UserPin[] | null) || [])
      } else {
        errs.push('PIN 資料載入失敗')
      }
      if (results[1].status === 'fulfilled') {
        setAllStaffRows((results[1].value.data as StaffRow[] | null) || [])
      } else {
        errs.push('員工資料載入失敗')
      }
      setLoadError(errs.length > 0 ? errs.join('；') : null)
      setLoading(false)
    })
  }, [])

  const pinMap = useMemo(() => {
    const m = new Map<string, UserPin>()
    for (const p of pins) m.set(p.staff_id, p)
    return m
  }, [pins])

  const staffRowMap = useMemo(() => {
    const m = new Map<string, StaffRow>()
    for (const s of allStaffRows) m.set(s.id, s)
    return m
  }, [allStaffRows])

  const groupLabels: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = { admin: '管理者', kitchen: '央廚' }
    for (const s of stores) m[s.id] = s.name
    return m
  }, [stores])

  const grouped = useMemo(() => {
    const m = new Map<string, StaffRow[]>()
    for (const s of allStaffRows) {
      const key = s.group_id || 'kitchen'
      const list = m.get(key) || []
      list.push(s)
      m.set(key, list)
    }
    // 群組內排序：未設定 PIN 的置頂（紅色提醒）→ 啟用 → 停用 → 離職
    for (const [key, list] of m.entries()) {
      list.sort((a, b) => {
        const pa = pinMap.get(a.id)
        const pb = pinMap.get(b.id)
        const rankA = !a.is_active ? 3 : !pa ? 0 : pa.is_active ? 1 : 2
        const rankB = !b.is_active ? 3 : !pb ? 0 : pb.is_active ? 1 : 2
        if (rankA !== rankB) return rankA - rankB
        return a.sort_order - b.sort_order
      })
      m.set(key, list)
    }
    return Array.from(m.entries()).sort(
      (a, b) => (GROUP_ORDER[a[0]] ?? 99) - (GROUP_ORDER[b[0]] ?? 99)
    )
  }, [allStaffRows, pinMap])

  const allStaffOptions = useMemo(() => [
    ...adminStaff.map((s) => ({ id: s.id, name: s.name, group: '管理者' })),
    ...kitchenStaff.map((s) => ({ id: s.id, name: s.name, group: '央廚' })),
    ...Object.entries(storeStaff).flatMap(([storeId, members]) => {
      const storeName = stores.find((s) => s.id === storeId)?.name || storeId
      return members.map((s) => ({ id: s.id, name: s.name, group: storeName }))
    }),
  ], [adminStaff, kitchenStaff, storeStaff, stores])

  // ── 展開/收合 ─────────────────────────────────────────────
  const handleExpand = (staffId: string, pin: UserPin | undefined, staffRow: StaffRow | undefined) => {
    if (expandedId === staffId) {
      setExpandedId(null)
      return
    }
    setExpandedId(staffId)
    setCardTab('account')
    setApproverEditing(false)
    if (pin) {
      setPagePanelPages(pin.allowed_pages ? [...pin.allowed_pages] : null)
      // 預填假單主管 tab 的當前值
      setApproverScope(pin.leave_approver_scope || 'kitchen')
      setApproverOrder(pin.leave_approver_order || 1)
      setApproverTelegramId(staffRow?.telegram_id || '')
    }
  }

  // ── 刷新 pins ────────────────────────────────────────────
  const refreshPins = async () => {
    if (!supabase) return
    const { data } = await supabase.from('user_pins').select('*').order('role')
    setPins((data as UserPin[] | null) || [])
  }

  const refreshStaff = async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('staff').select('id, name, group_id, sort_order, telegram_id').order('sort_order')
    setAllStaffRows((data as StaffRow[] | null) || [])
  }

  // ── 新增/編輯 Modal ──────────────────────────────────────
  const openAdd = (staffId?: string, groupId?: string) => {
    setEditing(null)
    setFormStaffId(staffId || '')
    setFormRole(groupId ? deriveRole(groupId) : 'store')
    setFormPin('')
    setFormAllowedStores(groupId ? deriveStores(groupId) : [])
    setModalOpen(true)
  }

  const openEdit = (pin: UserPin) => {
    setEditing(pin)
    setFormStaffId(pin.staff_id)
    setFormRole(pin.role)
    setFormPin('')
    setFormAllowedStores(pin.allowed_stores || [])
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!supabase) return
    if (!formStaffId) { showToast('請選擇人員', 'error'); return }
    if (!editing && !formPin) { showToast('請輸入 PIN 碼', 'error'); return }
    if (formPin && formPin.length !== 4) { showToast('PIN 碼必須是 4 位數字', 'error'); return }
    if (formPin && !/^\d{4}$/.test(formPin)) { showToast('PIN 碼只能是數字', 'error'); return }
    if (formSubmitting) return

    setFormSubmitting(true)
    await guardedWrite(editing ? 'PIN 更新' : 'PIN 新增', async () => {
      const pinData: Record<string, unknown> = {
        id: editing?.id || `pin_${formStaffId}`,
        staff_id: formStaffId,
        role: formRole,
        allowed_stores: formAllowedStores,
        updated_at: new Date().toISOString(),
      }
      if (formPin) pinData.pin_hash = await hashPin(formPin)
      if (!editing) {
        pinData.created_at = new Date().toISOString()
        pinData.is_active = true
      }

      const { error } = await supabase!.from('user_pins').upsert(pinData, { onConflict: 'id' })
      if (error) throw error
      await refreshPins()
      setModalOpen(false)
      showToast(editing ? 'PIN 已更新' : 'PIN 已新增')
    })
    setFormSubmitting(false)
  }

  // ── Toggle：帳號狀態 ─────────────────────────────────────
  // 啟用 PIN 時若該員工先前被標記為離職，自動回復 staff.is_active=true，讓登入畫面重新出現
  const toggleActive = (pin: UserPin) => guardedWrite('帳號狀態更新', async () => {
    if (!supabase) return
    const nextActive = !pin.is_active
    const { error } = await supabase
      .from('user_pins')
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) throw error

    if (nextActive) {
      const staffRow = staffRowMap.get(pin.staff_id)
      if (staffRow && !staffRow.is_active) {
        const { error: staffErr } = await supabase
          .from('staff')
          .update({ is_active: true })
          .eq('id', pin.staff_id)
        if (staffErr) throw staffErr
        setAllStaffRows((prev) => prev.map((s) => s.id === pin.staff_id ? { ...s, is_active: true } : s))
      }
    }

    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, is_active: nextActive } : p))
    showToast(pin.is_active ? '已停用' : '已啟用')
  })

  // ── 設為離職：staff.is_active=false，登入畫面隱藏 ─────────
  // 只在 PIN 已停用時提供，避免「啟用又離職」的矛盾狀態
  const setRetired = (staffRow: StaffRow) => guardedWrite('設為離職', async () => {
    if (!supabase) return
    if (!confirm(`確定將「${staffRow.name}」設為離職？\n\n離職後將從登入畫面消失，但歷史排班/出貨/請假紀錄會保留。\n如需復職，重新「啟用」PIN 即可。`)) return
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', staffRow.id)
    if (error) throw error
    setAllStaffRows((prev) => prev.map((s) => s.id === staffRow.id ? { ...s, is_active: false } : s))
    showToast(`已將「${staffRow.name}」設為離職`)
  })

  // ── Toggle：排班管理 ─────────────────────────────────────
  const toggleCanSchedule = (pin: UserPin) => guardedWrite('排班權限更新', async () => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ can_schedule: !pin.can_schedule, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) throw error
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, can_schedule: !p.can_schedule } : p))
    showToast(pin.can_schedule ? '已取消排班權限' : '已授予排班權限')
  })

  // ── Toggle：班次詳情可見 ─────────────────────────────────
  const toggleCanPopup = (pin: UserPin) => guardedWrite('班次詳情權限更新', async () => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ can_popup: !pin.can_popup, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) throw error
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, can_popup: !p.can_popup } : p))
    showToast(pin.can_popup ? '已隱藏班次詳情' : '已開放班次詳情')
  })

  // ── 儲存頁面權限 ─────────────────────────────────────────
  const saveAllowedPages = async (pin: UserPin) => {
    if (pagePanelSaving) return
    setPagePanelSaving(true)
    await guardedWrite('頁面權限儲存', async () => {
      if (!supabase) return
      const { error } = await supabase
        .from('user_pins')
        .update({ allowed_pages: pagePanelPages, updated_at: new Date().toISOString() })
        .eq('id', pin.id)
      if (error) throw error
      setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, allowed_pages: pagePanelPages } : p))
      showToast('頁面權限已更新')
    })
    setPagePanelSaving(false)
  }

  // ── 儲存假單主管設定 ─────────────────────────────────────
  const saveApproverSettings = async (pin: UserPin) => {
    if (approverSaving) return
    setApproverSaving(true)
    await guardedWrite('假單主管設定儲存', async () => {
      if (!supabase) return
      // 1. 更新 user_pins
      const { error: pinErr } = await supabase
        .from('user_pins')
        .update({
          is_leave_approver: true,
          leave_approver_scope: approverScope,
          leave_approver_order: approverOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pin.id)
      if (pinErr) throw pinErr

      // 2. 同步寫入 staff.telegram_id
      const { error: staffErr } = await supabase
        .from('staff')
        .update({ telegram_id: approverTelegramId.trim() || null })
        .eq('id', pin.staff_id)
      if (staffErr) throw new Error('Telegram ID 儲存失敗：' + staffErr.message)

      // 3. 清除 V2 主管快取，讓下次送假重新查
      clearLeaveApproverCache()

      await Promise.all([refreshPins(), refreshStaff()])
      setApproverEditing(false)
      showToast('假單主管設定已儲存')
    })
    setApproverSaving(false)
  }

  // ── 關閉假單主管設定 ─────────────────────────────────────
  const removeApproverSettings = async (pin: UserPin) => {
    if (approverSaving) return
    if (!confirm(`確定要取消 ${staffRowMap.get(pin.staff_id)?.name || pin.staff_id} 的假單主管設定嗎？\n（會同時清空 Telegram ID）`)) return

    setApproverSaving(true)
    await guardedWrite('取消主管設定', async () => {
      if (!supabase) return
      // 1. 清 user_pins 主管設定
      const { error: pinErr } = await supabase
        .from('user_pins')
        .update({
          is_leave_approver: false,
          leave_approver_scope: null,
          leave_approver_order: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pin.id)
      if (pinErr) throw pinErr

      // 2. A2 — 同步清空 staff.telegram_id（不再是主管就不需要接收通知）
      const { error: staffErr } = await supabase
        .from('staff')
        .update({ telegram_id: null })
        .eq('id', pin.staff_id)
      if (staffErr) throw new Error('Telegram ID 清空失敗：' + staffErr.message)

      clearLeaveApproverCache()
      await Promise.all([refreshPins(), refreshStaff()])
      setApproverEditing(false)
      showToast('已取消假單主管設定')
    })
    setApproverSaving(false)
  }

  const getPageContext = (pin: UserPin): 'store' | 'kitchen' =>
    pin.role === 'kitchen' ? 'kitchen' : 'store'

  const getPageList = (ctx: 'store' | 'kitchen') =>
    ctx === 'store' ? STORE_PAGES : KITCHEN_PAGES

  const roleOptions = [
    { value: 'store',   label: '門店' },
    { value: 'kitchen', label: '央廚' },
    { value: 'admin',   label: '管理者' },
  ]

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="PIN 碼管理" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          需連接 Supabase
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="PIN 碼管理" backTo="/admin" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
          載入中...
        </div>
      ) : (
        <>
          {loadError && (
            <div className="mx-4 mb-2 mt-2 px-3 py-2 rounded-lg bg-status-warning/10 border border-status-warning/30 text-xs text-status-warning">
              ⚠️ {loadError}（顯示為部分資料，請重新整理）
            </div>
          )}
          {grouped.map(([groupId, staffRows]) => {
            const setCount = staffRows.filter(s => pinMap.has(s.id)).length
            const unsetCount = staffRows.length - setCount
            return (
            <div key={groupId}>
              <SectionHeader
                title={`${groupLabels[groupId] || groupId}（${setCount}/${staffRows.length} 已設定${unsetCount > 0 ? `・${unsetCount} 待設定` : ''}）`}
                icon="■"
              />
              <div className="space-y-2 px-4 pb-2">
                {staffRows.map((staff) => {
                  const pin       = pinMap.get(staff.id)
                  const isExpanded = expandedId === staff.id
                  const isInactive = pin && !pin.is_active

                  return (
                    <div
                      key={staff.id}
                      className={`rounded-xl border transition-colors ${
                        !pin
                          ? 'bg-white border-status-danger/30'
                          : isInactive
                          ? 'bg-gray-50 border-gray-200 opacity-60'
                          : 'bg-white border-gray-100'
                      }`}
                    >
                      {/* ── 收合列 ── */}
                      <button
                        type="button"
                        onClick={() => handleExpand(staff.id, pin, staffRowMap.get(staff.id))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${pin ? 'text-brand-oak' : 'text-brand-oak/50'}`}>
                            {staff.name}
                          </p>
                          {pin ? (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {/* 離職標籤（優先於停用，因為離職一定也停用）*/}
                              {!staff.is_active && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-200 text-gray-600">
                                  已離職
                                </span>
                              )}
                              {/* 停用標籤（啟用狀態用整列灰階表示，不再顯示 tag）*/}
                              {staff.is_active && !pin.is_active && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                  停用
                                </span>
                              )}

                              {/* 授權門市 */}
                              {pin.allowed_stores?.length > 0 && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                                  {pin.allowed_stores
                                    .map((sid) => stores.find((s) => s.id === sid)?.name || sid)
                                    .join('、')}
                                </span>
                              )}

                              {/* 頁面權限 — 只在「自訂」時顯示（全部頁面是預設值，不需 tag）*/}
                              {pin.role !== 'admin' && pin.allowed_pages && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                                  自訂 {pin.allowed_pages.length} 頁
                                </span>
                              )}

                              {/* 排班 + 詳情合併顯示，去除 emoji */}
                              {pin.role !== 'admin' && pin.can_schedule && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700">
                                  排班
                                </span>
                              )}
                              {pin.role !== 'admin' && pin.can_popup && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700">
                                  班次詳情
                                </span>
                              )}

                              {/* 假單主管 */}
                              {pin.is_leave_approver && pin.leave_approver_scope && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">
                                  主管 {APPROVER_SCOPE_OPTIONS.find((o) => o.value === pin.leave_approver_scope)?.label || pin.leave_approver_scope}・{pin.leave_approver_order === 1 ? '一' : '二'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] font-medium text-status-danger mt-1 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-status-danger inline-block" />
                              未設定 PIN
                            </p>
                          )}
                        </div>

                        {pin ? (
                          isExpanded
                            ? <ChevronUp  size={18} className="text-gray-400 shrink-0" />
                            : <ChevronDown size={18} className="text-gray-400 shrink-0" />
                        ) : (
                          <span
                            onClick={(e) => { e.stopPropagation(); openAdd(staff.id, staff.group_id) }}
                            className="px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform shrink-0"
                          >
                            設定 PIN
                          </span>
                        )}
                      </button>

                      {/* ── 展開內容 ── */}
                      {isExpanded && pin && (
                        <div className="px-4 pb-4">
                          <div className="h-px bg-gray-100 mb-3" />

                          {/* Tab 切換 */}
                          <div className="flex gap-1 mb-4">
                            {(
                              [
                                { id: 'account',        label: '帳號設定' },
                                { id: 'permissions',    label: '功能權限' },
                                { id: 'leave_approver', label: '假單主管' },
                              ] as { id: CardTab; label: string }[]
                            ).map((t) => (
                              <button
                                key={t.id}
                                onClick={() => setCardTab(t.id)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  cardTab === t.id
                                    ? 'bg-brand-oak text-white'
                                    : 'bg-gray-100 text-brand-mocha'
                                }`}
                              >
                                {t.label}
                                {t.id === 'leave_approver' && pin.is_leave_approver && (
                                  <span className="ml-1 text-rose-400">●</span>
                                )}
                              </button>
                            ))}
                          </div>

                          {/* ════ Tab 1：帳號設定 ════ */}
                          {cardTab === 'account' && (
                            <div className="space-y-1">
                              <Toggle
                                checked={pin.is_active}
                                onChange={() => toggleActive(pin)}
                                label="帳號狀態"
                                sublabel={pin.is_active ? '目前啟用中' : '目前已停用'}
                              />
                              <div className="h-px bg-gray-100" />
                              <div className="py-2">
                                <p className="text-xs text-brand-lotus mb-0.5">角色</p>
                                <p className="text-sm font-medium text-brand-oak">
                                  {pin.role === 'admin' ? '管理者' : pin.role === 'kitchen' ? '央廚' : '門店'}
                                </p>
                              </div>
                              {pin.allowed_stores?.length > 0 && (
                                <>
                                  <div className="h-px bg-gray-100" />
                                  <div className="py-2">
                                    <p className="text-xs text-brand-lotus mb-0.5">授權門市</p>
                                    <p className="text-sm font-medium text-brand-oak">
                                      {pin.allowed_stores
                                        .map((sid) => stores.find((s) => s.id === sid)?.name || sid)
                                        .join('、')}
                                    </p>
                                  </div>
                                </>
                              )}
                              <div className="h-px bg-gray-100" />
                              <button
                                onClick={() => openEdit(pin)}
                                className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-brand-oak bg-gray-50 border border-gray-200 active:bg-gray-100 transition-colors"
                              >
                                修改 PIN 碼
                              </button>

                              {/* 設為離職：停用狀態下且尚未離職才顯示 */}
                              {!pin.is_active && staff.is_active && (
                                <button
                                  onClick={() => setRetired(staff)}
                                  className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium text-status-danger bg-rose-50 border border-rose-200 active:bg-rose-100 transition-colors"
                                >
                                  設為離職（從登入畫面隱藏）
                                </button>
                              )}

                              {/* 已離職提示 */}
                              {!staff.is_active && (
                                <div className="mt-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs text-brand-mocha">
                                  此員工已離職，登入畫面不顯示。如需復職，請啟用上方「帳號狀態」開關。
                                </div>
                              )}
                            </div>
                          )}

                          {/* ════ Tab 2：功能權限 ════ */}
                          {cardTab === 'permissions' && (
                            <div className="space-y-1">
                              {pin.role !== 'admin' && (
                                <>
                                  <Toggle
                                    checked={pin.can_schedule}
                                    onChange={() => toggleCanSchedule(pin)}
                                    label="排班管理"
                                    sublabel="可編輯排班表、審核請假"
                                  />
                                  <div className="h-px bg-gray-100" />
                                  <Toggle
                                    checked={pin.can_popup}
                                    onChange={() => toggleCanPopup(pin)}
                                    label="班次詳情可見"
                                    sublabel="行事曆可點開看班次時間"
                                  />
                                  <div className="h-px bg-gray-100 my-2" />

                                  {/* 頁面權限 */}
                                  {(() => {
                                    const pageCtx  = getPageContext(pin)
                                    const pageList = getPageList(pageCtx)
                                    const presets  = pageCtx === 'store' ? STORE_PRESETS : KITCHEN_PRESETS
                                    return (
                                      <div className="space-y-3">
                                        <p className="text-xs font-semibold text-brand-oak flex items-center gap-1">
                                          📋 頁面權限
                                          {pin.can_schedule && (
                                            <span className="text-brand-amber font-normal">
                                              （排班人員已有全部權限）
                                            </span>
                                          )}
                                        </p>

                                        {/* 預設按鈕 */}
                                        <div className="flex flex-wrap gap-1.5">
                                          {[
                                            { label: '全部預設', value: null },
                                            { label: '工讀生',   value: presets['part_time'] },
                                            { label: '正職',     value: presets['full_time'] },
                                          ].map(({ label, value }) => {
                                            const isActive = value === null
                                              ? pagePanelPages === null
                                              : pagePanelPages !== null &&
                                                JSON.stringify([...pagePanelPages].sort()) ===
                                                JSON.stringify([...(value as string[])].sort())
                                            return (
                                              <button
                                                key={label}
                                                onClick={() => setPagePanelPages(value ? [...value] : null)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                                  isActive
                                                    ? 'bg-brand-lotus text-white'
                                                    : 'bg-gray-50 text-brand-oak border border-gray-200'
                                                }`}
                                              >
                                                {label}
                                              </button>
                                            )
                                          })}
                                        </div>

                                        {/* 頁面勾選 */}
                                        <div className="grid grid-cols-2 gap-1.5">
                                          {pageList.map((page) => {
                                            const checked = pagePanelPages === null || pagePanelPages.includes(page.key)
                                            return (
                                              <label
                                                key={page.key}
                                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 text-sm cursor-pointer"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={(e) => {
                                                    if (pagePanelPages === null) {
                                                      const all = pageList.map((p) => p.key)
                                                      setPagePanelPages(
                                                        e.target.checked
                                                          ? all
                                                          : all.filter((k) => k !== page.key)
                                                      )
                                                    } else {
                                                      setPagePanelPages(
                                                        e.target.checked
                                                          ? [...pagePanelPages, page.key]
                                                          : pagePanelPages.filter((k) => k !== page.key)
                                                      )
                                                    }
                                                  }}
                                                  className="w-4 h-4 rounded border-gray-300 text-brand-lotus"
                                                />
                                                <span className="text-brand-oak text-xs">{page.label}</span>
                                              </label>
                                            )
                                          })}
                                        </div>

                                        <button
                                          onClick={() => saveAllowedPages(pin)}
                                          disabled={pagePanelSaving}
                                          className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-brand-lotus disabled:opacity-50 active:opacity-80 transition-opacity"
                                        >
                                          {pagePanelSaving ? '儲存中...' : '儲存頁面權限'}
                                        </button>
                                      </div>
                                    )
                                  })()}
                                </>
                              )}
                              {pin.role === 'admin' && (
                                <p className="text-sm text-brand-lotus py-2 text-center">
                                  管理者擁有所有功能，無需設定
                                </p>
                              )}
                            </div>
                          )}

                          {/* ════ Tab 3：假單主管 ════ */}
                          {cardTab === 'leave_approver' && (
                            <div className="space-y-4">
                              {/* 說明卡片（預設摺疊）*/}
                              <button
                                type="button"
                                onClick={() => setApproverHelpOpen(v => !v)}
                                className="w-full bg-amber-50 rounded-xl px-3 py-2 border border-amber-100 flex items-center justify-between"
                              >
                                <p className="text-xs font-semibold text-amber-700">假單主管說明</p>
                                {approverHelpOpen
                                  ? <ChevronUp size={14} className="text-amber-600" />
                                  : <ChevronDown size={14} className="text-amber-600" />}
                              </button>
                              {approverHelpOpen && (
                                <div className="bg-amber-50/60 rounded-xl px-3 py-2.5 border border-amber-100 -mt-3">
                                  <ul className="text-[11px] text-amber-600 space-y-0.5 list-disc list-inside">
                                    <li>每個群組須設定「第一主管」與「第二主管」各一人</li>
                                    <li>兩位主管都設定後，員工才能送出假單</li>
                                    <li>送假時兩位主管同時收到通知</li>
                                    <li>Telegram ID 用於接收請假推播通知</li>
                                  </ul>
                                </div>
                              )}

                              {/* 目前狀態 */}
                              {!approverEditing ? (
                                <div className="space-y-3">
                                  {pin.is_leave_approver ? (
                                    <div className="bg-rose-50 rounded-xl px-4 py-3 border border-rose-100 space-y-2">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-rose-700">🔏 目前為假單主管</p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                        <div>
                                          <span className="text-rose-400">負責群組</span>
                                          <p className="font-medium text-rose-700">
                                            {APPROVER_SCOPE_OPTIONS.find((o) => o.value === pin.leave_approver_scope)?.label || pin.leave_approver_scope}
                                          </p>
                                        </div>
                                        <div>
                                          <span className="text-rose-400">簽核順序</span>
                                          <p className="font-medium text-rose-700">
                                            第 {pin.leave_approver_order} 主管
                                          </p>
                                        </div>
                                        <div className="col-span-2">
                                          <span className="text-rose-400">Telegram ID</span>
                                          <p className="font-medium text-rose-700">
                                            {staffRowMap.get(pin.staff_id)?.telegram_id || '未設定'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                                      <p className="text-sm text-brand-lotus text-center">尚未設定為假單主管</p>
                                    </div>
                                  )}

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setApproverScope(pin.leave_approver_scope || 'kitchen')
                                        setApproverOrder(pin.leave_approver_order || 1)
                                        setApproverTelegramId(staffRowMap.get(pin.staff_id)?.telegram_id || '')
                                        setApproverEditing(true)
                                      }}
                                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-brand-oak text-white active:opacity-80 transition-opacity"
                                    >
                                      {pin.is_leave_approver ? '修改設定' : '設為假單主管'}
                                    </button>
                                    {pin.is_leave_approver && (
                                      <button
                                        onClick={() => removeApproverSettings(pin)}
                                        disabled={approverSaving}
                                        className="px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-status-danger border border-status-danger/20 active:opacity-80 disabled:opacity-50"
                                      >
                                        取消
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                /* 編輯表單 */
                                <div className="space-y-3">
                                  {/* 負責群組 */}
                                  <div>
                                    <label className="block text-xs font-semibold text-brand-oak mb-1.5">
                                      負責群組 <span className="text-status-danger">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                      {APPROVER_SCOPE_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.value}
                                          onClick={() => setApproverScope(opt.value)}
                                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            approverScope === opt.value
                                              ? 'bg-brand-oak text-white'
                                              : 'bg-gray-100 text-brand-mocha'
                                          }`}
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 簽核順序 */}
                                  <div>
                                    <label className="block text-xs font-semibold text-brand-oak mb-1.5">
                                      簽核順序 <span className="text-status-danger">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                      {APPROVER_ORDER_OPTIONS.map((opt) => (
                                        <button
                                          key={opt.value}
                                          onClick={() => setApproverOrder(opt.value)}
                                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors leading-tight ${
                                            approverOrder === opt.value
                                              ? 'bg-brand-oak text-white'
                                              : 'bg-gray-100 text-brand-mocha'
                                          }`}
                                        >
                                          第 {opt.value} 主管
                                        </button>
                                      ))}
                                    </div>
                                    <p className="text-[11px] text-brand-lotus mt-1">
                                      {approverOrder === 1
                                        ? '員工送假時，此主管第一個收到通知並審核'
                                        : '第一主管核准後，此主管接續審核'}
                                    </p>
                                  </div>

                                  {/* Telegram ID */}
                                  <div>
                                    <label className="block text-xs font-semibold text-brand-oak mb-1.5">
                                      Telegram Chat ID
                                      <span className="text-brand-lotus font-normal ml-1">（推播通知用）</span>
                                    </label>
                                    <input
                                      type="text"
                                      value={approverTelegramId}
                                      onChange={(e) => setApproverTelegramId(e.target.value)}
                                      placeholder="例：7920645981"
                                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-surface-input outline-none focus:border-brand-oak"
                                    />
                                    <p className="text-[11px] text-brand-lotus mt-1">
                                      在 Telegram 搜尋 @userinfobot 可取得自己的 Chat ID
                                    </p>
                                  </div>

                                  {/* 儲存/取消 */}
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => setApproverEditing(false)}
                                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-brand-mocha active:bg-gray-200"
                                    >
                                      取消
                                    </button>
                                    <button
                                      onClick={() => saveApproverSettings(pin)}
                                      disabled={approverSaving}
                                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-brand-oak text-white disabled:opacity-50 active:opacity-80"
                                    >
                                      {approverSaving ? '儲存中...' : '儲存設定'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => openAdd()}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-brand-lotus text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
      >
        <Plus size={24} />
      </button>

      {/* 新增/編輯 Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '編輯 PIN' : '新增 PIN'}
        onSubmit={handleSubmit}
        submitting={formSubmitting}
      >
        <ModalField label="人員">
          <ModalSelect
            value={formStaffId}
            onChange={setFormStaffId}
            options={allStaffOptions.map((s) => ({ value: s.id, label: `${s.name} (${s.group})` }))}
            placeholder="選擇人員"
          />
        </ModalField>

        <ModalField label={editing ? 'PIN 碼（留空不修改）' : 'PIN 碼（4 位數字）'}>
          <ModalInput
            value={formPin}
            onChange={setFormPin}
            placeholder="0000"
            type="password"
          />
        </ModalField>

        <ModalField label="角色">
          <ModalSelect
            value={formRole}
            onChange={setFormRole}
            options={roleOptions}
          />
        </ModalField>

        {formRole === 'store' && (
          <ModalField label="授權門市（留空 = 全部門市）">
            <div className="space-y-2">
              {stores.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-brand-oak">
                  <input
                    type="checkbox"
                    checked={formAllowedStores.includes(s.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormAllowedStores((prev) => [...prev, s.id])
                      } else {
                        setFormAllowedStores((prev) => prev.filter((id) => id !== s.id))
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </ModalField>
        )}
      </AdminModal>
    </div>
  )
}
