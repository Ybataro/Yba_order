import { Plus, Trash2 } from 'lucide-react'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useCostStore } from '@/stores/useCostStore'
import { getMaterialCostPerG, getRecipeCost } from '@/lib/costAnalysis'
import type { MenuItemIngredient } from '@/lib/costAnalysis'
import { useMemo } from 'react'

interface Props {
  ingredients: MenuItemIngredient[]
  onChange: (ingredients: MenuItemIngredient[]) => void
  menuItemId: string
}

type SourceType = 'recipe' | 'material' | 'custom'

function getSourceType(ing: MenuItemIngredient): SourceType {
  if (ing.recipe_id) return 'recipe'
  if (ing.material_id) return 'material'
  return 'custom'
}

export function MenuIngredientEditor({ ingredients, onChange, menuItemId }: Props) {
  const materials = useMaterialStore((s) => s.items)
  const recipes = useCostStore((s) => s.recipes)

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

  const addRow = () => {
    onChange([
      ...ingredients,
      {
        id: `mii_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        menu_item_id: menuItemId,
        recipe_id: null,
        material_id: null,
        custom_name: null,
        custom_cost: null,
        amount_g: 0,
        sort_order: ingredients.length,
      },
    ])
  }

  const updateRow = (idx: number, partial: Partial<MenuItemIngredient>) => {
    onChange(ingredients.map((ing, i) => (i === idx ? { ...ing, ...partial } : ing)))
  }

  const removeRow = (idx: number) => {
    onChange(ingredients.filter((_, i) => i !== idx))
  }

  const switchSource = (idx: number, source: SourceType) => {
    const base: Partial<MenuItemIngredient> = {
      recipe_id: null,
      material_id: null,
      custom_name: null,
      custom_cost: null,
    }
    if (source === 'recipe' && recipes.length > 0) base.recipe_id = recipes[0].id
    if (source === 'material' && materials.length > 0) base.material_id = materials[0].id
    updateRow(idx, base)
  }

  const getSubtotal = (ing: MenuItemIngredient): number | null => {
    if (ing.recipe_id) {
      const recipe = recipesMap.get(ing.recipe_id)
      if (recipe) {
        const { costPerG } = getRecipeCost(recipe, materialsMap)
        if (costPerG != null) return costPerG * ing.amount_g
      }
    } else if (ing.material_id) {
      const mat = materialsMap.get(ing.material_id)
      if (mat) {
        const cpg = getMaterialCostPerG(mat)
        if (cpg != null) return cpg * ing.amount_g
      }
    } else if (ing.custom_cost != null) {
      return ing.custom_cost
    }
    return null
  }

  const total = ingredients.reduce((sum, ing) => {
    const sub = getSubtotal(ing)
    return sub != null ? sum + sub : sum
  }, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-brand-oak">販售品配料</span>
        <span className="text-xs text-brand-lotus">
          合計：<span className="font-semibold text-brand-oak">${total.toFixed(2)}</span> 元
        </span>
      </div>

      {ingredients.map((ing, idx) => {
        const source = getSourceType(ing)
        const subtotal = getSubtotal(ing)

        return (
          <div key={ing.id} className="flex items-start gap-2 p-2 bg-surface-section rounded-card">
            <div className="flex-1 space-y-1.5">
              {/* Source type tabs */}
              <div className="flex gap-1">
                {(['recipe', 'material', 'custom'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => switchSource(idx, s)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      source === s ? 'bg-brand-mocha text-white' : 'bg-white text-brand-lotus border border-gray-200'
                    }`}
                  >
                    {s === 'recipe' ? '成品' : s === 'material' ? '原料' : '自訂'}
                  </button>
                ))}
              </div>

              {/* Source specific fields */}
              {source === 'recipe' && (
                <select
                  value={ing.recipe_id ?? ''}
                  onChange={(e) => updateRow(idx, { recipe_id: e.target.value || null })}
                  className="w-full h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
                >
                  <option value="">選擇成品配方</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              )}

              {source === 'material' && (
                <select
                  value={ing.material_id ?? ''}
                  onChange={(e) => updateRow(idx, { material_id: e.target.value || null })}
                  className="w-full h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
                >
                  <option value="">選擇原料</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              )}

              {source === 'custom' && (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={ing.custom_name ?? ''}
                    onChange={(e) => updateRow(idx, { custom_name: e.target.value })}
                    placeholder="名稱"
                    className="flex-1 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                  />
                  <input
                    type="number"
                    value={ing.custom_cost ?? ''}
                    onChange={(e) => updateRow(idx, { custom_cost: parseFloat(e.target.value) || null })}
                    placeholder="固定成本"
                    className="w-20 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                  />
                </div>
              )}

              {/* Amount (for recipe/material) */}
              {source !== 'custom' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={ing.amount_g || ''}
                    onChange={(e) => updateRow(idx, { amount_g: parseFloat(e.target.value) || 0 })}
                    placeholder="克數"
                    className="w-20 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                  />
                  <span className="text-[10px] text-brand-lotus">g</span>
                  {subtotal != null && (
                    <span className="text-[10px] text-brand-mocha ml-auto">${subtotal.toFixed(2)}</span>
                  )}
                </div>
              )}

              {source === 'custom' && subtotal != null && (
                <p className="text-[10px] text-brand-mocha">${subtotal.toFixed(2)}</p>
              )}
            </div>

            <button onClick={() => removeRow(idx)} className="p-1 mt-1 text-status-danger/70 hover:text-status-danger">
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}

      <button
        onClick={addRow}
        className="w-full flex items-center justify-center gap-1 h-8 rounded-card border border-dashed border-gray-300 text-xs text-brand-lotus hover:bg-surface-section"
      >
        <Plus size={14} /> 新增配料
      </button>
    </div>
  )
}
