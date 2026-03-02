import { useState } from 'react'
import { TopNav } from '@/components/TopNav'
import { BottomAction } from '@/components/BottomAction'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useProductionZoneStore } from '@/stores/useProductionZoneStore'
import type { ZoneDef, ItemDef, FieldDef, SugarTypeDef } from '@/stores/useProductionZoneStore'
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus } from 'lucide-react'

type Tab = 'zones' | 'items' | 'fields' | 'sugars'

// ── Zone Tab ──
function ZoneTab() {
  const { showToast } = useToast()
  const zones = useProductionZoneStore((s) => s.zones)
  const { addZone, updateZone, removeZone, swapZoneOrder } = useProductionZoneStore()

  const [editZone, setEditZone] = useState<ZoneDef | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ id: '', name: '', icon: '', notice: '' })

  const openNew = () => {
    setForm({ id: '', name: '', icon: '', notice: '' })
    setIsNew(true)
    setEditZone({} as ZoneDef)
  }

  const openEdit = (z: ZoneDef) => {
    setForm({ id: z.id, name: z.name, icon: z.icon, notice: z.notice })
    setIsNew(false)
    setEditZone(z)
  }

  const handleSave = () => {
    if (!form.name.trim()) { showToast('請輸入區域名稱', 'error'); return }
    if (isNew) {
      if (!form.id.trim()) { showToast('請輸入區域 ID', 'error'); return }
      if (zones.find((z) => z.id === form.id)) { showToast('ID 已存在', 'error'); return }
      addZone({
        id: form.id.trim(),
        name: form.name.trim(),
        icon: form.icon.trim(),
        notice: form.notice.trim(),
        sort_order: zones.length,
        is_active: true,
      })
      showToast('已新增區域')
    } else {
      updateZone(editZone!.id, {
        name: form.name.trim(),
        icon: form.icon.trim(),
        notice: form.notice.trim(),
      })
      showToast('已更新區域')
    }
    setEditZone(null)
  }

  const handleDelete = (z: ZoneDef) => {
    if (!confirm(`確定刪除「${z.name}」及其所有品項/欄位？`)) return
    removeZone(z.id)
    showToast('已刪除')
  }

  return (
    <>
      <div className="px-4 space-y-2 mt-3">
        {zones.map((z, idx) => (
          <div key={z.id} className="card flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <button
                disabled={idx === 0}
                onClick={() => swapZoneOrder(z.id, zones[idx - 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronUp size={16} /></button>
              <button
                disabled={idx === zones.length - 1}
                onClick={() => swapZoneOrder(z.id, zones[idx + 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronDown size={16} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brand-oak">{z.icon} {z.name}</div>
              {z.notice && <div className="text-xs text-brand-lotus truncate">{z.notice}</div>}
              <div className="text-xs text-brand-lotus/60">{z.items.length} 品項 · {z.id}</div>
            </div>
            <button onClick={() => openEdit(z)} className="p-2 text-brand-lotus"><Pencil size={16} /></button>
            <button onClick={() => handleDelete(z)} className="p-2 text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <BottomAction label="新增區域" onClick={openNew} icon={<Plus size={18} />} />

      <AdminModal open={!!editZone} onClose={() => setEditZone(null)} title={isNew ? '新增區域' : '編輯區域'} onSubmit={handleSave}>
        {isNew && (
          <ModalField label="區域 ID（英文代號，不可修改）">
            <ModalInput value={form.id} onChange={(v) => setForm((f) => ({ ...f, id: v }))} placeholder="如 paste, ball..." />
          </ModalField>
        )}
        <ModalField label="名稱">
          <ModalInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="如 漿區" />
        </ModalField>
        <ModalField label="圖示 (Emoji)">
          <ModalInput value={form.icon} onChange={(v) => setForm((f) => ({ ...f, icon: v }))} placeholder="🫙" />
        </ModalField>
        <ModalField label="注意事項">
          <ModalInput value={form.notice} onChange={(v) => setForm((f) => ({ ...f, notice: v }))} placeholder="選填" />
        </ModalField>
      </AdminModal>
    </>
  )
}

// ── Item Tab ──
function ItemTab() {
  const { showToast } = useToast()
  const zones = useProductionZoneStore((s) => s.zones)
  const { addItem, updateItem, removeItem, swapItemOrder } = useProductionZoneStore()

  const [selectedZone, setSelectedZone] = useState(zones[0]?.id || '')
  const items = zones.find((z) => z.id === selectedZone)?.items || []

  const [editItem, setEditItem] = useState<ItemDef | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ id: '', name: '' })

  const openNew = () => {
    if (!selectedZone) { showToast('請先選擇區域', 'error'); return }
    setForm({ id: '', name: '' })
    setIsNew(true)
    setEditItem({} as ItemDef)
  }

  const openEdit = (item: ItemDef) => {
    setForm({ id: item.id, name: item.name })
    setIsNew(false)
    setEditItem(item)
  }

  const handleSave = () => {
    if (!form.name.trim()) { showToast('請輸入品項名稱', 'error'); return }
    if (isNew) {
      if (!form.id.trim()) { showToast('請輸入品項 ID', 'error'); return }
      const allItems = zones.flatMap((z) => z.items)
      if (allItems.find((i) => i.id === form.id)) { showToast('ID 已存在', 'error'); return }
      addItem({
        id: form.id.trim(),
        zone_id: selectedZone,
        name: form.name.trim(),
        sort_order: items.length,
        is_active: true,
      })
      showToast('已新增品項')
    } else {
      updateItem(editItem!.id, { name: form.name.trim() })
      showToast('已更新品項')
    }
    setEditItem(null)
  }

  const handleDelete = (item: ItemDef) => {
    if (!confirm(`確定刪除「${item.name}」及其所有欄位？`)) return
    removeItem(item.id)
    showToast('已刪除')
  }

  return (
    <>
      {/* Zone pills */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto scrollbar-hide pb-2">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => setSelectedZone(z.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedZone === z.id
                ? 'bg-brand-oak text-white'
                : 'bg-surface-section text-brand-lotus'
            }`}
          >
            {z.icon} {z.name}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2 mt-2">
        {items.map((item, idx) => (
          <div key={item.id} className="card flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <button
                disabled={idx === 0}
                onClick={() => swapItemOrder(item.id, items[idx - 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronUp size={16} /></button>
              <button
                disabled={idx === items.length - 1}
                onClick={() => swapItemOrder(item.id, items[idx + 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronDown size={16} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brand-oak">{item.name}</div>
              <div className="text-xs text-brand-lotus/60">{item.fields.length} 欄位 · {item.id}</div>
            </div>
            <button onClick={() => openEdit(item)} className="p-2 text-brand-lotus"><Pencil size={16} /></button>
            <button onClick={() => handleDelete(item)} className="p-2 text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-sm text-brand-lotus text-center py-8">此區域尚無品項</div>
        )}
      </div>
      <BottomAction label="新增品項" onClick={openNew} icon={<Plus size={18} />} />

      <AdminModal open={!!editItem} onClose={() => setEditItem(null)} title={isNew ? '新增品項' : '編輯品項'} onSubmit={handleSave}>
        {isNew && (
          <ModalField label="品項 ID（英文代號，不可修改）">
            <ModalInput value={form.id} onChange={(v) => setForm((f) => ({ ...f, id: v }))} placeholder="如 taro_paste" />
          </ModalField>
        )}
        <ModalField label="名稱">
          <ModalInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="如 芋泥漿" />
        </ModalField>
      </AdminModal>
    </>
  )
}

// ── Field Tab ──
function FieldTab() {
  const { showToast } = useToast()
  const zones = useProductionZoneStore((s) => s.zones)
  const { addField, updateField, removeField, swapFieldOrder } = useProductionZoneStore()

  const [selectedZone, setSelectedZone] = useState(zones[0]?.id || '')
  const zoneItems = zones.find((z) => z.id === selectedZone)?.items || []
  const [selectedItem, setSelectedItem] = useState(zoneItems[0]?.id || '')

  // Keep selectedItem in sync
  const currentItem = zoneItems.find((i) => i.id === selectedItem)
  const fields = currentItem?.fields || []

  const [editField, setEditField] = useState<FieldDef | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({
    field_key: '',
    label: '',
    field_type: 'numeric' as FieldDef['field_type'],
    unit: '',
    options: '',
  })

  const openNew = () => {
    if (!selectedItem) { showToast('請先選擇品項', 'error'); return }
    setForm({ field_key: '', label: '', field_type: 'numeric', unit: '', options: '' })
    setIsNew(true)
    setEditField({} as FieldDef)
  }

  const openEdit = (f: FieldDef) => {
    setForm({
      field_key: f.field_key,
      label: f.label,
      field_type: f.field_type,
      unit: f.unit,
      options: f.options.join(', '),
    })
    setIsNew(false)
    setEditField(f)
  }

  const handleSave = () => {
    if (!form.label.trim()) { showToast('請輸入欄位標籤', 'error'); return }
    const opts = form.options.split(',').map((s) => s.trim()).filter(Boolean)

    if (isNew) {
      if (!form.field_key.trim()) { showToast('請輸入欄位 Key', 'error'); return }
      if (fields.find((f) => f.field_key === form.field_key)) { showToast('Key 已存在', 'error'); return }
      const id = `f_${selectedItem}_${form.field_key.trim()}`
      addField({
        id,
        item_id: selectedItem,
        field_key: form.field_key.trim(),
        label: form.label.trim(),
        field_type: form.field_type,
        unit: form.unit.trim(),
        options: opts,
        sort_order: fields.length,
        is_active: true,
      })
      showToast('已新增欄位')
    } else {
      updateField(editField!.id, {
        label: form.label.trim(),
        field_type: form.field_type,
        unit: form.unit.trim(),
        options: opts,
      })
      showToast('已更新欄位')
    }
    setEditField(null)
  }

  const handleDelete = (f: FieldDef) => {
    if (!confirm(`確定刪除欄位「${f.label}」？`)) return
    removeField(f.id)
    showToast('已刪除')
  }

  const typeLabel = (t: string) => {
    switch (t) {
      case 'numeric': return '數字'
      case 'select': return '下拉'
      case 'text': return '文字'
      case 'sugar_select': return '糖多選'
      default: return t
    }
  }

  return (
    <>
      {/* Zone pills */}
      <div className="flex gap-2 px-4 mt-3 overflow-x-auto scrollbar-hide pb-2">
        {zones.map((z) => (
          <button
            key={z.id}
            onClick={() => {
              setSelectedZone(z.id)
              const firstItem = z.items[0]?.id || ''
              setSelectedItem(firstItem)
            }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedZone === z.id
                ? 'bg-brand-oak text-white'
                : 'bg-surface-section text-brand-lotus'
            }`}
          >
            {z.icon} {z.name}
          </button>
        ))}
      </div>

      {/* Item pills */}
      <div className="flex gap-2 px-4 mt-1 overflow-x-auto scrollbar-hide pb-2">
        {zoneItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedItem === item.id
                ? 'bg-brand-mocha text-white'
                : 'bg-surface-section text-brand-lotus'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-2 mt-2">
        {fields.map((f, idx) => (
          <div key={f.id} className="card flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <button
                disabled={idx === 0}
                onClick={() => swapFieldOrder(f.id, fields[idx - 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronUp size={16} /></button>
              <button
                disabled={idx === fields.length - 1}
                onClick={() => swapFieldOrder(f.id, fields[idx + 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronDown size={16} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brand-oak">{f.label}</div>
              <div className="text-xs text-brand-lotus/60">
                {typeLabel(f.field_type)}{f.unit ? ` · ${f.unit}` : ''} · {f.field_key}
              </div>
              {f.options.length > 0 && (
                <div className="text-xs text-brand-lotus/60">選項: {f.options.join(', ')}</div>
              )}
            </div>
            <button onClick={() => openEdit(f)} className="p-2 text-brand-lotus"><Pencil size={16} /></button>
            <button onClick={() => handleDelete(f)} className="p-2 text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
        {fields.length === 0 && selectedItem && (
          <div className="text-sm text-brand-lotus text-center py-8">此品項尚無欄位</div>
        )}
        {!selectedItem && (
          <div className="text-sm text-brand-lotus text-center py-8">請先選擇品項</div>
        )}
      </div>
      <BottomAction label="新增欄位" onClick={openNew} icon={<Plus size={18} />} />

      <AdminModal open={!!editField} onClose={() => setEditField(null)} title={isNew ? '新增欄位' : '編輯欄位'} onSubmit={handleSave}>
        {isNew && (
          <ModalField label="欄位 Key（英文代號，不可修改）">
            <ModalInput value={form.field_key} onChange={(v) => setForm((f) => ({ ...f, field_key: v }))} placeholder="如 sugar, water" />
          </ModalField>
        )}
        <ModalField label="標籤">
          <ModalInput value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} placeholder="如 糖、水" />
        </ModalField>
        <ModalField label="類型">
          <select
            value={form.field_type}
            onChange={(e) => setForm((f) => ({ ...f, field_type: e.target.value as FieldDef['field_type'] }))}
            className="w-full h-10 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus bg-surface-input"
          >
            <option value="numeric">數字 (numeric)</option>
            <option value="select">下拉 (select)</option>
            <option value="text">文字 (text)</option>
            <option value="sugar_select">糖多選 (sugar_select)</option>
          </select>
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="如 g, ml, °（選填）" />
        </ModalField>
        {form.field_type === 'select' && (
          <ModalField label="選項（逗號分隔）">
            <ModalInput value={form.options} onChange={(v) => setForm((f) => ({ ...f, options: v }))} placeholder="偏軟, 適中, 偏硬" />
          </ModalField>
        )}
      </AdminModal>
    </>
  )
}

// ── Sugar Tab ──
function SugarTab() {
  const { showToast } = useToast()
  const sugarTypes = useProductionZoneStore((s) => s.sugarTypes)
  const { addSugarType, updateSugarType, removeSugarType, swapSugarTypeOrder } = useProductionZoneStore()

  const [editSugar, setEditSugar] = useState<SugarTypeDef | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ name: '', unit: 'g' })

  const openNew = () => {
    setForm({ name: '', unit: 'g' })
    setIsNew(true)
    setEditSugar({} as SugarTypeDef)
  }

  const openEdit = (s: SugarTypeDef) => {
    setForm({ name: s.name, unit: s.unit || 'g' })
    setIsNew(false)
    setEditSugar(s)
  }

  const handleSave = () => {
    if (!form.name.trim()) { showToast('請輸入糖種名稱', 'error'); return }
    if (isNew) {
      if (sugarTypes.find((s) => s.name === form.name.trim())) { showToast('名稱已存在', 'error'); return }
      const id = `sugar_${Date.now()}`
      addSugarType({
        id,
        name: form.name.trim(),
        unit: form.unit.trim() || 'g',
        sort_order: sugarTypes.length,
        is_active: true,
      })
      showToast('已新增糖種')
    } else {
      updateSugarType(editSugar!.id, { name: form.name.trim(), unit: form.unit.trim() || 'g' })
      showToast('已更新糖種')
    }
    setEditSugar(null)
  }

  const handleDelete = (s: SugarTypeDef) => {
    if (!confirm(`確定刪除「${s.name}」？`)) return
    removeSugarType(s.id)
    showToast('已刪除')
  }

  return (
    <>
      <div className="px-4 space-y-2 mt-3">
        {sugarTypes.map((s, idx) => (
          <div key={s.id} className="card flex items-center gap-3">
            <div className="flex flex-col gap-0.5">
              <button
                disabled={idx === 0}
                onClick={() => swapSugarTypeOrder(s.id, sugarTypes[idx - 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronUp size={16} /></button>
              <button
                disabled={idx === sugarTypes.length - 1}
                onClick={() => swapSugarTypeOrder(s.id, sugarTypes[idx + 1].id)}
                className="p-0.5 text-brand-lotus disabled:opacity-20"
              ><ChevronDown size={16} /></button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-brand-oak">{s.name}</div>
              <div className="text-xs text-brand-lotus/60">單位: {s.unit || 'g'}</div>
            </div>
            <button onClick={() => openEdit(s)} className="p-2 text-brand-lotus"><Pencil size={16} /></button>
            <button onClick={() => handleDelete(s)} className="p-2 text-red-400"><Trash2 size={16} /></button>
          </div>
        ))}
        {sugarTypes.length === 0 && (
          <div className="text-sm text-brand-lotus text-center py-8">尚無糖種</div>
        )}
      </div>
      <BottomAction label="新增糖種" onClick={openNew} icon={<Plus size={18} />} />

      <AdminModal open={!!editSugar} onClose={() => setEditSugar(null)} title={isNew ? '新增糖種' : '編輯糖種'} onSubmit={handleSave}>
        <ModalField label="糖種名稱">
          <ModalInput value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="如 二砂、冰糖" />
        </ModalField>
        <ModalField label="單位">
          <ModalInput value={form.unit} onChange={(v) => setForm((f) => ({ ...f, unit: v }))} placeholder="g" />
        </ModalField>
      </AdminModal>
    </>
  )
}

// ── Main Page ──
const TABS: { id: Tab; label: string }[] = [
  { id: 'zones', label: '區域' },
  { id: 'items', label: '品項' },
  { id: 'fields', label: '欄位' },
  { id: 'sugars', label: '糖種' },
]

export default function ProductionZoneManager() {
  const [activeTab, setActiveTab] = useState<Tab>('zones')
  const loading = useProductionZoneStore((s) => s.loading)

  return (
    <div className="page-container">
      <TopNav title="生產區域管理" backTo="/admin" />

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-brand-mocha text-brand-oak'
                : 'border-transparent text-brand-lotus'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        <>
          {activeTab === 'zones' && <ZoneTab />}
          {activeTab === 'items' && <ItemTab />}
          {activeTab === 'fields' && <FieldTab />}
          {activeTab === 'sugars' && <SugarTab />}
        </>
      )}
    </div>
  )
}
