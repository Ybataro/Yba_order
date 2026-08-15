import { describe, it, expect } from 'vitest'
import { needsMySignature } from '@/hooks/useLeavePendingCount'

// 為何重要：央廚兩位主管同級、不分先後（2026-08-15 改）。
// 判斷「這單還缺不缺我的簽名」若錯了，主管的紅點會永遠是 0，
// 假單就像「消失」一樣卡在 pending — 正是那 6 筆卡單的故障模式。
describe('needsMySignature（無順序雙簽）', () => {
  it('還沒有人簽 → 兩位主管都該看到', () => {
    expect(needsMySignature(null, 'k1')).toBe(true)
    expect(needsMySignature(null, 'k2')).toBe(true)
  })

  it('阿勝先簽了 → 阿勝不該再看到，小宣仍要簽', () => {
    expect(needsMySignature('k1', 'k1')).toBe(false)
    expect(needsMySignature('k1', 'k2')).toBe(true)
  })

  it('反過來小宣先簽也一樣成立（順序無關）', () => {
    expect(needsMySignature('k2', 'k2')).toBe(false)
    expect(needsMySignature('k2', 'k1')).toBe(true)
  })

  it('undefined（欄位未回傳）視同無人簽核，寧可多顯示也不要漏簽', () => {
    expect(needsMySignature(undefined, 'k1')).toBe(true)
  })
})
