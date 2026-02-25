import { useState } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import type { StaffMember } from '@/data/staff'
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

const EMPLOYMENT_OPTIONS = [
  { value: 'full_time', label: '正職' },
  { value: 'part_time', label: '兼職' },
  { value: 'hourly', label: '工讀' },
]

export default function StaffManager() {
  const { adminStaff, kitchenStaff, storeStaff, addAdmin, updateAdmin, removeAdmin, addKitchen, updateKitchen, removeKitchen, addStore, updateStore, removeStore, reorderGroup } = useStaffStore()
  const stores = useStoreStore((s) => s.items)
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<{ member: StaffMember; group: string } | null>(null)
  const [formName, setFormName] = useState('')
  const [formGroup, setFormGroup] = useState('kitchen')
  const [formEmployment, setFormEmployment] = useState('full_time')
  const [formHourlyRate, setFormHourlyRate] = useState('')
  const [formMonthlySalary, setFormMonthlySalary] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ member: StaffMember; group: string } | null>(null)

  const groupOptions = [
    { value: 'admin', label: '管理者' },
    { value: 'kitchen', label: '央廚' },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ]

  const openAdd = () => {
    setEditing(null)
    setFormName('')
    setFormGroup('kitchen')
    setFormEmployment('full_time')
    setFormHourlyRate('')
    setFormMonthlySalary('')
    setModalOpen(true)
  }

  const openEdit = async (member: StaffMember, group: string) => {
    setEditing({ member, group })
    setFormName(member.name)
    setFormGroup(group)
    // Fetch employment_type and hourly_rate from DB
    if (supabase) {
      const { data } = await supabase.from('staff').select('employment_type, hourly_rate, monthly_salary').eq('id', member.id).single()
      setFormEmployment(data?.employment_type || 'full_time')
      setFormHourlyRate(data?.hourly_rate ? String(data.hourly_rate) : '')
      setFormMonthlySalary(data?.monthly_salary ? String(data.monthly_salary) : '')
    }
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      showToast('請填寫姓名', 'error')
      return
    }
    if (editing) {
      if (editing.group === 'admin') {
        updateAdmin(editing.member.id, { name: formName })
      } else if (editing.group === 'kitchen') {
        updateKitchen(editing.member.id, { name: formName })
      } else {
        updateStore(editing.group, editing.member.id, { name: formName })
      }
      // Update employment_type, hourly_rate, monthly_salary
      if (supabase) {
        await supabase.from('staff').update({
          employment_type: formEmployment,
          hourly_rate: formHourlyRate ? Number(formHourlyRate) : 0,
          monthly_salary: formMonthlySalary ? Number(formMonthlySalary) : 0,
        }).eq('id', editing.member.id)
      }
      showToast('人員已更新')
    } else {
      const newMember: StaffMember = { id: `staff_${Date.now()}`, name: formName }
      if (formGroup === 'admin') {
        addAdmin(newMember)
      } else if (formGroup === 'kitchen') {
        addKitchen(newMember)
      } else {
        addStore(formGroup, newMember)
      }
      // Set employment_type/hourly_rate and auto-create user_pins record
      if (supabase) {
        // Small delay to ensure the insert from store has completed
        setTimeout(async () => {
          await supabase!.from('staff').update({
            employment_type: formEmployment,
            hourly_rate: formHourlyRate ? Number(formHourlyRate) : 0,
            monthly_salary: formMonthlySalary ? Number(formMonthlySalary) : 0,
          }).eq('id', newMember.id)
          // Auto-create user_pins record (is_active=false, admin needs to set PIN later)
          const role = formGroup === 'admin' ? 'admin' : formGroup === 'kitchen' ? 'kitchen' : 'store'
          const allowed_stores = role === 'store' ? [formGroup] : []
          await supabase!.from('user_pins').insert({
            id: `pin_${newMember.id}`,
            staff_id: newMember.id,
            role,
            allowed_stores,
            pin_hash: '',
            is_active: false,
            can_schedule: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }, 500)
      }
      showToast('人員已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (member: StaffMember, group: string) => {
    setDeleteConfirm({ member, group })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    let err: string | null = null
    if (deleteConfirm.group === 'admin') {
      err = await removeAdmin(deleteConfirm.member.id)
    } else if (deleteConfirm.group === 'kitchen') {
      err = await removeKitchen(deleteConfirm.member.id)
    } else {
      err = await removeStore(deleteConfirm.group, deleteConfirm.member.id)
    }
    if (err) {
      showToast('刪除失敗：' + err, 'error')
    } else {
      showToast('人員已刪除')
    }
    setDeleteConfirm(null)
  }

  const moveUp = (members: StaffMember[], idx: number, group: string) => {
    if (idx === 0) return
    const arr = [...members]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    reorderGroup(group, arr)
  }

  const moveDown = (members: StaffMember[], idx: number, group: string) => {
    if (idx >= members.length - 1) return
    const arr = [...members]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    reorderGroup(group, arr)
  }

  const renderStaffList = (members: StaffMember[], group: string) => (
    <div className="bg-white">
      {members.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-brand-lotus">尚無人員</div>
      )}
      {members.map((member, idx) => (
        <div
          key={member.id}
          className={`flex items-center justify-between px-4 py-3 ${idx < members.length - 1 ? 'border-b border-gray-50' : ''}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <button onClick={() => moveUp(members, idx, group)} disabled={idx === 0} className="p-0.5 text-brand-lotus disabled:opacity-20 active:text-brand-oak">
                <ChevronUp size={14} />
              </button>
              <button onClick={() => moveDown(members, idx, group)} disabled={idx >= members.length - 1} className="p-0.5 text-brand-lotus disabled:opacity-20 active:text-brand-oak">
                <ChevronDown size={14} />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-oak">{member.name}</p>
              <p className="text-[10px] text-brand-lotus">ID: {member.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(member, group)} className="p-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100">
              <Pencil size={15} className="text-status-info" />
            </button>
            <button onClick={() => handleDelete(member, group)} className="p-1.5 rounded-lg hover:bg-red-50 active:bg-red-100">
              <Trash2 size={15} className="text-status-danger" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="page-container">
      <TopNav title="人員管理" backTo="/admin" />

      {/* Admin staff */}
      <SectionHeader title={`管理者 (${adminStaff.length})`} icon="■" />
      {renderStaffList(adminStaff, 'admin')}

      {/* Kitchen staff */}
      <SectionHeader title={`央廚人員 (${kitchenStaff.length})`} icon="■" />
      {renderStaffList(kitchenStaff, 'kitchen')}

      {/* Store staff */}
      {stores.map((store) => {
        const members = storeStaff[store.id] || []
        return (
          <div key={store.id}>
            <SectionHeader title={`${store.name} (${members.length})`} icon="■" />
            {renderStaffList(members, store.id)}
          </div>
        )
      })}

      <BottomAction label="新增人員" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯人員' : '新增人員'} onSubmit={handleSubmit}>
        <ModalField label="姓名">
          <ModalInput value={formName} onChange={setFormName} placeholder="請輸入姓名" />
        </ModalField>
        <ModalField label="所屬單位">
          <ModalSelect
            value={editing ? editing.group : formGroup}
            onChange={(v) => setFormGroup(v)}
            options={groupOptions}
            placeholder="請選擇"
          />
        </ModalField>
        <ModalField label="職別">
          <ModalSelect
            value={formEmployment}
            onChange={setFormEmployment}
            options={EMPLOYMENT_OPTIONS}
          />
        </ModalField>
        {formEmployment === 'full_time' ? (
          <ModalField label="月薪（元）">
            <ModalInput
              value={formMonthlySalary}
              onChange={setFormMonthlySalary}
              placeholder="例：30000"
              type="text"
            />
          </ModalField>
        ) : (
          <ModalField label="時薪（元）">
            <ModalInput
              value={formHourlyRate}
              onChange={setFormHourlyRate}
              placeholder="例：183"
              type="text"
            />
          </ModalField>
        )}
      </AdminModal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除「{deleteConfirm.member.name}」嗎？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={confirmDelete} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
