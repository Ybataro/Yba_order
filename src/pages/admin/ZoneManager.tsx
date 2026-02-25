import { useState, useMemo } from 'react'
import { TopNav } from '@/components/TopNav'
import { AdminModal, ModalField, ModalInput } from '@/components/AdminModal'
import { useToast } from '@/components/Toast'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { useFrozenProductStore } from '@/stores/useFrozenProductStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useZoneStore } from '@/stores/useZoneStore'
import { Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle, Snowflake, Package } from 'lucide-react'

export default function ZoneManager() {
  const stores = useStoreStore((s) => s.items)
  const products = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)
  const frozenProducts = useFrozenProductStore((s) => s.items)
  const materials = useMaterialStore((s) => s.items)
  const materialCategories = useMaterialStore((s) => s.categories)
  const { zones, getStoreZones, getZoneProductIds, addZone, removeZone, assignProduct, unassignProduct } = useZoneStore()
  const { showToast } = useToast()

  // 央廚 + 各門店 tabs
  const allTabs = [
    { id: 'kitchen', name: '央廚' },
    ...stores.map((s) => ({ id: s.id, name: s.name })),
  ]
  const [selectedStoreId, setSelectedStoreId] = useState('kitchen')
  const [expandedZone, setExpandedZone] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formZoneCode, setFormZoneCode] = useState('')
  const [formZoneName, setFormZoneName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const storeZones = getStoreZones(selectedStoreId)
  const isKitchen = selectedStoreId === 'kitchen'

  // Find products not assigned to any zone
  const allAssignedIds = new Set(
    storeZones.flatMap((z) => getZoneProductIds(z.id))
  )

  // 央廚：原物料 + 成品；門店：成品 + 冷凍品
  const unassignedItems = useMemo(() => {
    if (isKitchen) {
      const unMat = materials.filter((m) => !allAssignedIds.has(m.id))
      const unProd = products.filter((p) => !allAssignedIds.has(p.id))
      return { count: unMat.length + unProd.length, names: [...unMat.slice(0, 3).map((m) => m.name), ...unProd.slice(0, 3).map((p) => p.name)].slice(0, 5) }
    }
    const unProd = products.filter((p) => !allAssignedIds.has(p.id))
    const unFrozen = frozenProducts.filter((p) => !allAssignedIds.has(p.key))
    return { count: unProd.length + unFrozen.length, names: [...unProd.slice(0, 5).map((p) => p.name), ...unFrozen.slice(0, 3).map((p) => p.name)].slice(0, 5) }
  }, [isKitchen, materials, products, frozenProducts, allAssignedIds])

  const handleAddZone = () => {
    if (!formZoneCode.trim() || !formZoneName.trim()) {
      showToast('請填寫樓層代碼與名稱', 'error')
      return
    }
    const id = `${selectedStoreId}_${formZoneCode.toLowerCase()}`
    if (zones.some((z) => z.id === id)) {
      showToast('此樓層已存在', 'error')
      return
    }
    addZone({
      id,
      storeId: selectedStoreId,
      zoneCode: formZoneCode.toUpperCase(),
      zoneName: formZoneName,
      sortOrder: storeZones.length,
    })
    showToast('樓層已新增')
    setModalOpen(false)
  }

  const handleDeleteZone = () => {
    if (deleteConfirm) {
      removeZone(deleteConfirm)
      showToast('樓層已刪除')
      setDeleteConfirm(null)
      setExpandedZone(null)
    }
  }

  const toggleProduct = (zoneId: string, productId: string, checked: boolean) => {
    if (checked) {
      assignProduct(zoneId, productId)
    } else {
      unassignProduct(zoneId, productId)
    }
  }

  return (
    <div className="page-container">
      <TopNav title="樓層品項管理" backTo="/admin" />

      {/* Store tabs (央廚 + 各門店) */}
      <div className="flex border-b border-gray-200 bg-white">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setSelectedStoreId(tab.id)
              setExpandedZone(null)
            }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              selectedStoreId === tab.id
                ? 'text-brand-oak border-b-2 border-brand-oak'
                : 'text-brand-lotus'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Unassigned warning */}
      {unassignedItems.count > 0 && (
        <div className="mx-4 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {unassignedItems.count} 個品項未分配區域
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {unassignedItems.names.join('、')}
              {unassignedItems.count > 5 && `...等`}
            </p>
          </div>
        </div>
      )}

      {/* Zone list */}
      <div className="px-4 py-3 space-y-3">
        {storeZones.length === 0 && (
          <div className="text-center py-8 text-sm text-brand-lotus">{isKitchen ? '央廚尚無區域設定' : '此門店尚無樓層設定'}</div>
        )}
        {storeZones.map((zone) => {
          const isExpanded = expandedZone === zone.id
          const assignedIds = new Set(getZoneProductIds(zone.id))

          return (
            <div key={zone.id} className="bg-white rounded-card overflow-hidden shadow-sm">
              {/* Zone header */}
              <div className="flex items-center px-4 py-3">
                <button
                  onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown size={18} className="text-brand-oak" />
                  ) : (
                    <ChevronRight size={18} className="text-brand-lotus" />
                  )}
                  <span className="text-base font-semibold text-brand-oak">{zone.zoneName}</span>
                  <span className="text-xs text-brand-lotus">({zone.zoneCode})</span>
                  <span className="ml-auto text-xs text-brand-lotus">{assignedIds.size} 品項</span>
                </button>
                <button
                  onClick={() => setDeleteConfirm(zone.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 active:bg-red-100 ml-2"
                >
                  <Trash2 size={15} className="text-status-danger" />
                </button>
              </div>

              {/* Product checkboxes */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-2">
                  {isKitchen ? (
                    <>
                      {/* 央廚：原物料 */}
                      {materialCategories.map((cat) => {
                        const catMaterials = materials.filter((m) => m.category === cat)
                        if (catMaterials.length === 0) return null
                        return (
                          <div key={cat} className="mb-2">
                            <p className="text-xs font-semibold text-brand-lotus py-1">{cat}</p>
                            {catMaterials.map((mat) => (
                              <label
                                key={mat.id}
                                className="flex items-center gap-2 py-1.5 px-1 cursor-pointer active:bg-gray-50 rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignedIds.has(mat.id)}
                                  onChange={(e) => toggleProduct(zone.id, mat.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-brand-oak focus:ring-brand-oak/30"
                                />
                                <span className="text-sm text-brand-oak">{mat.name}</span>
                                {mat.spec && <span className="text-[10px] text-brand-lotus">({mat.spec})</span>}
                              </label>
                            ))}
                          </div>
                        )
                      })}
                      {/* 央廚：成品 */}
                      {products.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-brand-lotus py-1 flex items-center gap-1">
                            <Package size={11} />
                            成品
                          </p>
                          {productCategories.map((cat) => {
                            const catProducts = products.filter((p) => p.category === cat)
                            if (catProducts.length === 0) return null
                            return (
                              <div key={cat} className="ml-2 mb-1">
                                <p className="text-[10px] font-medium text-brand-mocha py-0.5">{cat}</p>
                                {catProducts.map((product) => (
                                  <label
                                    key={product.id}
                                    className="flex items-center gap-2 py-1.5 px-1 cursor-pointer active:bg-gray-50 rounded"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={assignedIds.has(product.id)}
                                      onChange={(e) => toggleProduct(zone.id, product.id, e.target.checked)}
                                      className="w-4 h-4 rounded border-gray-300 text-brand-oak focus:ring-brand-oak/30"
                                    />
                                    <span className="text-sm text-brand-oak">{product.name}</span>
                                    <span className="text-[10px] text-brand-lotus">({product.unit})</span>
                                  </label>
                                ))}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* 門店：成品 */}
                      {productCategories.map((cat) => {
                        const catProducts = products.filter((p) => p.category === cat)
                        if (catProducts.length === 0) return null
                        return (
                          <div key={cat} className="mb-2">
                            <p className="text-xs font-semibold text-brand-lotus py-1">{cat}</p>
                            {catProducts.map((product) => (
                              <label
                                key={product.id}
                                className="flex items-center gap-2 py-1.5 px-1 cursor-pointer active:bg-gray-50 rounded"
                              >
                                <input
                                  type="checkbox"
                                  checked={assignedIds.has(product.id)}
                                  onChange={(e) => toggleProduct(zone.id, product.id, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-brand-oak focus:ring-brand-oak/30"
                                />
                                <span className="text-sm text-brand-oak">{product.name}</span>
                                <span className="text-[10px] text-brand-lotus">({product.unit})</span>
                              </label>
                            ))}
                          </div>
                        )
                      })}
                      {/* 門店：冷凍品 */}
                      {frozenProducts.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-brand-lotus py-1 flex items-center gap-1">
                            <Snowflake size={11} />
                            冷凍品
                          </p>
                          {frozenProducts.map((fp) => (
                            <label
                              key={fp.key}
                              className="flex items-center gap-2 py-1.5 px-1 cursor-pointer active:bg-gray-50 rounded"
                            >
                              <input
                                type="checkbox"
                                checked={assignedIds.has(fp.key)}
                                onChange={(e) => toggleProduct(zone.id, fp.key, e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-brand-oak focus:ring-brand-oak/30"
                              />
                              <span className="text-sm text-brand-oak">{fp.name}</span>
                              <span className="text-[10px] text-brand-lotus">({fp.spec})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add zone button */}
      <div className="px-4 pb-6">
        <button
          onClick={() => {
            setFormZoneCode('')
            setFormZoneName('')
            setModalOpen(true)
          }}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          新增樓層
        </button>
      </div>

      {/* Add zone modal */}
      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} title="新增樓層" onSubmit={handleAddZone}>
        <ModalField label="樓層代碼">
          <ModalInput value={formZoneCode} onChange={setFormZoneCode} placeholder="例：3F" />
        </ModalField>
        <ModalField label="樓層名稱">
          <ModalInput value={formZoneName} onChange={setFormZoneName} placeholder="例：3樓" />
        </ModalField>
      </AdminModal>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-card p-6 mx-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-brand-oak mb-2">確認刪除</h3>
            <p className="text-sm text-brand-lotus mb-4">確定要刪除此樓層嗎？該樓層的品項分配將會清除。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1 !h-10">取消</button>
              <button onClick={handleDeleteZone} className="flex-1 h-10 rounded-btn text-white font-semibold text-sm bg-status-danger active:opacity-80">刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
