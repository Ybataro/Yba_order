import { useState, useEffect } from 'react'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const CACHE_KEY = 'yba_can_schedule'

export function useCanSchedule(): boolean {
  const [canSchedule, setCanSchedule] = useState(() => {
    // 快取必須搭配當前 session 才有效，無 session 一律 false
    const session = getSession()
    if (!session) return false
    if (session.role === 'admin') return true
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached !== null) return cached === 'true'
    return false
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

    // 非 admin 每次都查 DB 確認（快取僅用於初始 render 避免閃爍）
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
