import { useState, useEffect, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { AdminModal, ModalField, ModalInput, ModalSelect } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { useScheduleStore } from '@/stores/useScheduleStore'
import { supabase } from '@/lib/supabase'
import type { ShiftType, Position } from '@/lib/schedule'
import { formatTime } from '@/lib/schedule'
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react'

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
  const { tagPresets, fetchTagPresets, addTagPreset, removeTagPreset } = useScheduleStore()
  const groups = [...GROUPS, ...stores.map((s) => ({ id: s.id, label: s.name }))]

  // ── Shift Types state ──
  const [allShifts, setAllShifts] = useState<ShiftType[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ShiftType | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<ShiftType | null>(null)

  // Shift form
  const [formName, setFormName] = useState('')
  const [formStart, setFormStart] = useState('08:00')
  const [formEnd, setFormEnd] = useState('16:00')
  const [formColor, setFormColor] = useState('#6B5D55')
  const [formGroup, setFormGroup] = useState('kitchen')
  const [formTags, setFormTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // ── Positions state ──
  const [allPositions, setAllPositions] = useState<Position[]>([])
  const [posModalOpen, setPosModalOpen] = useState(false)
  const [posEditing, setPosEditing] = useState<Position | null>(null)
  const [posDeleteConfirm, setPosDeleteConfirm] = useState<Position | null>(null)

  // Position form
  const [posFormName, setPosFormName] = useState('')
  const [posFormColor, setPosFormColor] = useState('#6B5D55')
  const [posFormGroup, setPosFormGroup] = useState('kitchen')

  // ── Fetch ──
  const fetchAll = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    const [shiftRes, posRes] = await Promise.all([
      supabase.from('shift_types').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('positions').select('*').eq('is_active', true).order('sort_order'),
    ])
    setAllShifts((shiftRes.data || []).map((d: Record<string, unknown>) => ({ ...d, tags: d.tags || [] })) as ShiftType[])
    setAllPositions((posRes.data as Position[] | null) || [])
    setLoading(false)
  }, [])

  const [presetInput, setPresetInput] = useState('')

  useEffect(() => { fetchAll(); fetchTagPresets() }, [fetchAll, fetchTagPresets])

  // ── Shift Type CRUD ──
  const openAddShift = (groupId?: string) => {
    setEditing(null)
    setFormName('')
    setFormStart('08:00')
    setFormEnd('16:00')
    setFormColor('#6B5D55')
    setFormGroup(groupId || 'kitchen')
    setFormTags([])
    setTagInput('')
    setModalOpen(true)
  }

  const openEditShift = (st: ShiftType) => {
    setEditing(st)
    setFormName(st.name)
    setFormStart(st.start_time)
    setFormEnd(st.end_time)
    setFormColor(st.color)
    setFormGroup(st.group_id)
    setFormTags(st.tags || [])
    setTagInput('')
    setModalOpen(true)
  }

  const handleSubmitShift = async () => {
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
          tags: formTags,
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
          tags: formTags,
        })
      if (error) { showToast('新增失敗：' + error.message, 'error'); return }
      showToast('班次已新增')
    }

    setModalOpen(false)
    fetchAll()
  }

  const handleDeleteShift = async () => {
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

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !formTags.includes(tag)) {
      setFormTags([...formTags, tag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    setFormTags(formTags.filter((t) => t !== tag))
  }

  // ── Position CRUD ──
  const openAddPosition = (groupId?: string) => {
    setPosEditing(null)
    setPosFormName('')
    setPosFormColor('#6B5D55')
    setPosFormGroup(groupId || 'kitchen')
    setPosModalOpen(true)
  }

  const openEditPosition = (p: Position) => {
    setPosEditing(p)
    setPosFormName(p.name)
    setPosFormColor(p.color)
    setPosFormGroup(p.group_id)
    setPosModalOpen(true)
  }

  const handleSubmitPosition = async () => {
    if (!supabase) return
    if (!posFormName.trim()) { showToast('請填寫職位名稱', 'error'); return }

    if (posEditing) {
      const { error } = await supabase
        .from('positions')
        .update({ name: posFormName, color: posFormColor, group_id: posFormGroup })
        .eq('id', posEditing.id)
      if (error) { showToast('更新失敗：' + error.message, 'error'); return }
      showToast('職位已更新')
    } else {
      const maxOrder = allPositions.filter((p) => p.group_id === posFormGroup).length
      const { error } = await supabase
        .from('positions')
        .insert({ name: posFormName, color: posFormColor, group_id: posFormGroup, sort_order: maxOrder })
      if (error) { showToast('新增失敗：' + error.message, 'error'); return }
      showToast('職位已新增')
    }

    setPosModalOpen(false)
    fetchAll()
  }

  const handleDeletePosition = async () => {
    if (!supabase || !posDeleteConfirm) return
    const { error } = await supabase
      .from('positions')
      .update({ is_active: false })
      .eq('id', posDeleteConfirm.id)
    if (error) { showToast('刪除失敗', 'error'); return }
    showToast('職位已刪除')
    setPosDeleteConfirm(null)
    fetchAll()
  }

  if (!supabase) {
    return (
      <div className="page-container">
        <TopNav title="班次與職位管理" backTo="/admin" />
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">需連接 Supabase</div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <TopNav title="班次與職位管理" backTo="/admin" />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">載入中...</div>
      ) : (
        groups.map((group) => {
          const shifts = allShifts.filter((s) => s.group_id === group.id)
          const positions = allPositions.filter((p) => p.group_id === group.id)
          return (
            <div key={group.id}>
              {/* 班次區塊 */}
              <SectionHeader title={`${group.label} 班次 (${shifts.length})`} icon="■" />
              <div className="bg-white divide-y divide-gray-50">
                {shifts.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">尚無班次</div>
                ) : (
                  shifts.map((st) => (
                    <div key={st.id} className="flex items-center px-4 py-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 mr-3"
                        style={{ backgroundColor: st.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-oak">{st.name}</p>
                        <p className="text-[11px] text-brand-lotus">
                          {formatTime(st.start_time)} - {formatTime(st.end_time)}
                          {st.tags && st.tags.length > 0 && (
                            <span className="ml-2">
                              {st.tags.map((t) => (
                                <span key={t} className="inline-block ml-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-brand-mocha">{t}</span>
                              ))}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditShift(st)} className="p-1.5 rounded-lg hover:bg-blue-50">
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
                  onClick={() => openAddShift(group.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm text-brand-lotus active:bg-gray-50"
                >
                  <Plus size={16} />
                  新增班次
                </button>
              </div>

              {/* 職位區塊 */}
              <SectionHeader title={`${group.label} 職位 (${positions.length})`} icon="●" />
              <div className="bg-white divide-y divide-gray-50">
                {positions.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">尚無職位</div>
                ) : (
                  positions.map((p) => (
                    <div key={p.id} className="flex items-center px-4 py-3">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 mr-3"
                        style={{ backgroundColor: p.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-brand-oak">{p.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditPosition(p)} className="p-1.5 rounded-lg hover:bg-blue-50">
                          <Pencil size={15} className="text-status-info" />
                        </button>
                        <button onClick={() => setPosDeleteConfirm(p)} className="p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} className="text-status-danger" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                <button
                  onClick={() => openAddPosition(group.id)}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-3 text-sm text-brand-lotus active:bg-gray-50"
                >
                  <Plus size={16} />
                  新增職位
                </button>
              </div>
            </div>
          )
        })
      )}

      {/* 建議標籤管理 */}
      <SectionHeader title={`建議標籤 (${tagPresets.length})`} icon="🏷" />
      <div className="bg-white px-4 py-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tagPresets.length === 0 ? (
            <span className="text-sm text-gray-400">尚無預設標籤</span>
          ) : (
            tagPresets.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-lotus/10 text-xs text-brand-oak font-medium">
                <Tag size={11} className="text-brand-lotus" />
                {tag}
                <button
                  type="button"
                  onClick={() => { removeTagPreset(tag); showToast(`已移除「${tag}」`) }}
                  className="ml-0.5 hover:text-status-danger"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={presetInput}
            onChange={(e) => setPresetInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (presetInput.trim()) {
                  addTagPreset(presetInput.trim())
                  showToast(`已新增「${presetInput.trim()}」`)
                  setPresetInput('')
                }
              }
            }}
            placeholder="輸入新標籤後按 Enter"
            className="flex-1 h-9 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
          />
          <button
            type="button"
            onClick={() => {
              if (presetInput.trim()) {
                addTagPreset(presetInput.trim())
                showToast(`已新增「${presetInput.trim()}」`)
                setPresetInput('')
              }
            }}
            className="px-3 h-9 rounded-lg bg-brand-lotus text-white text-xs font-medium"
          >
            <Plus size={14} className="inline -mt-0.5" /> 加入
          </button>
        </div>
      </div>

      {/* Shift Type Modal */}
      <AdminModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '編輯班次' : '新增班次'}
        onSubmit={handleSubmitShift}
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
        <ModalField label="標籤">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {formTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-lotus/10 text-xs text-brand-oak">
                  {tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-status-danger">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                placeholder="輸入標籤後按 Enter"
                className="flex-1 h-9 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
              />
              <button type="button" onClick={handleAddTag} className="px-3 h-9 rounded-lg bg-brand-lotus/10 text-xs text-brand-lotus font-medium">
                加入
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {tagPresets.filter((t) => !formTags.includes(t)).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormTags([...formTags, t])}
                  className="px-2 py-0.5 rounded-full bg-gray-100 text-[11px] text-brand-mocha hover:bg-gray-200"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        </ModalField>
      </AdminModal>

      {/* Position Modal */}
      <AdminModal
        open={posModalOpen}
        onClose={() => setPosModalOpen(false)}
        title={posEditing ? '編輯職位' : '新增職位'}
        onSubmit={handleSubmitPosition}
      >
        <ModalField label="職位名稱">
          <ModalInput value={posFormName} onChange={setPosFormName} placeholder="例：內場" />
        </ModalField>
        <ModalField label="所屬單位">
          <ModalSelect
            value={posFormGroup}
            onChange={setPosFormGroup}
            options={groups.map((g) => ({ value: g.id, label: g.label }))}
          />
        </ModalField>
        <ModalField label="顏色">
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setPosFormColor(c.value)}
                className={`w-8 h-8 rounded-lg border-2 ${posFormColor === c.value ? 'border-brand-oak scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </div>
        </ModalField>
      </AdminModal>

      {/* Delete shift confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除班次「{deleteConfirm.name}」嗎？</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={handleDeleteShift} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete position confirm */}
      {posDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setPosDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除職位「{posDeleteConfirm.name}」嗎？</p>
            <div className="flex gap-3">
              <button onClick={() => setPosDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={handleDeletePosition} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
