import { useState, useEffect, useCallback } from 'react'
import { hashPin, setSession, type AuthSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { UserCircle, ChevronDown } from 'lucide-react'

interface PinEntryProps {
  onSuccess: (session: AuthSession) => void
}

interface PinUser {
  id: string
  staff_id: string
  staff_name: string
  role: string
  allowed_stores: string[]
  group_id: string
  sort_order: number
}

const roleLabels: Record<string, string> = {
  admin: '管理者',
  kitchen: '央廚',
  store: '門店',
}

// 統一使用 oak #6B5D55 色系
const groupCards: { key: string; label: string }[] = [
  { key: 'admin', label: '管理者' },
  { key: 'kitchen', label: '央廚' },
  { key: 'lehua', label: '樂華店' },
  { key: 'xingnan', label: '興南店' },
]

export default function PinEntry({ onSuccess }: PinEntryProps) {
  const [users, setUsers] = useState<PinUser[]>([])
  const [selectedUser, setSelectedUser] = useState<PinUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // Load active users (NO pin_hash exposed to frontend)
  useEffect(() => {
    if (!supabase) return
    supabase
      .from('user_pins')
      .select('id, staff_id, role, allowed_stores, staff:staff_id(name, group_id, sort_order)')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data) {
          const mapped: PinUser[] = data.map((d: Record<string, unknown>) => ({
            id: d.id as string,
            staff_id: d.staff_id as string,
            staff_name: (d.staff as { name: string; group_id: string; sort_order: number })?.name || (d.staff_id as string),
            role: d.role as string,
            allowed_stores: (d.allowed_stores as string[]) || [],
            group_id: (d.staff as { name: string; group_id: string })?.group_id || d.role as string,
            sort_order: (d.staff as { sort_order: number })?.sort_order ?? 999,
          }))
          mapped.sort((a, b) => a.sort_order - b.sort_order)
          setUsers(mapped)
        }
        setLoadingUsers(false)
      })
  }, [])

  const handleDigit = (digit: string) => {
    if (pin.length >= 4 || checking) return
    setError('')
    setPin((prev) => prev + digit)
  }

  const handleDelete = () => {
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }

  const handleBack = () => {
    setSelectedUser(null)
    setPin('')
    setError('')
  }

  const verify = useCallback(async (fullPin: string) => {
    if (!selectedUser || !supabase) return

    setChecking(true)
    try {
      // Check crypto.subtle availability
      if (!crypto?.subtle) {
        setError('此瀏覽器不支援加密功能，請用 Chrome 或 Safari 開啟')
        setPin('')
        setChecking(false)
        return
      }

      const hashed = await hashPin(fullPin)

      // Verify via Supabase query (server-side hash comparison)
      const { data, error: dbErr } = await supabase
        .from('user_pins')
        .select('id')
        .eq('id', selectedUser.id)
        .eq('pin_hash', hashed)
        .eq('is_active', true)
        .maybeSingle()

      if (dbErr) {
        setError('驗證失敗：' + dbErr.message)
        setPin('')
        setChecking(false)
        return
      }

      if (!data) {
        setError('PIN 碼錯誤，請重試')
        setPin('')
        setChecking(false)
        return
      }

      const session: AuthSession = {
        staffId: selectedUser.staff_id,
        staffName: selectedUser.staff_name,
        role: selectedUser.role as 'admin' | 'kitchen' | 'store',
        allowedStores: selectedUser.allowed_stores,
        loginAt: Date.now(),
      }

      setSession(session)
      onSuccess(session)
    } catch (e) {
      setError('系統錯誤：' + (e instanceof Error ? e.message : String(e)))
      setPin('')
    }
    setChecking(false)
  }, [selectedUser, onSuccess])

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      verify(pin)
    }
  }, [pin, verify])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  // ── Step 1: Select user ──
  if (!selectedUser) {
    // Group users by group_id (admin / kitchen / lehua / xingnan)
    const grouped = new Map<string, PinUser[]>()
    for (const u of users) {
      const key = u.group_id || u.role
      const group = grouped.get(key) || []
      group.push(u)
      grouped.set(key, group)
    }

    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-brand-lotus to-brand-mocha px-6">
        <div className="text-center pt-14 pb-6">
          <h1 className="text-3xl font-bold text-white mb-1">阿爸的芋圓</h1>
          <p className="text-white/70 text-sm">請選擇您的身分</p>
        </div>

        {loadingUsers ? (
          <p className="text-center text-white/60 text-sm py-10">載入中...</p>
        ) : users.length === 0 ? (
          <p className="text-center text-white/60 text-sm py-10">尚未設定任何 PIN 碼</p>
        ) : (
          <div className="flex-1 overflow-y-auto pb-8 space-y-3">
            {groupCards.map(card => {
              const members = grouped.get(card.key)
              if (!members || members.length === 0) return null
              const isOpen = expandedGroup === card.key
              return (
                <div key={card.key} className="rounded-2xl backdrop-blur-sm ring-1 ring-white/10 overflow-hidden" style={{ background: 'rgba(107,93,85,0.22)' }}>
                  <button
                    type="button"
                    onClick={() => setExpandedGroup(prev => prev === card.key ? null : card.key)}
                    className="w-full flex items-center justify-between px-4 py-3.5 active:bg-white/5 transition-colors"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-bold text-brand-camel">{card.label}</span>
                      <span className="text-white/50 text-sm">{members.length} 人</span>
                    </div>
                    <ChevronDown size={18} className={`text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-2 px-4 pb-4">
                      {members.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => setSelectedUser(user)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/15"
                          style={{ background: 'rgba(107,93,85,0.25)' }}
                        >
                          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                            <UserCircle size={18} className="text-white/80" />
                          </div>
                          <span className="text-white text-sm font-medium truncate">{user.staff_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Step 2: Enter PIN for selected user ──
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-lotus to-brand-mocha px-6">
      {/* User info */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
          <UserCircle size={36} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-white">{selectedUser.staff_name}</h2>
        <p className="text-white/60 text-sm">{roleLabels[selectedUser.role] || selectedUser.role}</p>
        <button
          onClick={handleBack}
          className="mt-2 text-white/50 text-xs underline"
        >
          切換身分
        </button>
      </div>

      <p className="text-white/80 text-sm mb-4">請輸入 PIN 碼</p>

      {/* PIN dots */}
      <div className={`flex gap-4 mb-6 ${error ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? error
                  ? 'bg-red-400 border-red-400'
                  : 'bg-white border-white'
                : 'bg-transparent border-white/50'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-300 text-sm mb-4 text-center px-4">{error}</p>
      )}

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {digits.map((d, i) => {
          if (d === '') return <div key={i} />
          if (d === 'del') {
            return (
              <button
                key={i}
                onClick={handleDelete}
                className="h-16 rounded-2xl bg-white/10 text-white text-lg font-medium active:bg-white/20 transition-colors flex items-center justify-center"
              >
                ⌫
              </button>
            )
          }
          return (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              disabled={checking}
              className="h-16 rounded-2xl bg-white/15 text-white text-2xl font-semibold active:bg-white/30 transition-colors disabled:opacity-50"
            >
              {d}
            </button>
          )
        })}
      </div>

      {checking && (
        <p className="text-white/60 text-sm mt-6">驗證中...</p>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  )
}
