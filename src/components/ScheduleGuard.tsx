import { Outlet } from 'react-router-dom'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import { getSession, clearSession } from '@/lib/auth'

/**
 * 排班管理權限守衛
 * 允許 admin 角色直接通過，其他角色需在 user_pins 中有 can_schedule = true
 */
export default function ScheduleGuard() {
  const canSchedule = useCanSchedule()
  const session = getSession()

  if (!session) return null

  if (!canSchedule) {
    const homePath = session.role === 'kitchen' ? '/kitchen'
      : session.role === 'store' ? `/store/${session.allowedStores[0] || 'lehua'}`
      : '/admin'

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">📅</p>
          <h2 className="text-lg font-bold text-brand-oak mb-2">需要排班權限</h2>
          <p className="text-sm text-brand-lotus mb-4">請聯絡管理者開啟排班管理權限</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { window.location.href = homePath }}
              className="px-6 py-2 rounded-xl bg-brand-mocha text-white text-sm font-medium active:scale-95 transition-transform"
            >
              返回首頁
            </button>
            <button
              onClick={() => { clearSession(); window.location.reload() }}
              className="px-6 py-2 rounded-xl bg-brand-lotus text-white text-sm font-medium active:scale-95 transition-transform"
            >
              切換帳號
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}
