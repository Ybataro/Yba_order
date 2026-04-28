import { useEffect } from 'react'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useSettlementStore } from '@/stores/useSettlementStore'
import { useZoneStore } from '@/stores/useZoneStore'
import { useFrozenProductStore } from '@/stores/useFrozenProductStore'
import { useCostStore } from '@/stores/useCostStore'
import { useProductionZoneStore } from '@/stores/useProductionZoneStore'
import { useSopStore } from '@/stores/useSopStore'

// 回傳 true 代表所有影響資料正確性的關鍵 store 已從 DB 載入完畢
export function useInitStores(): boolean {
  const productReady = useProductStore((s) => s.initialized)
  const storeReady = useStoreStore((s) => s.initialized)
  const zoneReady = useZoneStore((s) => s.initialized)
  const staffReady = useStaffStore((s) => s.initialized)

  useEffect(() => {
    useStoreStore.getState().initialize()
    useProductStore.getState().initialize()
    useMaterialStore.getState().initialize()
    useStaffStore.getState().initialize()
    useSettlementStore.getState().initialize()
    useZoneStore.getState().initialize()
    useFrozenProductStore.getState().initialize()
    useCostStore.getState().initialize()
    useProductionZoneStore.getState().initialize()
    useSopStore.getState().initialize()
  }, [])

  return productReady && storeReady && zoneReady && staffReady
}
