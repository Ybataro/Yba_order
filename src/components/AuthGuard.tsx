import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSession, isAuthorized, clearSession, type AuthSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import PinEntry from '@/pages/PinEntry'

interface AuthGuardProps {
  requiredRole: 'admin' | 'kitchen' | 'store'
  children: ReactNode
}

// Module-level cache: null = not checked, true/false = result
let hasPinsCache: boolean | null = null

// Get the home path for a given role
function getRoleHomePath(role: string, allowedStores: string[]): string {
  switch (role) {
    case 'admin': return '/admin'
    case 'kitchen': return '/kitchen'
    case 'store': return `/store/${allowedStores[0] || 'lehua'}`
    default: return '/'
  }
}

export default function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const [session, setSessionState] = useState<AuthSession | null>(() => getSession())
  const [hasPins, setHasPins] = useState<boolean | null>(hasPinsCache)

  const handleSuccess = useCallback((s: AuthSession) => {
    setSessionState(s)
    // After login, if role doesn't match current route, redirect to correct area
    if (!isAuthorized(s, requiredRole, storeId)) {
      navigate(getRoleHomePath(s.role, s.allowedStores), { replace: true })
    }
  }, [requiredRole, storeId, navigate])

  // Check if user_pins table has any records
  useEffect(() => {
    if (!supabase || hasPinsCache !== null) return

    supabase
      .from('user_pins')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        if (error) {
          // Table might not exist yet → skip auth
          hasPinsCache = false
          setHasPins(false)
          return
        }
        const result = (count ?? 0) > 0
        hasPinsCache = result
        setHasPins(result)
      })
  }, [])

  // No Supabase → skip auth
  if (!supabase) return <>{children}</>

  // Still checking → show nothing (brief flash)
  if (hasPins === null) return null

  // No PINs configured yet → skip auth (setup mode)
  if (!hasPins) return <>{children}</>

  // No session → show PIN entry
  if (!session) {
    return <PinEntry onSuccess={handleSuccess} />
  }

  // Check authorization — redirect to correct area instead of blocking
  if (!isAuthorized(session, requiredRole, storeId)) {
    const homePath = getRoleHomePath(session.role, session.allowedStores)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-brand-oak mb-2">權限不足</h2>
          <p className="text-sm text-brand-lotus mb-4">
            您的帳號無法存取此頁面
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(homePath, { replace: true })}
              className="px-6 py-2 rounded-xl bg-brand-mocha text-white text-sm font-medium active:scale-95 transition-transform"
            >
              前往我的首頁
            </button>
            <button
              onClick={() => {
                clearSession()
                setSessionState(null)
              }}
              className="px-6 py-2 rounded-xl bg-brand-lotus text-white text-sm font-medium active:scale-95 transition-transform"
            >
              切換帳號
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
