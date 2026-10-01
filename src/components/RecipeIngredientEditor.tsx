import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getMaterialCostPerG } from '@/lib/costAnalysis'
import type { RecipeIngredient } from '@/lib/costAnalysis'
import type { RawMaterial } from '@/data/rawMaterials'

interface Props {
  ingredients: RecipeIngredient[]
  onChange: (ingredients: RecipeIngredient[]) => void
  recipeId: string
}

/** 原料可用「採購單位」輸入（如 瓶）：需有淨重，且單位不是克本身 */
function getPackUnit(mat: RawMaterial | undefined): { label: string; grams: number } | null {
  if (!mat?.net_weight_g || mat.net_weight_g <= 0 || !mat.unit || ['g', '克', '公克'].includes(mat.unit)) return null
  return { label: mat.unit, grams: mat.net_weight_g }
}

const fmtQty = (n: number) => String(Math.round(n * 10000) / 10000)

export function RecipeIngredientEditor({ ingredients, onChange, recipeId }: Props) {
  const materials = useMaterialStore((s) => s.items)
  // 存檔一律存克數（amount_g）；選採購單位時僅輸入介面換算。draft 保留輸入中的 "3." 等中間狀態
  const [packMode, setPackMode] = useState<Record<string, boolean>>({})
  const [packDraft, setPackDraft] = useState<Record<string, string>>({})

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
  const missingPriceCount = ingredients.filter((ing) => getSubtotal(ing) == null).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-brand-oak">配方原料</span>
        <span className="text-xs text-brand-lotus">
          {missingPriceCount > 0 && <span className="font-medium text-status-danger">⚠ {missingPriceCount} 項未設價 · </span>}
          合計：<span className="font-semibold text-brand-oak">${total.toFixed(2)}</span> 元
        </span>
      </div>

      {ingredients.map((ing, idx) => {
        const isCustom = !ing.material_id
        const subtotal = getSubtotal(ing)
        const pack = isCustom ? null : getPackUnit(materials.find((m) => m.id === ing.material_id))
        const inPackMode = pack != null && packMode[ing.id] === true

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
                  setPackMode({ ...packMode, [ing.id]: false })
                }}
                className="w-full h-8 rounded-input px-2 text-xs border border-gray-200 bg-white"
              >
                <option value="__custom__">自訂項目</option>
                {materials.filter((m) => m.is_active !== false || m.id === ing.material_id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.is_active === false ? '（已停用）' : ''}</option>
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
                {inPackMode ? (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={packDraft[ing.id] ?? (ing.amount_g ? fmtQty(ing.amount_g / pack.grams) : '')}
                    onChange={(e) => {
                      setPackDraft({ ...packDraft, [ing.id]: e.target.value })
                      // DB amount_g 為 NUMERIC(10,1)，先取到 0.1g 避免存檔後數字飄移
                      updateRow(idx, { amount_g: Math.round((parseFloat(e.target.value) || 0) * pack.grams * 10) / 10 })
                    }}
                    placeholder={`${pack.label}數`}
                    className="w-20 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                  />
                ) : (
                  <input
                    type="number"
                    value={ing.amount_g || ''}
                    onChange={(e) => updateRow(idx, { amount_g: parseFloat(e.target.value) || 0 })}
                    placeholder="克數"
                    className="w-20 h-7 rounded-input px-2 text-xs border border-gray-200 bg-white"
                  />
                )}
                {pack ? (
                  <select
                    value={inPackMode ? 'pack' : 'g'}
                    onChange={(e) => {
                      setPackMode({ ...packMode, [ing.id]: e.target.value === 'pack' })
                      setPackDraft((prev) => { const next = { ...prev }; delete next[ing.id]; return next })
                    }}
                    className="h-7 rounded-input px-1 text-[10px] border border-gray-200 bg-white text-brand-lotus self-center shrink-0"
                  >
                    <option value="g">g</option>
                    <option value="pack">{pack.label}</option>
                  </select>
                ) : (
                  <span className="text-[10px] text-brand-lotus self-center shrink-0">g</span>
                )}
              </div>

              {subtotal == null && (
                <p className="text-[10px] text-status-danger">
                  {isCustom ? '未填單價（$/g）' : materials.some((m) => m.id === ing.material_id) ? '此原料未設採購價/淨重，請到央廚原物料管理補上' : '原物料已被刪除，請重新選擇'}
                </p>
              )}
              {(subtotal != null || (pack && ing.amount_g > 0)) && (
                <p className="text-[10px] text-brand-mocha">
                  {subtotal != null && `$${subtotal.toFixed(2)}`}
                  {pack && ing.amount_g > 0 && (
                    <span className="text-brand-lotus">
                      {subtotal != null && ' · '}
                      {inPackMode ? `= ${fmtQty(ing.amount_g)}g` : `= ${fmtQty(ing.amount_g / pack.grams)}${pack.label}`}
                      {`（1${pack.label}=${pack.grams}g）`}
                    </span>
                  )}
                </p>
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
