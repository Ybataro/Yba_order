import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminTable } from '@/components/AdminTable'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { SectionHeader } from '@/components/SectionHeader'
import { CategoryManager } from '@/components/CategoryManager'
import { useToast } from '@/components/Toast'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useCostStore } from '@/stores/useCostStore'
import { useProductStore } from '@/stores/useProductStore'
import type { RawMaterial } from '@/data/rawMaterials'
import { Plus, FolderCog, Archive, ChevronDown } from 'lucide-react'
import { getMaterialCostPerG } from '@/lib/costAnalysis'

const emptyMaterial: RawMaterial = { id: '', name: '', category: '', spec: '', unit: '', notes: '', box_unit: undefined, box_ratio: undefined, purchase_price: null, net_weight_g: null }

export default function MaterialManager() {
  const { items, categories, add, update, reorder, renameCategory, addCategory, removeCategory, reorderCategory } = useMaterialStore()
  const { showToast } = useToast()
  const [showCatManager, setShowCatManager] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RawMaterial | null>(null)
  const [form, setForm] = useState<RawMaterial>(emptyMaterial)
  const [filterCat, setFilterCat] = useState<string>('')
  const [deactivateConfirm, setDeactivateConfirm] = useState<RawMaterial | null>(null)
  const [showInactive, setShowInactive] = useState(false)
  // 價格用字串 state 追蹤，避免 number 轉換吃掉輸入中的 "12." 小數點
  const [purchasePriceStr, setPurchasePriceStr] = useState('')
  const [netWeightStr, setNetWeightStr] = useState('')
  const recipes = useCostStore((s) => s.recipes)
  const menuItems = useCostStore((s) => s.menuItems)
  const storeProducts = useProductStore((s) => s.items)

  /** 使用此原物料的配方/販售品/門店品項（停用時提示；停用不影響其成本計算） */
  const getUsage = (materialId: string) => [
    ...recipes.filter((r) => r.ingredients.some((i) => i.material_id === materialId)).map((r) => `配方「${r.name}」`),
    ...menuItems.filter((mi) => mi.ingredients.some((i) => i.material_id === materialId)).map((mi) => `販售品「${mi.name}」`),
    ...storeProducts.filter((p) => p.material_id === materialId).map((p) => `門店品項「${p.name}」`),
  ]
  const deactivateUsage = deactivateConfirm ? getUsage(deactivateConfirm.id) : []

  // 已停用的原物料收在頁面底部，不混在啟用清單
  const activeItems = useMemo(() => items.filter((m) => m.is_active !== false), [items])
  const inactiveItems = useMemo(() => items.filter((m) => m.is_active === false), [items])

  // 分類計數含已停用：刪分類會連帶刪除底下全部原物料，計數不可漏算
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    categories.forEach((c) => { counts[c] = items.filter((m) => m.category === c).length })
    return counts
  }, [items, categories])

  const filteredItems = filterCat ? activeItems.filter((m) => m.category === filterCat) : activeItems

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyMaterial, id: `m${Date.now()}` })
    setPurchasePriceStr('')
    setNetWeightStr('')
    setModalOpen(true)
  }

  const openEdit = (item: RawMaterial) => {
    setEditing(item)
    setForm({ ...item })
    setPurchasePriceStr(item.purchase_price ? String(item.purchase_price) : '')
    setNetWeightStr(item.net_weight_g ? String(item.net_weight_g) : '')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.category || !form.unit.trim()) {
      showToast('請填寫品名、分類、單位', 'error')
      return
    }
    const submitForm = { ...form, purchase_price: parseFloat(purchasePriceStr) || null, net_weight_g: parseFloat(netWeightStr) || null }
    if (editing) {
      const err = await update(editing.id, submitForm)
      if (err) { showToast(`儲存失敗：${err}`, 'error'); return }
      showToast('原物料已更新')
    } else {
      add(submitForm)
      showToast('原物料已新增')
    }
    setModalOpen(false)
  }

  const setActive = async (item: RawMaterial, isActive: boolean) => {
    const err = await update(item.id, { is_active: isActive })
    if (err) { showToast(`${isActive ? '恢復' : '停用'}失敗：${err}`, 'error'); return false }
    showToast(isActive ? `已恢復「${item.name}」` : `已停用「${item.name}」`)
    return true
  }

  const confirmDeactivate = async () => {
    if (!deactivateConfirm) return
    if (await setActive(deactivateConfirm, false)) setDeactivateConfirm(null)
  }

  // 刪分類會連帶「刪除」底下原物料（含已停用）→ 歷史紀錄失去品名，故分類內有任何原物料就擋下
  const handleRemoveCategory = (name: string) => {
    const count = catCounts[name] || 0
    if (count > 0) {
      showToast(`「${name}」內還有 ${count} 項原物料（含已停用），請先移到其他分類`, 'error')
      return
    }
    removeCategory(name)
  }

  const categoryOptions = categories.map((c) => ({ value: c, label: c }))

  return (
    <div className="page-container">
      <TopNav title="央廚原物料管理" backTo="/admin" />

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
            onRemove={handleRemoveCategory}
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
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterCat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'}`}
          >
            全部 ({activeItems.length})
          </button>
          {categories.map((cat) => {
            const count = activeItems.filter((m) => m.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCat === cat ? 'bg-brand-mocha text-white' : 'bg-surface-section text-brand-lotus'}`}
              >
                {cat.replace(/\/.*/, '')} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {filterCat ? (
        <AdminTable
          items={filteredItems}
          columns={[
            {
              key: 'name',
              label: '品名',
              render: (m) => (
                <div>
                  <p className="text-sm font-medium text-brand-oak">{m.name}</p>
                  <p className="text-[10px] text-brand-lotus">{m.spec ? m.spec : m.unit}{m.box_unit && m.box_ratio ? ` (1${m.box_unit}=${m.box_ratio}${m.unit})` : ''}{m.notes ? ` · ${m.notes}` : ''}{(() => { const cpg = getMaterialCostPerG(m); return cpg != null ? ` · $${cpg.toFixed(4)}/g` : '' })()}</p>
                </div>
              ),
            },
          ]}
          onEdit={openEdit}
          onDelete={setDeactivateConfirm}
          deleteIcon={<Archive size={15} className="text-brand-lotus" />}
          onMoveUp={(idx) => {
            if (idx > 0) reorder(items.indexOf(filteredItems[idx]), items.indexOf(filteredItems[idx - 1]))
          }}
          onMoveDown={(idx) => {
            if (idx < filteredItems.length - 1) reorder(items.indexOf(filteredItems[idx]), items.indexOf(filteredItems[idx + 1]))
          }}
        />
      ) : (
        categories.map((cat) => {
          const catItems = activeItems.filter((m) => m.category === cat)
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
                    render: (m) => (
                      <div>
                        <p className="text-sm font-medium text-brand-oak">{m.name}</p>
                        <p className="text-[10px] text-brand-lotus">{m.spec ? m.spec : m.unit}{m.box_unit && m.box_ratio ? ` (1${m.box_unit}=${m.box_ratio}${m.unit})` : ''}{m.notes ? ` · ${m.notes}` : ''}{(() => { const cpg = getMaterialCostPerG(m); return cpg != null ? ` · $${cpg.toFixed(4)}/g` : '' })()}</p>
                      </div>
                    ),
                  },
                ]}
                onEdit={openEdit}
                onDelete={setDeactivateConfirm}
                deleteIcon={<Archive size={15} className="text-brand-lotus" />}
                onMoveUp={(idx) => {
                  if (idx > 0) reorder(items.indexOf(catItems[idx]), items.indexOf(catItems[idx - 1]))
                }}
                onMoveDown={(idx) => {
                  if (idx < catItems.length - 1) reorder(items.indexOf(catItems[idx]), items.indexOf(catItems[idx + 1]))
                }}
              />
            </div>
          )
        })
      )}

      {/* 已停用（預設收合） */}
      {inactiveItems.length > 0 && (
        <div className="px-4 py-3">
          <button
            onClick={() => setShowInactive(!showInactive)}
            className="w-full flex items-center justify-center gap-1 h-8 text-xs text-brand-lotus"
          >
            {showInactive ? '收合' : '顯示'}已停用 {inactiveItems.length} 項
            <ChevronDown size={14} className={`transition-transform ${showInactive ? 'rotate-180' : ''}`} />
          </button>
          {showInactive && (
            <div className="mt-1 rounded-card bg-white divide-y divide-gray-50">
              {inactiveItems.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-brand-lotus truncate">{m.name}</p>
                    <p className="text-[10px] text-brand-lotus/70">{m.category}{m.spec ? ` · ${m.spec}` : ''}</p>
                  </div>
                  <button
                    onClick={() => setActive(m, true)}
                    className="shrink-0 h-7 px-3 rounded-btn text-xs font-medium text-brand-mocha bg-surface-section active:bg-surface-filled"
                  >
                    恢復
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomAction label="新增原物料" onClick={openAdd} icon={<Plus size={18} />} />

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? '編輯原物料' : '新增原物料'} onSubmit={handleSubmit}>
        <ModalField label="品名">
          <ModalInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="例：綠豆(天鶴牌)" />
        </ModalField>
        <ModalField label="分類">
          <ModalSelect value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categoryOptions} placeholder="請選擇分類" />
        </ModalField>
        <ModalField label="規格">
          <ModalInput value={form.spec} onChange={(v) => setForm({ ...form, spec: v })} placeholder="例：50斤/袋" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="例：袋、包、箱" />
        </ModalField>
        <ModalField label="箱入單位">
          <ModalInput value={form.box_unit ?? ''} onChange={(v) => setForm({ ...form, box_unit: v || undefined })} placeholder="例：箱（留空表示無箱規）" />
        </ModalField>
        <ModalField label="箱入數量">
          <ModalInput value={form.box_ratio ? String(form.box_ratio) : ''} onChange={(v) => setForm({ ...form, box_ratio: parseInt(v) || undefined })} placeholder="例：6（1箱=6袋）" />
        </ModalField>
        <ModalField label="採購價（元）">
          <ModalInput value={purchasePriceStr} onChange={setPurchasePriceStr} placeholder="例：750（選填，用於成本計算）" />
        </ModalField>
        <ModalField label="淨重（克）">
          <ModalInput value={netWeightStr} onChange={setNetWeightStr} placeholder="例：30000（選填，用於成本計算）" />
        </ModalField>
        {parseFloat(purchasePriceStr) > 0 && parseFloat(netWeightStr) > 0 ? (
          <div className="px-3 py-2 bg-surface-section rounded-card text-xs text-brand-oak">
            每克成本：<span className="font-semibold">${(parseFloat(purchasePriceStr) / parseFloat(netWeightStr)).toFixed(4)}</span> 元/g
          </div>
        ) : null}
        <ModalField label="備註">
          <ModalInput value={form.notes ?? ''} onChange={(v) => setForm({ ...form, notes: v })} placeholder="選填" />
        </ModalField>
      </AdminModal>

      {deactivateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeactivateConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">停用原物料</h3>
            <p className="text-sm text-brand-lotus mb-2">停用「{deactivateConfirm.name}」後，盤點、叫貨與配方選單不再顯示；歷史紀錄保留，可隨時恢復。</p>
            {deactivateUsage.length > 0 && (
              <p className="text-xs text-status-warning mb-2">仍被使用：{deactivateUsage.join('、')}。這些項目的成本照常計算。</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setDeactivateConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={confirmDeactivate} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-brand-mocha active:opacity-80">停用</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
