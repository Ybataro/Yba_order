import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShoppingCart, Coffee } from 'lucide-react'
import { TopNav } from '@/components/TopNav'

const items = [
  {
    key: 'material-orders',
    label: '原物料叫貨',
    desc: '向供應商訂購原物料',
    path: '/kitchen/material-orders',
    icon: ShoppingCart,
    color: 'bg-brand-silver',
  },
  {
    key: 'doujiang-order',
    label: '店內豆漿叫貨',
    desc: '每週訂貨：根據三方庫存自動算建議量',
    path: '/kitchen/doujiang-order',
    icon: Coffee,
    color: 'bg-brand-camel',
  },
]

export default function OrdersHub() {
  const navigate = useNavigate()
  return (
    <div className="page-container">
      <TopNav title="叫貨表" backTo="/kitchen" />
      <div className="px-4 pt-3 space-y-3">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <button
              key={it.key}
              onClick={() => navigate(it.path)}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-gray-100 rounded-xl shadow-sm active:bg-gray-50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${it.color} flex items-center justify-center text-white shrink-0`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-semibold text-brand-oak">{it.label}</p>
                <p className="text-[11px] text-brand-lotus mt-0.5">{it.desc}</p>
              </div>
              <ChevronRight size={18} className="text-brand-lotus shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
