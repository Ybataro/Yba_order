import { useState } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { useToast } from '@/components/Toast'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import type { StaffMember } from '@/data/staff'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function StaffManager() {
  const { kitchenStaff, storeStaff, addKitchen, updateKitchen, removeKitchen, addStore, updateStore, removeStore } = useStaffStore()
  const stores = useStoreStore((s) => s.items)
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<{ member: StaffMember; group: string } | null>(null)
  const [formName, setFormName] = useState('')
  const [formGroup, setFormGroup] = useState('kitchen')
  const [deleteConfirm, setDeleteConfirm] = useState<{ member: StaffMember; group: string } | null>(null)

  const groupOptions = [
    { value: 'kitchen', label: '央廚' },
    ...stores.map((s) => ({ value: s.id, label: s.name })),
  ]

  const openAdd = () => {
    setEditing(null)
    setFormName('')
    setFormGroup('kitchen')
    setModalOpen(true)
  }

  const openEdit = (member: StaffMember, group: string) => {
    setEditing({ member, group })
    setFormName(member.name)
    setFormGroup(group)
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!formName.trim()) {
      showToast('請填寫姓名', 'error')
      return
    }
    if (editing) {
      if (editing.group === 'kitchen') {
        updateKitchen(editing.member.id, { name: formName })
      } else {
        updateStore(editing.group, editing.member.id, { name: formName })
      }
      showToast('人員已更新')
    } else {
      const newMember: StaffMember = { id: `staff_${Date.now()}`, name: formName }
      if (formGroup === 'kitchen') {
        addKitchen(newMember)
      } else {
        addStore(formGroup, newMember)
      }
      showToast('人員已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (member: StaffMember, group: string) => {
    setDeleteConfirm({ member, group })
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      if (deleteConfirm.group === 'kitchen') {
        removeKitchen(deleteConfirm.member.id)
      } else {
        removeStore(deleteConfirm.group, deleteConfirm.member.id)
      }
      showToast('人員已刪除')
      setDeleteConfirm(null)
    }
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
          <div>
            <p className="text-sm font-medium text-brand-oak">{member.name}</p>
            <p className="text-[10px] text-brand-lotus">ID: {member.id}</p>
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
      <TopNav title="人員管理" />

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
