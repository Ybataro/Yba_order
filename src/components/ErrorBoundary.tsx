import { Component, type ReactNode } from 'react'

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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <p className="text-5xl mb-4">😵</p>
          <h1 className="text-lg font-bold text-brand-oak mb-2">頁面發生錯誤</h1>
          <p className="text-sm text-brand-lotus mb-6">請重新整理頁面，或回到首頁</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
            className="px-6 py-2.5 rounded-lg bg-brand-mocha text-white text-sm font-semibold"
          >
            回到首頁
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
