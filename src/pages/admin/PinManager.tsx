import { useState, useEffect, useMemo } from 'react'
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

  // ── 新增/編輯 Modal state ──
  const [formStaffId, setFormStaffId] = useState('')
  const [formRole, setFormRole] = useState('store')
  const [formPin, setFormPin] = useState('')
  const [formAllowedStores, setFormAllowedStores] = useState<string[]>([])

  // ── 初始載入 ──────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    Promise.all([
      supabase.from('user_pins').select('*').order('role'),
      supabase.from('staff').select('id, name, group_id, sort_order, telegram_id').order('sort_order'),
    ]).then(([pinRes, staffRes]) => {
      setPins((pinRes.data as UserPin[] | null) || [])
      setAllStaffRows((staffRes.data as StaffRow[] | null) || [])
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
    return Array.from(m.entries()).sort(
      (a, b) => (GROUP_ORDER[a[0]] ?? 99) - (GROUP_ORDER[b[0]] ?? 99)
    )
  }, [allStaffRows])

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

    const { error } = await supabase.from('user_pins').upsert(pinData, { onConflict: 'id' })
    if (error) { showToast('儲存失敗：' + error.message, 'error'); return }
    await refreshPins()
    setModalOpen(false)
    showToast(editing ? 'PIN 已更新' : 'PIN 已新增')
  }

  // ── Toggle：帳號狀態 ─────────────────────────────────────
  const toggleActive = async (pin: UserPin) => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ is_active: !pin.is_active, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) { showToast('更新失敗', 'error'); return }
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, is_active: !p.is_active } : p))
    showToast(pin.is_active ? '已停用' : '已啟用')
  }

  // ── Toggle：排班管理 ─────────────────────────────────────
  const toggleCanSchedule = async (pin: UserPin) => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ can_schedule: !pin.can_schedule, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) { showToast('更新失敗', 'error'); return }
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, can_schedule: !p.can_schedule } : p))
    showToast(pin.can_schedule ? '已取消排班權限' : '已授予排班權限')
  }

  // ── Toggle：班次詳情可見 ─────────────────────────────────
  const toggleCanPopup = async (pin: UserPin) => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ can_popup: !pin.can_popup, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    if (error) { showToast('更新失敗', 'error'); return }
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, can_popup: !p.can_popup } : p))
    showToast(pin.can_popup ? '已隱藏班次詳情' : '已開放班次詳情')
  }

  // ── 儲存頁面權限 ─────────────────────────────────────────
  const saveAllowedPages = async (pin: UserPin) => {
    if (!supabase) return
    setPagePanelSaving(true)
    const { error } = await supabase
      .from('user_pins')
      .update({ allowed_pages: pagePanelPages, updated_at: new Date().toISOString() })
      .eq('id', pin.id)
    setPagePanelSaving(false)
    if (error) { showToast('儲存失敗', 'error'); return }
    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, allowed_pages: pagePanelPages } : p))
    showToast('頁面權限已更新')
  }

  // ── 儲存假單主管設定 ─────────────────────────────────────
  const saveApproverSettings = async (pin: UserPin) => {
    if (!supabase) return
    setApproverSaving(true)

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

    if (pinErr) {
      showToast('主管設定儲存失敗', 'error')
      setApproverSaving(false)
      return
    }

    // 2. 同步寫入 staff.telegram_id
    const { error: staffErr } = await supabase
      .from('staff')
      .update({ telegram_id: approverTelegramId.trim() || null })
      .eq('id', pin.staff_id)

    if (staffErr) {
      showToast('Telegram ID 儲存失敗', 'error')
      setApproverSaving(false)
      return
    }

    // 3. 清除 V2 主管快取，讓下次送假重新查
    clearLeaveApproverCache()

    await Promise.all([refreshPins(), refreshStaff()])
    setApproverSaving(false)
    setApproverEditing(false)
    showToast('假單主管設定已儲存')
  }

  // ── 關閉假單主管設定 ─────────────────────────────────────
  const removeApproverSettings = async (pin: UserPin) => {
    if (!supabase) return
    if (!confirm(`確定要取消 ${staffRowMap.get(pin.staff_id)?.name || pin.staff_id} 的假單主管設定嗎？`)) return

    setApproverSaving(true)
    const { error } = await supabase
      .from('user_pins')
      .update({
        is_leave_approver: false,
        leave_approver_scope: null,
        leave_approver_order: 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pin.id)

    if (error) { showToast('取消設定失敗', 'error'); setApproverSaving(false); return }

    clearLeaveApproverCache()
    await refreshPins()
    setApproverSaving(false)
    setApproverEditing(false)
    showToast('已取消假單主管設定')
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
          {grouped.map(([groupId, staffRows]) => (
            <div key={groupId}>
              <SectionHeader
                title={`${groupLabels[groupId] || groupId} (${staffRows.length})`}
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
                        isInactive
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
                              {/* 啟用狀態 */}
                              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                pin.is_active
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {pin.is_active ? '🟢 啟用' : '⚫ 停用'}
                              </span>

                              {/* 授權門市 */}
                              {pin.allowed_stores?.length > 0 && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
                                  {pin.allowed_stores
                                    .map((sid) => stores.find((s) => s.id === sid)?.name || sid)
                                    .join('、')}
                                </span>
                              )}

                              {/* 頁面權限 */}
                              {pin.role !== 'admin' && (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                                  pin.allowed_pages
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-gray-50 text-gray-500'
                                }`}>
                                  {pin.allowed_pages ? `自訂 ${pin.allowed_pages.length} 頁` : '全部頁面'}
                                </span>
                              )}

                              {/* 排班 */}
                              {pin.role !== 'admin' && pin.can_schedule && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700">
                                  📅 排班
                                </span>
                              )}

                              {/* 詳情 */}
                              {pin.role !== 'admin' && pin.can_popup && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700">
                                  👁 詳情
                                </span>
                              )}

                              {/* 假單主管 */}
                              {pin.is_leave_approver && pin.leave_approver_scope && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700">
                                  🔏 主管 {APPROVER_SCOPE_OPTIONS.find((o) => o.value === pin.leave_approver_scope)?.label || pin.leave_approver_scope}-{pin.leave_approver_order}
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-status-danger/70 mt-1">未設定 PIN</p>
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
                              {/* 說明卡片 */}
                              <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                                <p className="text-xs font-semibold text-amber-700 mb-1">假單主管說明</p>
                                <ul className="text-[11px] text-amber-600 space-y-0.5 list-disc list-inside">
                                  <li>每個群組須設定「第一主管」與「第二主管」各一人</li>
                                  <li>兩位主管都設定後，員工才能送出假單</li>
                                  <li>送假時兩位主管同時收到通知</li>
                                  <li>Telegram ID 用於接收請假推播通知</li>
                                </ul>
                              </div>

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
          ))}
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
