// 請假系統常數與型別

export const TRACKED_LEAVE_TYPES = [
  { id: 'annual_leave',   name: '特休', defaultDays: 7 },
  { id: 'sick_leave',     name: '病假', defaultDays: 30 },
  { id: 'personal_leave', name: '事假', defaultDays: 14 },
] as const

export const DAY_PARTS = [
  { id: 'full', name: '全天' },
  { id: 'am',   name: '上半天' },
  { id: 'pm',   name: '下半天' },
] as const

export type LeaveType = typeof TRACKED_LEAVE_TYPES[number]['id']
export type DayPart = typeof DAY_PARTS[number]['id']
export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  staff_id: string
  leave_type: LeaveType
  start_date: string
  end_date: string
  day_part: DayPart
  reason: string
  status: LeaveStatus
  leave_days: number
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string
  created_at: string
}

export interface LeaveBalance {
  id: string
  staff_id: string
  leave_type: LeaveType
  year: number
  total_days: number
  used_days: number
}

export function calcLeaveDays(startDate: string, endDate: string, dayPart: DayPart): number {
  if (dayPart !== 'full') return 0.5
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export function getLeaveTypeName(id: string): string {
  return TRACKED_LEAVE_TYPES.find((t) => t.id === id)?.name ?? id
}
