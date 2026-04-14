// 請假系統常數與型別 — V2

// ── 假別清單 ──────────────────────────────────────────────
export const TRACKED_LEAVE_TYPES = [
  { id: 'annual_leave',   name: '特休',  defaultDays: 7,  requirePhoto: false },
  { id: 'sick_leave',     name: '病假',  defaultDays: 30, requirePhoto: true  },
  { id: 'personal_leave', name: '事假',  defaultDays: 14, requirePhoto: false },
  { id: 'comp_leave',     name: '補休',  defaultDays: 0,  requirePhoto: false },
  { id: 'other_leave',    name: '其他',  defaultDays: 0,  requirePhoto: false },
] as const

// ── 時段 ──────────────────────────────────────────────────
export const DAY_PARTS = [
  { id: 'full', name: '全天' },
  { id: 'am',   name: '上半天' },
  { id: 'pm',   name: '下半天' },
] as const

// ── 型別 ──────────────────────────────────────────────────
export type LeaveType = typeof TRACKED_LEAVE_TYPES[number]['id']
export type DayPart   = typeof DAY_PARTS[number]['id']

export type LeaveStatus =
  | 'pending'             // 員工已送出，等第一主管審核
  | 'approver1_approved'  // 第一主管已核准，等第二主管審核
  | 'manager_approved'    // 雙主管都已核准，等 admin 最終審核
  | 'approved'            // 完全核准，已寫入排班 + 扣假別餘額
  | 'rejected'            // 任一關駁回

export interface LeaveRequest {
  // ── 基本資料 ──
  id: string
  staff_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  day_part: DayPart
  reason: string
  status: LeaveStatus
  leave_days: number
  created_at: string

  // ── V2 新增：送假必填 ──
  proxy_name: string              // 代理人姓名（必填，文字）
  other_leave_type_name: string   // 假別選「其他」時必填
  photo_submitted: boolean        // 病假診斷書是否已補傳

  // ── V2 新增：第一主管簽核 ──
  approver1_id: string | null
  approver1_at: string | null
  approver1_note: string          // 核准備注（必填）

  // ── V2 新增：第二主管簽核 ──
  approver2_id: string | null
  approver2_at: string | null
  approver2_note: string          // 核准備注（必填）

  // ── V2 新增：後台最終審核 ──
  reviewed_by: string | null      // admin staff_id
  reviewed_at: string | null
  admin_approve_note: string      // 後台核准備注（必填）

  // ── V2 新增：駁回記錄 ──
  rejected_by: string | null      // 任一關駁回者 staff_id
  rejected_at: string | null
  reject_reason: string           // 駁回原因

  // ── 向後相容：舊欄位保留（勿移除）──
  manager_reviewed_by: string | null   // 舊版主管審核，現由 approver2 接管
  manager_reviewed_at: string | null
}

export interface LeaveBalance {
  id: string
  staff_id: string
  leave_type: LeaveType
  year: number
  total_days: number
  used_days: number
}

// ── 工具函式 ─────────────────────────────────────────────

export function calcLeaveDays(startDate: string, endDate: string, dayPart: DayPart): number {
  if (dayPart !== 'full') return 0.5
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate   + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export function getLeaveTypeName(id: string): string {
  return TRACKED_LEAVE_TYPES.find((t) => t.id === id)?.name ?? id
}

/** 該假別是否要求上傳照片（病假） */
export function isPhotoRequired(leaveType: LeaveType): boolean {
  return TRACKED_LEAVE_TYPES.find((t) => t.id === leaveType)?.requirePhoto ?? false
}

/** 取得 LeaveStatus 的中文顯示標籤 */
export function getLeaveStatusLabel(status: LeaveStatus): string {
  switch (status) {
    case 'pending':            return '待主管審核'
    case 'approver1_approved': return '待第二主管審核'
    case 'manager_approved':   return '待最終審核'
    case 'approved':           return '已核准'
    case 'rejected':           return '已駁回'
  }
}
