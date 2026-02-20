import { supabase } from '@/lib/supabase'
import { getPendingSubmissions, removePendingSubmission, type PendingSubmission } from '@/lib/offlineQueue'

export interface SyncResult {
  synced: number
  failed: number
}

async function replaySubmission(submission: PendingSubmission): Promise<boolean> {
  if (!supabase) return false

  try {
    // 1. Upsert session
    const { error: sessionErr } = await supabase
      .from(`${submission.type}_sessions`)
      .upsert(submission.payload.session, { onConflict: 'id' })

    if (sessionErr) {
      console.error(`[offlineSync] session upsert failed for ${submission.id}:`, sessionErr.message)
      return false
    }

    // 2. Upsert items
    if (submission.payload.items.length > 0) {
      const tableName = submission.type === 'settlement'
        ? 'settlement_values'
        : `${submission.type}_items`

      const conflictKey = submission.type === 'settlement'
        ? 'session_id,field_id'
        : 'session_id,product_id'

      const { error: itemErr } = await supabase
        .from(tableName)
        .upsert(submission.payload.items, { onConflict: conflictKey })

      if (itemErr) {
        console.error(`[offlineSync] items upsert failed for ${submission.id}:`, itemErr.message)
        return false
      }
    }

    return true
  } catch (err) {
    console.error(`[offlineSync] replay error for ${submission.id}:`, err)
    return false
  }
}

export async function syncPendingSubmissions(): Promise<SyncResult> {
  const pending = await getPendingSubmissions()
  let synced = 0
  let failed = 0

  for (const submission of pending) {
    const success = await replaySubmission(submission)
    if (success) {
      await removePendingSubmission(submission.id)
      synced++
    } else {
      failed++
    }
  }

  return { synced, failed }
}
