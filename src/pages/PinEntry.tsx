import { useState, useEffect, useCallback } from 'react'
import { hashPin, setSession, type AuthSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface PinEntryProps {
  onSuccess: (session: AuthSession) => void
}

export default function PinEntry({ onSuccess }: PinEntryProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  const handleDigit = (digit: string) => {
    if (pin.length >= 4 || checking) return
    setError(false)
    setPin((prev) => prev + digit)
  }

  const handleDelete = () => {
    setError(false)
    setPin((prev) => prev.slice(0, -1))
  }

  const verify = useCallback(async (fullPin: string) => {
    if (!supabase) return

    setChecking(true)
    try {
      const hashed = await hashPin(fullPin)

      const { data, error: dbErr } = await supabase
        .from('user_pins')
        .select('*, staff:staff_id(id, name)')
        .eq('pin_hash', hashed)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (dbErr || !data) {
        setError(true)
        setPin('')
        setChecking(false)
        return
      }

      const session: AuthSession = {
        staffId: data.staff_id,
        staffName: (data.staff as { id: string; name: string })?.name || '',
        role: data.role as 'admin' | 'kitchen' | 'store',
        allowedStores: data.allowed_stores || [],
        loginAt: Date.now(),
      }

      setSession(session)
      onSuccess(session)
    } catch {
      setError(true)
      setPin('')
    }
    setChecking(false)
  }, [onSuccess])

  // Auto-verify when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      verify(pin)
    }
  }, [pin, verify])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-lotus to-brand-mocha px-6">
      {/* Brand */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">阿爸的芋圓</h1>
        <p className="text-white/70 text-sm">請輸入 PIN 碼登入</p>
      </div>

      {/* PIN dots */}
      <div className={`flex gap-4 mb-8 ${error ? 'animate-shake' : ''}`}>
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
        <p className="text-red-300 text-sm mb-4">PIN 碼錯誤，請重試</p>
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
