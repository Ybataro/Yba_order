import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminTable } from '@/components/AdminTable'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { CategoryManager } from '@/components/CategoryManager'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useFrozenProductStore } from '@/stores/useFrozenProductStore'
import type { StoreProduct, VisibleIn } from '@/data/storeProducts'
import type { FrozenProduct } from '@/lib/frozenProducts'
import { Plus, FolderCog, Snowflake } from 'lucide-react'

const emptyProduct: StoreProduct = { id: '', name: '', category: '', unit: '', shelfLifeDays: '', baseStock: '', ourCost: 0, franchisePrice: 0, visibleIn: 'both', linkable: false, linkedInventoryIds: [] }

const visibleInOptions: { value: VisibleIn; label: string }[] = [
  { value: 'both', label: '盤點＋叫貨' },
  { value: 'inventory_only', label: '僅盤點' },
  { value: 'order_only', label: '僅叫貨' },
]

const emptyFrozen: FrozenProduct = { key: '', name: '', spec: '', price: 0 }

export default function ProductManager() {
  const { items, categories, add, update, remove, reorder, renameCategory, addCategory, removeCategory, reorderCategory } = useProductStore()
  const frozenStore = useFrozenProductStore()
  const { showToast } = useToast()
  const [showCatManager, setShowCatManager] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StoreProduct | null>(null)
  const [form, setForm] = useState<StoreProduct>(emptyProduct)
  const [filterCat, setFilterCat] = useState<string>('')
  const [deleteConfirm, setDeleteConfirm] = useState<StoreProduct | null>(null)

  // Frozen product state
  const [frozenModalOpen, setFrozenModalOpen] = useState(false)
  const [frozenEditing, setFrozenEditing] = useState<FrozenProduct | null>(null)
  const [frozenForm, setFrozenForm] = useState<FrozenProduct>(emptyFrozen)
  const [frozenDeleteConfirm, setFrozenDeleteConfirm] = useState<FrozenProduct | null>(null)

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach((c) => { counts[c] = items.filter((p) => p.category === c).length })
    return counts
  }, [items, categories])

  const filteredItems = filterCat ? items.filter((p) => p.category === filterCat) : items

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyProduct, id: `p${Date.now()}` })
    setModalOpen(true)
  }

  const openEdit = (item: StoreProduct) => {
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
      showToast('品項已更新')
    } else {
      add(form)
      showToast('品項已新增')
    }
    setModalOpen(false)
  }

  const handleDelete = (item: StoreProduct) => {
    setDeleteConfirm(item)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      remove(deleteConfirm.id)
      showToast('品項已刪除')
      setDeleteConfirm(null)
    }
  }

  const handleMoveUp = (idx: number) => {
    if (idx > 0) {
      const globalFrom = items.indexOf(filteredItems[idx])
      const globalTo = items.indexOf(filteredItems[idx - 1])
      reorder(globalFrom, globalTo)
    }
  }

  const handleMoveDown = (idx: number) => {
    if (idx < filteredItems.length - 1) {
      const globalFrom = items.indexOf(filteredItems[idx])
      const globalTo = items.indexOf(filteredItems[idx + 1])
      reorder(globalFrom, globalTo)
    }
  }

  const linkableProducts = useMemo(() =>
    items.filter(p => p.linkable),
    [items]
  )

  const categoryOptions = categories.map((c) => ({ value: c, label: c }))

  // Frozen product handlers
  const frozenItems = useMemo(() =>
    frozenStore.items.map(p => ({ ...p, id: p.key })),
    [frozenStore.items]
  )

  const openFrozenAdd = () => {
    setFrozenEditing(null)
    setFrozenForm({ ...emptyFrozen, key: `f${Date.now()}` })
    setFrozenModalOpen(true)
  }

  const openFrozenEdit = (item: FrozenProduct & { id: string }) => {
    const fp = { key: item.key, name: item.name, spec: item.spec, price: item.price }
    setFrozenEditing(fp)
    setFrozenForm({ ...fp })
    setFrozenModalOpen(true)
  }

  const handleFrozenSubmit = () => {
    if (!frozenForm.name.trim() || !frozenForm.spec.trim()) {
      showToast('請填寫品名和規格', 'error')
      return
    }
    if (frozenEditing) {
      frozenStore.update(frozenEditing.key, frozenForm)
      showToast('冷凍品已更新')
    } else {
      frozenStore.add(frozenForm)
      showToast('冷凍品已新增')
    }
    setFrozenModalOpen(false)
  }

  const confirmFrozenDelete = () => {
    if (frozenDeleteConfirm) {
      frozenStore.remove(frozenDeleteConfirm.key)
      showToast('冷凍品已刪除')
      setFrozenDeleteConfirm(null)
    }
  }

  return (
    <div className="page-container">
      <TopNav title="門店品項管理" backTo="/admin" />

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
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !filterCat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'
            }`}
          >
            全部 ({items.length})
          </button>
          {categories.map((cat) => {
            const count = items.filter((p) => p.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterCat === cat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'
                }`}
              >
                {cat.replace(/（.+）/, '')} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Category sections or flat list */}
      {filterCat ? (
        <AdminTable
          items={filteredItems}
          columns={[
            {
              key: 'name',
              label: '品名',
              render: (p) => (
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-brand-oak">{p.name}</p>
                    {p.visibleIn && p.visibleIn !== 'both' && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${p.visibleIn === 'inventory_only' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.visibleIn === 'inventory_only' ? '僅盤點' : '僅叫貨'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-brand-lotus">{p.unit}{p.shelfLifeDays ? ` · 期效${p.shelfLifeDays}` : ''}</p>
                </div>
              ),
            },
          ]}
          onEdit={openEdit}
          onDelete={handleDelete}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
        />
      ) : (
        categories.map((cat) => {
          const catItems = items.filter((p) => p.category === cat)
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
                    render: (p) => (
                      <div>
                        <p className="text-sm font-medium text-brand-oak">{p.name}</p>
                        <p className="text-[10px] text-brand-lotus">{p.unit}{p.shelfLifeDays ? ` · 期效${p.shelfLifeDays}` : ''}</p>
                      </div>
                    ),
                  },
                ]}
                onEdit={openEdit}
                onDelete={handleDelete}
                onMoveUp={(idx) => {
                  const globalIdx = items.indexOf(catItems[idx])
                  if (idx > 0) reorder(globalIdx, items.indexOf(catItems[idx - 1]))
                }}
                onMoveDown={(idx) => {
                  const globalIdx = items.indexOf(catItems[idx])
                  if (idx < catItems.length - 1) reorder(globalIdx, items.indexOf(catItems[idx + 1]))
                }}
              />
            </div>
          )
        })
      )}

      <BottomAction label="新增品項" onClick={openAdd} icon={<Plus size={18} />} />

      {/* Add/Edit Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '編輯品項' : '新增品項'}
        onSubmit={handleSubmit}
      >
        <ModalField label="品名">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：紅豆" />
        </ModalField>
        <ModalField label="分類">
          <ModalSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categoryOptions} placeholder="請選擇分類" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="例：盒、袋、桶" />
        </ModalField>
        <ModalField label="保存期限">
          <ModalInput value={String(form.shelfLifeDays ?? '')} onChange={(v) => setForm({ ...form, shelfLifeDays: v })} placeholder="例：7 或 冷凍45天" />
        </ModalField>
        <ModalField label="基準庫存">
          <ModalInput value={form.baseStock ?? ''} onChange={(v) => setForm({ ...form, baseStock: v })} placeholder="例：2盒/2天" />
        </ModalField>
        <ModalField label="我們價格">
          <ModalInput value={String(form.ourCost || '')} onChange={(v) => setForm({ ...form, ourCost: parseFloat(v) || 0 })} placeholder="例：50" />
        </ModalField>
        <ModalField label="加盟價格">
          <ModalInput value={String(form.franchisePrice || '')} onChange={(v) => setForm({ ...form, franchisePrice: parseFloat(v) || 0 })} placeholder="例：65" />
        </ModalField>
        <ModalField label="顯示範圍">
          <ModalSelect
            value={form.visibleIn || 'both'}
            onChange={(v) => setForm({ ...form, visibleIn: v as VisibleIn })}
            options={visibleInOptions}
          />
        </ModalField>
        <ModalField label="可被關聯">
          <label className="flex items-center gap-2 text-sm text-brand-oak cursor-pointer">
            <input
              type="checkbox"
              checked={form.linkable || false}
              onChange={(e) => setForm({ ...form, linkable: e.target.checked })}
              className="rounded border-gray-300"
            />
            允許其他品項關聯此品項的庫存
          </label>
        </ModalField>
        {linkableProducts.filter(p => p.id !== form.id).length > 0 && (
          <ModalField label="關聯盤點品項">
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {linkableProducts.filter(p => p.id !== form.id).map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-brand-oak cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.linkedInventoryIds?.includes(p.id) || false}
                    onChange={(e) => {
                      const ids = form.linkedInventoryIds || []
                      setForm({
                        ...form,
                        linkedInventoryIds: e.target.checked
                          ? [...ids, p.id]
                          : ids.filter(id => id !== p.id),
                      })
                    }}
                    className="rounded border-gray-300"
                  />
                  {p.name} <span className="text-xs text-brand-lotus">({p.unit})</span>
                </label>
              ))}
            </div>
          </ModalField>
        )}
      </AdminModal>

      {/* Delete Confirm */}
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

      {/* ─── 冷凍品管理 ─── */}
      <div className="mt-6">
        <SectionHeader title={`冷凍品 (${frozenItems.length})`} icon="■" />
        <AdminTable
          items={frozenItems}
          columns={[
            {
              key: 'name',
              label: '品名',
              render: (p) => (
                <div>
                  <p className="text-sm font-medium text-brand-oak">{p.name}</p>
                  <p className="text-[10px] text-brand-lotus">{p.spec} · ${p.price}</p>
                </div>
              ),
            },
          ]}
          onEdit={openFrozenEdit}
          onDelete={(item) => setFrozenDeleteConfirm({ key: item.key, name: item.name, spec: item.spec, price: item.price })}
          onMoveUp={(idx) => { if (idx > 0) frozenStore.reorder(idx, idx - 1) }}
          onMoveDown={(idx) => { if (idx < frozenItems.length - 1) frozenStore.reorder(idx, idx + 1) }}
        />
        <div className="px-4 py-3">
          <button
            onClick={openFrozenAdd}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-btn border-2 border-dashed border-brand-lotus/30 text-brand-lotus text-sm font-medium active:bg-brand-lotus/5"
          >
            <Snowflake size={16} />
            新增冷凍品
          </button>
        </div>
      </div>

      {/* Frozen Add/Edit Modal */}
      <AdminModal
        open={frozenModalOpen}
        onClose={() => setFrozenModalOpen(false)}
        title={frozenEditing ? '編輯冷凍品' : '新增冷凍品'}
        onSubmit={handleFrozenSubmit}
      >
        <ModalField label="品名">
          <ModalInput value={frozenForm.name} onChange={(v) => setFrozenForm({ ...frozenForm, name: v })} placeholder="例：芋圓" />
        </ModalField>
        <ModalField label="規格">
          <ModalInput value={frozenForm.spec} onChange={(v) => setFrozenForm({ ...frozenForm, spec: v })} placeholder="例：包 300g" />
        </ModalField>
        <ModalField label="售價">
          <ModalInput value={String(frozenForm.price || '')} onChange={(v) => setFrozenForm({ ...frozenForm, price: parseInt(v) || 0 })} placeholder="例：135" />
        </ModalField>
      </AdminModal>

      {/* Frozen Delete Confirm */}
      {frozenDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setFrozenDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除冷凍品「{frozenDeleteConfirm.name}」嗎？此操作無法復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setFrozenDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={confirmFrozenDelete} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
