import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock } from 'lucide-react'
import { useNotifications, type Notification } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { notifyWithFeedback } from '@/lib/notificationSound'
import { addToHistory } from '@/components/NotificationHistory'
import NotificationHistory from '@/components/NotificationHistory'

interface NotificationBellProps {
  context: 'store' | 'kitchen'
  storeId?: string
  className?: string
  onCriticalNotifications?: (notifications: Notification[], dismiss: (id: string) => void) => void
}

export default function NotificationBell({ context, storeId, className, onCriticalNotifications }: NotificationBellProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  const prevCountRef = useRef(0)

  const { notifications, unreadCount, loading, dismiss, dismissAll } = useNotifications(context, storeId)

  // Pass critical notifications up to parent for modal
  useEffect(() => {
    if (onCriticalNotifications) {
      onCriticalNotifications(notifications, dismiss)
    }
  }, [notifications, dismiss, onCriticalNotifications])

  // Play sound when new notifications arrive
  useEffect(() => {
    if (unreadCount > prevCountRef.current && prevCountRef.current >= 0) {
      const hasCritical = notifications.some((n) => n.severity === 'critical')
      const hasWarning = notifications.some((n) => n.severity === 'warning')
      if (hasCritical) {
        notifyWithFeedback('critical')
      } else if (hasWarning) {
        notifyWithFeedback('warning')
      } else if (unreadCount > 0) {
        notifyWithFeedback('info')
      }
    }
    prevCountRef.current = unreadCount
  }, [unreadCount, notifications])

  // Outside click handler
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setShowHistory(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleNotificationClick(link?: string, id?: string) {
    if (id) {
      const n = notifications.find((n) => n.id === id)
      if (n) {
        addToHistory({ id: n.id, type: n.type, title: n.title, message: n.message, icon: n.icon, severity: n.severity })
      }
      dismiss(id)
    }
    setOpen(false)
    setShowHistory(false)
    if (link) navigate(link)
  }

  function handleDismissAll() {
    notifications.forEach((n) => {
      addToHistory({ id: n.id, type: n.type, title: n.title, message: n.message, icon: n.icon, severity: n.severity })
    })
    dismissAll()
  }

  const actionText: Record<string, string> = {
    low_stock: '前往盤點',
    order_reminder: '前往叫貨',
    shipment_pending: '前往收貨確認',
    settlement_reminder: '前往結帳',
    shift_change: '確認',
  }

  return (
    <div className="relative">
      {/* Bell button with pulse */}
      <button
        ref={bellRef}
        onClick={() => { setOpen((v) => !v); setShowHistory(false) }}
        className={cn('relative p-2 rounded-full transition-colors hover:bg-white/20', className)}
        aria-label="通知中心"
      >
        <Bell size={24} className={unreadCount > 0 ? 'animate-bell-pulse' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold px-1 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-xl bg-white shadow-xl border border-gray-100 z-50"
        >
          {showHistory ? (
            <NotificationHistory onBack={() => setShowHistory(false)} />
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-brand-oak">📢 通知中心</span>
                {notifications.length > 0 && (
                  <button onClick={handleDismissAll} className="text-xs text-brand-lotus hover:underline">
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
                      className={cn(
                        'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors',
                        n.severity === 'critical' && 'bg-red-50 hover:bg-red-100',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-lg leading-none mt-0.5">{n.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-sm font-semibold',
                            n.severity === 'critical' ? 'text-red-600' : 'text-brand-oak',
                          )}>
                            {n.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{n.message}</p>
                          {n.link && (
                            <p className="text-xs text-brand-lotus mt-1">
                              → {actionText[n.type] || '查看'}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* History link */}
              <div className="border-t border-gray-100">
                <button
                  onClick={() => setShowHistory(true)}
                  className="w-full px-4 py-2.5 text-xs text-brand-lotus hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  <Clock size={12} />
                  查看歷史
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes bellPulse {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(15deg); }
          40% { transform: rotate(-15deg); }
          60% { transform: rotate(8deg); }
          80% { transform: rotate(-8deg); }
        }
        .animate-bell-pulse {
          animation: bellPulse 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
