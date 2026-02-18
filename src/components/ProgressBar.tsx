interface ProgressBarProps {
  current: number
  total: number
  label?: string
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="px-4 py-2 bg-white border-b border-gray-100">
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-brand-oak font-medium">
          {label || `進度：${current}/${total} 品項已完成`}
        </span>
        <span className="text-brand-lotus">{percent}%</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${percent}%`,
            backgroundColor: percent === 100 ? '#4CAF50' : '#9E9590',
          }}
        />
      </div>
    </div>
  )
}
