import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Truck, Package, Box, ShoppingCart, LogOut, CalendarClock } from 'lucide-react'
import { getTodayString, formatDate } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'
import CriticalAlertModal from '@/components/CriticalAlertModal'
import type { Notification } from '@/hooks/useNotifications'
import { clearSession } from '@/lib/auth'

const menuItems = [
  { icon: ClipboardList, label: '各店叫貨總表', desc: '查看各店叫貨需求與加總', path: '/kitchen/orders', color: 'bg-brand-mocha' },
  { icon: Truck, label: '出貨表', desc: '記錄各店出貨品項', path: '/kitchen/shipments', color: 'bg-brand-camel' },
  { icon: Package, label: '原物料庫存', desc: '盤點原物料並叫貨', path: '/kitchen/materials', color: 'bg-brand-lotus' },
  { icon: Box, label: '成品庫存', desc: '盤點成品與半成品', path: '/kitchen/products', color: 'bg-brand-blush' },
  { icon: ShoppingCart, label: '原物料叫貨', desc: '向供應商訂購原物料', path: '/kitchen/material-orders', color: 'bg-brand-silver' },
  { icon: CalendarClock, label: '生產排程建議', desc: '今日/明日生產量與本週概覽', path: '/kitchen/schedule', color: 'bg-brand-oak' },
]

export default function KitchenHome() {
  const navigate = useNavigate()
  const [criticalNotifications, setCriticalNotifications] = useState<Notification[]>([])
  const [criticalDismiss, setCriticalDismiss] = useState<((id: string) => void) | null>(null)

  const handleCriticalNotifications = useCallback((notifications: Notification[], dismiss: (id: string) => void) => {
    setCriticalNotifications(notifications)
    setCriticalDismiss(() => dismiss)
  }, [])

  const handleLogout = () => {
    clearSession()
    window.location.reload()
  }

  return (
    <div className="page-container">
      <div className="bg-brand-silver text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">{formatDate(getTodayString())}</p>
            <h1 className="text-2xl font-bold">阿爸的芋圓</h1>
            <p className="text-base opacity-90 mt-1">中央廚房</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              context="kitchen"
              className="text-white"
              onCriticalNotifications={handleCriticalNotifications}
            />
            <button onClick={handleLogout} className="p-2 rounded-full text-white/80 hover:bg-white/20" title="登出">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3">
        {menuItems.map((item) => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="card w-full flex items-center gap-4 active:scale-[0.98] transition-transform text-left">
            <div className={`${item.color} w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0`}>
              <item.icon size={24} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-brand-oak">{item.label}</h2>
              <p className="text-sm text-brand-lotus">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Critical alert modal */}
      {criticalDismiss && (
        <CriticalAlertModal
          notifications={criticalNotifications}
          onDismiss={criticalDismiss}
        />
      )}
    </div>
  )
}
