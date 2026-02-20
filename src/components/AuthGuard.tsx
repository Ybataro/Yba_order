import { useState, useCallback, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { getSession, isAuthorized, clearSession, type AuthSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import PinEntry from '@/pages/PinEntry'

interface AuthGuardProps {
  requiredRole: 'admin' | 'kitchen' | 'store'
  children: ReactNode
}

export default function AuthGuard({ requiredRole, children }: AuthGuardProps) {
  const { storeId } = useParams<{ storeId: string }>()
  const [session, setSessionState] = useState<AuthSession | null>(() => getSession())

  const handleSuccess = useCallback((s: AuthSession) => {
    setSessionState(s)
  }, [])

  // If no Supabase or no user_pins table configured, skip auth
  if (!supabase) return <>{children}</>

  // No session → show PIN entry
  if (!session) {
    return <PinEntry onSuccess={handleSuccess} />
  }

  // Check authorization
  if (!isAuthorized(session, requiredRole, storeId)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface-page px-6">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-brand-oak mb-2">權限不足</h2>
          <p className="text-sm text-brand-lotus mb-6">
            您的帳號無法存取此頁面
          </p>
          <button
            onClick={() => {
              clearSession()
              setSessionState(null)
            }}
            className="px-6 py-2 rounded-xl bg-brand-lotus text-white text-sm font-medium active:scale-95 transition-transform"
          >
            重新登入
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
