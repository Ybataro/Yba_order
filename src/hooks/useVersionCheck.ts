import { useEffect, useRef } from 'react'
import { useToast } from '@/components/Toast'

const CHECK_INTERVAL = 5 * 60 * 1000 // 5 分鐘檢查一次
const VERSION_URL = '/version.json'

/**
 * V2.0 版本檢查 Hook
 * 定期比對 version.json，若版本不符則提示使用者重新整理
 */
export function useVersionCheck() {
  const { showToast } = useToast()
  const currentVersion = useRef<string | null>(null)
  const hasNotified = useRef(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${VERSION_URL}?_t=${Date.now()}`)
        if (!res.ok) return
        const data = await res.json() as { version: string }

        if (!currentVersion.current) {
          // 首次載入，記錄版本
          currentVersion.current = data.version
          return
        }

        if (data.version !== currentVersion.current && !hasNotified.current) {
          hasNotified.current = true
          showToast('系統已更新，請重新整理頁面以取得最新版本', 'info')
        }
      } catch {
        // 網路錯誤不處理
      }
    }

    check()
    const timer = setInterval(check, CHECK_INTERVAL)
    return () => clearInterval(timer)
  }, [showToast])
}
