import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'

interface ShipmentItem {
  productId: string
  name: string
  unit: string
  category: string
  orderQty: number   // 門店原始叫貨量
  actualQty: number  // 央廚實際出貨量
  hasDiff: boolean    // 是否有異動
  diff: number        // 差異量
}

export default function Receive() {
  const { storeId } = useParams<{ storeId: string }>()
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)

  // 模擬出貨資料（含異動）
  const shipmentItems = useMemo<ShipmentItem[]>(() => {
    return storeProducts
      .filter(() => Math.random() > 0.4)
      .map(p => {
        const orderQty = Math.round(Math.random() * 5 * 10) / 10
        // 約 30% 機率央廚有調整數量
        const adjusted = Math.random() > 0.7
        const actualQty = adjusted
          ? Math.round((orderQty + (Math.random() - 0.3) * 2) * 10) / 10
          : orderQty
        const finalActual = Math.max(0, actualQty)
        return {
          productId: p.id,
          name: p.name,
          unit: p.unit,
          category: p.category,
          orderQty,
          actualQty: finalActual,
          hasDiff: orderQty !== finalActual,
          diff: Math.round((finalActual - orderQty) * 10) / 10,
        }
      })
      .filter(item => item.orderQty > 0 || item.actualQty > 0)
  }, [])

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ShipmentItem[]>()
    for (const cat of productCategories) {
      const catItems = shipmentItems.filter(i => i.category === cat)
      if (catItems.length > 0) map.set(cat, catItems)
    }
    return map
  }, [shipmentItems])

  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})
  const [note, setNote] = useState('')

  const toggleConfirm = (productId: string) => {
    setConfirmed(prev => ({ ...prev, [productId]: !prev[productId] }))
  }

  const confirmedCount = shipmentItems.filter(item => confirmed[item.productId]).length
  const diffCount = shipmentItems.filter(item => item.hasDiff).length

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 收貨確認`} />

      {/* 出貨資訊 */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100">
        <p className="text-xs text-brand-lotus">央廚出貨時間：今日 08:30</p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-brand-oak font-medium">
            已確認 <span className="font-semibold">{confirmedCount}/{shipmentItems.length}</span> 項
          </p>
          {diffCount > 0 && (
            <p className="flex items-center gap-1 text-xs text-status-warning font-medium">
              <AlertTriangle size={12} />
              {diffCount} 項數量異動
            </p>
          )}
        </div>
      </div>

      {/* 異動提醒橫幅 */}
      {diffCount > 0 && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 bg-status-warning/10 text-status-warning px-3 py-2.5 rounded-btn text-xs">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>央廚有 <strong>{diffCount}</strong> 項出貨數量與叫貨不同，橘色標示項目請留意核對</span>
        </div>
      )}

      {/* 欄位標題 */}
      <div className="flex items-center px-4 py-1.5 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100 mt-2">
        <span className="w-6"></span>
        <span className="flex-1 pl-2">品名</span>
        <span className="w-[50px] text-center">叫貨</span>
        <span className="w-[12px]"></span>
        <span className="w-[50px] text-center">實收</span>
      </div>

      {/* 品項列表 */}
      {Array.from(itemsByCategory.entries()).map(([category, items]) => (
        <div key={category}>
          <SectionHeader title={category} icon="■" />
          <div className="bg-white">
            {items.map((item, idx) => {
              const isConfirmed = confirmed[item.productId]

              return (
                <button
                  key={item.productId}
                  onClick={() => toggleConfirm(item.productId)}
                  className={`w-full flex items-center px-4 py-2.5 text-left active:bg-gray-50 ${
                    idx < items.length - 1 ? 'border-b border-gray-50' : ''
                  } ${item.hasDiff ? 'bg-status-warning/5' : ''} ${isConfirmed ? 'bg-status-success/5' : ''}`}
                >
                  {/* 勾選框 */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isConfirmed ? 'bg-status-success border-status-success' : 'border-gray-300'
                  }`}>
                    {isConfirmed && <CheckCircle size={13} className="text-white" />}
                  </div>

                  {/* 品名 + 異動提示 */}
                  <div className="flex-1 min-w-0 pl-2">
                    <p className="text-sm font-medium text-brand-oak leading-tight">{item.name}</p>
                    <p className="text-[10px] text-brand-lotus leading-tight">{item.unit}</p>
                    {item.hasDiff && (
                      <p className="text-[10px] text-status-warning font-medium leading-tight">
                        央廚異動 {item.diff > 0 ? '+' : ''}{item.diff} {item.unit}
                      </p>
                    )}
                  </div>

                  {/* 叫貨量 → 實收量 */}
                  <div className="flex items-center gap-0.5">
                    <span className={`w-[50px] text-center text-sm font-num ${
                      item.hasDiff ? 'text-brand-lotus line-through' : 'text-brand-oak'
                    }`}>
                      {item.orderQty}
                    </span>
                    {item.hasDiff ? (
                      <>
                        <ArrowRight size={10} className="text-status-warning shrink-0" />
                        <span className="w-[50px] text-center text-sm font-num font-bold text-status-warning">
                          {item.actualQty}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-[12px]"></span>
                        <span className="w-[50px] text-center text-sm font-num text-brand-oak">
                          {item.actualQty}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* 差異備註 */}
      <div className="px-4 py-3">
        <label className="text-sm font-medium text-brand-oak block mb-1.5">差異備註（若有不符）</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="例：芋泥球實際只收到2盒..."
          className="w-full h-20 rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
          style={{ backgroundColor: 'var(--color-input-bg)' }} />
      </div>

      <BottomAction label="確認收貨完成" onClick={() => showToast('收貨確認已提交！')} variant="success" icon={<CheckCircle size={18} />} />
    </div>
  )
}
