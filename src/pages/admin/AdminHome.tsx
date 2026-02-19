import { useNavigate } from 'react-router-dom'
import { Package, Warehouse, Users, Store, Receipt, QrCode, Layers, ClipboardList } from 'lucide-react'
import { getTodayString, formatDate } from '@/lib/utils'

const menuItems = [
  { icon: Package, label: '門店品項管理', desc: '新增/編輯/排序門店品項', path: '/admin/products', color: 'bg-brand-mocha' },
  { icon: Warehouse, label: '央廚原物料管理', desc: '新增/編輯/排序原物料', path: '/admin/materials', color: 'bg-brand-camel' },
  { icon: Users, label: '人員管理', desc: '管理央廚及各門店人員', path: '/admin/staff', color: 'bg-brand-lotus' },
  { icon: Store, label: '門店管理', desc: '新增/編輯門店資訊', path: '/admin/stores', color: 'bg-brand-blush' },
  { icon: Receipt, label: '結帳欄位管理', desc: '管理每日結帳表單欄位', path: '/admin/settlement-fields', color: 'bg-brand-silver' },
  { icon: Layers, label: '樓層品項管理', desc: '設定門店樓層及品項分配', path: '/admin/zones', color: 'bg-brand-camel' },
  { icon: QrCode, label: 'QR Code 管理', desc: '產生各門店/央廚/後台 QR Code', path: '/admin/qrcode', color: 'bg-brand-oak' },
  { icon: ClipboardList, label: '歷史叫貨查詢', desc: '查看叫貨紀錄及品項統計分析', path: '/admin/order-history', color: 'bg-brand-lotus' },
]

export default function AdminHome() {
  const navigate = useNavigate()

  return (
    <div className="page-container">
      <div className="bg-brand-oak text-white px-6 pt-12 pb-8">
        <p className="text-sm opacity-80 mb-1">{formatDate(getTodayString())}</p>
        <h1 className="text-2xl font-bold">阿爸的芋圓</h1>
        <p className="text-base opacity-90 mt-1">後台管理系統</p>
      </div>

      <div className="px-4 -mt-4 space-y-3">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
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

      {/* Quick links */}
      <div className="px-4 mt-6">
        <p className="text-xs text-brand-lotus mb-2">快速前往</p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/store/lehua')} className="btn-secondary !h-9 !text-sm flex-1">門店操作</button>
          <button onClick={() => navigate('/kitchen')} className="btn-secondary !h-9 !text-sm flex-1">央廚操作</button>
        </div>
      </div>
    </div>
  )
}
