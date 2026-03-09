import { useState, useEffect, useRef } from 'react'
import { X, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Category {
  id: string
  label: string
  sort_order: number
}

interface Props {
  open: boolean
  onClose: () => void
  storeId: 'store' | 'kitchen'
  onSaved: () => void
}

export function ExpenseCategoryModal({ open, onClose, storeId, onSaved }: Props) {
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      fetchCategories()
    } else {
      document.body.style.overflow = ''
      setEditingId(null)
      setDeleting(null)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // Focus input when editing
  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  const fetchCategories = async () => {
    if (!supabase) return
    setLoading(true)
    const { data } = await supabase
      .from('expense_categories')
      .select('id, label, sort_order')
      .eq('store_id', storeId)
      .eq('is_auto', false)
      .order('sort_order')
    setItems((data as Category[]) || [])
    setLoading(false)
  }

  // ── Add ──
  const handleAdd = async () => {
    if (!supabase) return
    const prefix = storeId === 'kitchen' ? 'k' : 's'
    const newId = `${prefix}_custom_${Date.now()}`
    const maxSort = items.length > 0 ? Math.max(...items.map((i) => i.sort_order)) : 0
    const newItem: Category = { id: newId, label: '新費用項目', sort_order: maxSort + 1 }

    await supabase.from('expense_categories').insert({
      id: newId,
      label: newItem.label,
      store_id: storeId,
      sort_order: newItem.sort_order,
      is_auto: false,
      auto_field: null,
      auto_rate: null,
    })

    setItems((prev) => [...prev, newItem])
    setEditingId(newId)
    setEditLabel(newItem.label)
    onSaved()
  }

  // ── Rename ──
  const startEdit = (item: Category) => {
    setEditingId(item.id)
    setEditLabel(item.label)
  }

  const confirmEdit = async () => {
    if (!supabase || !editingId) return
    const trimmed = editLabel.trim()
    if (!trimmed) return
    await supabase
      .from('expense_categories')
      .update({ label: trimmed })
      .eq('id', editingId)
    setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, label: trimmed } : i)))
    setEditingId(null)
    onSaved()
  }

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!supabase) return
    // Delete related monthly_expenses first
    await supabase.from('monthly_expenses').delete().eq('category_id', id)
    await supabase.from('expense_categories').delete().eq('id', id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    setDeleting(null)
    onSaved()
  }

  // ── Reorder ──
  const swap = async (index: number, direction: -1 | 1) => {
    if (!supabase) return
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const updated = [...items]
    const [a, b] = [updated[index], updated[target]]
    ;[a.sort_order, b.sort_order] = [b.sort_order, a.sort_order]
    ;[updated[index], updated[target]] = [b, a]
    setItems(updated)
    await supabase.from('expense_categories').update({ sort_order: a.sort_order }).eq('id', a.id)
    await supabase.from('expense_categories').update({ sort_order: b.sort_order }).eq('id', b.id)
    onSaved()
  }

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" />

      <div
        className="relative w-full max-w-lg bg-white rounded-t-sheet max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-oak">管理費用項目</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200">
            <X size={20} className="text-brand-lotus" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-sm text-brand-lotus">載入中...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 text-sm text-brand-lotus">尚無手動費用項目</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2.5 bg-white"
                >
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => swap(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
                    >
                      <ChevronUp size={14} className="text-brand-lotus" />
                    </button>
                    <button
                      onClick={() => swap(idx, 1)}
                      disabled={idx === items.length - 1}
                      className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
                    >
                      <ChevronDown size={14} className="text-brand-lotus" />
                    </button>
                  </div>

                  {/* Label or edit input */}
                  <div className="flex-1 min-w-0">
                    {editingId === item.id ? (
                      <input
                        ref={inputRef}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit() }}
                        className="w-full h-8 rounded-lg border border-brand-lotus bg-surface-input px-2 text-sm text-brand-oak outline-none"
                      />
                    ) : (
                      <span className="text-sm text-brand-oak truncate block">{item.label}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === item.id ? (
                      <button onClick={confirmEdit} className="p-1.5 rounded-lg hover:bg-gray-100">
                        <Check size={16} className="text-status-success" />
                      </button>
                    ) : deleting === item.id ? (
                      <>
                        <span className="text-xs text-status-danger mr-1">確定?</span>
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                          <Check size={16} className="text-status-danger" />
                        </button>
                        <button onClick={() => setDeleting(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                          <X size={16} className="text-brand-lotus" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-gray-100">
                          <Pencil size={14} className="text-brand-lotus" />
                        </button>
                        <button onClick={() => setDeleting(item.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                          <Trash2 size={14} className="text-status-danger" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — Add button */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={handleAdd} className="btn-primary w-full !h-11 flex items-center justify-center gap-1.5">
            <Plus size={16} />
            新增項目
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
