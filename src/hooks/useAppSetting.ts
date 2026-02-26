import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const CACHE_PREFIX = 'yba_app_setting_'

export function useAppSetting(key: string) {
  const [value, setValue] = useState<string | null>(() => {
    const cached = sessionStorage.getItem(CACHE_PREFIX + key)
    return cached
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()
      .then(({ data }) => {
        const v = data?.value ?? null
        setValue(v)
        if (v !== null) sessionStorage.setItem(CACHE_PREFIX + key, v)
        setLoading(false)
      })
  }, [key])

  const update = useCallback(async (newValue: string) => {
    if (!supabase) return
    setValue(newValue)
    sessionStorage.setItem(CACHE_PREFIX + key, newValue)
    await supabase
      .from('app_settings')
      .upsert({ key, value: newValue, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  }, [key])

  return { value, loading, update }
}
