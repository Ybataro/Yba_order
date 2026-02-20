import { useEffect, useState, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { Notification } from '@/hooks/useNotifications'
import { notifyWithFeedback } from '@/lib/notificationSound'

interface CriticalAlertModalProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

export default function CriticalAlertModal({ notifications, onDismiss }: CriticalAlertModalProps) {
  const [current, setCurrent] = useState<Notification | null>(null)
  const shownRef = useRef<Set<string>>(new Set())

  const criticals = notifications.filter((n) => n.severity === 'critical')

  useEffect(() => {
    const unshown = criticals.find((n) => !shownRef.current.has(n.id))
    if (unshown) {
      setCurrent(unshown)
      shownRef.current.add(unshown.id)
      notifyWithFeedback('critical')
    }
  }, [criticals])

  if (!current) return null

  const handleClose = () => {
    onDismiss(current.id)
    setCurrent(null)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative mx-4 w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'criticalPulse 0.3s ease-out' }}
      >
        {/* Red header */}
        <div className="bg-red-500 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={28} className="text-white shrink-0" />
          <h2 className="text-lg font-bold text-white flex-1">{current.title}</h2>
          <button onClick={handleClose} className="text-white/80 hover:text-white">
            <X size={24} />
          </button>
        </div>
        {/* Body */}
        <div className="px-5 py-6">
          <p className="text-base text-brand-oak whitespace-pre-line">{current.message}</p>
        </div>
        {/* Action */}
        <div className="px-5 pb-5">
          <button
            onClick={handleClose}
            className="w-full h-12 rounded-xl bg-red-500 text-white font-semibold text-base active:scale-[0.98] transition-transform"
          >
            我知道了
          </button>
        </div>
      </div>
      <style>{`
        @keyframes criticalPulse {
          0% { transform: scale(0.9); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
