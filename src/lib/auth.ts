// PIN-based authentication system
// Uses Web Crypto API for SHA-256 hashing, sessionStorage for session

export interface AuthSession {
  staffId: string
  staffName: string
  role: 'admin' | 'kitchen' | 'store'
  allowedStores: string[]
  loginAt: number
}

const SESSION_KEY = 'yba_auth_session'

// ── PIN hash ──

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Session management ──

export function getSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function setSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

// ── Authorization check ──

export function isAuthorized(
  session: AuthSession | null,
  requiredRole: 'admin' | 'kitchen' | 'store',
  storeId?: string,
): boolean {
  if (!session) return false

  // admin can access everything
  if (session.role === 'admin') return true

  // Role must match
  if (session.role !== requiredRole) return false

  // For store role, check allowed stores
  if (requiredRole === 'store' && storeId) {
    if (session.allowedStores.length > 0 && !session.allowedStores.includes(storeId)) {
      return false
    }
  }

  return true
}
