import { useState, useMemo } from 'react'
import { ChevronLeft, Trash2 } from 'lucide-react'

// ── localStorage history helpers ─────────────────────────

const HISTORY_KEY = 'notification_history'

export interface HistoryEntry {
  id: string
  type: string
  title: string
  message: string
  icon: string
  severity: string
  dismissedAt: number
}

export function addToHistory(entry: Omit<HistoryEntry, 'dismissedAt'>) {
  const list = getHistory()
  // Avoid duplicates (same id within 1 hour)
  const exists = list.find((h) => h.id === entry.id && Date.now() - h.dismissedAt < 3600_000)
  if (exists) return
  list.unshift({ ...entry, dismissedAt: Date.now() })
  // Keep last 100 entries
  if (list.length > 100) list.length = 100
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
}

function getHistory(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

// ── Component ────────────────────────────────────────────

interface NotificationHistoryProps {
  onBack: () => void
}

export default function NotificationHistory({ onBack }: NotificationHistoryProps) {
  const [items, setItems] = useState<HistoryEntry[]>(() => getHistory())

  const grouped = useMemo(() => {
    const groups: Record<string, HistoryEntry[]> = {}
    items.forEach((item) => {
      const date = new Date(item.dismissedAt).toLocaleDateString('zh-TW', {
        timeZone: 'Asia/Taipei',
        month: 'numeric',
        day: 'numeric',
      })
      if (!groups[date]) groups[date] = []
      groups[date].push(item)
    })
    return groups
  }, [items])

  const handleClear = () => {
    clearHistory()
    setItems([])
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-brand-lotus">
          <ChevronLeft size={16} />
          返回
        </button>
        <span className="text-sm font-semibold text-brand-oak">通知歷史</span>
        {items.length > 0 && (
          <button onClick={handleClear} className="text-xs text-red-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-400">暫無歷史通知</div>
      ) : (
        <div className="max-h-[50vh] overflow-y-auto">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <div className="px-4 py-1.5 bg-gray-50 text-[11px] text-brand-lotus font-medium">
                {date}
              </div>
              {entries.map((entry, i) => (
                <div key={`${entry.id}-${i}`} className="px-4 py-2.5 border-b border-gray-50">
                  <div className="flex items-start gap-2">
                    <span className="text-sm leading-none mt-0.5">{entry.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-brand-oak">{entry.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{entry.message}</p>
                      <p className="text-[10px] text-gray-300 mt-0.5">
                        {new Date(entry.dismissedAt).toLocaleTimeString('zh-TW', {
                          timeZone: 'Asia/Taipei',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
