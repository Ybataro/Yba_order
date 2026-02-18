import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatDate, getTodayString } from '@/lib/utils'

interface TopNavProps {
  title: string
  showBack?: boolean
  date?: string
}

export function TopNav({ title, showBack = true, date }: TopNavProps) {
  const navigate = useNavigate()

  return (
    <div className="top-nav">
      <div className="flex items-center gap-3">
        {showBack && (
          <button onClick={() => navigate(-1)} className="p-1 -ml-1 active:opacity-70">
            <ArrowLeft size={22} />
          </button>
        )}
        <h1 className="text-base font-semibold truncate">{title}</h1>
      </div>
      <span className="text-sm opacity-80">{formatDate(date || getTodayString())}</span>
    </div>
  )
}
