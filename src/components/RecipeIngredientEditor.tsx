import { Plus, Trash2 } from 'lucide-react'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getMaterialCostPerG } from '@/lib/costAnalysis'
import type { RecipeIngredient } from '@/lib/costAnalysis'

interface Props {
  ingredients: RecipeIngredient[]
  onChange: (ingredients: RecipeIngredient[]) => void
  recipeId: string
}

export function RecipeIngredientEditor({ ingredients, onChange, recipeId }: Props) {
  const materials = useMaterialStore((s) => s.items)

  const addRow = () => {
    onChange([
      ...ingredients,
      {
        id: `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        recipe_id: recipeId,
        material_id: null,
        custom_name: null,
        custom_price_per_g: null,
        amount_g: 0,
        sort_order: ingredients.length,
      },
    ])
  }

  const updateRow = (idx: number, partial: Partial<RecipeIngredient>) => {
    onChange(ingredients.map((ing, i) => (i === idx ? { ...ing, ...partial } : ing)))
  }

  const removeRow = (idx: number) => {
    onChange(ingredients.filter((_, i) => i !== idx))
  }

  const getSubtotal = (ing: RecipeIngredient): number | null => {
    if (ing.material_id) {
      const mat = materials.find((m) => m.id === ing.material_id)
      if (mat) {
        const cpg = getMaterialCostPerG(mat)
        if (cpg != null) return cpg * ing.amount_g
      }
    } else if (ing.custom_price_per_g != null) {
      return ing.custom_price_per_g * ing.amount_g
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
        <span className="text-sm font-medium text-brand-oak">配方原料</span>
        <span className="text-xs text-brand-lotus">
          合計：<span className="font-semibold text-brand-oak">${total.toFixed(2)}</span> 元
        </span>
      </div>

      {ingredients.map((ing, idx) => {
        const isCustom = !ing.material_id
        const subtotal = getSubtotal(ing)

        return (
          <div key={ing.id} className="flex items-start gap-2 p-2 bg-surface-section rounded-card">
            {/* Source select */}
            <div className="flex-1 space-y-1.5">
              <select
                value={ing.material_id ?? '__custom__'}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '__custom__') {
                    updateRow(idx, { material_id: null, custom_name: '', custom_price_per_g: null })
                  } else {
                    updateRow(idx, { material_id: val, custom_name: null, custom_price_per_g: null })
                  }
                }}
                className="w-full h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
              >
                <option value="__custom__">自訂項目</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <div className="flex gap-1.5">
                {isCustom && (
                  <>
                    <input
                      type="text"
                      value={ing.custom_name ?? ''}
                      onChange={(e) => updateRow(idx, { custom_name: e.target.value })}
                      placeholder="名稱"
                      className="flex-1 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                    />
                    <input
                      type="number"
                      value={ing.custom_price_per_g ?? ''}
                      onChange={(e) => updateRow(idx, { custom_price_per_g: parseFloat(e.target.value) || null })}
                      placeholder="$/g"
                      className="w-16 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                    />
                  </>
                )}
                <input
                  type="number"
                  value={ing.amount_g || ''}
                  onChange={(e) => updateRow(idx, { amount_g: parseFloat(e.target.value) || 0 })}
                  placeholder="克數"
                  className="w-20 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                />
                <span className="text-[10px] text-brand-lotus self-center shrink-0">g</span>
              </div>

              {subtotal != null && (
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
        <Plus size={14} /> 新增原料
      </button>
    </div>
  )
}
