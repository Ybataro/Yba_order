import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface AdminModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  onSubmit: () => void
  submitLabel?: string
}

export function AdminModal({ open, onClose, title, children, onSubmit, submitLabel = '儲存' }: AdminModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal Sheet */}
      <div
        className="relative w-full max-w-lg bg-white rounded-t-sheet max-h-[85vh] flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-brand-oak">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200">
            <X size={20} className="text-brand-lotus" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 !h-11">取消</button>
          <button onClick={onSubmit} className="btn-primary flex-1 !h-11">{submitLabel}</button>
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

interface FieldProps {
  label: string
  children: ReactNode
}

export function ModalField({ label, children }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-oak mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function ModalInput({ value, onChange, placeholder, type = 'text' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus"
      style={{ backgroundColor: 'var(--color-input-bg)' }}
    />
  )
}

export function ModalSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-input px-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus bg-surface-input"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}
