import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminTable } from '@/components/AdminTable'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { CategoryManager } from '@/components/CategoryManager'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import type { RawMaterial } from '@/data/rawMaterials'
import { Plus, FolderCog } from 'lucide-react'

const emptyMaterial: RawMaterial = { id: '', name: '', category: '', spec: '', unit: '', notes: '', box_unit: undefined, box_ratio: undefined }

export default function MaterialManager() {
  const { items, categories, add, update, remove, reorder, renameCategory, addCategory, removeCategory, reorderCategory } = useMaterialStore()
  const { showToast } = useToast()
  const [showCatManager, setShowCatManager] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RawMaterial | null>(null)
  const [form, setForm] = useState<RawMaterial>(emptyMaterial)
  const [filterCat, setFilterCat] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<RawMaterial | null>(null)

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach((c) => { counts[c] = items.filter((m) => m.category === c).length })
    return counts
  }, [items, categories])

  const filteredItems = filterCat ? items.filter((m) => m.category === filterCat) : items

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyMaterial, id: `m${Date.now()}` })
    setModalOpen(true)
  }

  const openEdit = (item: RawMaterial) => {
    setEditing(item)
    setForm({ ...item })
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim() || !form.category || !form.unit.trim()) {
      showToast('請填寫品名、分類、單位', 'error')
      return
    }
    if (editing) {
      update(editing.id, form)
      showToast('原物料已更新')
    } else {
      add(form)
      showToast('原物料已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (item: RawMaterial) => setDeleteConfirm(item)

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove(deleteConfirm.id)
      showToast('原物料已刪除')
      setDeleteConfirm(null)
    }
  }

  const categoryOptions = categories.map((c) => ({ value: c, label: c }))

  return (
    <div className="page-container">
      <TopNav title="央廚原物料管理" backTo="/admin" />

      {/* Category manager toggle */}
      <div className="px-4 pt-3 pb-1 flex justify-end">
        <button
          onClick={() => setShowCatManager(!showCatManager)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            showCatManager ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'
          }`}
        >
          <FolderCog size={13} />
          管理分類
        </button>
      </div>

      {showCatManager && (
        <div className="mx-4 mb-2 rounded-card overflow-hidden border border-gray-200">
          <CategoryManager
            categories={[...categories]}
            itemCounts={catCounts}
            onRename={renameCategory}
            onAdd={addCategory}
            onRemove={removeCategory}
            onReorder={reorderCategory}
            label="分類"
          />
        </div>
      )}

      {/* Filter */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterCat('')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterCat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'}`}
          >
            全部 ({items.length})
          </button>
          {categories.map((cat) => {
            const count = items.filter((m) => m.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCat === cat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'}`}
              >
                {cat.replace(/\/.*/, '')} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {filterCat ? (
        <AdminTable
          items={filteredItems}
          columns={[
            {
              key: 'name',
              label: '品名',
              render: (m) => (
                <div>
                  <p className="text-sm font-medium text-brand-oak">{m.name}</p>
                  <p className="text-[10px] text-brand-lotus">{m.spec ? m.spec : m.unit}{m.box_unit && m.box_ratio ? ` (1${m.box_unit}=${m.box_ratio}${m.unit})` : ''}{m.notes ? ` · ${m.notes}` : ''}</p>
                </div>
              ),
            },
          ]}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveUp={(idx) => {
            if (idx > 0) reorder(items.indexOf(filteredItems[idx]), items.indexOf(filteredItems[idx - 1]))
          }}
          onMoveDown={(idx) => {
            if (idx < filteredItems.length - 1) reorder(items.indexOf(filteredItems[idx]), items.indexOf(filteredItems[idx + 1]))
          }}
        />
      ) : (
        categories.map((cat) => {
          const catItems = items.filter((m) => m.category === cat)
          if (catItems.length === 0) return null
          return (
            <div key={cat}>
              <SectionHeader title={cat} icon="■" />
              <AdminTable
                items={catItems}
                columns={[
                  {
                    key: 'name',
                    label: '品名',
                    render: (m) => (
                      <div>
                        <p className="text-sm font-medium text-brand-oak">{m.name}</p>
                        <p className="text-[10px] text-brand-lotus">{m.spec ? m.spec : m.unit}{m.box_unit && m.box_ratio ? ` (1${m.box_unit}=${m.box_ratio}${m.unit})` : ''}{m.notes ? ` · ${m.notes}` : ''}</p>
                      </div>
                    ),
                  },
                ]}
                onEdit={openEdit}
                onDelete={handleDelete}
                onMoveUp={(idx) => {
                  if (idx > 0) reorder(items.indexOf(catItems[idx]), items.indexOf(catItems[idx - 1]))
                }}
                onMoveDown={(idx) => {
                  if (idx < catItems.length - 1) reorder(items.indexOf(catItems[idx]), items.indexOf(catItems[idx + 1]))
                }}
              />
            </div>
          )
        })
      )}

      <BottomAction label="新增原物料" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯原物料' : '新增原物料'} onSubmit={handleSubmit}>
        <ModalField label="品名">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：綠豆(天鶴牌)" />
        </ModalField>
        <ModalField label="分類">
          <ModalSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categoryOptions} placeholder="請選擇分類" />
        </ModalField>
        <ModalField label="規格">
          <ModalInput value={form.spec} onChange={(v) => setForm({ ...form, spec: v })} placeholder="例：50斤/袋" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="例：袋、包、箱" />
        </ModalField>
        <ModalField label="箱入單位">
          <ModalInput value={form.box_unit ?? ''} onChange={(v) => setForm({ ...form, box_unit: v || undefined })} placeholder="例：箱（留空表示無箱規）" />
        </ModalField>
        <ModalField label="箱入數量">
          <ModalInput value={form.box_ratio ? String(form.box_ratio) : ''} onChange={(v) => setForm({ ...form, box_ratio: parseInt(v) || undefined })} placeholder="例：6（1箱=6袋）" />
        </ModalField>
        <ModalField label="備註">
          <ModalInput value={form.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} placeholder="選填" />
        </ModalField>
      </AdminModal>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除「{deleteConfirm.name}」嗎？此操作無法復原。</p>
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
