import { useState, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import { hashPin } from '@/lib/auth'
import { Plus, Pencil, Shield, ShieldOff } from 'lucide-react'

interface UserPin {
  id: string
  staff_id: string
  pin_hash: string
  role: string
  allowed_stores: string[]
  is_active: boolean
  staff?: { name: string }
}

export default function PinManager() {
  const { showToast } = useToast()
  const { kitchenStaff, storeStaff } = useStaffStore()
  const stores = useStoreStore((s) => s.items)

  const [pins, setPins] = useState<UserPin[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<UserPin | null>(null)

  // Form state
  const [formStaffId, setFormStaffId] = useState('')
  const [formRole, setFormRole] = useState('store')
  const [formPin, setFormPin] = useState('')
  const [formAllowedStores, setFormAllowedStores] = useState<string[]>([])

  // Fetch pins
  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase
      .from('user_pins')
      .select('*, staff:staff_id(name)')
      .order('role')
      .then(({ data }) => {
        setPins((data as UserPin[] | null) || [])
        setLoading(false)
      })
  }, [])

  const adminStaff = useStaffStore((s) => s.adminStaff)

  // All staff flat list
  const allStaff = [
    ...adminStaff.map((s) => ({ id: s.id, name: s.name, group: '管理者' })),
    ...kitchenStaff.map((s) => ({ id: s.id, name: s.name, group: '央廚' })),
    ...Object.entries(storeStaff).flatMap(([storeId, members]) => {
      const storeName = stores.find((s) => s.id === storeId)?.name || storeId
      return members.map((s) => ({ id: s.id, name: s.name, group: storeName }))
    }),
  ]

  const openAdd = () => {
    setEditing(null)
    setFormStaffId('')
    setFormRole('store')
    setFormPin('')
    setFormAllowedStores([])
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

    // Refresh list
    const { data } = await supabase
      .from('user_pins')
      .select('*, staff:staff_id(name)')
      .order('role')
    setPins((data as UserPin[] | null) || [])

    setModalOpen(false)
    showToast(editing ? 'PIN 已更新' : 'PIN 已新增')
  }

  const toggleActive = async (pin: UserPin) => {
    if (!supabase) return
    const { error } = await supabase
      .from('user_pins')
      .update({ is_active: !pin.is_active, updated_at: new Date().toISOString() })
      .eq('id', pin.id)

    if (error) {
      showToast('更新失敗', 'error')
      return
    }

    setPins((prev) => prev.map((p) => p.id === pin.id ? { ...p, is_active: !p.is_active } : p))
    showToast(pin.is_active ? '已停用' : '已啟用')
  }

  const roleLabels: Record<string, string> = {
    admin: '管理者',
    kitchen: '央廚',
    store: '門店',
  }

  const roleOptions = [
    { value: 'store', label: '門店' },
    { value: 'kitchen', label: '央廚' },
    { value: 'admin', label: '管理者' },
  ]

  // Group pins by role
  const grouped = {
    admin: pins.filter((p) => p.role === 'admin'),
    kitchen: pins.filter((p) => p.role === 'kitchen'),
    store: pins.filter((p) => p.role === 'store'),
  }

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
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {/* Groups */}
          {Object.entries(grouped).map(([role, items]) => (
            <div key={role}>
              <SectionHeader title={`${roleLabels[role]} (${items.length})`} icon="■" />
              <div className="bg-white divide-y divide-gray-50">
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">尚無人員</div>
                ) : (
                  items.map((pin) => (
                    <div key={pin.id} className="flex items-center px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-oak">
                          {(pin.staff as unknown as { name: string })?.name || pin.staff_id}
                        </p>
                        <p className="text-[11px] text-brand-lotus">
                          {roleLabels[pin.role]}
                          {pin.allowed_stores?.length > 0 && (
                            <> · {pin.allowed_stores.map((sid) => stores.find((s) => s.id === sid)?.name || sid).join('、')}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* FAB */}
      <button
        onClick={openAdd}
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
            options={allStaff.map((s) => ({ value: s.id, label: `${s.name} (${s.group})` }))}
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
