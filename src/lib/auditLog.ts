import { supabase } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

/**
 * Fire-and-forget audit log entry
 */
export function logAudit(
  action: string,
  storeId?: string,
  sessionId?: string,
  details?: Record<string, unknown>,
) {
  if (!supabase) return

  const session = getSession()

  supabase
    .from('audit_logs')
    .insert({
      action,
      staff_id: session?.staffId || null,
      staff_name: session?.staffName || null,
      store_id: storeId || null,
      session_id: sessionId || null,
      details: details || {},
    })
    .then(({ error }) => {
      if (error) console.error('[auditLog] insert error:', error.message)
    })
}
