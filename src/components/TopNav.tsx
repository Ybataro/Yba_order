import { ArrowLeft } from 'lucide-react'
import { formatDate, getTodayString } from '@/lib/utils'

interface TopNavProps {
  title: string
  showBack?: boolean
  backTo?: string
  date?: string
}

export function TopNav({ title, showBack = true, backTo, date }: TopNavProps) {
  return (
    <div className="top-nav">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => backTo ? window.location.href = backTo : window.history.back()} className="p-1 -ml-1 active:opacity-70">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>
      <span className="text-sm opacity-80">{formatDate(date || getTodayString())}</span>
    </div>
  )
}
