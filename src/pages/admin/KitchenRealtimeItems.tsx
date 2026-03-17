import { useState, useEffect, useCallback, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import type { ShipmentDeduction } from '@/hooks/useKitchenRealtimeStock'

interface RealtimeItem {
  id: string
  name: string
  unit: string
  sort_order: number
  shipment_deductions: ShipmentDeduction[]
  is_active: boolean
}

export default function KitchenRealtimeItems() {
  const { showToast } = useToast()
  const allProducts = useProductStore((s) => s.items)

  // 可選的出貨品項（門店可見品項）
  const shipmentProducts = useMemo(
    () => allProducts.filter((p) => !p.visibleIn || p.visibleIn === 'both' || p.visibleIn === 'order_only'),
    [allProducts],
  )

  const [items, setItems] = useState<RealtimeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RealtimeItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<RealtimeItem | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formUnit, setFormUnit] = useState('袋')
  const [formDeductions, setFormDeductions] = useState<ShipmentDeduction[]>([])

  const fetchItems = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const { data } = await supabase
      .from('kitchen_realtime_items')
      .select('*')
      .order('sort_order')
    setItems(
      (data || []).map((r) => {
        const deds: ShipmentDeduction[] = Array.isArray(r.shipment_deductions)
          ? r.shipment_deductions
              .filter((d: { product_id?: string }) => d && typeof d.product_id === 'string')
              .map((d: { product_id: string; ratio?: number }) => ({ product_id: d.product_id, ratio: Number(d.ratio) || 1 }))
          : []
        return {
          id: r.id,
          name: r.name,
          unit: r.unit,
          sort_order: r.sort_order,
          shipment_deductions: deds,
          is_active: r.is_active,
        }
      }),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    const init = async () => { await fetchItems() }
    init()
  }, [fetchItems])

  const openAdd = () => {
    setEditing(null)
    setFormName('')
    setFormUnit('袋')
    setFormDeductions([])
    setModalOpen(true)
  }

  const openEdit = (item: RealtimeItem) => {
    setEditing(item)
    setFormName(item.name)
    setFormUnit(item.unit)
    setFormDeductions(item.shipment_deductions.map((d) => ({ ...d })))
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!supabase || !formName.trim()) {
      showToast('請輸入品名', 'error')
      return
    }

    const deductionsJson = formDeductions.filter((d) => d.product_id)

    if (editing) {
      const { error } = await supabase
        .from('kitchen_realtime_items')
        .update({
          name: formName.trim(),
          unit: formUnit.trim() || '袋',
          shipment_deductions: deductionsJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
      if (error) {
        showToast('更新失敗: ' + error.message, 'error')
        return
      }
      showToast('已更新')
    } else {
      const newId = `kri_${Date.now().toString(36)}`
      const maxSort = items.reduce((m, i) => Math.max(m, i.sort_order), 0)
      const { error } = await supabase
        .from('kitchen_realtime_items')
        .insert({
          id: newId,
          name: formName.trim(),
          unit: formUnit.trim() || '袋',
          sort_order: maxSort + 1,
          shipment_deductions: deductionsJson,
        })
      if (error) {
        showToast('新增失敗: ' + error.message, 'error')
        return
      }
      showToast('已新增')
    }

    setModalOpen(false)
    fetchItems()
  }

  const handleDelete = async (item: RealtimeItem) => {
    if (!supabase) return
    const { error } = await supabase
      .from('kitchen_realtime_items')
      .delete()
      .eq('id', item.id)
    if (error) {
      showToast('刪除失敗: ' + error.message, 'error')
      return
    }
    showToast('已刪除')
    setDeleteConfirm(null)
    fetchItems()
  }

  const toggleActive = async (item: RealtimeItem) => {
    if (!supabase) return
    await supabase
      .from('kitchen_realtime_items')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    fetchItems()
  }

  const moveItem = async (item: RealtimeItem, direction: 'up' | 'down') => {
    if (!supabase) return
    const idx = items.findIndex((i) => i.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= items.length) return

    const other = items[swapIdx]
    await Promise.all([
      supabase.from('kitchen_realtime_items').update({ sort_order: other.sort_order }).eq('id', item.id),
      supabase.from('kitchen_realtime_items').update({ sort_order: item.sort_order }).eq('id', other.id),
    ])
    fetchItems()
  }

  // Toggle a product in deductions (add with ratio 1 or remove)
  const toggleDeduction = (pid: string) => {
    setFormDeductions((prev) => {
      const exists = prev.find((d) => d.product_id === pid)
      if (exists) return prev.filter((d) => d.product_id !== pid)
      return [...prev, { product_id: pid, ratio: 1 }]
    })
  }

  // Update ratio for a specific deduction
  const updateDeductionRatio = (key: string, ratio: string) => {
    const num = parseFloat(ratio)
    if (ratio !== '' && isNaN(num)) return
    setFormDeductions((prev) =>
      prev.map((d) => {
        const dKey = d.product_id || d.field || ''
        return dKey === key ? { ...d, ratio: num || 1 } : d
      }),
    )
  }

  // Group products by category for the selector
  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof shipmentProducts>()
    shipmentProducts.forEach((p) => {
      const cat = p.category || '其他'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    })
    return map
  }, [shipmentProducts])

  return (
    <div className="page-container">
      <TopNav title="即時庫存品項管理" backTo="/admin" />

      <div className="px-4 py-3">
        <button
          onClick={openAdd}
          className="w-full h-10 rounded-xl bg-brand-mocha text-white text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus size={16} /> 新增品項
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-brand-lotus">尚未建立即時庫存品項</div>
      ) : (
        <div>
          <SectionHeader title={`共 ${items.length} 項`} icon="■" />
          <div className="bg-white">
            {items.map((item, idx) => {
              const dedLabels = item.shipment_deductions
                .map((d) => {
                  const name = allProducts.find((p) => p.id === d.product_id)?.name
                  return name ? (d.ratio !== 1 ? `${name}×${d.ratio}` : name) : null
                })
                .filter(Boolean)
              return (
                <div
                  key={item.id}
                  className={`flex items-center px-4 py-3 gap-3 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''} ${!item.is_active ? 'opacity-50' : ''}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveItem(item, 'up')} className="text-brand-lotus" disabled={idx === 0}>
                      <GripVertical size={14} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-oak">{item.name}</p>
                    <p className="text-[10px] text-brand-lotus">
                      {item.unit}
                      {dedLabels.length > 0 && ` · 扣除：${dedLabels.join('、')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleActive(item)}
                      className={`px-2 py-1 rounded text-[10px] font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {item.is_active ? '啟用' : '停用'}
                    </button>
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg bg-surface-section">
                      <Pencil size={14} className="text-brand-mocha" />
                    </button>
                    <button onClick={() => setDeleteConfirm(item)} className="p-1.5 rounded-lg bg-red-50">
                      <Trash2 size={14} className="text-status-danger" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 新增/編輯 Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '編輯品項' : '新增品項'}
        onSubmit={handleSubmit}
      >
        <ModalField label="品名">
          <ModalInput value={formName} onChange={setFormName} placeholder="例：無糖豆漿" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={formUnit} onChange={setFormUnit} placeholder="袋" />
        </ModalField>
        <ModalField label="對應出貨品項（勾選 + 設定比例）">
          <p className="text-[10px] text-brand-lotus mb-1">
            比例 = 出貨 1 單位該品項會扣多少單位即時庫存。例：出貨 1 桶豆花 = 扣 4 袋豆漿 → 比例填 4
          </p>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2">
            {Array.from(productsByCategory.entries()).map(([cat, products]) => (
              <div key={cat}>
                <p className="text-[10px] text-brand-lotus font-medium mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1">
                  {products.map((p) => {
                    const ded = formDeductions.find((d) => d.product_id === p.id)
                    const selected = !!ded
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleDeduction(p.id)}
                        className={`px-2 py-1 rounded text-xs ${
                          selected
                            ? 'bg-brand-mocha text-white'
                            : 'bg-gray-100 text-brand-oak'
                        }`}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* 已選品項 + 比例設定 */}
          {formDeductions.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] text-brand-lotus font-medium">已選品項與比例：</p>
              {formDeductions.map((ded, i) => {
                const key = ded.product_id || ded.field || `ded-${i}`
                const name = ded.type === 'order_note'
                  ? `備註: ${ded.field}`
                  : allProducts.find((p) => p.id === ded.product_id)?.name || ded.product_id || ''
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-brand-oak flex-1 min-w-0 truncate">{name}</span>
                    <span className="text-[10px] text-brand-lotus shrink-0">×</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={String(ded.ratio)}
                      onChange={(e) => updateDeductionRatio(ded.product_id || ded.field || '', e.target.value)}
                      className="w-14 h-7 text-center text-sm border border-gray-200 rounded-lg bg-surface-input outline-none focus:border-brand-lotus"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </ModalField>
      </AdminModal>

      {/* 刪除確認 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-brand-oak text-center mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus text-center mb-5">
              確定要刪除「{deleteConfirm.name}」嗎？相關追蹤資料也會被刪除。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-brand-lotus"
              >
                取消
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 h-10 rounded-xl bg-status-danger text-white text-sm font-semibold"
              >
                確定刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
