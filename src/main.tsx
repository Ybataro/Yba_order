import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initGlobalErrorHandlers } from '@/lib/crashReport'

// V2.0：全域錯誤攔截（窮人版 Sentry）
initGlobalErrorHandlers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
