import { useState, useEffect } from 'react'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'yba_can_schedule'

export function useCanSchedule(): boolean {
  const [canSchedule, setCanSchedule] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY)
    return cached === 'true'
  })

  useEffect(() => {
    const session = getSession()
    if (!session) { setCanSchedule(false); return }
    if (session.role === 'admin') {
      setCanSchedule(true)
      sessionStorage.setItem(CACHE_KEY, 'true')
      return
    }
    if (!supabase) return

    supabase
      .from('user_pins')
      .select('can_schedule')
      .eq('staff_id', session.staffId)
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        const val = data?.can_schedule === true
        setCanSchedule(val)
        sessionStorage.setItem(CACHE_KEY, String(val))
      })
  }, [])

  return canSchedule
}
