import { Component, type ReactNode } from 'react'
import { sendCrashReport } from '@/lib/crashReport'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)

    // V2.0：自動 Telegram 報錯
    sendCrashReport({
      type: 'react_crash',
      message: error.message,
      stack: (error.stack || '') + '\n\nComponent Stack:' + (info.componentStack || ''),
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-surface-page">
          <p className="text-5xl mb-4">😵</p>
          <h1 className="text-lg font-bold text-brand-oak mb-2">系統發生異常</h1>
          <p className="text-sm text-brand-lotus mb-2">已自動通知管理員，請稍後再試</p>
          <p className="text-xs text-gray-400 mb-6">若持續發生，請清除瀏覽器快取後重試</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-lg bg-brand-mocha text-white text-sm font-semibold"
            >
              重新載入
            </button>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
              className="px-6 py-2.5 rounded-lg bg-surface-card border border-brand-silver text-brand-oak text-sm font-semibold"
            >
              回到首頁
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
