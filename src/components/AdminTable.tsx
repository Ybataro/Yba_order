import { ChevronUp, ChevronDown, Pencil, Trash2 } from 'lucide-react'

interface Column<T> {
  key: string
  label: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface AdminTableProps<T extends { id: string }> {
  items: T[]
  columns: Column<T>[]
  onEdit: (item: T) => void
  onDelete: (item: T) => void
  onMoveUp: (idx: number) => void
  onMoveDown: (idx: number) => void
}

export function AdminTable<T extends { id: string }>({
  items,
  columns,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: AdminTableProps<T>) {
  return (
    <div className="bg-white">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
        <span className="w-[52px] shrink-0 text-center">排序</span>
        {columns.map((col) => (
          <span key={col.key} className={`flex-1 min-w-0 ${col.className || ''}`}>
            {col.label}
          </span>
        ))}
        <span className="w-[68px] shrink-0 text-center">操作</span>
      </div>

      {/* Rows */}
      {items.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-brand-lotus">
          尚無資料，請點擊下方按鈕新增
        </div>
      )}

      {items.map((item, idx) => (
        <div
          key={item.id}
          className={`flex items-center px-4 py-2.5 ${idx < items.length - 1 ? 'border-b border-gray-50' : ''}`}
        >
          {/* Reorder buttons */}
          <div className="w-[52px] shrink-0 flex items-center justify-center gap-0.5">
            <button
              onClick={() => onMoveUp(idx)}
              disabled={idx === 0}
              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
            >
              <ChevronUp size={16} className="text-brand-lotus" />
            </button>
            <button
              onClick={() => onMoveDown(idx)}
              disabled={idx === items.length - 1}
              className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20"
            >
              <ChevronDown size={16} className="text-brand-lotus" />
            </button>
          </div>

          {/* Data columns */}
          {columns.map((col) => (
            <div key={col.key} className={`flex-1 min-w-0 ${col.className || ''}`}>
              {col.render ? (
                col.render(item)
              ) : (
                <span className="text-sm text-brand-oak truncate block">
                  {String((item as Record<string, unknown>)[col.key] ?? '')}
                </span>
              )}
            </div>
          ))}

          {/* Action buttons */}
          <div className="w-[68px] shrink-0 flex items-center justify-center gap-1">
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 rounded-lg hover:bg-blue-50 active:bg-blue-100"
            >
              <Pencil size={15} className="text-status-info" />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1.5 rounded-lg hover:bg-red-50 active:bg-red-100"
            >
              <Trash2 size={15} className="text-status-danger" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
