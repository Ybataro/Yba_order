import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { useCostStore } from '@/stores/useCostStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { getMaterialCostPerG, getRecipeCost, getMenuItemCost } from '@/lib/costAnalysis'
import { ChevronDown } from 'lucide-react'

type Tab = 'materials' | 'recipes' | 'menu'

export default function CostAnalysis() {
  const [tab, setTab] = useState<Tab>('materials')
  const materials = useMaterialStore((s) => s.items)
  const categories = useMaterialStore((s) => s.categories)
  const { recipes, menuItems } = useCostStore()

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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'materials', label: '原料成本' },
    { key: 'recipes', label: '成品成本' },
    { key: 'menu', label: '販售品成本' },
  ]

  return (
    <div className="page-container">
      <TopNav title="成本分析" backTo="/admin" />

      {/* Tabs */}
      <div className="px-4 py-2 bg-white border-b border-gray-100">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-full text-xs font-medium transition-colors ${
                tab === t.key ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'materials' && <MaterialsTab materials={materials} categories={categories} />}
      {tab === 'recipes' && <RecipesTab recipes={recipes} materialsMap={materialsMap} />}
      {tab === 'menu' && <MenuTab menuItems={menuItems} recipesMap={recipesMap} materialsMap={materialsMap} />}
    </div>
  )
}

// ─── 原料成本 Tab ───

function MaterialsTab({ materials, categories }: { materials: ReturnType<typeof useMaterialStore.getState>['items']; categories: string[] }) {
  const materialsWithCost = materials.filter((m) => m.purchase_price && m.net_weight_g)
  const materialsWithout = materials.filter((m) => !m.purchase_price || !m.net_weight_g)

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="text-xs text-brand-lotus">
        已設定成本：{materialsWithCost.length} 項 / 未設定：{materialsWithout.length} 項
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 pr-2 text-brand-lotus font-medium">品名</th>
              <th className="text-right py-2 px-1 text-brand-lotus font-medium whitespace-nowrap">採購價</th>
              <th className="text-right py-2 px-1 text-brand-lotus font-medium whitespace-nowrap">淨重(g)</th>
              <th className="text-right py-2 pl-1 text-brand-lotus font-medium whitespace-nowrap">$/g</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const catItems = materialsWithCost.filter((m) => m.category === cat)
              if (catItems.length === 0) return null
              return (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={4} className="pt-3 pb-1 text-[10px] font-semibold text-brand-mocha">{cat}</td>
                  </tr>
                  {catItems.map((m) => {
                    const cpg = getMaterialCostPerG(m)
                    return (
                      <tr key={m.id} className="border-b border-gray-50">
                        <td className="py-1.5 pr-2 text-brand-oak">{m.name}</td>
                        <td className="py-1.5 px-1 text-right text-brand-oak">${m.purchase_price}</td>
                        <td className="py-1.5 px-1 text-right text-brand-lotus">{m.net_weight_g}</td>
                        <td className="py-1.5 pl-1 text-right font-semibold text-brand-oak">{cpg != null ? `$${cpg.toFixed(4)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {materialsWithout.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-brand-lotus mb-1">尚未設定成本（{materialsWithout.length} 項）：</p>
          <p className="text-[10px] text-brand-lotus/60">{materialsWithout.map((m) => m.name).join('、')}</p>
        </div>
      )}
    </div>
  )
}

import { Fragment } from 'react'

// ─── 成品成本 Tab ───

function RecipesTab({ recipes, materialsMap }: { recipes: ReturnType<typeof useCostStore.getState>['recipes']; materialsMap: Map<string, ReturnType<typeof useMaterialStore.getState>['items'][0]> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="px-4 py-3 space-y-3">
      {recipes.length === 0 && (
        <div className="text-center py-12 text-sm text-brand-lotus">尚無配方資料</div>
      )}

      {recipes.map((recipe) => {
        const { totalCost, costPerG, details } = getRecipeCost(recipe, materialsMap)
        const isOpen = expandedId === recipe.id

        return (
          <div key={recipe.id} className="card !p-0 overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : recipe.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className="text-sm font-semibold text-brand-oak">{recipe.name}</p>
                <p className="text-[10px] text-brand-lotus">
                  {recipe.total_weight_g}g/{recipe.unit}
                  {costPerG != null && ` · $${costPerG.toFixed(4)}/g`}
                  {' · 總成本 '}${totalCost.toFixed(2)}
                </p>
              </div>
              <ChevronDown size={16} className={`text-brand-lotus transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                {details.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-brand-lotus">
                      {d.name} × {d.amountG}g
                      {d.unitCost != null && <span className="text-brand-lotus/50"> (@${d.unitCost.toFixed(4)}/g)</span>}
                    </span>
                    <span className="text-brand-oak font-medium">{d.subtotal != null ? `$${d.subtotal.toFixed(2)}` : '—'}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                  <span className="font-medium text-brand-oak">合計</span>
                  <span className="font-semibold text-brand-oak">${totalCost.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── 販售品成本 Tab ───

function MenuTab({
  menuItems,
  recipesMap,
  materialsMap,
}: {
  menuItems: ReturnType<typeof useCostStore.getState>['menuItems']
  recipesMap: Map<string, ReturnType<typeof useCostStore.getState>['recipes'][0]>
  materialsMap: Map<string, ReturnType<typeof useMaterialStore.getState>['items'][0]>
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="px-4 py-3 space-y-3">
      {menuItems.length === 0 && (
        <div className="text-center py-12 text-sm text-brand-lotus">尚無販售品資料</div>
      )}

      {menuItems.map((item) => {
        const { totalCost, profit, profitRate, details } = getMenuItemCost(item, recipesMap, materialsMap)
        const isOpen = expandedId === item.id
        const rateColor = profitRate >= 60 ? 'text-status-success' : profitRate >= 40 ? 'text-brand-amber' : 'text-status-danger'
        const barColor = profitRate >= 60 ? 'bg-status-success' : profitRate >= 40 ? 'bg-brand-amber' : 'bg-status-danger'

        return (
          <div key={item.id} className="card !p-0 overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-brand-oak truncate">{item.name}</p>
                  <span className={`text-xs font-bold ${rateColor}`}>{profitRate.toFixed(0)}%</span>
                </div>
                <p className="text-[10px] text-brand-lotus">
                  售 ${item.selling_price} · 成本 ${totalCost.toFixed(1)} · 毛利 ${profit.toFixed(1)}
                </p>
              </div>
              <ChevronDown size={16} className={`text-brand-lotus transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profit bar */}
            <div className="px-4 pb-2">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.min(Math.max(profitRate, 0), 100)}%` }}
                />
              </div>
            </div>

            {isOpen && (
              <div className="border-t border-gray-100 px-4 py-2 space-y-1">
                {details.map((d, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-brand-lotus">{d.name} × {d.amountG}g</span>
                    <span className="text-brand-oak">{d.subtotal != null ? `$${d.subtotal.toFixed(2)}` : '—'}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-gray-100">
                  <span className="text-brand-lotus">成本合計</span>
                  <span className="font-semibold text-brand-oak">${totalCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-brand-lotus">售價</span>
                  <span className="font-medium text-brand-oak">${item.selling_price}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-brand-lotus">毛利</span>
                  <span className={`font-bold ${rateColor}`}>${profit.toFixed(2)} ({profitRate.toFixed(1)}%)</span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
