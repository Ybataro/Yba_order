import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { hashPin, getSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/Toast'

interface ChangePinModalProps {
  open: boolean
  onClose: () => void
}

export default function ChangePinModal({ open, onClose }: ChangePinModalProps) {
  const { showToast } = useToast()
  const [step, setStep] = useState<'verify' | 'newPin'>('verify')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep('verify')
      setPin('')
      setError('')
      setChecking(false)
      checkingRef.current = false
    }
  }, [open])

  const handleDigit = async (digit: string) => {
    if (pin.length >= 4 || checkingRef.current) return
    setError('')
    const newPin = pin + digit
    setPin(newPin)

    if (newPin.length === 4) {
      if (step === 'verify') {
        await verifyOldPin(newPin)
      } else {
        await submitNewPin(newPin)
      }
    }
  }

  const handleDelete = () => {
    if (checkingRef.current) return
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }

  const verifyOldPin = async (fullPin: string) => {
    const session = getSession()
    if (!session || !supabase) return

    checkingRef.current = true
    setChecking(true)
    try {
      const hashed = await hashPin(fullPin)
      const { data, error: dbErr } = await supabase
        .from('user_pins')
        .select('id')
        .eq('staff_id', session.staffId)
        .eq('pin_hash', hashed)
        .eq('is_active', true)
        .maybeSingle()

      if (dbErr) {
        setError('驗證失敗：' + dbErr.message)
        setPin('')
        return
      }

      if (!data) {
        setError('PIN 碼錯誤')
        setPin('')
        return
      }

      // Success → go to step 2
      setStep('newPin')
      setPin('')
      setError('')
    } catch (e) {
      setError('系統錯誤：' + (e instanceof Error ? e.message : String(e)))
      setPin('')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }

  const submitNewPin = async (fullPin: string) => {
    const session = getSession()
    if (!session || !supabase) return

    checkingRef.current = true
    setChecking(true)
    try {
      const newHash = await hashPin(fullPin)
      const { error: dbErr } = await supabase
        .from('user_pins')
        .update({ pin_hash: newHash, updated_at: new Date().toISOString() })
        .eq('staff_id', session.staffId)

      if (dbErr) {
        showToast('更新失敗：' + dbErr.message, 'error')
        setPin('')
        return
      }

      showToast('PIN 碼已更新')
      onClose()
    } catch (e) {
      showToast('系統錯誤：' + (e instanceof Error ? e.message : String(e)), 'error')
      setPin('')
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }

  if (!open) return null

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  const prompt = step === 'verify' ? '請輸入目前的 PIN 碼' : '請輸入新的 PIN 碼'

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-brand-lotus to-brand-mocha">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-12 left-4 p-2 rounded-full text-white/80 hover:bg-white/20"
      >
        <X size={24} />
      </button>

      {/* Title & prompt */}
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold text-white mb-2">修改 PIN 碼</h2>
        <p className="text-white/80 text-sm">{prompt}</p>
      </div>

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
        <p className="text-white/60 text-sm mt-6">處理中...</p>
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
