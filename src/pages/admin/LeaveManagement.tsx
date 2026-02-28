import { useState, useEffect, useMemo, useCallback } from 'react'
import { TopNav } from '@/components/TopNav'
import { useLeaveStore } from '@/stores/useLeaveStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { useToast } from '@/components/Toast'
import { getSession } from '@/lib/auth'
import { TRACKED_LEAVE_TYPES } from '@/lib/leave'
import { supabase } from '@/lib/supabase'
import LeaveRequestCard from '@/components/LeaveRequestCard'
import type { LeaveBalance } from '@/lib/leave'

type Tab = 'review' | 'balance'

export default function LeaveManagement() {
  const [tab, setTab] = useState<Tab>('review')
  const { requests, loading, fetchPending, fetchAll, approve, reject, remove } = useLeaveStore()
  const kitchenStaff = useStaffStore((s) => s.kitchenStaff)
  const storeStaff = useStaffStore((s) => s.storeStaff)
  const stores = useStoreStore((s) => s.items)
  const { showToast } = useToast()
  const session = getSession()

  const [showHistory, setShowHistory] = useState(false)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 取得所有員工名稱 map
  const staffNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    kitchenStaff.forEach((s) => { map[s.id] = s.name })
    Object.values(storeStaff).forEach((list) => {
      list.forEach((s) => { map[s.id] = s.name })
    })
    return map
  }, [kitchenStaff, storeStaff])

  // 所有員工列表（去重）
  const allStaff = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string; group: string }[] = []
    kitchenStaff.forEach((s) => {
      if (!seen.has(s.id)) { seen.add(s.id); result.push({ ...s, group: '央廚' }) }
    })
    stores.forEach((store) => {
      const list = storeStaff[store.id] || []
      list.forEach((s) => {
        if (!seen.has(s.id)) { seen.add(s.id); result.push({ ...s, group: store.name }) }
      })
    })
    return result
  }, [kitchenStaff, storeStaff, stores])

  useEffect(() => {
    if (tab === 'review') {
      if (showHistory) {
        fetchAll()
      } else {
        fetchPending()
      }
    }
  }, [tab, showHistory, fetchPending, fetchAll])

  const handleApprove = async (id: string) => {
    if (!session) return
    const ok = await approve(id, session.staffId)
    if (ok) {
      showToast('已核准')
      fetchPending()
    } else {
      showToast('核准失敗', 'error')
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectId || !session) return
    const ok = await reject(rejectId, session.staffId, rejectReason)
    if (ok) {
      showToast('已駁回')
      setRejectId(null)
      setRejectReason('')
      fetchPending()
    } else {
      showToast('駁回失敗', 'error')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆請假申請嗎？（已核准的會回滾餘額和排班）')) return
    const ok = await remove(id)
    if (ok) {
      showToast('已刪除')
      if (showHistory) fetchAll()
      else fetchPending()
    } else {
      showToast('刪除失敗', 'error')
    }
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const historyRequests = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="page-container">
      <TopNav title="請假管理" backTo="/admin" />

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-2">
        {[
          { id: 'review' as const, label: '請假審核' },
          { id: 'balance' as const, label: '假別餘額' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-oak text-white' : 'bg-gray-100 text-brand-mocha'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'review' && (
        <div className="px-4 py-3 space-y-3">
          {/* 待審核 */}
          <h3 className="text-sm font-bold text-brand-oak">
            待審核 ({pendingRequests.length})
          </h3>
          {loading && <p className="text-sm text-brand-lotus">載入中...</p>}
          {!loading && pendingRequests.length === 0 && (
            <p className="text-sm text-brand-lotus">目前沒有待審核的請假申請</p>
          )}
          {pendingRequests.map((req) => (
            <LeaveRequestCard
              key={req.id}
              request={req}
              showStaffName={staffNameMap[req.staff_id] || req.staff_id}
              onApprove={() => handleApprove(req.id)}
              onReject={() => { setRejectId(req.id); setRejectReason('') }}
              onDelete={() => handleDelete(req.id)}
            />
          ))}

          {/* 歷史 */}
          <button
            onClick={() => { setShowHistory(!showHistory) }}
            className="text-xs text-brand-lotus underline"
          >
            {showHistory ? '隱藏歷史記錄' : '顯示歷史記錄'}
          </button>
          {showHistory && historyRequests.length > 0 && (
            <div className="space-y-2">
              {historyRequests.map((req) => (
                <LeaveRequestCard
                  key={req.id}
                  request={req}
                  showStaffName={staffNameMap[req.staff_id] || req.staff_id}
                  onDelete={() => handleDelete(req.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'balance' && (
        <BalanceTab allStaff={allStaff} />
      )}

      {/* 駁回彈窗 */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRejectId(null)}>
          <div className="bg-white rounded-2xl w-[90%] max-w-sm p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-brand-oak mb-3">駁回原因</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="請輸入駁回原因"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectId(null)}
                className="flex-1 py-2 rounded-lg bg-gray-100 text-brand-mocha text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={handleRejectConfirm}
                className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium"
              >
                確認駁回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 假別餘額 Tab ──────────────────────────────────────
function BalanceTab({ allStaff }: { allStaff: { id: string; name: string; group: string }[] }) {
  const year = new Date().getFullYear()
  const [balanceMap, setBalanceMap] = useState<Record<string, LeaveBalance[]>>({})
  const [loading, setLoading] = useState(false)
  const [editingCell, setEditingCell] = useState<{ staffId: string; leaveType: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const loadAll = useCallback(async () => {
    if (!supabase || allStaff.length === 0) return
    setLoading(true)
    const staffIds = allStaff.map((s) => s.id)
    const { data } = await supabase
      .from('leave_balances')
      .select('*')
      .in('staff_id', staffIds)
      .eq('year', year)

    const map: Record<string, LeaveBalance[]> = {}
    if (data) {
      for (const row of data as LeaveBalance[]) {
        if (!map[row.staff_id]) map[row.staff_id] = []
        map[row.staff_id].push(row)
      }
    }
    setBalanceMap(map)
    setLoading(false)
  }, [allStaff, year])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const getBalance = (staffId: string, leaveType: string): LeaveBalance | undefined => {
    return balanceMap[staffId]?.find((b) => b.leave_type === leaveType)
  }

  const handleSaveTotal = async (staffId: string, leaveType: string) => {
    if (!supabase) return
    const newTotal = parseFloat(editValue)
    if (isNaN(newTotal) || newTotal < 0) {
      setEditingCell(null)
      return
    }

    const bal = getBalance(staffId, leaveType)
    if (bal) {
      await supabase.from('leave_balances').update({ total_days: newTotal }).eq('id', bal.id)
    } else {
      await supabase.from('leave_balances').insert({
        staff_id: staffId,
        leave_type: leaveType,
        year,
        total_days: newTotal,
        used_days: 0,
      })
    }

    setEditingCell(null)
    loadAll()
  }

  if (loading) return <p className="px-4 py-3 text-sm text-brand-lotus">載入中...</p>

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-brand-lotus mb-3">{year} 年度（點擊總額可編輯）</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-brand-oak font-medium">員工</th>
              {TRACKED_LEAVE_TYPES.map((t) => (
                <th key={t.id} className="text-center py-2 text-brand-oak font-medium px-2">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allStaff.map((staff) => (
              <tr key={staff.id} className="border-b border-gray-100">
                <td className="py-2">
                  <span className="text-sm text-brand-oak font-medium">{staff.name}</span>
                  <span className="text-[10px] text-brand-lotus ml-1">({staff.group})</span>
                </td>
                {TRACKED_LEAVE_TYPES.map((t) => {
                  const bal = getBalance(staff.id, t.id)
                  const used = bal ? Number(bal.used_days) : 0
                  const total = bal ? Number(bal.total_days) : t.defaultDays
                  const isEditing = editingCell?.staffId === staff.id && editingCell?.leaveType === t.id

                  return (
                    <td key={t.id} className="text-center py-2 px-2">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleSaveTotal(staff.id, t.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveTotal(staff.id, t.id)
                            if (e.key === 'Escape') setEditingCell(null)
                          }}
                          autoFocus
                          className="w-14 text-center border rounded px-1 py-0.5 text-sm"
                          min={0}
                          step={0.5}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 rounded px-1 py-0.5"
                          onClick={() => {
                            setEditingCell({ staffId: staff.id, leaveType: t.id })
                            setEditValue(String(total))
                          }}
                        >
                          <span className={used > 0 ? 'text-brand-lotus' : 'text-gray-400'}>{used}</span>
                          <span className="text-gray-300">/</span>
                          <span className="text-brand-oak">{total}</span>
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {allStaff.length === 0 && (
        <p className="text-sm text-brand-lotus mt-3">尚無員工資料</p>
      )}
    </div>
  )
}
