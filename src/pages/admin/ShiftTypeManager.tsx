import { useState, useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { supabase } from '@/lib/supabase'
import type { ShiftType } from '@/lib/schedule'
import { formatTime } from '@/lib/schedule'
import { Plus, Pencil, Trash2 } from 'lucide-react'

const GROUPS = [
  { id: 'kitchen', label: '央廚' },
]

const COLORS = [
  { value: '#6B5D55', label: '棕色' },
  { value: '#8B6F4E', label: '焦糖' },
  { value: '#A0522D', label: '赭色' },
  { value: '#B87333', label: '銅色' },
  { value: '#4A7C59', label: '綠色' },
  { value: '#5B7FA5', label: '藍色' },
  { value: '#8B5E83', label: '紫色' },
  { value: '#C4A35A', label: '金色' },
]

export default function ShiftTypeManager() {
  const { showToast } = useToast()
  const stores = useStoreStore((s) => s.items)
  const groups = [...GROUPS, ...stores.map((s) => ({ id: s.id, label: s.name }))]

  const [allShifts, setAllShifts] = useState<ShiftType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftType | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ShiftType | null>(null)

  // Form
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('08:00')
  const [formEnd, setFormEnd] = useState('16:00')
  const [formColor, setFormColor] = useState('#6B5D55')
  const [formGroup, setFormGroup] = useState('kitchen')

  const fetchAll = async () => {
    if (!supabase) { setLoading(false); return }
    const { data } = await supabase
      .from('shift_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    setAllShifts((data as ShiftType[] | null) || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openAdd = (groupId?: string) => {
    setEditing(null)
    setFormName('')
    setFormStart('08:00')
    setFormEnd('16:00')
    setFormColor('#6B5D55')
    setFormGroup(groupId || 'kitchen')
    setModalOpen(true)
  }

  const openEdit = (st: ShiftType) => {
    setEditing(st)
    setFormName(st.name)
    setFormStart(st.start_time)
    setFormEnd(st.end_time)
    setFormColor(st.color)
    setFormGroup(st.group_id)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!supabase) return
    if (!formName.trim()) { showToast('請填寫班次名稱', 'error'); return }

    if (editing) {
      const { error } = await supabase
        .from('shift_types')
        .update({
          name: formName,
          start_time: formStart,
          end_time: formEnd,
          color: formColor,
          group_id: formGroup,
        })
        .eq('id', editing.id)
      if (error) { showToast('更新失敗：' + error.message, 'error'); return }
      showToast('班次已更新')
    } else {
      const maxOrder = allShifts.filter((s) => s.group_id === formGroup).length
      const { error } = await supabase
        .from('shift_types')
        .insert({
          name: formName,
          start_time: formStart,
          end_time: formEnd,
          color: formColor,
          group_id: formGroup,
          sort_order: maxOrder,
        })
      if (error) { showToast('新增失敗：' + error.message, 'error'); return }
      showToast('班次已新增')
    }

    setModalOpen(false)
    fetchAll()
  }

  const handleDelete = async () => {
    if (!supabase || !deleteConfirm) return
    const { error } = await supabase
      .from('shift_types')
      .update({ is_active: false })
      .eq('id', deleteConfirm.id)
    if (error) { showToast('刪除失敗', 'error'); return }
    showToast('班次已刪除')
    setDeleteConfirm(null)
    fetchAll()
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="班次類型管理" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="班次類型管理" backTo="/admin" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        groups.map((group) => {
          const items = allShifts.filter((s) => s.group_id === group.id)
          return (
            <div key={group.id}>
              <SectionHeader title={`${group.label} (${items.length})`} icon="■" />
              <div className="bg-white divide-y divide-gray-50">
                {items.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">尚無班次</div>
                ) : (
                  items.map((st) => (
                    <div key={st.id} className="flex items-center px-4 py-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 mr-3"
                        style={{ backgroundColor: st.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-oak">{st.name}</p>
                        <p className="text-[11px] text-brand-lotus">
                          {formatTime(st.start_time)} - {formatTime(st.end_time)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(st)} className="p-1.5 rounded-lg hover:bg-blue-50">
                          <Pencil size={15} className="text-status-info" />
                        </button>
                        <button onClick={() => setDeleteConfirm(st)} className="p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} className="text-status-danger" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <button
                  onClick={() => openAdd(group.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm text-brand-lotus active:bg-gray-50"
                >
                  <Plus size={16} />
                  新增班次
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '編輯班次' : '新增班次'}
        onSubmit={handleSubmit}
      >
        <ModalField label="班次名稱">
          <ModalInput value={formName} onChange={setFormName} placeholder="例：早班" />
        </ModalField>
        <ModalField label="所屬單位">
          <ModalSelect
            value={formGroup}
            onChange={setFormGroup}
            options={groups.map((g) => ({ value: g.id, label: g.label }))}
          />
        </ModalField>
        <ModalField label="開始時間">
          <input
            type="time"
            value={formStart}
            onChange={(e) => setFormStart(e.target.value)}
            className="w-full h-10 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
          />
        </ModalField>
        <ModalField label="結束時間">
          <input
            type="time"
            value={formEnd}
            onChange={(e) => setFormEnd(e.target.value)}
            className="w-full h-10 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
          />
        </ModalField>
        <ModalField label="顏色">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFormColor(c.value)}
                className={`w-8 h-8 rounded-lg border-2 ${formColor === c.value ? 'border-brand-oak scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </ModalField>
      </AdminModal>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除班次「{deleteConfirm.name}」嗎？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={handleDelete} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
