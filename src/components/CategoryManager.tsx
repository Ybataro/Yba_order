import { useState } from 'react'
import { Pencil, Trash2, Plus, Check, X, ChevronUp, ChevronDown } from 'lucide-react'

interface CategoryManagerProps {
  categories: string[]
  itemCounts: Record<string, number>
  onRename: (oldName: string, newName: string) => void
  onAdd: (name: string) => void
  onRemove: (name: string) => void
  onReorder?: (fromIdx: number, toIdx: number) => void
  label?: string
}

export function CategoryManager({
  categories,
  itemCounts,
  onRename,
  onAdd,
  onRemove,
  onReorder,
  label = '分類',
}: CategoryManagerProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [addValue, setAddValue] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const startEdit = (idx: number) => {
    setEditingIdx(idx)
    setEditValue(categories[idx])
  }

  const confirmEdit = () => {
    if (editingIdx === null) return
    const trimmed = editValue.trim()
    if (!trimmed) return
    if (trimmed !== categories[editingIdx]) {
      onRename(categories[editingIdx], trimmed)
    }
    setEditingIdx(null)
  }

  const confirmAdd = () => {
    const trimmed = addValue.trim()
    if (!trimmed) return
    if (categories.includes(trimmed)) return
    onAdd(trimmed)
    setAddValue('')
    setAdding(false)
  }

  const handleRemove = (name: string) => {
    const count = itemCounts[name] || 0
    if (count > 0) {
      setDeleteConfirm(name)
    } else {
      onRemove(name)
    }
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-brand-oak">{label}管理</span>
        <button
          onClick={() => { setAdding(true); setAddValue('') }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-mocha/10 text-brand-mocha text-xs font-medium active:bg-brand-mocha/20"
        >
          <Plus size={13} />
          新增{label}
        </button>
      </div>

      {/* Add row */}
      {adding && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-blue-50/50">
          <input
            autoFocus
            value={addValue}
            onChange={(e) => setAddValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(false) }}
            placeholder={`輸入新${label}名稱`}
            className="flex-1 h-8 rounded-input px-2.5 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
            style={{ backgroundColor: 'var(--color-input-bg)' }}
          />
          <button onClick={confirmAdd} className="p-1.5 rounded-lg bg-status-success/10 active:bg-status-success/20">
            <Check size={16} className="text-status-success" />
          </button>
          <button onClick={() => setAdding(false)} className="p-1.5 rounded-lg bg-gray-100 active:bg-gray-200">
            <X size={16} className="text-brand-lotus" />
          </button>
        </div>
      )}

      {/* Category list */}
      {categories.map((cat, idx) => (
        <div
          key={cat}
          className={`flex items-center gap-2 px-4 py-2.5 ${idx < categories.length - 1 ? 'border-b border-gray-50' : ''}`}
        >
          {/* Reorder */}
          {onReorder && (
            <div className="flex flex-col items-center gap-0 shrink-0">
              <button
                onClick={() => idx > 0 && onReorder(idx, idx - 1)}
                disabled={idx === 0}
                className="p-0 disabled:opacity-20"
              >
                <ChevronUp size={14} className="text-brand-lotus" />
              </button>
              <button
                onClick={() => idx < categories.length - 1 && onReorder(idx, idx + 1)}
                disabled={idx === categories.length - 1}
                className="p-0 disabled:opacity-20"
              >
                <ChevronDown size={14} className="text-brand-lotus" />
              </button>
            </div>
          )}

          {/* Name / edit input */}
          {editingIdx === idx ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') setEditingIdx(null) }}
                className="flex-1 h-8 rounded-input px-2.5 text-sm outline-none border border-brand-lotus"
                style={{ backgroundColor: 'var(--color-input-bg)' }}
              />
              <button onClick={confirmEdit} className="p-1 rounded-lg bg-status-success/10">
                <Check size={15} className="text-status-success" />
              </button>
              <button onClick={() => setEditingIdx(null)} className="p-1 rounded-lg bg-gray-100">
                <X size={15} className="text-brand-lotus" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-brand-oak">{cat}</span>
                <span className="text-[11px] text-brand-lotus ml-2">({itemCounts[cat] || 0} 項)</span>
              </div>
              <button onClick={() => startEdit(idx)} className="p-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100">
                <Pencil size={14} className="text-status-info" />
              </button>
              <button onClick={() => handleRemove(cat)} className="p-1.5 rounded-lg hover:bg-red-50 active:bg-red-100">
                <Trash2 size={14} className="text-status-danger" />
              </button>
            </>
          )}
        </div>
      ))}

      {categories.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-brand-lotus">尚無{label}</div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除{label}</h3>
            <p className="text-sm text-brand-lotus mb-1">
              「{deleteConfirm}」底下還有 <strong className="text-status-danger">{itemCounts[deleteConfirm] || 0}</strong> 個項目。
            </p>
            <p className="text-sm text-status-danger mb-4">刪除{label}將同時刪除底下所有項目，此操作無法復原。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button
                onClick={() => { onRemove(deleteConfirm); setDeleteConfirm(null) }}
                className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
