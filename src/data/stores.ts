export interface Store {
  id: string
  name: string
  code: string
}

export const stores: Store[] = [
  { id: 'lehua', name: '樂華店', code: 'lehua' },
  { id: 'xingnan', name: '興南店', code: 'xingnan' },
]

export function getStoreById(id: string): Store | undefined {
  return stores.find(s => s.id === id)
}

export function getStoreName(id: string): string {
  return getStoreById(id)?.name ?? '未知門店'
}
