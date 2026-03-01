import { useState, useEffect, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { hashPin } from '@/lib/auth'
import { Plus, Pencil, Shield, ShieldOff, CalendarDays, Lock, Eye, EyeOff } from 'lucide-react'

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
}

/** Page definitions for store and kitchen contexts */
const STORE_PAGES = [
  { key: 'inventory', label: '物料盤點' },
  { key: 'settlement', label: '每日結帳' },
  { key: 'order', label: '叫貨' },
  { key: 'receive', label: '收貨確認' },
  { key: 'expense', label: '雜支申報' },
  { key: 'expense-edit', label: '雜支改刪（主管）' },
  { key: 'schedule', label: '排班表' },
]

const KITCHEN_PAGES = [
  { key: 'orders', label: '各店叫貨總表' },
  { key: 'shipments', label: '出貨表' },
  { key: 'materials', label: '原物料庫存' },
  { key: 'products', label: '成品庫存' },
  { key: 'material-orders', label: '原物料叫貨' },
  { key: 'production-schedule', label: '生產排程建議' },
  { key: 'expense', label: '雜支申報' },
  { key: 'expense-edit', label: '雜支改刪（主管）' },
  { key: 'staff-schedule', label: '排班表' },
]

const STORE_PRESETS: Record<string, string[]> = {
  part_time: ['expense', 'schedule'],
  full_time: ['expense', 'schedule', 'inventory'],
}

const KITCHEN_PRESETS: Record<string, string[]> = {
  part_time: ['expense', 'staff-schedule'],
  full_time: ['expense', 'staff-schedule', 'materials', 'products'],
}

interface StaffRow {
  id: string
  name: string
  group_id: string
  sort_order: number
}

/** Derive role from group_id */
function deriveRole(groupId: string): string {
  if (groupId === 'admin') return 'admin'
  if (groupId === 'kitchen') return 'kitchen'
  return 'store'
}

/** Derive allowed_stores from group_id */
function deriveStores(groupId: string): string[] {
  if (groupId === 'admin' || groupId === 'kitchen') return []
  return [groupId]
}

const GROUP_ORDER: Record<string, number> = { admin: 0, kitchen: 1, lehua: 2, xingnan: 3 }

export default function PinManager() {
  const { showToast } = useToast()
  const { adminStaff, kitchenStaff, storeStaff } = useStaffStore()
  const stores = useStoreStore((s) => s.items)

  const [pins, setPins] = useState<UserPin[]>([])
  const [allStaffRows, setAllStaffRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserPin | null>(null)

  // Form state
  const [formStaffId, setFormStaffId] = useState('')
  const [formRole, setFormRole] = useState('store')
  const [formPin, setFormPin] = useState('')
  const [formAllowedStores, setFormAllowedStores] = useState<string[]>([])

  // Page permission panel state
  const [pagePanelPinId, setPagePanelPinId] = useState<string | null>(null)
  const [pagePanelPages, setPagePanelPages] = useState<string[] | null>(null)
  const [pagePanelSaving, setPagePanelSaving] = useState(false)

  const getPageContext = (pin: UserPin): 'store' | 'kitchen' => {
    return pin.role === 'kitchen' ? 'kitchen' : 'store'
  }

  const getPageList = (ctx: 'store' | 'kitchen') => ctx === 'store' ? STORE_PAGES : KITCHEN_PAGES

  const togglePagePanel = (pin: UserPin) => {
    if (pagePanelPinId === pin.id) {
      setPagePanelPinId(null)
      return
    }
    setPagePanelPinId(pin.id)
    setPagePanelPages(pin.allowed_pages ? [...pin.allowed_pages] : null)
  }

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
    setPagePanelPinId(null)
    showToast('頁面權限已更新')
  }

  // Fetch pins + all staff
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    Promise.all([
      supabase.from('user_pins').select('*').order('role'),
      supabase.from('staff').select('id, name, group_id, sort_order').order('sort_order'),
    ]).then(([pinRes, staffRes]) => {
      setPins((pinRes.data as UserPin[] | null) || [])
      setAllStaffRows((staffRes.data as StaffRow[] | null) || [])
      setLoading(false)
    })
  }, [])

  // Build pin lookup: staff_id → UserPin
  const pinMap = useMemo(() => {
    const m = new Map<string, UserPin>()
    for (const p of pins) m.set(p.staff_id, p)
    return m
  }, [pins])

  // Group labels
  const groupLabels: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = { admin: '管理者', kitchen: '央廚' }
    for (const s of stores) m[s.id] = s.name
    return m
  }, [stores])

  // Group staff by group_id, sorted
  const grouped = useMemo(() => {
    const m = new Map<string, StaffRow[]>()
    for (const s of allStaffRows) {
      const key = s.group_id || 'kitchen'
      const list = m.get(key) || []
      list.push(s)
      m.set(key, list)
    }
    return Array.from(m.entries()).sort((a, b) => (GROUP_ORDER[a[0]] ?? 99) - (GROUP_ORDER[b[0]] ?? 99))
  }, [allStaffRows])

  // All staff flat list for modal dropdown
  const allStaffOptions = useMemo(() => [
    ...adminStaff.map((s) => ({ id: s.id, name: s.name, group: '管理者' })),
    ...kitchenStaff.map((s) => ({ id: s.id, name: s.name, group: '央廚' })),
    ...Object.entries(storeStaff).flatMap(([storeId, members]) => {
      const storeName = stores.find((s) => s.id === storeId)?.name || storeId
      return members.map((s) => ({ id: s.id, name: s.name, group: storeName }))
    }),
  ], [adminStaff, kitchenStaff, storeStaff, stores])

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

  const refreshPins = async () => {
    if (!supabase) return
    const { data } = await supabase.from('user_pins').select('*').order('role')
    setPins((data as UserPin[] | null) || [])
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

    if (formPin) {
      pinData.pin_hash = await hashPin(formPin)
    }

    if (!editing) {
      pinData.created_at = new Date().toISOString()
      pinData.is_active = true
    }

    const { error } = await supabase
      .from('user_pins')
      .upsert(pinData, { onConflict: 'id' })

    if (error) {
      showToast('儲存失敗：' + error.message, 'error')
      return
    }

    await refreshPins()
    setModalOpen(false)
    showToast(editing ? 'PIN 已更新' : 'PIN 已新增')
  }

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

  const roleOptions = [
    { value: 'store', label: '門店' },
    { value: 'kitchen', label: '央廚' },
    { value: 'admin', label: '管理者' },
  ]

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="PIN 碼管理" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="PIN 碼管理" backTo="/admin" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {grouped.map(([groupId, staffRows]) => (
            <div key={groupId}>
              <SectionHeader title={`${groupLabels[groupId] || groupId} (${staffRows.length})`} icon="■" />
              <div className="bg-white divide-y divide-gray-50">
                {staffRows.map((staff) => {
                  const pin = pinMap.get(staff.id)
                  const isPanelOpen = pin && pagePanelPinId === pin.id
                  const pageCtx = pin ? getPageContext(pin) : 'store'
                  const pageList = getPageList(pageCtx)
                  const presets = pageCtx === 'store' ? STORE_PRESETS : KITCHEN_PRESETS
                  return (
                    <div key={staff.id}>
                      <div className="flex items-center px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${pin ? 'text-brand-oak' : 'text-brand-oak/50'}`}>
                            {staff.name}
                          </p>
                          {pin ? (
                            <p className="text-[11px] text-brand-lotus">
                              {pin.is_active ? '啟用中' : '已停用'}
                              {pin.allowed_stores?.length > 0 && (
                                <> · {pin.allowed_stores.map((sid) => stores.find((s) => s.id === sid)?.name || sid).join('、')}</>
                              )}
                              {pin.role !== 'admin' && !pin.can_schedule && (
                                <> · {pin.allowed_pages ? `自訂 ${pin.allowed_pages.length} 頁` : '預設權限'}</>
                              )}
                            </p>
                          ) : (
                            <p className="text-[11px] text-status-danger/70">未設定 PIN</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {pin ? (
                            <>
                              {pin.role !== 'admin' && (
                                <button
                                  onClick={() => togglePagePanel(pin)}
                                  className={`p-1.5 rounded-lg ${isPanelOpen ? 'text-brand-lotus bg-brand-lotus/10' : pin.allowed_pages ? 'text-brand-mocha bg-amber-50' : 'text-gray-300 bg-gray-50'}`}
                                  title="頁面權限"
                                >
                                  <Lock size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => toggleCanPopup(pin)}
                                className={`p-1.5 rounded-lg ${pin.can_popup ? 'text-blue-500 bg-blue-50' : 'text-gray-300 bg-gray-50'}`}
                                title={pin.can_popup ? '隱藏班次詳情' : '開放班次詳情'}
                              >
                                {pin.can_popup ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>
                              <button
                                onClick={() => toggleCanSchedule(pin)}
                                className={`p-1.5 rounded-lg ${pin.can_schedule ? 'text-brand-amber bg-amber-50' : 'text-gray-300 bg-gray-50'}`}
                                title={pin.can_schedule ? '取消排班權限' : '授予排班權限'}
                              >
                                <CalendarDays size={16} />
                              </button>
                              <button
                                onClick={() => toggleActive(pin)}
                                className={`p-1.5 rounded-lg ${pin.is_active ? 'text-green-500 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                                title={pin.is_active ? '停用' : '啟用'}
                              >
                                {pin.is_active ? <Shield size={16} /> : <ShieldOff size={16} />}
                              </button>
                              <button
                                onClick={() => openEdit(pin)}
                                className="p-1.5 rounded-lg text-brand-lotus bg-gray-50"
                              >
                                <Pencil size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => openAdd(staff.id, staff.group_id)}
                              className="px-2.5 py-1 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
                            >
                              設定 PIN
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline page permission panel */}
                      {isPanelOpen && pin && (
                        <div className="px-4 pb-3">
                          <div className="rounded-xl bg-gray-50 p-3 space-y-3">
                            <p className="text-xs font-semibold text-brand-oak">
                              頁面權限 — {staff.name}
                              {pin.can_schedule && <span className="ml-1 text-brand-amber font-normal">（排班人員，已有全部權限）</span>}
                            </p>

                            {/* Preset buttons */}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => setPagePanelPages(null)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  pagePanelPages === null ? 'bg-brand-lotus text-white' : 'bg-white text-brand-oak border border-gray-200'
                                }`}
                              >
                                全部（預設）
                              </button>
                              <button
                                onClick={() => setPagePanelPages([...presets['part_time']])}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  pagePanelPages !== null && JSON.stringify([...pagePanelPages].sort()) === JSON.stringify([...presets['part_time']].sort())
                                    ? 'bg-brand-lotus text-white' : 'bg-white text-brand-oak border border-gray-200'
                                }`}
                              >
                                工讀生/兼職
                              </button>
                              <button
                                onClick={() => setPagePanelPages([...presets['full_time']])}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                                  pagePanelPages !== null && JSON.stringify([...pagePanelPages].sort()) === JSON.stringify([...presets['full_time']].sort())
                                    ? 'bg-brand-lotus text-white' : 'bg-white text-brand-oak border border-gray-200'
                                }`}
                              >
                                正職
                              </button>
                            </div>

                            {/* Individual toggles */}
                            <div className="grid grid-cols-2 gap-1.5">
                              {pageList.map((page) => {
                                const checked = pagePanelPages === null || pagePanelPages.includes(page.key)
                                return (
                                  <label key={page.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white text-sm">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => {
                                        if (pagePanelPages === null) {
                                          // Switch from "all" to custom: include all except this one
                                          const all = pageList.map((p) => p.key)
                                          setPagePanelPages(e.target.checked ? all : all.filter((k) => k !== page.key))
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

                            {/* Save / Cancel */}
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => setPagePanelPinId(null)}
                                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-brand-oak bg-white border border-gray-200"
                              >
                                取消
                              </button>
                              <button
                                onClick={() => saveAllowedPages(pin)}
                                disabled={pagePanelSaving}
                                className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white bg-brand-lotus disabled:opacity-50"
                              >
                                {pagePanelSaving ? '儲存中...' : '儲存'}
                              </button>
                            </div>
                          </div>
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

      {/* Modal */}
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
