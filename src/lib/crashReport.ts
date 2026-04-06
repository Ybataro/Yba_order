/**
 * 窮人版 Sentry — 全域錯誤攔截 + Telegram 報錯
 * 不裝任何套件，用現有 Telegram Bot 達到即時報錯
 */

import { sendTelegramNotification } from '@/lib/telegram'

// 5 分鐘內同一錯誤不重複報（防洪水）
const reportedErrors = new Map<string, number>()
const THROTTLE_MS = 5 * 60 * 1000

interface CrashInfo {
  type: string
  message: string
  source?: string
  line?: number
  stack?: string
}

function getFingerprint(info: CrashInfo): string {
  return `${info.type}:${info.message}:${info.source || ''}:${info.line || 0}`
}

export function sendCrashReport(info: CrashInfo): void {
  // 過濾離線雜訊
  if (!navigator.onLine) return

  // 過濾已知的網路噪音
  const noise = ['Failed to fetch', 'Network Error', 'Load failed', 'timeout', 'AbortError', 'ChunkLoadError']
  if (noise.some(n => info.message?.toLowerCase().includes(n.toLowerCase()))) return

  // 節流：同一錯誤 5 分鐘內只報一次
  const fp = getFingerprint(info)
  const lastReport = reportedErrors.get(fp)
  if (lastReport && Date.now() - lastReport < THROTTLE_MS) return
  reportedErrors.set(fp, Date.now())

  // 從 sessionStorage 取上下文
  const page = window.location.pathname
  const storeId = sessionStorage.getItem('storeId') || '未知'
  const staffName = sessionStorage.getItem('staffName') || '未知'
  const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })

  const text = [
    `🚨 <b>前端崩潰報告</b>`,
    `⏰ ${now}`,
    `📍 頁面：${page}`,
    `🏪 門店：${storeId}`,
    `👤 操作者：${staffName}`,
    `❌ 類型：${info.type}`,
    `💬 ${info.message}`,
    info.source ? `📄 ${info.source}:${info.line}` : '',
    info.stack ? `📋 <pre>${info.stack.slice(0, 400)}</pre>` : '',
  ].filter(Boolean).join('\n')

  // 只發給管理者（privateOnly=true），不發群組
  sendTelegramNotification(text, true).catch(() => {})
}

/** 在 main.tsx 呼叫一次即可 */
export function initGlobalErrorHandlers(): void {
  // 同步錯誤（變數 undefined、型別錯誤等）
  window.addEventListener('error', (event) => {
    sendCrashReport({
      type: 'uncaught_error',
      message: event.message || '未知錯誤',
      source: event.filename,
      line: event.lineno,
      stack: event.error?.stack,
    })
  })

  // 未處理的 Promise 錯誤
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    sendCrashReport({
      type: 'unhandled_rejection',
      message: reason?.message || String(reason) || '未知 Promise 錯誤',
      stack: reason?.stack,
    })
  })
}
