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
  // 清除所有 app 相關快取，避免殘留到下一位登入者
  sessionStorage.removeItem('kitchen_staff')
  sessionStorage.removeItem('yba_has_pins')
  sessionStorage.removeItem('yba_can_schedule')
  const keys = Object.keys(sessionStorage).filter((k) => k.startsWith('store_') && k.endsWith('_staff'))
  for (const k of keys) sessionStorage.removeItem(k)
}

// ── Role home path ──

export function getRoleHomePath(session: AuthSession | null): string {
  if (!session) return '/'
  switch (session.role) {
    case 'admin': return '/admin'
    case 'kitchen': return '/kitchen'
    case 'store': return `/store/${session.allowedStores[0] || 'lehua'}`
    default: return '/'
  }
}

// ── Authorization check ──

export type RoleRequirement = 'admin' | 'kitchen' | 'store' | Array<'admin' | 'kitchen' | 'store'>

export function isAuthorized(
  session: AuthSession | null,
  requiredRole: RoleRequirement,
  storeId?: string,
): boolean {
  if (!session) return false

  // admin can access everything
  if (session.role === 'admin') return true

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  // Role must be in allowed list
  if (!roles.includes(session.role)) return false

  // For store role, check allowed stores
  if (session.role === 'store' && storeId) {
    if (session.allowedStores.length > 0 && !session.allowedStores.includes(storeId)) {
      return false
    }
  }

  return true
}
