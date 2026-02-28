import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { TRACKED_LEAVE_TYPES } from '@/lib/leave'
import type { LeaveBalance } from '@/lib/leave'

export function useLeaveBalance(staffId: string | null, year: number) {
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !staffId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('staff_id', staffId)
      .eq('year', year)

    if (error) {
      console.error('載入假別餘額失敗:', error.message)
      setLoading(false)
      return
    }

    // 自動初始化缺少的假別
    const existing = (data ?? []) as LeaveBalance[]
    const missing = TRACKED_LEAVE_TYPES.filter(
      (t) => !existing.find((b) => b.leave_type === t.id)
    )

    if (missing.length > 0) {
      const inserts = missing.map((t) => ({
        staff_id: staffId,
        leave_type: t.id,
        year,
        total_days: t.defaultDays,
        used_days: 0,
      }))
      const { data: inserted, error: insertErr } = await supabase
        .from('leave_balances')
        .insert(inserts)
        .select()

      if (insertErr) {
        console.error('初始化假別餘額失敗:', insertErr.message)
      } else if (inserted) {
        existing.push(...(inserted as LeaveBalance[]))
      }
    }

    setBalances(existing)
    setLoading(false)
  }, [staffId, year])

  useEffect(() => {
    load()
  }, [load])

  const updateTotal = useCallback(async (leaveType: string, newTotal: number) => {
    if (!supabase || !staffId) return
    const bal = balances.find((b) => b.leave_type === leaveType)
    if (!bal) return

    setBalances((prev) =>
      prev.map((b) => b.leave_type === leaveType ? { ...b, total_days: newTotal } : b)
    )

    const { error } = await supabase
      .from('leave_balances')
      .update({ total_days: newTotal })
      .eq('id', bal.id)

    if (error) {
      console.error('更新假別總額失敗:', error.message)
    }
  }, [staffId, balances])

  return { balances, loading, reload: load, updateTotal }
}
