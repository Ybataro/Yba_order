import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { sendTelegramNotification } from '@/lib/telegram'
import { calcLeaveDays, getLeaveTypeName } from '@/lib/leave'
import type { LeaveRequest, LeaveType, DayPart } from '@/lib/leave'

interface SubmitData {
  staff_id: string
  staff_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  day_part: DayPart
  reason: string
}

interface LeaveState {
  requests: LeaveRequest[]
  loading: boolean

  fetchByStaff: (staffId: string) => Promise<void>
  fetchPending: () => Promise<void>
  fetchAll: (year?: number) => Promise<void>
  submit: (data: SubmitData) => Promise<boolean>
  approve: (id: string, reviewerId: string) => Promise<boolean>
  reject: (id: string, reviewerId: string, reason: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>
}

export const useLeaveStore = create<LeaveState>()((set, get) => ({
  requests: [],
  loading: false,

  fetchByStaff: async (staffId) => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('載入請假記錄失敗:', error.message)
    }
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  fetchPending: async () => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('載入待審核請假失敗:', error.message)
    }
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  fetchAll: async (year) => {
    if (!supabase) return
    set({ loading: true })
    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (year) {
      const startOfYear = `${year}-01-01`
      const endOfYear = `${year}-12-31`
      query = query.gte('start_date', startOfYear).lte('start_date', endOfYear)
    }
    const { data, error } = await query
    if (error) {
      console.error('載入所有請假記錄失敗:', error.message)
    }
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  submit: async (data) => {
    if (!supabase) return false
    const leaveDays = calcLeaveDays(data.start_date, data.end_date, data.day_part)
    const record = {
      staff_id: data.staff_id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      day_part: data.day_part,
      reason: data.reason,
      leave_days: leaveDays,
      status: 'pending',
    }

    const { error } = await supabase.from('leave_requests').insert(record)
    if (error) {
      console.error('提交請假申請失敗:', error.message)
      return false
    }

    // 發送 Telegram 通知
    const typeName = getLeaveTypeName(data.leave_type)
    const dateRange = data.start_date === data.end_date
      ? data.start_date
      : `${data.start_date} ~ ${data.end_date}`
    const dayPartLabel = data.day_part === 'full' ? '' : data.day_part === 'am' ? '（上半天）' : '（下半天）'
    const msg = [
      '📋 <b>請假申請</b>',
      `👤 員工：${data.staff_name}`,
      `📅 日期：${dateRange}${dayPartLabel}（${leaveDays}天）`,
      `📝 假別：${typeName}`,
      data.reason ? `💬 事由：${data.reason}` : '',
    ].filter(Boolean).join('\n')

    sendTelegramNotification(msg, true, ['8515675347']).catch(() => {})

    return true
  },

  approve: async (id, reviewerId) => {
    if (!supabase) return false

    // 取得申請資料
    const req = get().requests.find((r) => r.id === id)
    if (!req) return false

    // 1. 更新狀態
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) {
      console.error('核准請假失敗:', error.message)
      return false
    }

    // 2. 寫入排班表
    const dates: string[] = []
    const start = new Date(req.start_date + 'T00:00:00')
    const end = new Date(req.end_date + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${day}`)
    }

    const now = new Date().toISOString()
    const scheduleRecords = dates.map((date) => ({
      id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      staff_id: req.staff_id,
      date,
      shift_type_id: null,
      custom_start: null,
      custom_end: null,
      note: '',
      created_by: reviewerId,
      position_id: null,
      attendance_type: req.leave_type,
      tags: [] as string[],
      updated_at: now,
    }))

    const { error: schedError } = await supabase
      .from('schedules')
      .upsert(scheduleRecords, { onConflict: 'staff_id,date' })
    if (schedError) {
      console.error('寫入排班表失敗:', schedError.message)
    }

    // 3. 更新假別餘額
    const year = new Date(req.start_date + 'T00:00:00').getFullYear()
    const { data: balData } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('staff_id', req.staff_id)
      .eq('leave_type', req.leave_type)
      .eq('year', year)
      .single()

    if (balData) {
      await supabase
        .from('leave_balances')
        .update({ used_days: Number(balData.used_days) + req.leave_days })
        .eq('id', balData.id)
    } else {
      // 若無餘額記錄則自動建立
      const def = (await import('@/lib/leave')).TRACKED_LEAVE_TYPES.find((t) => t.id === req.leave_type)
      await supabase
        .from('leave_balances')
        .insert({
          staff_id: req.staff_id,
          leave_type: req.leave_type,
          year,
          total_days: def?.defaultDays ?? 0,
          used_days: req.leave_days,
        })
    }

    // 更新本地狀態
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: 'approved' as const, reviewed_by: reviewerId, reviewed_at: now } : r
      ),
    }))

    return true
  },

  reject: async (id, reviewerId, reason) => {
    if (!supabase) return false
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: now,
        reject_reason: reason,
      })
      .eq('id', id)
    if (error) {
      console.error('駁回請假失敗:', error.message)
      return false
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: 'rejected' as const, reviewed_by: reviewerId, reviewed_at: now, reject_reason: reason } : r
      ),
    }))

    return true
  },

  remove: async (id) => {
    if (!supabase) return false
    const req = get().requests.find((r) => r.id === id)
    if (!req) return false

    // 如果已核准，需回滾餘額和排班
    if (req.status === 'approved') {
      // 回滾餘額
      const year = new Date(req.start_date + 'T00:00:00').getFullYear()
      const { data: balData } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('staff_id', req.staff_id)
        .eq('leave_type', req.leave_type)
        .eq('year', year)
        .single()
      if (balData) {
        await supabase
          .from('leave_balances')
          .update({ used_days: Math.max(0, Number(balData.used_days) - req.leave_days) })
          .eq('id', balData.id)
      }

      // 刪除排班記錄
      const dates: string[] = []
      const start = new Date(req.start_date + 'T00:00:00')
      const end = new Date(req.end_date + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${day}`)
      }
      await supabase
        .from('schedules')
        .delete()
        .eq('staff_id', req.staff_id)
        .in('date', dates)
        .eq('attendance_type', req.leave_type)
    }

    // 刪除申請
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) {
      console.error('刪除請假申請失敗:', error.message)
      return false
    }

    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }))
    return true
  },
}))
