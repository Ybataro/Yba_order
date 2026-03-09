interface SectionHeaderProps {
  title: string
  completed?: number
  total?: number
  icon?: string
  sticky?: boolean
}

export function SectionHeader({ title, completed, total, icon, sticky = true }: SectionHeaderProps) {
  const showProgress = completed !== undefined && total !== undefined

  return (
    <div className={sticky ? 'section-header' : 'section-header !static'}>
      <div className="flex items-center gap-2">
        {icon && <span className="w-2 h-2 rounded-sm bg-brand-mocha inline-block" />}
        <span>{title}</span>
      </div>
      {showProgress && (
        <span className={`text-xs font-normal ${completed === total ? 'text-status-success' : 'text-brand-lotus'}`}>
          {completed}/{total} {completed === total ? '✓' : ''}
        </span>
      )}
    </div>
  )
}
