import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  sendTelegramToTargets,
  sendTelegramPhotosToTargets,
  getLeaveNotifyTargets,
  getAdminNotifyTargets,
} from '@/lib/telegram'
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
  photos?: File[]
  store_context?: string  // 'lehua' | 'xingnan' | 'kitchen'
}

interface LeaveState {
  requests: LeaveRequest[]
  loading: boolean

  fetchByStaff: (staffId: string) => Promise<void>
  fetchPending: () => Promise<void>
  fetchManagerPending: (storeContext: string, staffIds: string[]) => Promise<void>
  fetchAdminPending: () => Promise<void>
  fetchAll: (year?: number) => Promise<void>
  submit: (data: SubmitData) => Promise<boolean>
  managerApprove: (id: string, reviewerId: string) => Promise<boolean>
  managerReject: (id: string, reviewerId: string, reason: string) => Promise<boolean>
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

  // 後台用：只抓 manager_approved（主管已核准，等最終審核）
  fetchPending: async () => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'manager_approved')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('載入待審核請假失敗:', error.message)
    }
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  fetchAdminPending: async () => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'manager_approved')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('載入待最終審核請假失敗:', error.message)
    }
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  // 主管用：抓該店員工的 pending 請假
  fetchManagerPending: async (storeContext, staffIds) => {
    if (!supabase || staffIds.length === 0) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .in('staff_id', staffIds)
      .order('created_at', { ascending: false })
    if (error) {
      console.error(`載入${storeContext}待審核請假失敗:`, error.message)
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

    // 發送 Telegram 通知（僅通知該店主管，不通知後台管理員）
    const notifyTargets = await getLeaveNotifyTargets(data.store_context || '')
    const typeName = getLeaveTypeName(data.leave_type)
    const dateRange = data.start_date === data.end_date
      ? data.start_date
      : `${data.start_date} ~ ${data.end_date}`
    const dayPartLabel = data.day_part === 'full' ? '' : data.day_part === 'am' ? '（上半天）' : '（下半天）'
    const msg = [
      '📋 <b>請假申請（待主管審核）</b>',
      `👤 員工：${data.staff_name}`,
      `📅 日期：${dateRange}${dayPartLabel}（${leaveDays}天）`,
      `📝 假別：${typeName}`,
      data.reason ? `💬 事由：${data.reason}` : '',
    ].filter(Boolean).join('\n')

    if (notifyTargets.length > 0) {
      // 文字通知 fire-and-forget（私訊主管）
      sendTelegramToTargets(msg, notifyTargets)
        .then((ok) => { if (!ok) console.warn('[請假通知] 發送失敗') })
        .catch((err) => console.error('[請假通知] 錯誤:', err))

      // 照片需要 await，避免 modal 關閉後 File 物件被回收
      if (data.photos && data.photos.length > 0) {
        const caption = `📋 ${data.staff_name} 的請假附件`
        try {
          const photoPromise = sendTelegramPhotosToTargets(data.photos, caption, notifyTargets)
          const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000))
          const ok = await Promise.race([photoPromise, timeout])
          if (!ok) console.warn('[請假照片] 發送失敗或超時')
        } catch (err) {
          console.error('[請假照片] 錯誤:', err)
        }
      }
    }

    return true
  },

  // ── 主管審核 ──
  managerApprove: async (id, reviewerId) => {
    if (!supabase) return false

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'manager_approved',
        manager_reviewed_by: reviewerId,
        manager_reviewed_at: now,
      })
      .eq('id', id)
    if (error) {
      console.error('主管核准失敗:', error.message)
      return false
    }

    // 從 DB 查該筆請假（store.requests 可能不包含待審核資料）
    const { data: reqData } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .single()
    const req = reqData as LeaveRequest | null

    // 通知後台管理員
    if (req) {
      const adminTargets = await getAdminNotifyTargets()
      if (adminTargets.length > 0) {
        const typeName = getLeaveTypeName(req.leave_type)
        const dateRange = req.start_date === req.end_date
          ? req.start_date
          : `${req.start_date} ~ ${req.end_date}`
        const dayPartLabel = req.day_part === 'full' ? '' : req.day_part === 'am' ? '（上半天）' : '（下半天）'

        // 查員工姓名
        const { data: staffData } = await supabase
          .from('staff')
          .select('name')
          .eq('id', req.staff_id)
          .single()
        const staffName = staffData?.name || req.staff_id

        const msg = [
          '✅ <b>請假申請（主管已核准，待最終審核）</b>',
          `👤 員工：${staffName}`,
          `📅 日期：${dateRange}${dayPartLabel}（${req.leave_days}天）`,
          `📝 假別：${typeName}`,
          req.reason ? `💬 事由：${req.reason}` : '',
        ].filter(Boolean).join('\n')

        sendTelegramToTargets(msg, adminTargets)
          .then((ok) => { if (!ok) console.warn('[主管核准通知] 發送失敗') })
          .catch((err) => console.error('[主管核准通知] 錯誤:', err))
      }
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: 'manager_approved' as const, manager_reviewed_by: reviewerId, manager_reviewed_at: now } : r
      ),
    }))

    return true
  },

  managerReject: async (id, reviewerId, reason) => {
    if (!supabase) return false
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        manager_reviewed_by: reviewerId,
        manager_reviewed_at: now,
        reject_reason: reason,
      })
      .eq('id', id)
    if (error) {
      console.error('主管駁回失敗:', error.message)
      return false
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, status: 'rejected' as const, manager_reviewed_by: reviewerId, manager_reviewed_at: now, reject_reason: reason } : r
      ),
    }))

    return true
  },

  // ── 後台最終審核 ──
  approve: async (id, reviewerId) => {
    if (!supabase) return false

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
