import { useState, useEffect, useRef } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { getPendingCount } from '@/lib/offlineQueue'
import { syncPendingSubmissions } from '@/lib/offlineSync'

export default function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const wasOfflineRef = useRef(false)

  // Poll pending count
  useEffect(() => {
    const check = async () => {
      const count = await getPendingCount()
      setPendingCount(count)
    }
    check()
    const interval = setInterval(check, 10_000)
    return () => clearInterval(interval)
  }, [])

  // Track offline → online transition
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      return
    }

    if (wasOfflineRef.current) {
      wasOfflineRef.current = false
      // Auto sync on reconnect
      handleSync()
    }
  }, [isOnline])

  const handleSync = async () => {
    const count = await getPendingCount()
    if (count === 0) return

    setSyncing(true)
    setSyncMessage('')

    const result = await syncPendingSubmissions()
    const newCount = await getPendingCount()
    setPendingCount(newCount)
    setSyncing(false)

    if (result.synced > 0) {
      setSyncMessage(`已同步 ${result.synced} 筆`)
      setTimeout(() => setSyncMessage(''), 4000)
    }
    if (result.failed > 0) {
      setSyncMessage(`${result.synced} 筆同步成功，${result.failed} 筆失敗`)
      setTimeout(() => setSyncMessage(''), 6000)
    }
  }

  // Nothing to show
  if (isOnline && pendingCount === 0 && !syncMessage) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[55] max-w-lg mx-auto">
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <WifiOff size={16} className="shrink-0" />
          <span className="flex-1">目前離線中</span>
          {pendingCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {pendingCount} 筆待同步
            </span>
          )}
        </div>
      )}

      {isOnline && pendingCount > 0 && !syncing && (
        <div className="bg-blue-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <RefreshCw size={16} className="shrink-0" />
          <span className="flex-1">{pendingCount} 筆待同步</span>
          <button
            onClick={handleSync}
            className="bg-white/20 px-3 py-0.5 rounded-full text-xs active:bg-white/30"
          >
            立即同步
          </button>
        </div>
      )}

      {syncing && (
        <div className="bg-blue-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <RefreshCw size={16} className="shrink-0 animate-spin" />
          <span>同步中...</span>
        </div>
      )}

      {syncMessage && isOnline && pendingCount === 0 && (
        <div className="bg-green-500 text-white px-4 py-2 flex items-center gap-2 text-sm">
          <span>✓ {syncMessage}</span>
        </div>
      )}
    </div>
  )
}
