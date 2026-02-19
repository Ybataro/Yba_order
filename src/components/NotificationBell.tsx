import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  context: 'store' | 'kitchen'
  storeId?: string
  className?: string
}

export default function NotificationBell({ context, storeId, className }: NotificationBellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  const { notifications, unreadCount, loading, dismiss, dismissAll } = useNotifications(context, storeId)

  // 點擊面板外部關閉
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(link?: string, id?: string) {
    if (id) dismiss(id)
    setOpen(false)
    if (link) navigate(link)
  }

  return (
    <div className="relative">
      {/* 鈴鐺按鈕 */}
      <button
        ref={bellRef}
        onClick={() => setOpen((v) => !v)}
        className={cn('relative p-2 rounded-full transition-colors hover:bg-white/20', className)}
        aria-label="通知中心"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-gray-100 z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-brand-oak">📢 通知中心</span>
            {notifications.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-brand-lotus hover:underline"
              >
                全部已讀
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">載入中...</div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              目前沒有待處理項目 ✓
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n.link, n.id)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">{n.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-oak">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{n.message}</p>
                      {n.link && (
                        <p className="text-xs text-brand-lotus mt-1">
                          → {n.type === 'low_stock' ? '前往盤點' : n.type === 'order_reminder' ? '前往叫貨' : '前往收貨確認'}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
