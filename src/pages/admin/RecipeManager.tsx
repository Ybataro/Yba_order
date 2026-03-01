import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { RecipeIngredientEditor } from '@/components/RecipeIngredientEditor'
import { useToast } from '@/components/Toast'
import { useCostStore } from '@/stores/useCostStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getRecipeCost } from '@/lib/costAnalysis'
import type { Recipe, RecipeIngredient } from '@/lib/costAnalysis'
import { Plus, ChevronDown, Trash2, Edit3 } from 'lucide-react'

export default function RecipeManager() {
  const { recipes, addRecipe, updateRecipe, removeRecipe, setRecipeIngredients } = useCostStore()
  const materials = useMaterialStore((s) => s.items)
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [form, setForm] = useState({ name: '', unit: '盒', total_weight_g: '', solid_weight_g: '', liquid_weight_g: '', notes: '' })
  const [formIngredients, setFormIngredients] = useState<RecipeIngredient[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Recipe | null>(null)

  const materialsMap = useMemo(() => {
    const m = new Map<string, typeof materials[0]>()
    materials.forEach((mat) => m.set(mat.id, mat))
    return m
  }, [materials])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', unit: '盒', total_weight_g: '', solid_weight_g: '', liquid_weight_g: '', notes: '' })
    setFormIngredients([])
    setModalOpen(true)
  }

  const openEdit = (recipe: Recipe) => {
    setEditing(recipe)
    setForm({
      name: recipe.name,
      unit: recipe.unit,
      total_weight_g: recipe.total_weight_g ? String(recipe.total_weight_g) : '',
      solid_weight_g: recipe.solid_weight_g ? String(recipe.solid_weight_g) : '',
      liquid_weight_g: recipe.liquid_weight_g ? String(recipe.liquid_weight_g) : '',
      notes: recipe.notes,
    })
    setFormIngredients([...recipe.ingredients])
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      showToast('請填寫配方名稱', 'error')
      return
    }
    const totalWeight = parseFloat(form.total_weight_g) || 0

    if (editing) {
      updateRecipe(editing.id, {
        name: form.name.trim(),
        unit: form.unit,
        total_weight_g: totalWeight,
        solid_weight_g: parseFloat(form.solid_weight_g) || null,
        liquid_weight_g: parseFloat(form.liquid_weight_g) || null,
        notes: form.notes,
      })
      setRecipeIngredients(editing.id, formIngredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
      showToast('配方已更新')
    } else {
      const newId = `recipe_${Date.now()}`
      const ings = formIngredients.map((ing, i) => ({ ...ing, recipe_id: newId, sort_order: i }))
      addRecipe({
        id: newId,
        name: form.name.trim(),
        unit: form.unit,
        total_weight_g: totalWeight,
        solid_weight_g: parseFloat(form.solid_weight_g) || null,
        liquid_weight_g: parseFloat(form.liquid_weight_g) || null,
        store_product_id: null,
        notes: form.notes,
        sort_order: recipes.length,
        ingredients: ings,
      })
      showToast('配方已新增')
    }
    setModalOpen(false)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      removeRecipe(deleteConfirm.id)
      showToast('配方已刪除')
      setDeleteConfirm(null)
    }
  }

  return (
    <div className="page-container">
      <TopNav title="成品配方管理" backTo="/admin" />

      <div className="px-4 py-3 space-y-3">
        {recipes.length === 0 && (
          <div className="text-center py-12 text-sm text-brand-lotus">尚無配方，點下方按鈕新增</div>
        )}

        {recipes.map((recipe) => {
          const { totalCost, costPerG, details } = getRecipeCost(recipe, materialsMap)
          const isOpen = expandedId === recipe.id

          return (
            <div key={recipe.id} className="card !p-0 overflow-hidden">
              {/* Header */}
              <button
                onClick={() => setExpandedId(isOpen ? null : recipe.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-oak">{recipe.name}</p>
                  <p className="text-[10px] text-brand-lotus">
                    {recipe.total_weight_g}g/{recipe.unit}
                    {costPerG != null && ` · $${costPerG.toFixed(4)}/g`}
                    {' · '}總成本 ${totalCost.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => { e.stopPropagation(); openEdit(recipe) }} className="p-1.5 text-brand-lotus hover:text-brand-oak">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(recipe) }} className="p-1.5 text-status-danger/60 hover:text-status-danger">
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={16} className={`text-brand-lotus transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Details */}
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                  {details.map((d, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-brand-lotus">{d.name} × {d.amountG}g</span>
                      <span className="text-brand-oak">{d.subtotal != null ? `$${d.subtotal.toFixed(2)}` : '—'}</span>
                    </div>
                  ))}
                  {recipe.notes && (
                    <p className="text-[10px] text-brand-lotus mt-1">備註：{recipe.notes}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <BottomAction label="新增配方" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯配方' : '新增配方'} onSubmit={handleSubmit}>
        <ModalField label="配方名稱">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：紅豆配料" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="例：盒、鍋" />
        </ModalField>
        <ModalField label="總重量（g）">
          <ModalInput value={form.total_weight_g} onChange={(v) => setForm({ ...form, total_weight_g: v })} placeholder="例：2000" />
        </ModalField>
        <div className="grid grid-cols-2 gap-3">
          <ModalField label="固體重（g）">
            <ModalInput value={form.solid_weight_g} onChange={(v) => setForm({ ...form, solid_weight_g: v })} placeholder="選填" />
          </ModalField>
          <ModalField label="湯汁重（g）">
            <ModalInput value={form.liquid_weight_g} onChange={(v) => setForm({ ...form, liquid_weight_g: v })} placeholder="選填" />
          </ModalField>
        </div>
        <ModalField label="備註">
          <ModalInput value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="選填" />
        </ModalField>

        <RecipeIngredientEditor
          ingredients={formIngredients}
          onChange={setFormIngredients}
          recipeId={editing?.id ?? 'new'}
        />
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
