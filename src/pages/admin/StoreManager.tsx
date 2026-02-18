import { useState } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import type { Store } from '@/data/stores'
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react'

export default function StoreManager() {
  const { items, add, update, remove } = useStoreStore()
  const { showToast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Store | null>(null)
  const [formName, setFormName] = useState('')
  const [formCode, setFormCode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<Store | null>(null)

  const openAdd = () => {
    setEditing(null)
    setFormName('')
    setFormCode('')
    setModalOpen(true)
  }

  const openEdit = (store: Store) => {
    setEditing(store)
    setFormName(store.name)
    setFormCode(store.code)
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!formName.trim() || !formCode.trim()) {
      showToast('請填寫門店名稱與代碼', 'error')
      return
    }
    if (editing) {
      update(editing.id, { name: formName, code: formCode })
      showToast('門店已更新')
    } else {
      const id = formCode.toLowerCase().replace(/\s+/g, '')
      if (items.some((s) => s.id === id)) {
        showToast('門店代碼重複', 'error')
        return
      }
      add({ id, name: formName, code: formCode })
      showToast('門店已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (store: Store) => setDeleteConfirm(store)

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove(deleteConfirm.id)
      showToast('門店已刪除')
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="page-container">
      <TopNav title="門店管理" />

      <div className="bg-white">
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-brand-lotus">尚無門店，請點擊下方按鈕新增</div>
        )}
        {items.map((store, idx) => (
          <div
            key={store.id}
            className={`flex items-center gap-4 px-4 py-4 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}
          >
            <div className="w-11 h-11 rounded-xl bg-brand-blush/20 flex items-center justify-center shrink-0">
              <MapPin size={20} className="text-brand-blush" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-brand-oak">{store.name}</p>
              <p className="text-xs text-brand-lotus">代碼：{store.code} / ID：{store.id}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(store)} className="p-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100">
                <Pencil size={15} className="text-status-info" />
              </button>
              <button onClick={() => handleDelete(store)} className="p-1.5 rounded-lg hover:bg-red-50 active:bg-red-100">
                <Trash2 size={15} className="text-status-danger" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <BottomAction label="新增門店" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯門店' : '新增門店'} onSubmit={handleSubmit}>
        <ModalField label="門店名稱">
          <ModalInput value={formName} onChange={setFormName} placeholder="例：樂華店" />
        </ModalField>
        <ModalField label="門店代碼">
          <ModalInput value={formCode} onChange={setFormCode} placeholder="例：lehua（英文小寫）" />
        </ModalField>
      </AdminModal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除「{deleteConfirm.name}」嗎？刪除後相關人員資料也會受影響。</p>
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
