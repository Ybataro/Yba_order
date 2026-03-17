import { useState, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useSopStore } from '@/stores/useSopStore'
import type { SopRecipe, SopIngredient, SopStep } from '@/stores/useSopStore'
import { Plus, Edit3, Trash2, Clock, ChevronUp, ChevronDown } from 'lucide-react'

export default function SopDetail() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const {
    categories,
    addRecipe, updateRecipe, removeRecipe, swapRecipeOrder,
    addIngredient, updateIngredient, removeIngredient, swapIngredientOrder,
    addStep, updateStep, removeStep, swapStepOrder,
  } = useSopStore()
  const { showToast } = useToast()

  const category = categories.find((c) => c.id === categoryId)
  const recipes = category?.recipes ?? []

  // Selected recipe
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedRecipe = useMemo(() => {
    if (selectedId) return recipes.find((r) => r.id === selectedId) ?? recipes[0] ?? null
    return recipes[0] ?? null
  }, [recipes, selectedId])

  // Scroll ref for recipe tabs
  const tabsRef = useRef<HTMLDivElement>(null)

  // ── Recipe Modal ──
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState<SopRecipe | null>(null)
  const [recipeForm, setRecipeForm] = useState({ name: '', image_url: '', batch_sizes: '', notes: '' })

  const openAddRecipe = () => {
    setEditingRecipe(null)
    setRecipeForm({ name: '', image_url: '', batch_sizes: '1份', notes: '' })
    setRecipeModalOpen(true)
  }

  const openEditRecipe = (r: SopRecipe) => {
    setEditingRecipe(r)
    setRecipeForm({
      name: r.name,
      image_url: r.image_url,
      batch_sizes: r.batch_sizes.join(','),
      notes: r.notes,
    })
    setRecipeModalOpen(true)
  }

  const submitRecipe = () => {
    if (!recipeForm.name.trim()) { showToast('請填寫配方名稱', 'error'); return }
    const sizes = recipeForm.batch_sizes.split(',').map((s) => s.trim()).filter(Boolean)
    if (sizes.length === 0) sizes.push('1份')

    if (editingRecipe) {
      updateRecipe(editingRecipe.id, {
        name: recipeForm.name.trim(),
        image_url: recipeForm.image_url.trim(),
        batch_sizes: sizes,
        notes: recipeForm.notes.trim(),
      })
      showToast('配方已更新')
    } else {
      const newId = `sop_${Date.now()}`
      const maxSort = recipes.length > 0 ? Math.max(...recipes.map((r) => r.sort_order)) + 1 : 0
      addRecipe({
        id: newId,
        category_id: categoryId!,
        name: recipeForm.name.trim(),
        image_url: recipeForm.image_url.trim(),
        batch_sizes: sizes,
        notes: recipeForm.notes.trim(),
        sort_order: maxSort,
        is_active: true,
      })
      setSelectedId(newId)
      showToast('配方已新增')
    }
    setRecipeModalOpen(false)
  }

  const [deleteRecipeConfirm, setDeleteRecipeConfirm] = useState<SopRecipe | null>(null)
  const confirmDeleteRecipe = () => {
    if (deleteRecipeConfirm) {
      removeRecipe(deleteRecipeConfirm.id)
      if (selectedId === deleteRecipeConfirm.id) setSelectedId(null)
      showToast('配方已刪除')
      setDeleteRecipeConfirm(null)
    }
  }

  // ── Ingredient Modal ──
  const [ingModalOpen, setIngModalOpen] = useState(false)
  const [editingIng, setEditingIng] = useState<SopIngredient | null>(null)
  const [ingForm, setIngForm] = useState({ name: '', unit: '', amounts: '', notes: '' })

  const openAddIng = () => {
    if (!selectedRecipe) return
    setEditingIng(null)
    // Pre-fill amounts template from batch_sizes
    const template = selectedRecipe.batch_sizes.map((s) => `${s}:`).join(', ')
    setIngForm({ name: '', unit: '', amounts: template, notes: '' })
    setIngModalOpen(true)
  }

  const openEditIng = (ing: SopIngredient) => {
    setEditingIng(ing)
    const amountStr = Object.entries(ing.amounts).map(([k, v]) => `${k}:${v}`).join(', ')
    setIngForm({ name: ing.name, unit: ing.unit, amounts: amountStr, notes: ing.notes })
    setIngModalOpen(true)
  }

  const parseAmounts = (str: string): Record<string, number> => {
    const result: Record<string, number> = {}
    str.split(',').forEach((part) => {
      const [key, val] = part.split(':').map((s) => s.trim())
      if (key && val !== undefined) result[key] = parseFloat(val) || 0
    })
    return result
  }

  const submitIng = () => {
    if (!ingForm.name.trim() || !selectedRecipe) { showToast('請填寫原料名稱', 'error'); return }
    const amounts = parseAmounts(ingForm.amounts)

    if (editingIng) {
      updateIngredient(editingIng.id, {
        name: ingForm.name.trim(),
        unit: ingForm.unit.trim(),
        amounts,
        notes: ingForm.notes.trim(),
      })
      showToast('原料已更新')
    } else {
      const newId = `ing_${Date.now()}`
      const maxSort = selectedRecipe.ingredients.length > 0
        ? Math.max(...selectedRecipe.ingredients.map((i) => i.sort_order)) + 1 : 0
      addIngredient({
        id: newId,
        recipe_id: selectedRecipe.id,
        name: ingForm.name.trim(),
        unit: ingForm.unit.trim(),
        amounts,
        notes: ingForm.notes.trim(),
        sort_order: maxSort,
      })
      showToast('原料已新增')
    }
    setIngModalOpen(false)
  }

  // ── Step Modal ──
  const [stepModalOpen, setStepModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<SopStep | null>(null)
  const [stepForm, setStepForm] = useState({ title: '', description: '', duration_min: '', notes: '' })

  const openAddStep = () => {
    if (!selectedRecipe) return
    setEditingStep(null)
    setStepForm({ title: '', description: '', duration_min: '', notes: '' })
    setStepModalOpen(true)
  }

  const openEditStep = (step: SopStep) => {
    setEditingStep(step)
    setStepForm({
      title: step.title,
      description: step.description,
      duration_min: step.duration_min ? String(step.duration_min) : '',
      notes: step.notes,
    })
    setStepModalOpen(true)
  }

  const submitStep = () => {
    if (!stepForm.title.trim() || !selectedRecipe) { showToast('請填寫步驟標題', 'error'); return }
    const dur = parseFloat(stepForm.duration_min) || 0

    if (editingStep) {
      updateStep(editingStep.id, {
        title: stepForm.title.trim(),
        description: stepForm.description.trim(),
        duration_min: dur,
        notes: stepForm.notes.trim(),
      })
      showToast('步驟已更新')
    } else {
      const newId = `stp_${Date.now()}`
      const steps = selectedRecipe.steps
      const maxSort = steps.length > 0 ? Math.max(...steps.map((s) => s.sort_order)) + 1 : 0
      addStep({
        id: newId,
        recipe_id: selectedRecipe.id,
        step_number: steps.length + 1,
        title: stepForm.title.trim(),
        description: stepForm.description.trim(),
        duration_min: dur,
        notes: stepForm.notes.trim(),
        sort_order: maxSort,
      })
      showToast('步驟已新增')
    }
    setStepModalOpen(false)
  }

  if (!category) {
    return (
      <div className="page-container">
        <TopNav title="SOP 管理" backTo="/admin/sop" />
        <div className="text-center py-12 text-sm text-brand-lotus">找不到此分類</div>
      </div>
    )
  }

  return (
    <div className="page-container pb-6">
      <TopNav title={category.name} backTo="/admin/sop" />

      {/* Recipe tabs — horizontal scroll pills */}
      <div className="px-4 pt-3">
        <div ref={tabsRef} className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {recipes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedRecipe?.id === r.id
                  ? 'bg-brand-oak text-white'
                  : 'bg-surface-section text-brand-lotus hover:bg-surface-filled'
              }`}
            >
              {r.name}
            </button>
          ))}
          <button
            onClick={openAddRecipe}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-gray-300 text-brand-lotus hover:bg-surface-section flex items-center gap-1"
          >
            <Plus size={12} /> 新增
          </button>
        </div>
      </div>

      {recipes.length === 0 && (
        <div className="text-center py-12 text-sm text-brand-lotus">此分類尚無配方，點上方「新增」按鈕建立</div>
      )}

      {selectedRecipe && (
        <div className="px-4 mt-3 space-y-4">
          {/* Recipe header */}
          <div className="card !p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-brand-oak">{selectedRecipe.name}</h2>
                <p className="text-[11px] text-brand-lotus mt-0.5">
                  批次：{selectedRecipe.batch_sizes.join(' / ')}
                </p>
                {selectedRecipe.notes && (
                  <p className="text-[11px] text-brand-camel mt-1">{selectedRecipe.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 ml-2">
                {(() => {
                  const idx = recipes.findIndex((r) => r.id === selectedRecipe.id)
                  return (
                    <>
                      <button
                        onClick={() => idx > 0 && swapRecipeOrder(selectedRecipe.id, recipes[idx - 1].id)}
                        disabled={idx <= 0}
                        className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => idx < recipes.length - 1 && swapRecipeOrder(selectedRecipe.id, recipes[idx + 1].id)}
                        disabled={idx >= recipes.length - 1}
                        className="p-1 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </>
                  )
                })()}
                <button onClick={() => openEditRecipe(selectedRecipe)} className="p-1.5 text-brand-lotus hover:text-brand-oak">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => setDeleteRecipeConfirm(selectedRecipe)} className="p-1.5 text-status-danger/60 hover:text-status-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Recipe image */}
            {selectedRecipe.image_url && (
              <div className="mt-2 rounded-card overflow-hidden">
                <img src={selectedRecipe.image_url} alt={selectedRecipe.name} className="w-full h-40 object-cover" />
              </div>
            )}
          </div>

          {/* ── Ingredient table ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-brand-oak">配料表</h3>
              <button
                onClick={openAddIng}
                className="flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium text-white bg-brand-camel active:opacity-80"
              >
                <Plus size={12} /> 新增原料
              </button>
            </div>
            <div className="card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-surface-section">
                      <th className="text-left px-3 py-2 font-semibold text-brand-oak">原料</th>
                      {selectedRecipe.batch_sizes.map((size) => (
                        <th key={size} className="text-right px-3 py-2 font-semibold text-brand-oak whitespace-nowrap">
                          {size}
                        </th>
                      ))}
                      <th className="w-20 px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecipe.ingredients.length === 0 ? (
                      <tr><td colSpan={selectedRecipe.batch_sizes.length + 2} className="text-center py-6 text-brand-lotus">尚無原料</td></tr>
                    ) : (
                      selectedRecipe.ingredients.map((ing, idx) => (
                        <tr key={ing.id} className="border-t border-gray-50">
                          <td className="px-3 py-2">
                            <span className="text-brand-oak font-medium">{ing.name}</span>
                            {ing.unit && <span className="text-brand-lotus ml-1">({ing.unit})</span>}
                            {ing.notes && <span className="text-[10px] text-brand-camel block">{ing.notes}</span>}
                          </td>
                          {selectedRecipe.batch_sizes.map((size) => (
                            <td key={size} className="text-right px-3 py-2 font-num text-brand-oak tabular-nums">
                              {ing.amounts[size] != null ? ing.amounts[size] : '—'}
                            </td>
                          ))}
                          <td className="px-2 py-1">
                            <div className="flex items-center gap-0.5 justify-end">
                              <button
                                onClick={() => idx > 0 && swapIngredientOrder(ing.id, selectedRecipe.ingredients[idx - 1].id)}
                                disabled={idx <= 0}
                                className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={() => idx < selectedRecipe.ingredients.length - 1 && swapIngredientOrder(ing.id, selectedRecipe.ingredients[idx + 1].id)}
                                disabled={idx >= selectedRecipe.ingredients.length - 1}
                                className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                              >
                                <ChevronDown size={12} />
                              </button>
                              <button onClick={() => openEditIng(ing)} className="p-0.5 text-brand-lotus hover:text-brand-oak">
                                <Edit3 size={12} />
                              </button>
                              <button onClick={() => removeIngredient(ing.id)} className="p-0.5 text-status-danger/60 hover:text-status-danger">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Steps ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-brand-oak">製作步驟</h3>
              <button
                onClick={openAddStep}
                className="flex items-center gap-1 h-7 px-2.5 rounded-btn text-[11px] font-medium text-white bg-brand-camel active:opacity-80"
              >
                <Plus size={12} /> 新增步驟
              </button>
            </div>
            <div className="space-y-0">
              {selectedRecipe.steps.length === 0 ? (
                <div className="card text-center py-6 text-xs text-brand-lotus">尚無步驟</div>
              ) : (
                selectedRecipe.steps.map((step, idx) => (
                  <div key={step.id} className="flex gap-3">
                    {/* Timeline */}
                    <div className="flex flex-col items-center">
                      <div className="w-7 h-7 rounded-full bg-brand-oak text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </div>
                      {idx < selectedRecipe.steps.length - 1 && (
                        <div className="w-0.5 flex-1 bg-brand-oak/20 my-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="card flex-1 !py-2.5 !px-3 mb-2">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand-oak">{step.title}</p>
                          {step.description && (
                            <p className="text-xs text-brand-lotus mt-0.5">{step.description}</p>
                          )}
                          {step.notes && (
                            <p className="text-[10px] text-brand-camel mt-1">{step.notes}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 ml-2">
                          {step.duration_min > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-brand-camel bg-brand-camel/10 px-1.5 py-0.5 rounded-full mr-1">
                              <Clock size={10} />{step.duration_min}分
                            </span>
                          )}
                          <button
                            onClick={() => idx > 0 && swapStepOrder(step.id, selectedRecipe.steps[idx - 1].id)}
                            disabled={idx <= 0}
                            className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            onClick={() => idx < selectedRecipe.steps.length - 1 && swapStepOrder(step.id, selectedRecipe.steps[idx + 1].id)}
                            disabled={idx >= selectedRecipe.steps.length - 1}
                            className="p-0.5 text-brand-lotus hover:text-brand-oak disabled:opacity-30"
                          >
                            <ChevronDown size={12} />
                          </button>
                          <button onClick={() => openEditStep(step)} className="p-0.5 text-brand-lotus hover:text-brand-oak">
                            <Edit3 size={12} />
                          </button>
                          <button onClick={() => { removeStep(step.id); showToast('步驟已刪除') }} className="p-0.5 text-status-danger/60 hover:text-status-danger">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recipe Modal ── */}
      <AdminModal open={recipeModalOpen} onClose={() => setRecipeModalOpen(false)} title={editingRecipe ? '編輯配方' : '新增配方'} onSubmit={submitRecipe}>
        <ModalField label="配方名稱">
          <ModalInput value={recipeForm.name} onChange={(v) => setRecipeForm({ ...recipeForm, name: v })} placeholder="例：紅豆料" />
        </ModalField>
        <ModalField label="批次大小（逗號分隔）">
          <ModalInput value={recipeForm.batch_sizes} onChange={(v) => setRecipeForm({ ...recipeForm, batch_sizes: v })} placeholder="例：2盒,4盒,6盒" />
        </ModalField>
        <ModalField label="圖片網址（選填）">
          <ModalInput value={recipeForm.image_url} onChange={(v) => setRecipeForm({ ...recipeForm, image_url: v })} placeholder="https://..." />
        </ModalField>
        <ModalField label="備註（選填）">
          <ModalInput value={recipeForm.notes} onChange={(v) => setRecipeForm({ ...recipeForm, notes: v })} placeholder="例：1盒料1300湯700" />
        </ModalField>
      </AdminModal>

      {/* ── Ingredient Modal ── */}
      <AdminModal open={ingModalOpen} onClose={() => setIngModalOpen(false)} title={editingIng ? '編輯原料' : '新增原料'} onSubmit={submitIng}>
        <ModalField label="原料名稱">
          <ModalInput value={ingForm.name} onChange={(v) => setIngForm({ ...ingForm, name: v })} placeholder="例：紅豆" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={ingForm.unit} onChange={(v) => setIngForm({ ...ingForm, unit: v })} placeholder="例：g、kg、cc" />
        </ModalField>
        <ModalField label="各批次用量（格式：批次:數量，逗號分隔）">
          <ModalInput value={ingForm.amounts} onChange={(v) => setIngForm({ ...ingForm, amounts: v })} placeholder="例：2盒:1.24, 4盒:2.34, 6盒:3.44" />
        </ModalField>
        <ModalField label="備註（選填）">
          <ModalInput value={ingForm.notes} onChange={(v) => setIngForm({ ...ingForm, notes: v })} placeholder="選填" />
        </ModalField>
      </AdminModal>

      {/* ── Step Modal ── */}
      <AdminModal open={stepModalOpen} onClose={() => setStepModalOpen(false)} title={editingStep ? '編輯步驟' : '新增步驟'} onSubmit={submitStep}>
        <ModalField label="步驟標題">
          <ModalInput value={stepForm.title} onChange={(v) => setStepForm({ ...stepForm, title: v })} placeholder="例：煮水" />
        </ModalField>
        <ModalField label="說明">
          <ModalInput value={stepForm.description} onChange={(v) => setStepForm({ ...stepForm, description: v })} placeholder="例：大火煮滾後轉小火" />
        </ModalField>
        <ModalField label="時間（分鐘）">
          <ModalInput value={stepForm.duration_min} onChange={(v) => setStepForm({ ...stepForm, duration_min: v })} placeholder="例：30" type="number" />
        </ModalField>
        <ModalField label="備註（選填）">
          <ModalInput value={stepForm.notes} onChange={(v) => setStepForm({ ...stepForm, notes: v })} placeholder="選填" />
        </ModalField>
      </AdminModal>

      {/* ── Delete Recipe Confirm ── */}
      {deleteRecipeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteRecipeConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除「{deleteRecipeConfirm.name}」嗎？所有原料和步驟也會一併刪除。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteRecipeConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={confirmDeleteRecipe} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
