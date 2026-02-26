import { useState, useEffect } from 'react'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'yba_allowed_pages'

/** Default page sets by employment_type */
const STORE_DEFAULTS: Record<string, string[]> = {
  full_time: ['expense', 'schedule', 'inventory'],
  part_time: ['expense', 'schedule'],
}

const KITCHEN_DEFAULTS: Record<string, string[]> = {
  full_time: ['expense', 'staff-schedule', 'materials', 'products'],
  part_time: ['expense', 'staff-schedule'],
}

/**
 * Returns allowed page keys for the current user, or null if all pages are visible.
 * Priority:
 * 1. admin → null (all visible)
 * 2. allowed_pages explicitly set → that array (individual override, trumps can_schedule)
 * 3. can_schedule = true → null (all visible)
 * 4. allowed_pages NULL → default by employment_type
 */
export function useAllowedPages(context: 'store' | 'kitchen'): string[] | null {
  const [allowedPages, setAllowedPages] = useState<string[] | null>(() => {
    const session = getSession()
    if (!session) return []
    if (session.role === 'admin') return null
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        if (parsed.staffId === session.staffId && parsed.context === context) {
          return parsed.pages as string[] | null
        }
      } catch { /* ignore */ }
    }
    return null // loading: show all pages until resolved
  })

  useEffect(() => {
    const session = getSession()
    if (!session) { setAllowedPages([]); return }
    if (session.role === 'admin') { setAllowedPages(null); return }
    if (!supabase) return

    // Fetch user_pins for can_schedule + allowed_pages, and staff for employment_type
    Promise.all([
      supabase
        .from('user_pins')
        .select('can_schedule, allowed_pages')
        .eq('staff_id', session.staffId)
        .eq('is_active', true)
        .single(),
      supabase
        .from('staff')
        .select('employment_type')
        .eq('id', session.staffId)
        .single(),
    ]).then(([pinRes, staffRes]) => {
      // Explicit allowed_pages override (trumps can_schedule)
      const dbPages = pinRes.data?.allowed_pages as string[] | null
      if (dbPages && dbPages.length > 0) {
        cache(session.staffId, context, dbPages)
        setAllowedPages(dbPages)
        return
      }

      // can_schedule (no explicit override) → all visible
      if (pinRes.data?.can_schedule === true) {
        cache(session.staffId, context, null)
        setAllowedPages(null)
        return
      }

      // Fall back to employment_type defaults
      const empType = (staffRes.data?.employment_type as string) || 'part_time'
      const defaults = context === 'store' ? STORE_DEFAULTS : KITCHEN_DEFAULTS
      const pages = defaults[empType] || defaults['part_time']!
      cache(session.staffId, context, pages)
      setAllowedPages(pages)
    })
  }, [context])

  return allowedPages
}

function cache(staffId: string, context: string, pages: string[] | null) {
  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ staffId, context, pages }))
}
