import { useState, useEffect, useCallback } from 'react'
import { useParams, Outlet } from 'react-router-dom'
import { getSession, isAuthorized, clearSession, getRoleHomePath, type AuthSession, type RoleRequirement } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import PinEntry from '@/pages/PinEntry'

interface AuthGuardProps {
  requiredRole: RoleRequirement
}

const HASPINS_KEY = 'yba_has_pins'

// Read hasPins from sessionStorage for instant page loads
function getCachedHasPins(): boolean | null {
  try {
    const v = sessionStorage.getItem(HASPINS_KEY)
    if (v === 'true') return true
    if (v === 'false') return false
    return null
  } catch {
    return null
  }
}

function setCachedHasPins(val: boolean) {
  try {
    sessionStorage.setItem(HASPINS_KEY, String(val))
  } catch { /* ignore */ }
}

export default function AuthGuard({ requiredRole }: AuthGuardProps) {
  const { storeId } = useParams<{ storeId: string }>()
  const [session, setSessionState] = useState<AuthSession | null>(() => getSession())
  const [hasPins, setHasPins] = useState<boolean | null>(() => getCachedHasPins())

  const handleSuccess = useCallback((s: AuthSession) => {
    setSessionState(s)
    if (!isAuthorized(s, requiredRole, storeId)) {
      window.location.href = getRoleHomePath(s)
    }
  }, [requiredRole, storeId])

  // Check if user_pins table has any records
  useEffect(() => {
    if (!supabase) return

    // Already have cached result
    const cached = getCachedHasPins()
    if (cached !== null) {
      if (hasPins !== cached) setHasPins(cached)
      return
    }

    supabase
      .from('user_pins')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          setCachedHasPins(false)
          setHasPins(false)
          return
        }
        const result = (count ?? 0) > 0
        setCachedHasPins(result)
        setHasPins(result)
      })
  }, [hasPins])

  if (!supabase) return <Outlet />

  if (hasPins === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-brand-lotus">載入中...</p>
      </div>
    )
  }

  if (!hasPins) return <Outlet />

  if (!session) {
    return <PinEntry onSuccess={handleSuccess} />
  }

  if (!isAuthorized(session, requiredRole, storeId)) {
    const homePath = getRoleHomePath(session)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-brand-oak mb-2">權限不足</h2>
          <p className="text-sm text-brand-lotus mb-4">您的帳號無法存取此頁面</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => { window.location.href = homePath }}
              className="px-6 py-2 rounded-xl bg-brand-mocha text-white text-sm font-medium active:scale-95 transition-transform"
            >
              前往我的首頁
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
