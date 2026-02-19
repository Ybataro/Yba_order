import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminTable } from '@/components/AdminTable'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { CategoryManager } from '@/components/CategoryManager'
import { useToast } from '@/components/Toast'
import { useSettlementStore } from '@/stores/useSettlementStore'
import type { SettlementField } from '@/data/settlementFields'
import { Plus, FolderCog } from 'lucide-react'

const emptyField: SettlementField = { id: '', label: '', group: '', type: 'input', multiplier: undefined, unit: '' }

export default function SettlementManager() {
  const { items, groups, add, update, remove, reorder, renameGroup, addGroup, removeGroup } = useSettlementStore()
  const { showToast } = useToast()
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SettlementField | null>(null)
  const [form, setForm] = useState<SettlementField>(emptyField)
  const [deleteConfirm, setDeleteConfirm] = useState<SettlementField | null>(null)

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    groups.forEach((g) => { counts[g] = items.filter((f) => f.group === g).length })
    return counts
  }, [items, groups])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyField, id: `sf_${Date.now()}` })
    setModalOpen(true)
  }

  const openEdit = (item: SettlementField) => {
    setEditing(item)
    setForm({ ...item })
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.label.trim() || !form.group) {
      showToast('請填寫欄位名稱與分組', 'error')
      return
    }
    if (editing) {
      update(editing.id, form)
      showToast('欄位已更新')
    } else {
      add(form)
      showToast('欄位已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (item: SettlementField) => setDeleteConfirm(item)

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove(deleteConfirm.id)
      showToast('欄位已刪除')
      setDeleteConfirm(null)
    }
  }

  const groupOptions = groups.map((g) => ({ value: g, label: g }))
  const typeOptions = [
    { value: 'input', label: '數字輸入' },
    { value: 'text', label: '文字輸入' },
  ]

  return (
    <div className="page-container">
      <TopNav title="結帳欄位管理" backTo="/admin" />

      {/* Group manager toggle */}
      <div className="px-4 pt-3 pb-1 flex justify-end">
        <button
          onClick={() => setShowGroupManager(!showGroupManager)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showGroupManager ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'
          }`}
        >
          <FolderCog size={13} />
          管理分組
        </button>
      </div>

      {showGroupManager && (
        <div className="mx-4 mb-2 rounded-card overflow-hidden border border-gray-200">
          <CategoryManager
            categories={[...groups]}
            itemCounts={groupCounts}
            onRename={renameGroup}
            onAdd={addGroup}
            onRemove={removeGroup}
            label="分組"
          />
        </div>
      )}

      {groups.map((group) => {
        const groupItems = items.filter((f) => f.group === group)
        if (groupItems.length === 0) return null
        return (
          <div key={group}>
            <SectionHeader title={`${group} (${groupItems.length})`} icon="■" />
            <AdminTable
              items={groupItems}
              columns={[
                {
                  key: 'label',
                  label: '欄位',
                  render: (f) => (
                    <div>
                      <p className="text-sm font-medium text-brand-oak">{f.label}</p>
                      <p className="text-[10px] text-brand-lotus">
                        {f.type === 'input' ? '數字' : '文字'}
                        {f.multiplier ? ` · x${f.multiplier}` : ''}
                        {f.unit ? ` · ${f.unit}` : ''}
                      </p>
                    </div>
                  ),
                },
              ]}
              onEdit={openEdit}
              onDelete={handleDelete}
              onMoveUp={(idx) => {
                if (idx > 0) reorder(items.indexOf(groupItems[idx]), items.indexOf(groupItems[idx - 1]))
              }}
              onMoveDown={(idx) => {
                if (idx < groupItems.length - 1) reorder(items.indexOf(groupItems[idx]), items.indexOf(groupItems[idx + 1]))
              }}
            />
          </div>
        )
      })}

      <BottomAction label="新增欄位" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯欄位' : '新增欄位'} onSubmit={handleSubmit}>
        <ModalField label="欄位名稱">
          <ModalInput value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="例：POS結帳金額" />
        </ModalField>
        <ModalField label="分組">
          <ModalSelect value={form.group} onChange={(v) => setForm({ ...form, group: v })} options={groupOptions} placeholder="請選擇分組" />
        </ModalField>
        <ModalField label="類型">
          <ModalSelect value={form.type} onChange={(v) => setForm({ ...form, type: v as 'input' | 'text' })} options={typeOptions} />
        </ModalField>
        <ModalField label="倍率（選填，僅數字類型）">
          <ModalInput value={form.multiplier != null ? String(form.multiplier) : ''} onChange={(v) => setForm({ ...form, multiplier: v ? Number(v) : undefined })} placeholder="例：1000" />
        </ModalField>
        <ModalField label="單位（選填）">
          <ModalInput value={form.unit ?? ''} onChange={(v) => setForm({ ...form, unit: v })} placeholder="例：元、張、枚" />
        </ModalField>
      </AdminModal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除「{deleteConfirm.label}」欄位嗎？</p>
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
