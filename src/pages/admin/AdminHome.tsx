import { useState } from 'react'
import { Package, Warehouse, Users, Store, Receipt, QrCode, Layers, ClipboardList, FileText, DollarSign, CloudSun, ChefHat, LayoutDashboard, LogOut, KeyRound, ScrollText, Wallet, TrendingUp, ChevronDown, CalendarClock, Clock, Snowflake, CalendarDays, ArrowUpDown, CalendarOff } from 'lucide-react'
import { getTodayString, formatDate } from '@/lib/utils'
import { useStoreStore } from '@/stores/useStoreStore'
import { clearSession } from '@/lib/auth'
import ChangePinModal from '@/components/ChangePinModal'

interface MenuItem {
  icon: React.ComponentType<{ size?: number }>
  label: string
  desc: string
  path: string
  color: string
}

interface MenuGroup {
  title: string
  defaultOpen: boolean
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    title: '常用功能',
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: '老闆儀表板', desc: '今日營運總覽、庫存與趨勢', path: '/admin/dashboard', color: 'bg-brand-amber' },
      { icon: ClipboardList, label: '歷史叫貨查詢', desc: '查看叫貨紀錄及品項統計分析', path: '/admin/order-history', color: 'bg-brand-lotus' },
      { icon: FileText, label: '結帳歷史查詢', desc: '各店結帳紀錄及月報表', path: '/admin/settlement-history', color: 'bg-brand-amber' },
      { icon: Wallet, label: '雜支管理', desc: '查看/管理各店日常雜支紀錄', path: '/admin/expenses', color: 'bg-brand-camel' },
      { icon: CalendarOff, label: '請假管理', desc: '審核請假申請、管理假別餘額', path: '/admin/leave', color: 'bg-brand-lotus' },
    ],
  },
  {
    title: '基礎設定',
    defaultOpen: false,
    items: [
      { icon: Package, label: '門店品項管理', desc: '新增/編輯/排序門店品項', path: '/admin/products', color: 'bg-brand-mocha' },
      { icon: Warehouse, label: '央廚原物料管理', desc: '新增/編輯/排序原物料', path: '/admin/materials', color: 'bg-brand-camel' },
      { icon: Users, label: '人員管理', desc: '管理央廚及各門店人員', path: '/admin/staff', color: 'bg-brand-lotus' },
      { icon: Store, label: '門店管理', desc: '新增/編輯門店資訊', path: '/admin/stores', color: 'bg-brand-blush' },
      { icon: Receipt, label: '結帳欄位管理', desc: '管理每日結帳表單欄位', path: '/admin/settlement-fields', color: 'bg-brand-silver' },
      { icon: Layers, label: '樓層品項管理', desc: '設定門店樓層及品項分配', path: '/admin/zones', color: 'bg-brand-camel' },
      { icon: CalendarDays, label: '排班管理', desc: 'PC 全寬行事曆排班、快速排班模式', path: '/admin/schedule', color: 'bg-brand-lotus' },
      { icon: CalendarClock, label: '班次與職位管理', desc: '設定班次時段、職位與標籤', path: '/admin/shift-types', color: 'bg-brand-oak' },
      { icon: ArrowUpDown, label: '品項排序管理', desc: '設定各門店叫貨/盤點品項的顯示順序', path: '/admin/item-sort', color: 'bg-brand-mocha' },
    ],
  },
  {
    title: '報表分析',
    defaultOpen: false,
    items: [
      { icon: DollarSign, label: '叫貨價格統計', desc: '品項成本與加盟價格統計', path: '/admin/order-pricing', color: 'bg-brand-oak' },
      { icon: TrendingUp, label: '盈餘統計', desc: '月/年損益分析與費用管理', path: '/admin/profit-loss', color: 'bg-brand-amber' },
      { icon: CloudSun, label: '天氣用量分析', desc: '天氣與營業額、叫貨量關聯分析', path: '/admin/weather-analysis', color: 'bg-brand-amber' },
      { icon: Clock, label: '工時統計', desc: '依職別統計每月排班工時與薪資', path: '/admin/schedule-stats', color: 'bg-brand-mocha' },
      { icon: Snowflake, label: '冷凍品統計', desc: '冷凍產品銷售數量與金額統計', path: '/admin/frozen-stats', color: 'bg-brand-blush' },
    ],
  },
  {
    title: '系統管理',
    defaultOpen: false,
    items: [
      { icon: QrCode, label: 'QR Code 管理', desc: '產生各門店/央廚/後台 QR Code', path: '/admin/qrcode', color: 'bg-brand-oak' },
      { icon: KeyRound, label: 'PIN 碼管理', desc: '人員 PIN 碼、角色與授權門市', path: '/admin/pins', color: 'bg-brand-lotus' },
      { icon: ScrollText, label: '操作記錄', desc: '盤點、叫貨、結帳等操作記錄', path: '/admin/audit', color: 'bg-brand-silver' },
    ],
  },
]

export default function AdminHome() {
  const stores = useStoreStore((s) => s.items)
  const [changePinOpen, setChangePinOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    menuGroups.forEach((g) => { init[g.title] = g.defaultOpen })
    return init
  })

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  return (
    <div className="page-container">
      <div className="bg-brand-oak text-white px-6 pt-12 pb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80 mb-1">{formatDate(getTodayString())}</p>
            <h1 className="text-2xl font-bold">阿爸的芋圓</h1>
            <p className="text-base opacity-90 mt-1">後台管理系統</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setChangePinOpen(true)} className="p-2 rounded-full text-white/80 hover:bg-white/20" title="修改 PIN">
              <KeyRound size={20} />
            </button>
            <button
              onClick={() => { clearSession(); window.location.reload() }}
              className="p-2 rounded-full text-white/80 hover:bg-white/20"
              title="登出"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-3 pb-2">
        {menuGroups.map((group) => {
          const isOpen = openGroups[group.title]
          return (
            <div key={group.title}>
              {/* 分類標題 */}
              <button
                onClick={() => toggleGroup(group.title)}
                className="card w-full flex items-center justify-between !py-3 !px-4"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-brand-oak">{group.title}</span>
                  <span className="text-xs text-brand-lotus bg-surface-section rounded-full px-2 py-0.5">{group.items.length}</span>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-brand-mocha transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* 摺疊內容 */}
              <div
                className={`space-y-3 overflow-hidden transition-all duration-300 ${
                  isOpen ? 'max-h-[2000px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                }`}
              >
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => { window.location.href = item.path }}
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
            </div>
          )
        })}
      </div>

      {/* 快速前往 */}
      <div className="px-4 mt-4 pb-6">
        <p className="text-xs text-brand-lotus mb-2">快速前往</p>
        <div className="grid grid-cols-3 gap-2">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => { window.location.href = `/store/${s.id}` }}
              className="card flex flex-col items-center gap-1.5 py-3 active:scale-[0.97] transition-transform"
            >
              <div className="bg-brand-lotus w-9 h-9 rounded-lg flex items-center justify-center text-white">
                <Store size={18} />
              </div>
              <span className="text-xs font-medium text-brand-oak">{s.name}</span>
            </button>
          ))}
          <button
            onClick={() => { window.location.href = '/kitchen' }}
            className="card flex flex-col items-center gap-1.5 py-3 active:scale-[0.97] transition-transform"
          >
            <div className="bg-brand-silver w-9 h-9 rounded-lg flex items-center justify-center text-white">
              <ChefHat size={18} />
            </div>
            <span className="text-xs font-medium text-brand-oak">央廚</span>
          </button>
        </div>
      </div>

      <ChangePinModal open={changePinOpen} onClose={() => setChangePinOpen(false)} />
    </div>
  )
}
