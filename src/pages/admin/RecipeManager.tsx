import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { RecipeIngredientEditor } from '@/components/RecipeIngredientEditor'
import { useToast } from '@/components/Toast'
import { useCostStore } from '@/stores/useCostStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getRecipeCost, SERVING_UNIT_OPTIONS } from '@/lib/costAnalysis'
import type { Recipe, RecipeIngredient, ServingUnit } from '@/lib/costAnalysis'
import { Plus, ChevronDown, ChevronUp, Trash2, Edit3, Settings, Copy } from 'lucide-react'

export default function RecipeManager() {
  const {
    recipes, addRecipe, updateRecipe, removeRecipe, setRecipeIngredients,
    recipeCategories, addRecipeCategory, renameRecipeCategory, deleteRecipeCategory,
    reorderRecipeCategories, reorderRecipe,
  } = useCostStore()
  const materials = useMaterialStore((s) => s.items)
  const { showToast } = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [form, setForm] = useState({ name: '', unit: '盒', total_weight_g: '', solid_weight_g: '', liquid_weight_g: '', notes: '', category: '未分類' })
  const [formIngredients, setFormIngredients] = useState<RecipeIngredient[]>([])
  const [formServingUnits, setFormServingUnits] = useState<ServingUnit[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Recipe | null>(null)
  const [catManageOpen, setCatManageOpen] = useState(false)
  const [renamingCat, setRenamingCat] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const materialsMap = useMemo(() => {
    const m = new Map<string, typeof materials[0]>()
    materials.forEach((mat) => m.set(mat.id, mat))
    return m
  }, [materials])

  // 按分類分組配方
  const groupedRecipes = useMemo(() => {
    const map = new Map<string, Recipe[]>()
    for (const cat of recipeCategories) {
      map.set(cat, recipes.filter((r) => r.category === cat).sort((a, b) => a.sort_order - b.sort_order))
    }
    // 如果有配方的分類不在列表中（DB 資料不一致），歸入未分類
    const knownCats = new Set(recipeCategories)
    const orphans = recipes.filter((r) => !knownCats.has(r.category))
    if (orphans.length > 0) {
      const existing = map.get('未分類') ?? []
      map.set('未分類', [...existing, ...orphans].sort((a, b) => a.sort_order - b.sort_order))
    }
    return map
  }, [recipes, recipeCategories])

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', unit: '盒', total_weight_g: '', solid_weight_g: '', liquid_weight_g: '', notes: '', category: recipeCategories[0] ?? '未分類' })
    setFormIngredients([])
    setFormServingUnits([])
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
      category: recipe.category,
    })
    setFormIngredients([...recipe.ingredients])
    setFormServingUnits([...(recipe.serving_units ?? [])])
    setModalOpen(true)
  }

  const handleSubmit = () => {
    if (!form.name.trim()) {
      showToast('請填寫配方名稱', 'error')
      return
    }
    const totalWeight = parseFloat(form.total_weight_g) || 0

    const validUnits = formServingUnits.filter((u) => u.label && u.grams > 0)

    if (editing) {
      updateRecipe(editing.id, {
        name: form.name.trim(),
        unit: form.unit,
        total_weight_g: totalWeight,
        solid_weight_g: parseFloat(form.solid_weight_g) || null,
        liquid_weight_g: parseFloat(form.liquid_weight_g) || null,
        notes: form.notes,
        serving_units: validUnits,
        category: form.category,
      })
      setRecipeIngredients(editing.id, formIngredients.map((ing, i) => ({ ...ing, recipe_id: editing.id, sort_order: i })))
      showToast('配方已更新')
    } else {
      const newId = `recipe_${Date.now()}`
      const ings = formIngredients.map((ing, i) => ({ ...ing, recipe_id: newId, sort_order: i }))
      const sameCat = recipes.filter((r) => r.category === form.category)
      const maxSort = sameCat.length > 0 ? Math.max(...sameCat.map((r) => r.sort_order)) + 1 : 0
      addRecipe({
        id: newId,
        name: form.name.trim(),
        unit: form.unit,
        total_weight_g: totalWeight,
        solid_weight_g: parseFloat(form.solid_weight_g) || null,
        liquid_weight_g: parseFloat(form.liquid_weight_g) || null,
        store_product_id: null,
        notes: form.notes,
        sort_order: maxSort,
        serving_units: validUnits,
        category: form.category,
        ingredients: ings,
      })
      showToast('配方已新增')
    }
    setModalOpen(false)
  }

  const duplicateRecipe = (recipe: Recipe) => {
    const newId = `recipe_${Date.now()}`
    const sameCat = recipes.filter((r) => r.category === recipe.category)
    const maxSort = sameCat.length > 0 ? Math.max(...sameCat.map((r) => r.sort_order)) + 1 : 0
    const newIngs = recipe.ingredients.map((ing, i) => ({
      ...ing,
      id: `ri_${Date.now()}_${i}`,
      recipe_id: newId,
      sort_order: i,
    }))
    addRecipe({
      ...recipe,
      id: newId,
      name: `${recipe.name}複製`,
      sort_order: maxSort,
      serving_units: recipe.serving_units ? [...recipe.serving_units] : [],
      ingredients: newIngs,
    })
    showToast(`已複製「${recipe.name}」`)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      removeRecipe(deleteConfirm.id)
      showToast('配方已刪除')
      setDeleteConfirm(null)
    }
  }

  const handleAddCategory = () => {
    const name = prompt('請輸入分類名稱')
    if (!name?.trim()) return
    if (recipeCategories.includes(name.trim())) {
      showToast('分類已存在', 'error')
      return
    }
    addRecipeCategory(name.trim())
    showToast('分類已新增')
  }

  const handleRenameCategory = (oldName: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingCat(null)
      return
    }
    if (recipeCategories.includes(renameValue.trim())) {
      showToast('分類名稱已存在', 'error')
      return
    }
    renameRecipeCategory(oldName, renameValue.trim())
    setRenamingCat(null)
    showToast('分類已重新命名')
  }

  const handleDeleteCategory = (name: string) => {
    if (name === '未分類') {
      showToast('無法刪除「未分類」', 'error')
      return
    }
    if (!confirm(`確定要刪除「${name}」？該分類下的配方將移入「未分類」`)) return
    deleteRecipeCategory(name)
    showToast('分類已刪除')
  }

  return (
    <div className="page-container">
      <TopNav title="成品配方管理" backTo="/admin" />

      {/* 頂部操作列 */}
      <div className="px-4 pt-3 flex gap-2">
        <button onClick={handleAddCategory} className="flex items-center gap-1 h-8 px-3 rounded-btn text-xs font-medium text-white bg-brand-taro active:opacity-80">
          <Plus size={14} /> 新增分類
        </button>
        <button onClick={() => setCatManageOpen(!catManageOpen)} className="flex items-center gap-1 h-8 px-3 rounded-btn text-xs font-medium text-brand-oak border border-gray-200 active:bg-gray-50">
          <Settings size={14} /> 管理分類
        </button>
      </div>

      {/* 分類管理面板 */}
      {catManageOpen && (
        <div className="mx-4 mt-2 p-3 rounded-card border border-gray-200 bg-surface-section space-y-1.5">
          <p className="text-xs font-semibold text-brand-oak mb-1">分類排序與管理</p>
          {recipeCategories.map((cat, idx) => (
            <div key={cat} className="flex items-center gap-1.5 bg-white rounded-input px-2 py-1.5">
              {renamingCat === cat ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRenameCategory(cat)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRenameCategory(cat); if (e.key === 'Escape') setRenamingCat(null) }}
                  className="flex-1 h-7 px-2 text-xs border border-brand-taro rounded-input"
                />
              ) : (
                <span className="flex-1 text-xs text-brand-oak truncate">{cat}</span>
              )}
              <button
                onClick={() => { if (idx > 0) reorderRecipeCategories(idx, idx - 1) }}
                disabled={idx === 0}
                className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => { if (idx < recipeCategories.length - 1) reorderRecipeCategories(idx, idx + 1) }}
                disabled={idx === recipeCategories.length - 1}
                className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
              {cat !== '未分類' && (
                <>
                  <button
                    onClick={() => { setRenamingCat(cat); setRenameValue(cat) }}
                    className="p-1 text-brand-lotus hover:text-brand-oak"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="p-1 text-status-danger/60 hover:text-status-danger"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 配方列表（按分類分組） */}
      <div className="px-4 py-3 space-y-4">
        {recipes.length === 0 && (
          <div className="text-center py-12 text-sm text-brand-lotus">尚無配方，點下方按鈕新增</div>
        )}

        {recipeCategories.map((cat, catIdx) => {
          const catRecipes = groupedRecipes.get(cat) ?? []
          if (catRecipes.length === 0 && recipes.length > 0) return null

          return (
            <div key={cat}>
              {/* 分類標題 */}
              {recipes.length > 0 && (
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-xs font-bold text-brand-taro">{cat}</span>
                  <span className="text-[10px] text-brand-lotus">({catRecipes.length})</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => { if (catIdx > 0) reorderRecipeCategories(catIdx, catIdx - 1) }}
                    disabled={catIdx === 0}
                    className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => { if (catIdx < recipeCategories.length - 1) reorderRecipeCategories(catIdx, catIdx + 1) }}
                    disabled={catIdx === recipeCategories.length - 1}
                    className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              )}

              {/* 該分類下的配方 */}
              <div className="space-y-2">
                {catRecipes.map((recipe, rIdx) => {
                  const { totalCost, costPerG, details } = getRecipeCost(recipe, materialsMap)
                  const isOpen = expandedId === recipe.id

                  return (
                    <div key={recipe.id} className="card !p-0 overflow-hidden">
                      {/* Header */}
                      <button
                        onClick={() => setExpandedId(isOpen ? null : recipe.id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand-oak">{recipe.name}</p>
                          <p className="text-[10px] text-brand-lotus">
                            {recipe.total_weight_g}g/{recipe.unit}
                            {costPerG != null && ` · $${costPerG.toFixed(4)}/g`}
                            {' · '}總成本 ${totalCost.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); reorderRecipe(recipe.id, 'up') }}
                            disabled={rIdx === 0}
                            className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); reorderRecipe(recipe.id, 'down') }}
                            disabled={rIdx === catRecipes.length - 1}
                            className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openEdit(recipe) }} className="p-1.5 text-brand-lotus hover:text-brand-oak">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); duplicateRecipe(recipe) }} className="p-1.5 text-brand-lotus hover:text-brand-oak">
                            <Copy size={14} />
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
                          {recipe.serving_units?.length > 0 && (
                            <p className="text-[10px] text-brand-lotus mt-1">
                              份量：{recipe.serving_units.map((u) => `${u.label}=${u.grams}g`).join('、')}
                            </p>
                          )}
                          {recipe.notes && (
                            <p className="text-[10px] text-brand-lotus mt-1">備註：{recipe.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <BottomAction label="新增配方" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯配方' : '新增配方'} onSubmit={handleSubmit}>
        <ModalField label="配方名稱">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：紅豆配料" />
        </ModalField>
        <ModalField label="分類">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full h-9 rounded-input px-3 text-sm border border-gray-200 bg-white text-brand-oak"
          >
            {recipeCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
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

        {/* 份量單位定義 */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-brand-oak">份量單位定義</span>
          {formServingUnits.map((su, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <select
                value={su.label}
                onChange={(e) => {
                  const arr = [...formServingUnits]
                  arr[idx] = { ...arr[idx], label: e.target.value }
                  setFormServingUnits(arr)
                }}
                className="flex-1 h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
              >
                <option value="">選擇單位</option>
                {SERVING_UNIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <input
                type="number"
                value={su.grams || ''}
                onChange={(e) => {
                  const arr = [...formServingUnits]
                  arr[idx] = { ...arr[idx], grams: parseFloat(e.target.value) || 0 }
                  setFormServingUnits(arr)
                }}
                placeholder="克數"
                className="w-20 h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
              />
              <span className="text-[10px] text-brand-lotus">g</span>
              <button
                onClick={() => setFormServingUnits(formServingUnits.filter((_, i) => i !== idx))}
                className="p-1 text-status-danger/70 hover:text-status-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setFormServingUnits([...formServingUnits, { label: '', grams: 0 }])}
            className="w-full flex items-center justify-center gap-1 h-8 rounded-card border border-dashed border-gray-300 text-xs text-brand-lotus hover:bg-surface-section"
          >
            <Plus size={14} /> 新增份量單位
          </button>
        </div>

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
