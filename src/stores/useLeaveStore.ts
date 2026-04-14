import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import {
  sendTelegramToTargets,
  sendTelegramPhotosToTargets,
  getAdminNotifyTargets,
  getLeaveApproverChatIds,
  checkLeaveApproversReady,
  getAdminApproverChatIds,
  notifyStaffLeaveResult,
} from '@/lib/telegram'
import { calcLeaveDays, getLeaveTypeName, isPhotoRequired } from '@/lib/leave'
import type { LeaveRequest, LeaveType, DayPart } from '@/lib/leave'

// ── 送假資料 ────────────────────────────────────────────────
interface SubmitData {
  staff_id: string
  staff_name: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  day_part: DayPart
  reason: string
  proxy_name: string           // V2 必填
  other_leave_type_name: string // V2 選填（other_leave 時必填）
  photos?: File[]
  store_context?: string       // 'lehua' | 'xingnan' | 'kitchen'
}

// ── Store 介面 ──────────────────────────────────────────────
interface LeaveState {
  requests: LeaveRequest[]
  loading: boolean

  // ── 查詢 ──
  fetchByStaff: (staffId: string) => Promise<void>
  fetchPending: () => Promise<void>
  fetchAdminPending: () => Promise<void>
  fetchAll: (year?: number) => Promise<void>
  /** 第一主管：查 scope 內 status=pending 的申請 */
  fetchApprover1Pending: (scope: string, staffIds: string[]) => Promise<LeaveRequest[]>
  /** 第二主管：查 scope 內 status=approver1_approved 的申請 */
  fetchApprover2Pending: (scope: string, staffIds: string[]) => Promise<LeaveRequest[]>

  // ── 員工操作 ──
  submit: (data: SubmitData) => Promise<{ ok: boolean; error?: string }>
  resubmit: (id: string, data: SubmitData) => Promise<{ ok: boolean; error?: string }>
  submitPhoto: (id: string, photos: File[], staffName: string, scope: string) => Promise<boolean>
  remove: (id: string) => Promise<boolean>

  // ── 第一主管審核 ──
  approver1Approve: (id: string, approverId: string, note: string) => Promise<boolean>
  approver1Reject: (id: string, approverId: string, reason: string) => Promise<boolean>

  // ── 第二主管審核 ──
  approver2Approve: (id: string, approverId: string, note: string) => Promise<boolean>
  approver2Reject: (id: string, approverId: string, reason: string) => Promise<boolean>

  // ── 後台最終審核 ──
  approve: (id: string, reviewerId: string, note: string) => Promise<boolean>
  reject: (id: string, reviewerId: string, reason: string) => Promise<boolean>

  // ── 向後相容（舊版主管審核，保留供舊頁面呼叫，內部轉發至 approver1）──
  managerApprove: (id: string, reviewerId: string) => Promise<boolean>
  managerReject: (id: string, reviewerId: string, reason: string) => Promise<boolean>
  fetchManagerPending: (storeContext: string, staffIds: string[]) => Promise<void>
}

// ── 工具：建立請假訊息文字 ──────────────────────────────────
function buildLeaveMsg(params: {
  title: string
  staffName: string
  leaveDays: number
  leaveType: LeaveType
  otherLeaveTypeName: string
  startDate: string
  endDate: string
  dayPart: DayPart
  proxyName: string
  reason: string
  photoNote?: string
}): string {
  const typeName = params.leaveType === 'other_leave' && params.otherLeaveTypeName
    ? `其他（${params.otherLeaveTypeName}）`
    : getLeaveTypeName(params.leaveType)
  const dateRange = params.startDate === params.endDate
    ? params.startDate
    : `${params.startDate} ~ ${params.endDate}`
  const dayPartLabel = params.dayPart === 'full' ? '' : params.dayPart === 'am' ? '（上半天）' : '（下半天）'
  return [
    `<b>${params.title}</b>`,
    `👤 員工：${params.staffName}`,
    `📅 日期：${dateRange}${dayPartLabel}（${params.leaveDays}天）`,
    `📝 假別：${typeName}`,
    `🔄 代理人：${params.proxyName}`,
    params.reason ? `💬 事由：${params.reason}` : '',
    params.photoNote ? `📎 ${params.photoNote}` : '',
  ].filter(Boolean).join('\n')
}

// ── Store 實作 ──────────────────────────────────────────────
export const useLeaveStore = create<LeaveState>()((set, get) => ({
  requests: [],
  loading: false,

  // ── fetchByStaff ─────────────────────────────────────────
  fetchByStaff: async (staffId) => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('staff_id', staffId)
      .order('created_at', { ascending: false })
    if (error) console.error('載入請假記錄失敗:', error.message)
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  // ── fetchPending（後台用：查 manager_approved）───────────
  fetchPending: async () => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'manager_approved')
      .order('created_at', { ascending: false })
    if (error) console.error('載入待審核請假失敗:', error.message)
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  // ── fetchAdminPending（同 fetchPending，語義更清晰）───────
  fetchAdminPending: async () => {
    if (!supabase) return
    set({ loading: true })
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'manager_approved')
      .order('created_at', { ascending: false })
    if (error) console.error('載入待最終審核請假失敗:', error.message)
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  // ── fetchAll ─────────────────────────────────────────────
  fetchAll: async (year) => {
    if (!supabase) return
    set({ loading: true })
    let query = supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })
    if (year) {
      query = query
        .gte('start_date', `${year}-01-01`)
        .lte('start_date', `${year}-12-31`)
    }
    const { data, error } = await query
    if (error) console.error('載入所有請假記錄失敗:', error.message)
    set({ requests: (data as LeaveRequest[] | null) ?? [], loading: false })
  },

  // ── fetchApprover1Pending ─────────────────────────────────
  fetchApprover1Pending: async (scope, staffIds) => {
    if (!supabase || staffIds.length === 0) return []
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .in('staff_id', staffIds)
      .order('created_at', { ascending: false })
    if (error) console.error(`[fetchApprover1Pending] scope=${scope}:`, error.message)
    return (data as LeaveRequest[] | null) ?? []
  },

  // ── fetchApprover2Pending ─────────────────────────────────
  fetchApprover2Pending: async (scope, staffIds) => {
    if (!supabase || staffIds.length === 0) return []
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'approver1_approved')
      .in('staff_id', staffIds)
      .order('created_at', { ascending: false })
    if (error) console.error(`[fetchApprover2Pending] scope=${scope}:`, error.message)
    return (data as LeaveRequest[] | null) ?? []
  },

  // ── submit（員工送假）────────────────────────────────────
  submit: async (data) => {
    if (!supabase) return { ok: false, error: '系統未連線' }

    const scope = data.store_context || ''

    // 前置驗證：至少設定第一主管（第二主管為選配）
    const approverStatus = await checkLeaveApproversReady(scope)
    if (!approverStatus.ready) {
      return { ok: false, error: `${scope} 尚未設定主管，請聯絡管理員` }
    }

    const leaveDays = calcLeaveDays(data.start_date, data.end_date, data.day_part)
    const photoRequired = isPhotoRequired(data.leave_type)

    const record = {
      staff_id: data.staff_id,
      leave_type: data.leave_type,
      start_date: data.start_date,
      end_date: data.end_date,
      day_part: data.day_part,
      reason: data.reason,
      leave_days: leaveDays,
      status: 'pending',
      proxy_name: data.proxy_name,
      other_leave_type_name: data.other_leave_type_name,
      // 病假：有上傳照片就標為 true，否則 false（可事後補傳）
      photo_submitted: photoRequired && !!data.photos && data.photos.length > 0,
    }

    const { error: insertErr } = await supabase.from('leave_requests').insert(record)
    if (insertErr) {
      console.error('提交請假申請失敗:', insertErr.message)
      return { ok: false, error: '提交失敗，請重試' }
    }

    // 通知主管A + 主管B（同時發送，方案A）
    const [chatIds1, chatIds2] = await Promise.all([
      getLeaveApproverChatIds(scope, 1),
      getLeaveApproverChatIds(scope, 2),
    ])
    const allApproverChatIds = [...new Set([...chatIds1, ...chatIds2])]

    const photoNote = photoRequired && (!data.photos || data.photos.length === 0)
      ? '診斷書尚未上傳，員工將事後補傳'
      : undefined

    const msg = buildLeaveMsg({
      title: '📋 請假申請（待主管審核）',
      staffName: data.staff_name,
      leaveDays,
      leaveType: data.leave_type,
      otherLeaveTypeName: data.other_leave_type_name,
      startDate: data.start_date,
      endDate: data.end_date,
      dayPart: data.day_part,
      proxyName: data.proxy_name,
      reason: data.reason,
      photoNote,
    })

    if (allApproverChatIds.length > 0) {
      sendTelegramToTargets(msg, allApproverChatIds)
        .then((ok) => { if (!ok) console.warn('[請假通知] 主管通知發送失敗') })
        .catch((err) => console.error('[請假通知] 錯誤:', err))

      // 病假且有照片 → 傳照片
      if (data.photos && data.photos.length > 0) {
        const caption = `📋 ${data.staff_name} 的請假附件`
        try {
          const ok = await Promise.race([
            sendTelegramPhotosToTargets(data.photos, caption, allApproverChatIds),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 30000)),
          ])
          if (!ok) console.warn('[請假照片] 發送失敗或超時')
        } catch (err) {
          console.error('[請假照片] 錯誤:', err)
        }
      }
    }

    return { ok: true }
  },

  // ── resubmit（駁回後修改重送）────────────────────────────
  resubmit: async (id, data) => {
    if (!supabase) return { ok: false, error: '系統未連線' }

    const scope = data.store_context || ''

    // 前置驗證：至少設定第一主管（第二主管為選配）
    const approverStatus = await checkLeaveApproversReady(scope)
    if (!approverStatus.ready) {
      return { ok: false, error: `${scope} 尚未設定主管，請聯絡管理員` }
    }

    const leaveDays = calcLeaveDays(data.start_date, data.end_date, data.day_part)
    const photoRequired = isPhotoRequired(data.leave_type)

    // 清除所有舊簽核欄位，回到 pending
    const { error: updateErr } = await supabase
      .from('leave_requests')
      .update({
        leave_type: data.leave_type,
        start_date: data.start_date,
        end_date: data.end_date,
        day_part: data.day_part,
        reason: data.reason,
        leave_days: leaveDays,
        proxy_name: data.proxy_name,
        other_leave_type_name: data.other_leave_type_name,
        photo_submitted: photoRequired && !!data.photos && data.photos.length > 0,
        status: 'pending',
        // 清除所有簽核痕跡
        approver1_id: null,
        approver1_at: null,
        approver1_note: '',
        approver2_id: null,
        approver2_at: null,
        approver2_note: '',
        reviewed_by: null,
        reviewed_at: null,
        admin_approve_note: '',
        rejected_by: null,
        rejected_at: null,
        reject_reason: '',
        manager_reviewed_by: null,
        manager_reviewed_at: null,
      })
      .eq('id', id)
      .eq('status', 'rejected') // 只允許在 rejected 狀態下重送

    if (updateErr) {
      console.error('重送請假失敗:', updateErr.message)
      return { ok: false, error: '重送失敗，請重試' }
    }

    // 重新通知主管
    const [chatIds1, chatIds2] = await Promise.all([
      getLeaveApproverChatIds(scope, 1),
      getLeaveApproverChatIds(scope, 2),
    ])
    const allApproverChatIds = [...new Set([...chatIds1, ...chatIds2])]

    const msg = buildLeaveMsg({
      title: '📋 請假申請（修改重送）',
      staffName: data.staff_name,
      leaveDays,
      leaveType: data.leave_type,
      otherLeaveTypeName: data.other_leave_type_name,
      startDate: data.start_date,
      endDate: data.end_date,
      dayPart: data.day_part,
      proxyName: data.proxy_name,
      reason: data.reason,
    })

    if (allApproverChatIds.length > 0) {
      sendTelegramToTargets(msg, allApproverChatIds)
        .catch((err) => console.error('[重送通知] 錯誤:', err))
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          leave_type: data.leave_type,
          start_date: data.start_date,
          end_date: data.end_date,
          day_part: data.day_part,
          reason: data.reason,
          leave_days: leaveDays,
          proxy_name: data.proxy_name,
          other_leave_type_name: data.other_leave_type_name,
          photo_submitted: photoRequired && !!data.photos && data.photos.length > 0,
          status: 'pending' as const,
          approver1_id: null, approver1_at: null, approver1_note: '',
          approver2_id: null, approver2_at: null, approver2_note: '',
          reviewed_by: null, reviewed_at: null, admin_approve_note: '',
          rejected_by: null, rejected_at: null, reject_reason: '',
        } : r
      ),
    }))

    return { ok: true }
  },

  // ── submitPhoto（病假補傳診斷書）────────────────────────
  submitPhoto: async (id, photos, staffName, scope) => {
    if (!supabase) return false

    // 更新 photo_submitted
    const { error } = await supabase
      .from('leave_requests')
      .update({ photo_submitted: true })
      .eq('id', id)

    if (error) {
      console.error('補傳照片狀態更新失敗:', error.message)
      return false
    }

    // 傳照片給主管
    const [chatIds1, chatIds2] = await Promise.all([
      getLeaveApproverChatIds(scope, 1),
      getLeaveApproverChatIds(scope, 2),
    ])
    const allApproverChatIds = [...new Set([...chatIds1, ...chatIds2])]

    if (allApproverChatIds.length > 0 && photos.length > 0) {
      const caption = `📎 ${staffName} 補傳病假診斷書`
      sendTelegramPhotosToTargets(photos, caption, allApproverChatIds)
        .then((ok) => { if (!ok) console.warn('[補傳照片] 發送失敗') })
        .catch((err) => console.error('[補傳照片] 錯誤:', err))
    }

    // 通知主管補傳完成
    if (allApproverChatIds.length > 0) {
      sendTelegramToTargets(
        `📎 <b>病假診斷書補傳</b>\n👤 員工：${staffName}\n✅ 診斷書已上傳，請查看上方照片`,
        allApproverChatIds
      ).catch((err) => console.error('[補傳通知] 錯誤:', err))
    }

    set((s) => ({
      requests: s.requests.map((r) => r.id === id ? { ...r, photo_submitted: true } : r),
    }))

    return true
  },

  // ── remove（刪除申請）────────────────────────────────────
  remove: async (id) => {
    if (!supabase) return false
    const req = get().requests.find((r) => r.id === id)
    if (!req) return false

    // 已核准 → 先回滾餘額和排班
    if (req.status === 'approved') {
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

      const dates: string[] = []
      const start = new Date(req.start_date + 'T00:00:00')
      const end   = new Date(req.end_date   + 'T00:00:00')
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const y  = d.getFullYear()
        const m  = String(d.getMonth() + 1).padStart(2, '0')
        const dy = String(d.getDate()).padStart(2, '0')
        dates.push(`${y}-${m}-${dy}`)
      }
      await supabase
        .from('schedules')
        .delete()
        .eq('staff_id', req.staff_id)
        .in('date', dates)
        .eq('attendance_type', req.leave_type)
    }

    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) { console.error('刪除請假申請失敗:', error.message); return false }

    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }))
    return true
  },

  // ── approver1Approve（第一主管核准）─────────────────────
  approver1Approve: async (id, approverId, note) => {
    if (!supabase) return false
    const now = new Date().toISOString()

    // 取得此假單資料，從 staff.group_id 推算 scope，判斷是否有第二主管
    const { data: reqData } = await supabase
      .from('leave_requests').select('*').eq('id', id).single()
    if (!reqData) return false
    const req = reqData as LeaveRequest

    const { data: staffRow } = await supabase
      .from('staff').select('group_id').eq('id', req.staff_id).single()
    const scope = (staffRow?.group_id as string | null) ?? ''
    const approverStatus = await checkLeaveApproversReady(scope)
    // 有第二主管 → approver1_approved；無第二主管 → 直接跳 manager_approved
    const nextStatus = approverStatus.approver2Count >= 1
      ? 'approver1_approved'
      : 'manager_approved'

    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      approver1_id: approverId,
      approver1_at: now,
      approver1_note: note,
    }
    // 無第二主管時同步寫向後相容欄位
    if (nextStatus === 'manager_approved') {
      updatePayload.manager_reviewed_by = approverId
      updatePayload.manager_reviewed_at = now
    }

    const { error } = await supabase
      .from('leave_requests')
      .update(updatePayload)
      .eq('id', id)

    if (error) { console.error('第一主管核准失敗:', error.message); return false }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: nextStatus as LeaveRequest['status'],
          approver1_id: approverId,
          approver1_at: now,
          approver1_note: note,
        } : r
      ),
    }))

    // 無第二主管時，直接通知 admin 進行最終審核
    if (nextStatus === 'manager_approved') {
      const { data: staffData } = await supabase
        .from('staff').select('name').eq('id', req.staff_id).single()
      const staffName = staffData?.name || req.staff_id

      const adminChatIds = await getAdminApproverChatIds()
      const targets = adminChatIds.length > 0
        ? adminChatIds
        : await getAdminNotifyTargets()

      if (targets.length > 0) {
        const typeName = req.leave_type === 'other_leave' && req.other_leave_type_name
          ? `其他（${req.other_leave_type_name}）`
          : getLeaveTypeName(req.leave_type)
        const dateRange = req.start_date === req.end_date
          ? req.start_date
          : `${req.start_date} ~ ${req.end_date}`
        sendTelegramToTargets([
          '✅ <b>請假申請（主管已核准，待最終審核）</b>',
          `👤 員工：${staffName}`,
          `📅 日期：${dateRange}（${req.leave_days}天）`,
          `📝 假別：${typeName}`,
          `🔄 代理人：${req.proxy_name}`,
          req.reason ? `💬 事由：${req.reason}` : '',
          note ? `📌 主管備注：${note}` : '',
        ].filter(Boolean).join('\n'), targets)
          .catch((err) => console.error('[第一主管單簽通知admin] 錯誤:', err))
      }
    }

    console.log(`[approver1Approve] id=${id} by=${approverId} nextStatus=${nextStatus}`)
    return true
  },

  // ── approver1Reject（第一主管駁回）──────────────────────
  approver1Reject: async (id, approverId, reason) => {
    if (!supabase) return false
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejected_by: approverId,
        rejected_at: now,
        reject_reason: reason,
      })
      .eq('id', id)

    if (error) { console.error('第一主管駁回失敗:', error.message); return false }

    // 查員工資料，通知員工本人
    const { data: reqData } = await supabase
      .from('leave_requests').select('*').eq('id', id).single()
    if (reqData) {
      const req = reqData as LeaveRequest
      const { data: approverData } = await supabase
        .from('staff').select('name').eq('id', approverId).single()
      const approverName = approverData?.name || approverId
      notifyStaffLeaveResult(req.staff_id, [
        '❌ <b>請假申請已駁回</b>',
        `📝 假別：${getLeaveTypeName(req.leave_type)}`,
        `📅 日期：${req.start_date}${req.start_date !== req.end_date ? ` ~ ${req.end_date}` : ''}`,
        `🚫 駁回主管：${approverName}`,
        reason ? `💬 駁回原因：${reason}` : '',
        '💡 您可以修改後重新送出申請',
      ].filter(Boolean).join('\n'))
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: 'rejected' as const,
          rejected_by: approverId,
          rejected_at: now,
          reject_reason: reason,
        } : r
      ),
    }))

    return true
  },

  // ── approver2Approve（第二主管核准）─────────────────────
  approver2Approve: async (id, approverId, note) => {
    if (!supabase) return false
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'manager_approved',
        approver2_id: approverId,
        approver2_at: now,
        approver2_note: note,
        // 向後相容欄位同步寫入
        manager_reviewed_by: approverId,
        manager_reviewed_at: now,
      })
      .eq('id', id)

    if (error) { console.error('第二主管核准失敗:', error.message); return false }

    // 通知 admin（V2：從 user_pins 查；fallback：舊版 app_settings）
    const { data: reqData } = await supabase
      .from('leave_requests').select('*').eq('id', id).single()
    if (reqData) {
      const req = reqData as LeaveRequest
      const { data: staffData } = await supabase
        .from('staff').select('name').eq('id', req.staff_id).single()
      const staffName = staffData?.name || req.staff_id

      const adminChatIds = await getAdminApproverChatIds()
      const targets = adminChatIds.length > 0
        ? adminChatIds
        : await getAdminNotifyTargets() // fallback 舊版

      if (targets.length > 0) {
        const typeName = req.leave_type === 'other_leave' && req.other_leave_type_name
          ? `其他（${req.other_leave_type_name}）`
          : getLeaveTypeName(req.leave_type)
        const dateRange = req.start_date === req.end_date
          ? req.start_date
          : `${req.start_date} ~ ${req.end_date}`
        sendTelegramToTargets([
          '✅ <b>請假申請（雙主管已核准，待最終審核）</b>',
          `👤 員工：${staffName}`,
          `📅 日期：${dateRange}（${req.leave_days}天）`,
          `📝 假別：${typeName}`,
          `🔄 代理人：${req.proxy_name}`,
          req.reason ? `💬 事由：${req.reason}` : '',
          note ? `📌 第二主管備注：${note}` : '',
        ].filter(Boolean).join('\n'), targets)
          .catch((err) => console.error('[第二主管核准通知] 錯誤:', err))
      }
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: 'manager_approved' as const,
          approver2_id: approverId,
          approver2_at: now,
          approver2_note: note,
          manager_reviewed_by: approverId,
          manager_reviewed_at: now,
        } : r
      ),
    }))

    return true
  },

  // ── approver2Reject（第二主管駁回）──────────────────────
  approver2Reject: async (id, approverId, reason) => {
    if (!supabase) return false
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        rejected_by: approverId,
        rejected_at: now,
        reject_reason: reason,
      })
      .eq('id', id)

    if (error) { console.error('第二主管駁回失敗:', error.message); return false }

    const { data: reqData } = await supabase
      .from('leave_requests').select('*').eq('id', id).single()
    if (reqData) {
      const req = reqData as LeaveRequest
      const { data: approverData } = await supabase
        .from('staff').select('name').eq('id', approverId).single()
      const approverName = approverData?.name || approverId
      notifyStaffLeaveResult(req.staff_id, [
        '❌ <b>請假申請已駁回</b>',
        `📝 假別：${getLeaveTypeName(req.leave_type)}`,
        `📅 日期：${req.start_date}${req.start_date !== req.end_date ? ` ~ ${req.end_date}` : ''}`,
        `🚫 駁回主管：${approverName}`,
        reason ? `💬 駁回原因：${reason}` : '',
        '💡 您可以修改後重新送出申請',
      ].filter(Boolean).join('\n'))
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: 'rejected' as const,
          rejected_by: approverId,
          rejected_at: now,
          reject_reason: reason,
        } : r
      ),
    }))

    return true
  },

  // ── approve（後台最終核准）───────────────────────────────
  approve: async (id, reviewerId, note) => {
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
        admin_approve_note: note,
      })
      .eq('id', id)

    if (error) { console.error('後台核准失敗:', error.message); return false }

    // 2. 寫入排班表
    const dates: string[] = []
    const start = new Date(req.start_date + 'T00:00:00')
    const end   = new Date(req.end_date   + 'T00:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const y  = d.getFullYear()
      const m  = String(d.getMonth() + 1).padStart(2, '0')
      const dy = String(d.getDate()).padStart(2, '0')
      dates.push(`${y}-${m}-${dy}`)
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
    if (schedError) console.error('寫入排班表失敗:', schedError.message)

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

    // 4. 通知員工本人（若有 telegram_id）
    const typeName = req.leave_type === 'other_leave' && req.other_leave_type_name
      ? `其他（${req.other_leave_type_name}）`
      : getLeaveTypeName(req.leave_type)
    const dateRange = req.start_date === req.end_date
      ? req.start_date
      : `${req.start_date} ~ ${req.end_date}`
    const { data: reviewerData } = await supabase
      .from('staff').select('name').eq('id', reviewerId).single()
    const reviewerName = reviewerData?.name || reviewerId

    notifyStaffLeaveResult(req.staff_id, [
      '✅ <b>請假申請已核准</b>',
      `📝 假別：${typeName}`,
      `📅 日期：${dateRange}（${req.leave_days}天）`,
      `👨‍💼 核准人：${reviewerName}`,
      note ? `💬 備注：${note}` : '',
    ].filter(Boolean).join('\n'))

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: 'approved' as const,
          reviewed_by: reviewerId,
          reviewed_at: now,
          admin_approve_note: note,
        } : r
      ),
    }))

    return true
  },

  // ── reject（後台駁回）────────────────────────────────────
  reject: async (id, reviewerId, reason) => {
    if (!supabase) return false
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewerId,
        reviewed_at: now,
        rejected_by: reviewerId,
        rejected_at: now,
        reject_reason: reason,
      })
      .eq('id', id)

    if (error) { console.error('後台駁回失敗:', error.message); return false }

    const req = get().requests.find((r) => r.id === id)
    if (req) {
      const { data: reviewerData } = await supabase
        .from('staff').select('name').eq('id', reviewerId).single()
      const reviewerName = reviewerData?.name || reviewerId
      const typeName = getLeaveTypeName(req.leave_type)
      const dateRange = req.start_date === req.end_date
        ? req.start_date
        : `${req.start_date} ~ ${req.end_date}`

      notifyStaffLeaveResult(req.staff_id, [
        '❌ <b>請假申請已駁回</b>',
        `📝 假別：${typeName}`,
        `📅 日期：${dateRange}`,
        `🚫 駁回人：${reviewerName}`,
        reason ? `💬 駁回原因：${reason}` : '',
        '💡 您可以修改後重新送出申請',
      ].filter(Boolean).join('\n'))
    }

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? {
          ...r,
          status: 'rejected' as const,
          reviewed_by: reviewerId,
          reviewed_at: now,
          rejected_by: reviewerId,
          rejected_at: now,
          reject_reason: reason,
        } : r
      ),
    }))

    return true
  },

  // ── 向後相容：舊版 managerApprove → 轉發至 approver1Approve ──
  managerApprove: async (id, reviewerId) => {
    // 舊頁面呼叫時沒有 note，傳空字串（舊資料不要求必填）
    return get().approver1Approve(id, reviewerId, '')
  },

  // ── 向後相容：舊版 managerReject → 轉發至 approver1Reject ──
  managerReject: async (id, reviewerId, reason) => {
    return get().approver1Reject(id, reviewerId, reason)
  },

  // ── 向後相容：fetchManagerPending → 轉發至 fetchApprover1Pending ──
  fetchManagerPending: async (storeContext, staffIds) => {
    const results = await get().fetchApprover1Pending(storeContext, staffIds)
    set({ requests: results })
  },
}))
