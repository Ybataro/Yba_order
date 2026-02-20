import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStoreStore } from '@/stores/useStoreStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { ClipboardList, DollarSign, Package, PackageCheck, UserCircle, LogOut } from 'lucide-react'
import { getTodayString, formatDate } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'
import CriticalAlertModal from '@/components/CriticalAlertModal'
import type { Notification } from '@/hooks/useNotifications'
import { clearSession, getSession } from '@/lib/auth'

const menuItems = [
  { icon: ClipboardList, label: '物料盤點', desc: '門店打烊物料清點', path: 'inventory', color: 'bg-brand-mocha' },
  { icon: DollarSign, label: '每日結帳', desc: '營收與現金盤點', path: 'settlement', color: 'bg-brand-camel' },
  { icon: Package, label: '叫貨', desc: '明日物料需求', path: 'order', color: 'bg-brand-lotus' },
  { icon: PackageCheck, label: '收貨確認', desc: '確認央廚今日出貨', path: 'receive', color: 'bg-brand-blush' },
]

export default function StoreHome() {
  const { storeId } = useParams<{ storeId: string }>()
  const navigate = useNavigate()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const staffList = useStaffStore((s) => s.getStoreStaff(storeId || ''))
  const authSession = getSession()
  const [currentStaff, setCurrentStaff] = useState(() => authSession?.staffId || '')
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
      <div className="bg-brand-lotus text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">{formatDate(getTodayString())}</p>
            <h1 className="text-2xl font-bold">阿爸的芋圓</h1>
            <p className="text-base opacity-90 mt-1">{storeName}</p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              context="store"
              storeId={storeId}
              className="text-white"
              onCriticalNotifications={handleCriticalNotifications}
            />
            <button onClick={handleLogout} className="p-2 rounded-full text-white/80 hover:bg-white/20" title="登出">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 當班人員選單 */}
      <div className="mx-4 -mt-4 mb-3 card">
        <div className="flex items-center gap-2">
          <UserCircle size={20} className="text-brand-mocha shrink-0" />
          <span className="text-sm font-medium text-brand-oak shrink-0">當班人員</span>
          <select
            value={currentStaff}
            onChange={(e) => setCurrentStaff(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2.5 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">請選擇</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="px-4 space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(`/store/${storeId}/${item.path}${currentStaff ? `?staff=${currentStaff}` : ''}`)}
            className="card w-full flex items-center gap-4 active:scale-[0.98] transition-transform text-left"
          >
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
