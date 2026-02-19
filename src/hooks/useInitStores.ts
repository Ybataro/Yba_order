import { useEffect } from 'react'
import { useStoreStore } from '@/stores/useStoreStore'
import { useProductStore } from '@/stores/useProductStore'
import { useMaterialStore } from '@/stores/useMaterialStore'
import { useStaffStore } from '@/stores/useStaffStore'
import { useSettlementStore } from '@/stores/useSettlementStore'
import { useZoneStore } from '@/stores/useZoneStore'

export function useInitStores() {
  useEffect(() => {
    useStoreStore.getState().initialize()
    useProductStore.getState().initialize()
    useMaterialStore.getState().initialize()
    useStaffStore.getState().initialize()
    useSettlementStore.getState().initialize()
    useZoneStore.getState().initialize()
  }, [])
}
