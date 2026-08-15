import { useState, useEffect } from 'react'
import { getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { isLeaveObserver } from '@/lib/leave'

/**
 * 紅點種類：
 *   'action' = 主管，等你簽核（紅色實心，要你動作）
 *   'info'   = 觀察者（老闆/隱藏帳號），純資訊（灰色外框，不催你）
 *   null     = 不顯示
 */
export type LeaveBadgeKind = 'action' | 'info' | null

export interface LeaveBadge {
  count: number
  kind: LeaveBadgeKind
}

/**
 * 一筆 pending 假單是否「還等本人簽核」。
 * 無順序雙簽：兩位主管同級，誰先簽都行；自己簽過的就不該再出現在待辦。
 * 判斷錯了紅點會永遠是 0（假單看似消失），故獨立出來並加測試。
 */
export function needsMySignature(
  approver1Id: string | null | undefined,
  myStaffId: string
): boolean {
  return approver1Id !== myStaffId
}

/**
 * 回傳排班表入口要顯示的請假提示。
 *
 * 主管   → kind='action'，數字 = 還等你簽的筆數（自己簽過的不算）
 * 觀察者 → kind='info'，數字 = 該單位所有待簽核筆數（純資訊，不催你）
 * 其他人 → kind=null，不顯示
 *
 * @param scope 'kitchen' | 'lehua' | 'xingnan'
 * @param staffIds 該 scope 底下的員工 id
 */
export function useLeavePendingCount(scope: string, staffIds: string[]): LeaveBadge {
  const [badge, setBadge] = useState<LeaveBadge>({ count: 0, kind: null })

  // 用字串當依賴，避免呼叫端每次 render 產生新陣列造成無限 refetch
  const staffKey = staffIds.join(',')

  useEffect(() => {
    const session = getSession()
    if (!supabase || !session?.staffId || !scope || staffKey === '') return
    let cancelled = false

    ;(async () => {
      // 1. 查本人是不是此單位的主管
      const { data: pin } = await supabase!
        .from('user_pins')
        .select('leave_approver_order')
        .eq('staff_id', session.staffId)
        .eq('is_leave_approver', true)
        .eq('leave_approver_scope', scope)
        .eq('is_active', true)
        .maybeSingle()

      const order = pin?.leave_approver_order
      const isApprover = order === 1 || order === 2
      const observer = isLeaveObserver(session.staffId, session.role)

      // 既不是主管也不是觀察者 → 不顯示
      if (!isApprover && !observer) {
        if (!cancelled) setBadge({ count: 0, kind: null })
        return
      }

      // 2. 查 pending 單（只取 approver1_id，不拉整筆）
      const { data: rows } = await supabase!
        .from('leave_requests')
        .select('approver1_id')
        .eq('status', 'pending')
        .in('staff_id', staffKey.split(','))

      const all = rows ?? []
      // 主管優先：只算還等自己簽的；純觀察者算全部待簽
      const count = isApprover
        ? all.filter((r) => needsMySignature(r.approver1_id as string | null, session.staffId)).length
        : all.length

      if (!cancelled) setBadge({ count, kind: isApprover ? 'action' : 'info' })
    })()

    return () => { cancelled = true }
  }, [scope, staffKey])

  return badge
}
