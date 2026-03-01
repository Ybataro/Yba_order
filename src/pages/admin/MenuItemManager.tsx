import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { MenuIngredientEditor } from '@/components/MenuIngredientEditor'
import { useToast } from '@/components/Toast'
import { useCostStore } from '@/stores/useCostStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getMenuItemCost } from '@/lib/costAnalysis'
import type { MenuItem, MenuItemIngredient } from '@/lib/costAnalysis'
import { Plus, ChevronDown, Trash2, Edit3 } from 'lucide-react'

export default function MenuItemManager() {
  const { recipes, menuItems, addMenuItem, updateMenuItem, removeMenuItem, setMenuItemIngredients } = useCostStore()
  const materials = useMaterialStore((s) => s.items)
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [form, setForm] = useState({ name: '', selling_price: '', serving_g: '', notes: '' })
  const [formIngredients, setFormIngredients] = useState<MenuItemIngredient[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null)

  const materialsMap = useMemo(() => {
    const m = new Map<string, typeof materials[0]>()
    materials.forEach((mat) => m.set(mat.id, mat))
    return m
  }, [materials])

  const recipesMap = useMemo(() => {
    const m = new Map<string, typeof recipes[0]>()
    recipes.forEach((r) => m.set(r.id, r))
    return m
  }, [recipes])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', selling_price: '', serving_g: '', notes: '' })
    setFormIngredients([])
    setModalOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setForm({
      name: item.name,
      selling_price: item.selling_price ? String(item.selling_price) : '',
      serving_g: item.serving_g ? String(item.serving_g) : '',
      notes: item.notes,
    })
    setFormIngredients([...item.ingredients])
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      showToast('請填寫販售品名稱', 'error')
      return
    }

    if (editing) {
      updateMenuItem(editing.id, {
        name: form.name.trim(),
        selling_price: parseFloat(form.selling_price) || 0,
        serving_g: parseFloat(form.serving_g) || null,
        notes: form.notes,
      })
      setMenuItemIngredients(editing.id, formIngredients.map((ing, i) => ({ ...ing, menu_item_id: editing.id, sort_order: i })))
      showToast('販售品已更新')
    } else {
      const newId = `menu_${Date.now()}`
      const ings = formIngredients.map((ing, i) => ({ ...ing, menu_item_id: newId, sort_order: i }))
      addMenuItem({
        id: newId,
        name: form.name.trim(),
        selling_price: parseFloat(form.selling_price) || 0,
        serving_g: parseFloat(form.serving_g) || null,
        notes: form.notes,
        sort_order: menuItems.length,
        ingredients: ings,
      })
      showToast('販售品已新增')
    }
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      removeMenuItem(deleteConfirm.id)
      showToast('販售品已刪除')
      setDeleteConfirm(null)
    }
  }

  // Calculate live cost for form preview
  const formCost = useMemo(() => {
    const tempItem: MenuItem = {
      id: 'preview',
      name: '',
      selling_price: parseFloat(form.selling_price) || 0,
      notes: '',
      sort_order: 0,
      ingredients: formIngredients,
    }
    return getMenuItemCost(tempItem, recipesMap, materialsMap)
  }, [form.selling_price, formIngredients, recipesMap, materialsMap])

  return (
    <div className="page-container">
      <TopNav title="販售品管理" backTo="/admin" />

      <div className="px-4 py-3 space-y-3">
        {menuItems.length === 0 && (
          <div className="text-center py-12 text-sm text-brand-lotus">尚無販售品，點下方按鈕新增</div>
        )}

        {menuItems.map((item) => {
          const { totalCost, profit, profitRate } = getMenuItemCost(item, recipesMap, materialsMap)
          const isOpen = expandedId === item.id
          const rateColor = profitRate >= 60 ? 'text-status-success' : profitRate >= 40 ? 'text-brand-amber' : 'text-status-danger'

          return (
            <div key={item.id} className="card !p-0 overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isOpen ? null : item.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-oak truncate">{item.name}</p>
                    <span className={`text-xs font-semibold ${rateColor}`}>{profitRate.toFixed(0)}%</span>
                  </div>
                  <p className="text-[10px] text-brand-lotus">
                    售價 ${item.selling_price} · 成本 ${totalCost.toFixed(1)} · 毛利 ${profit.toFixed(1)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(item) }} className="p-1.5 text-brand-lotus hover:text-brand-oak">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item) }} className="p-1.5 text-status-danger/60 hover:text-status-danger">
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={16} className={`text-brand-lotus transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Profit rate bar */}
              <div className="px-4 pb-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      profitRate >= 60 ? 'bg-status-success' : profitRate >= 40 ? 'bg-brand-amber' : 'bg-status-danger'
                    }`}
                    style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Details */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                  {(() => {
                    const { details } = getMenuItemCost(item, recipesMap, materialsMap)
                    return details.map((d, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-brand-lotus">{d.name} × {d.amountG}g</span>
                        <span className="text-brand-oak">{d.subtotal != null ? `$${d.subtotal.toFixed(2)}` : '—'}</span>
                      </div>
                    ))
                  })()}
                  {item.notes && (
                    <p className="text-[10px] text-brand-lotus mt-1">備註：{item.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <BottomAction label="新增販售品" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯販售品' : '新增販售品'} onSubmit={handleSubmit}>
        <ModalField label="品名">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：招牌蔗片冰" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="售價（元）">
            <ModalInput value={form.selling_price} onChange={(v) => setForm({ ...form, selling_price: v })} placeholder="例：65" />
          </ModalField>
          <ModalField label="份量（g）">
            <ModalInput value={form.serving_g} onChange={(v) => setForm({ ...form, serving_g: v })} placeholder="選填" />
          </ModalField>
        </div>
        <ModalField label="備註">
          <ModalInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="選填" />
        </ModalField>

        <MenuIngredientEditor
          ingredients={formIngredients}
          onChange={setFormIngredients}
          menuItemId={editing?.id ?? 'new'}
        />

        {/* Live cost preview */}
        {(parseFloat(form.selling_price) || 0) > 0 && (
          <div className="p-3 bg-surface-section rounded-card space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-brand-lotus">成本</span>
              <span className="text-brand-oak font-semibold">${formCost.totalCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-brand-lotus">毛利</span>
              <span className="text-brand-oak font-semibold">${formCost.profit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-brand-lotus">毛利率</span>
              <span className={`font-semibold ${formCost.profitRate >= 60 ? 'text-status-success' : formCost.profitRate >= 40 ? 'text-brand-amber' : 'text-status-danger'}`}>
                {formCost.profitRate.toFixed(1)}%
              </span>
            </div>
          </div>
        )}
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
