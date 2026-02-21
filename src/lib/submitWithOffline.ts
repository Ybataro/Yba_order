import { supabase } from '@/lib/supabase'
import { addPendingSubmission, type PendingSubmission } from '@/lib/offlineQueue'

interface SubmitOptions {
  type: 'inventory' | 'order' | 'settlement'
  storeId: string
  sessionId: string
  session: Record<string, unknown>
  items: Record<string, unknown>[]
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export async function submitWithOffline({
  type,
  storeId,
  sessionId,
  session,
  items,
  onSuccess,
  onError,
}: SubmitOptions): Promise<boolean> {
  const isOnline = navigator.onLine

  // ── Offline: queue for later ──
  if (!isOnline || !supabase) {
    try {
      const pending: PendingSubmission = {
        id: `${type}_${sessionId}_${Date.now()}`,
        type,
        storeId,
        sessionId,
        payload: { session, items },
        createdAt: Date.now(),
      }
      await addPendingSubmission(pending)
      onSuccess('已暫存，上線後自動同步')
      return true
    } catch (err) {
      onError('離線暫存失敗')
      console.error('[submitWithOffline] queue error:', err)
      return false
    }
  }

  // ── Online: direct submit ──
  try {
    const sessionTable = `${type}_sessions`
    const { error: sessionErr } = await supabase
      .from(sessionTable)
      .upsert(session, { onConflict: 'id' })

    if (sessionErr) {
      // Network error during online → queue it
      if (isNetworkError(sessionErr.message)) {
        const pending: PendingSubmission = {
          id: `${type}_${sessionId}_${Date.now()}`,
          type,
          storeId,
          sessionId,
          payload: { session, items },
          createdAt: Date.now(),
        }
        await addPendingSubmission(pending)
        onSuccess('網路不穩，已暫存等待同步')
        return true
      }
      onError(`提交失敗：${sessionErr.message}`)
      return false
    }

    if (items.length > 0) {
      const itemTable = type === 'settlement' ? 'settlement_values' : `${type}_items`
      const conflictKey = type === 'settlement' ? 'session_id,field_id' : 'session_id,product_id'

      const { error: itemErr } = await supabase
        .from(itemTable)
        .upsert(items, { onConflict: conflictKey })

      if (itemErr) {
        onError(`項目儲存失敗：${itemErr.message}`)
        return false
      }
    }

    onSuccess('')
    return true
  } catch (err) {
    // Unexpected network failure → queue
    try {
      const pending: PendingSubmission = {
        id: `${type}_${sessionId}_${Date.now()}`,
        type,
        storeId,
        sessionId,
        payload: { session, items },
        createdAt: Date.now(),
      }
      await addPendingSubmission(pending)
      onSuccess('網路中斷，已暫存等待同步')
      return true
    } catch {
      onError('提交失敗')
      console.error('[submitWithOffline] fallback queue error:', err)
      return false
    }
  }
}

function isNetworkError(msg: string): boolean {
  const patterns = ['fetch', 'network', 'timeout', 'ECONNREFUSED', 'ERR_NETWORK', 'Failed to fetch']
  return patterns.some((p) => msg.toLowerCase().includes(p.toLowerCase()))
}
