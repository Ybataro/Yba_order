import { useRef } from 'react'
import { AlertTriangle, ArrowLeft, X } from 'lucide-react'

export interface OrderAlertItem {
  productId: string
  productName: string
  unit: string
  currentTotal: number
  minTotal: number
}

interface OrderAlertModalProps {
  items: OrderAlertItem[]
  onClose: () => void
}

export function OrderAlertModal({ items, onClose }: OrderAlertModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  if (items.length === 0) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-full max-w-sm bg-white rounded-card shadow-xl"
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-status-warning/10 shrink-0">
            <AlertTriangle size={20} className="text-status-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-brand-oak">有品項總量不足</h2>
            <p className="text-xs text-brand-lotus mt-0.5">以下 {items.length} 個品項低於最低設定值</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 shrink-0"
          >
            <X size={18} className="text-brand-lotus" />
          </button>
        </div>

        {/* 品項列表 */}
        <div className="px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
          {items.map(item => {
            const gap = Math.round((item.minTotal - item.currentTotal) * 10) / 10
            return (
              <div
                key={item.productId}
                className="flex items-center justify-between px-3 py-2.5 rounded-btn bg-status-danger/5 border border-status-danger/15"
              >
                <div>
                  <span className="text-sm font-medium text-brand-oak">{item.productName}</span>
                  <span className="text-[10px] text-brand-lotus ml-1">({item.unit})</span>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="text-sm font-num font-bold text-status-danger">{item.currentTotal}</span>
                    <span className="text-[10px] text-brand-lotus">{item.unit}</span>
                  </div>
                  <div className="text-[10px] text-brand-lotus font-num">
                    需達 {item.minTotal}　差 <span className="text-status-danger font-medium">+{gap}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="px-4 pb-5 pt-3 space-y-2">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-btn bg-brand-mocha text-white text-sm font-semibold flex items-center justify-center gap-2 active:opacity-80"
          >
            <ArrowLeft size={15} />
            回去修改叫貨量
          </button>
          <button
            onClick={onClose}
            className="w-full h-10 rounded-btn border border-gray-200 text-sm text-brand-lotus active:bg-gray-50"
          >
            忽略，維持現狀
          </button>
        </div>
      </div>
    </div>
  )
}
