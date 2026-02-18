import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface BottomActionProps {
  label: string
  onClick: () => void
  disabled?: boolean
  icon?: ReactNode
  variant?: 'primary' | 'success'
}

export function BottomAction({ label, onClick, disabled, icon, variant = 'primary' }: BottomActionProps) {
  return (
    <div className="bottom-bar">
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'btn-primary flex items-center justify-center gap-2',
          variant === 'success' && '!bg-status-success',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {icon}
        {label}
      </button>
    </div>
  )
}
