export interface StaffMember {
  id: string
  name: string
}

// 央廚人員（Phase 2 改為後台管理）
export const kitchenStaff: StaffMember[] = [
  { id: 'k1', name: '關堉勝' },
  { id: 'k2', name: '陳宣辰' },
  { id: 'k3', name: '陳佑欣' },
  { id: 'k4', name: '胡廷瑜' },
  { id: 'k5', name: '張馨予' },
]

// 門店人員，依門店分組（Phase 2 改為後台管理）
export const storeStaff: Record<string, StaffMember[]> = {
  lehua: [
    { id: 's1', name: '顏伊偲' },
    { id: 's2', name: '蔡博達' },
  ],
  xingnan: [
    { id: 's3', name: '陳宣佑' },
    { id: 's4', name: '郭峻豪' },
  ],
}

export function getStoreStaff(storeId: string): StaffMember[] {
  return storeStaff[storeId] || []
}
