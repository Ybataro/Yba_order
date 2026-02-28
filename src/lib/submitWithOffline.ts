import { supabase } from '@/lib/supabase'
import { addPendingSubmission, type PendingSubmission } from '@/lib/offlineQueue'

interface SubmitOptions {
  type: 'inventory' | 'order' | 'settlement'
  storeId: string
  sessionId: string
  session: Record<string, unknown>
  items: Record<string, unknown>[]
  onConflict?: string       // upsert conflict key, e.g. 'session_id,product_id'
  itemIdField?: string      // item 的 ID 欄位名, e.g. 'product_id'
  onSuccess: (message: string) => void
  onError: (message: string) => void
}

export async function submitWithOffline({
  type,
  storeId,
  sessionId,
  session,
  items,
  onConflict,
  itemIdField,
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

    // Items: upsert 新資料 → 刪除不在新列表中的舊記錄（安全：upsert 失敗不影響舊資料）
    const itemTable = type === 'settlement' ? 'settlement_values' : `${type}_items`
    const conflictKey = onConflict || 'session_id,product_id'
    const idField = itemIdField || 'product_id'

    if (items.length > 0) {
      const { error: itemErr } = await supabase
        .from(itemTable)
        .upsert(items, { onConflict: conflictKey })

      if (itemErr) {
        onError(`項目儲存失敗：${itemErr.message}`)
        return false
      }
    }

    // 清除不在新列表中的舊記錄（即使失敗也只是殘留多餘資料，不影響正確性）
    const newItemIds = new Set(items.map(i => (i as Record<string, unknown>)[idField]))
    const { data: existing } = await supabase
      .from(itemTable)
      .select('*')
      .eq('session_id', sessionId)
    const toDelete = (existing as Record<string, unknown>[] | null)
      ?.filter(e => !newItemIds.has(e[idField]))
      ?.map(e => e.id as number) || []
    if (toDelete.length > 0) {
      await supabase.from(itemTable).delete().in('id', toDelete)
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
