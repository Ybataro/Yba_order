import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStoreStore } from '@/stores/useStoreStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { ClipboardList, DollarSign, Package, PackageCheck, UserCircle, LogOut, Receipt, CalendarDays, Settings, KeyRound } from 'lucide-react'
import { getTodayString, formatDate } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'
import CriticalAlertModal from '@/components/CriticalAlertModal'
import type { Notification } from '@/hooks/useNotifications'
import { clearSession, getSession } from '@/lib/auth'
import { useCanSchedule } from '@/hooks/useCanSchedule'
import ChangePinModal from '@/components/ChangePinModal'

const menuItems = [
  { icon: ClipboardList, label: '物料盤點', desc: '門店打烊物料清點', path: 'inventory', color: 'bg-brand-mocha' },
  { icon: DollarSign, label: '每日結帳', desc: '營收與現金盤點', path: 'settlement', color: 'bg-brand-camel' },
  { icon: Package, label: '叫貨', desc: '明日物料需求', path: 'order', color: 'bg-brand-lotus' },
  { icon: PackageCheck, label: '收貨確認', desc: '確認央廚今日出貨', path: 'receive', color: 'bg-brand-blush' },
  { icon: Receipt, label: '雜支申報', desc: '記錄日常雜支費用', path: 'expense', color: 'bg-brand-silver' },
  { icon: CalendarDays, label: '排班表', desc: '查看/編輯門店員工排班', path: 'schedule', color: 'bg-brand-amber' },
]

const scheduleAdminItems = [
  { icon: CalendarDays, label: '排班管理', desc: '管理全部單位排班', path: '/admin/schedule', color: 'bg-brand-oak' },
  { icon: Settings, label: '班次與職位', desc: '設定班次類型與職位', path: '/admin/shift-types', color: 'bg-brand-mocha' },
]

export default function StoreHome() {
  const { storeId } = useParams<{ storeId: string }>()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const staffList = useStaffStore((s) => s.getStoreStaff(storeId || ''))
  const authSession = getSession()
  const canSchedule = useCanSchedule()
  const [currentStaff, setCurrentStaff] = useState(() => {
    // 先信任 sessionStorage（staffList 可能尚未載入）
    return sessionStorage.getItem(`store_${storeId}_staff`) || ''
  })

  // staffList 載入後：驗證 sessionStorage 值，或自動補值
  useEffect(() => {
    if (staffList.length === 0) return
    // 已有有效選擇 → 不動
    if (currentStaff && staffList.some((s) => s.id === currentStaff)) return
    // 嘗試用登入者 staffId
    const sid = authSession?.staffId || ''
    if (staffList.some((s) => s.id === sid)) {
      setCurrentStaff(sid)
      sessionStorage.setItem(`store_${storeId}_staff`, sid)
      return
    }
    // Admin 不在門店名單 → 自動選第一位
    if (authSession?.role === 'admin') {
      setCurrentStaff(staffList[0].id)
      sessionStorage.setItem(`store_${storeId}_staff`, staffList[0].id)
      return
    }
  }, [staffList, authSession, storeId])

  const handleStaffChange = (id: string) => {
    setCurrentStaff(id)
    if (id) sessionStorage.setItem(`store_${storeId}_staff`, id)
    else sessionStorage.removeItem(`store_${storeId}_staff`)
  }
  const [changePinOpen, setChangePinOpen] = useState(false)
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
            <button onClick={() => setChangePinOpen(true)} className="p-2 rounded-full text-white/80 hover:bg-white/20" title="修改 PIN">
              <KeyRound size={20} />
            </button>
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
            onChange={(e) => handleStaffChange(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-surface-input px-2.5 text-sm text-brand-oak outline-none focus:border-brand-lotus"
          >
            <option value="">請選擇</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!currentStaff && (
        <div className="mx-4 mb-1 px-3 py-2 rounded-lg bg-status-danger/10 text-status-danger text-xs font-medium text-center">
          請先選擇當班人員才能進入功能
        </div>
      )}

      <div className="px-4 space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            disabled={!currentStaff}
            onClick={() => { window.location.href = `/store/${storeId}/${item.path}?staff=${currentStaff}` }}
            className={`card w-full flex items-center gap-4 transition-transform text-left ${currentStaff ? 'active:scale-[0.98]' : 'opacity-40 cursor-not-allowed'}`}
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

      {/* 排班管理（有 can_schedule 權限才顯示） */}
      {canSchedule && (
        <div className="px-4 mt-6 space-y-3">
          <h3 className="text-xs font-semibold text-brand-lotus px-1">排班管理</h3>
          {scheduleAdminItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { window.location.href = item.path }}
              className="card w-full flex items-center gap-4 transition-transform text-left active:scale-[0.98]"
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
      )}

      {/* Critical alert modal */}
      {criticalDismiss && (
        <CriticalAlertModal
          notifications={criticalNotifications}
          onDismiss={criticalDismiss}
        />
      )}

      <ChangePinModal open={changePinOpen} onClose={() => setChangePinOpen(false)} />
    </div>
  )
}
