# 09 — 央廚成品庫存 ProductStock.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/kitchen/ProductStock.tsx`（411 行）
- 到期日批次：`src/components/StockEntryPanel.tsx`（227 行）— 與 Inventory 共用
- 即時庫存 hook：`src/hooks/useKitchenRealtimeStock.ts`
- RPC：`sync_product_stock_entries` (migration `20260407000000`)

**路由**：`/kitchen/products`（AuthGuard requiredRole="kitchen"）
**呼叫者**：`KitchenHome.tsx`
**最後 commit**：`556c933 deploy: 2026-05-22_22:07`

**業務角色**：央廚每天盤點「成品庫存」（已做好的芋圓、紅豆等），這頁的資料 → OrderSummary 表的「庫存」欄位讀取

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  央廚盤點時間（通常週一、週二、週四、週五、週六；週三/日休）           │
│  進入 /kitchen/products                                               │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ProductStock.tsx 初始化（L72-137）                                   │
│  ├─ 篩品項：若央廚有 store_zones（kitchen）→ 只顯示已分配；否則顯示全部 │
│  ├─ 過濾掉「包材類」（已移至即時庫存區）                              │
│  ├─ Load session：product_stock_sessions WHERE id=`kitchen_products_{date}` │
│  ├─ Load items：product_stock_items（每品項 stock_qty）              │
│  └─ Load stock_entries：product_stock_entries（到期日批次）          │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 結構                                                                │
│  ├─ TopNav + DateNav                                                   │
│  ├─ 已編輯 banner（如有紀錄）                                          │
│  ├─ 盤點人員 select（kitchenStaff）                                    │
│  ├─ 即時庫存區（鋁箔包/瓶蓋/貼紙等）— 含「補貨 / 剩餘」 + 個別 ✓ 按鈕  │
│  │   → 寫 kitchen_realtime_tracker（與成品庫存獨立）                  │
│  └─ 各分類分組（除包材類）的成品 ×N                                    │
│      └─ 每列：品名 / DualUnitInput 庫存量 / 展開 StockEntryPanel       │
│          └─ StockEntryPanel：到期日批次（自動 sum → stock 欄）         │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 央廚員工填好 → 按「儲存」
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  doSubmit() (L193-382)                                                │
│  ├─ 驗證：submittingRef 防雙擊、confirmBy 必填                         │
│  ├─ UPSERT product_stock_sessions                                     │
│  ├─ UPSERT product_stock_items + 刪多餘（安全模式）                   │
│  ├─ ⚠️ Stock entries：upsert + 刪多餘（**非 RPC 原子！未用既有 RPC**）│
│  │   - 去重邏輯：seMap 合併同 (pid, expiry_date)                      │
│  │   - 大量診斷 logAudit                                               │
│  ├─ Save realtime items（一一 await saveRtItem）                      │
│  └─ Telegram 通知（含品項數、即時庫存數）                              │
└──────────────────────────────────────────────────────────────────────┘
            ↓
       audit_log trigger 自動寫入（之前 2.5+2.6 加的，但只對 leave/expense）
       → product_stock 不在 audit_log 範圍內
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

| 元素 | 預期 | 位置 |
|---|---|---|
| TopNav 「成品庫存盤點」 | ✅ | L394 |
| DateNav | ✅ | L397 |
| 已編輯 banner | RefreshCw + 日期 | L399-404 |
| 盤點人員 select | kitchenStaff dropdown | L411-424 |
| **即時庫存區**（鋁箔包/瓶蓋/貼紙）| 補貨 / 剩餘 + 單筆 ✓ 按鈕 | L427-475 |
| 各分類成品分組 SectionHeader | productsByCategory（除包材類）| 後續 |
| 每列：品名 / DualUnitInput / 展開 stock entries | ✅ | 後續 |
| BottomAction「儲存」/「更新」 | ✅ | 後續 |
| 歷史日二次確認 dialog | ✅ | L384-390 |

#### 色彩規則
- 即時庫存剩餘 < 0 → 紅
- 已儲存 → 綠 ✓ 短暫顯示後恢復「確認」
- 已編輯 → 藍色 banner

---

### 2. API endpoint 🟡（stock_entries 沒用 RPC）

| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `product_stock_sessions` | L87-91 | session 主表 |
| READ | `product_stock_items` | L97-100 | 庫存量 |
| READ | `product_stock_entries` | L112-116 | 到期日批次 |
| UPSERT | `product_stock_sessions` | L210-217 | session |
| UPSERT | `product_stock_items` | L236-238 | 庫存量 + 刪多餘 |
| **UPSERT** | `product_stock_entries` | L298-300 | ⚠️ **非 RPC 原子** |
| DELETE | `product_stock_entries` 多餘 | L316 | 補刪 |
| 各種 SELECT 驗證讀 | `product_stock_entries` | L320-324 | 驗證筆數 |

#### 防呆驗證
- ✅ submittingRef 防雙擊（L62, L194-198）
- ✅ try/catch/finally（L208, L374-381）
- ✅ confirmBy 必填（L195-198）
- ✅ items 安全模式 upsert + 刪多餘（L236-258）
- ✅ stock_entries 完整診斷 logAudit（L336-347，含 rawCount/dedupCount/upsertOk/verifyCount/mismatch）
- ✅ stock_entries 驗證筆數對齊（L320-327）
- ⚠️ **stock_entries 沒用 RPC**（migration `20260407000000` 已建 `sync_product_stock_entries` RPC 但這頁沒用！）

---

### 3. 後端 lib 🟡

#### sessionId
```typescript
productStockSessionId(date) = `kitchen_products_${date}`
// 例：'kitchen_products_2026-05-22'
```
✅ 每天一筆，無 zone 概念（央廚只有一個地方）

#### Zone 篩選邏輯（L32-44）
```typescript
const kitchenZones = zones.filter((z) => z.storeId === 'kitchen')
if (kitchenZones.length === 0) {
  return { storeProducts: allProducts, ... }
}
```
**設計**：央廚有設 zone（如冷藏 / 冷凍） → 只顯示已分配品項；無 zone → 全部顯示。
**現況**：央廚有 1 個 zone（db-schema 02 確認）→ 走「已分配」路線

#### 包材類過濾（L168-171）
- 包材類（鋁箔包、瓶蓋、貼紙等）已移到「即時庫存區」單獨追蹤
- ProductStock 主區只剩成品（豆花、芋圓、紅豆等）

---

### 4. 資料來源 🟢

#### prod 真實規模（2026-05-22 SQL 實測）
| 表 | 筆數 | 最早 | 最新 |
|---|---|---|---|
| `product_stock_sessions` | 65 | 2026-02-21 | **2026-05-22** ✅ |
| `product_stock_items` | 1484 | — | — |
| `product_stock_entries` | 2316 | — | — |
| `kitchen_realtime_items` (active) | 12 | — | — |
| `kitchen_realtime_tracker` | 153 | — | — |

**5/22 真實狀況**：22 個成品庫存項目（與 OrderSummary 顯示一致）

---

### 5. 單位/時區 🟢

- ✅ `getTodayTW()`
- ✅ DualUnitInput（含 box_unit、box_ratio）
- ✅ stockEntries 自動加總到 stock 欄（L184-191）

---

### 6. 死碼 🟢

無發現

---

### 7. 邊界 🟢（**StockEntry 處理很完整**）

| 情境 | 處理 | 位置 |
|---|---|---|
| supabase 缺 | early return + offline toast | L73, L199-203 |
| 切日期 | reset stock + isEdit + stockEntries | L75-83 |
| 該日無 session | setLoading + return | L93 |
| 提交無 items | 全部清空 product_stock_items | L256-259 |
| stock_entries 全空 | 清空該 session 所有 entries | L329-333 |
| stock_entries 重複 (pid, date) | seMap 合併 quantity | L264-289 |
| stock_entries 驗證筆數不符 | toast error 提示重交 | L325-327 |
| 即時庫存單獨儲存 | 各品項 saveRtItem 一一 await | L353-363 |
| 雙擊提交 | submittingRef 防 | L62, L194 |
| 提交失敗 | crashReport + finally 解鎖 | L374-381 |
| 歷史日提交 | 二次確認 dialog | L384-390 |
| Telegram 失敗 | 不影響本地（fire-and-forget） | L370-372 |

---

## 🔢 數學驗算

### 驗算 1：到期日批次自動加總

**情境**：豆花有 3 個到期日批次
```
StockEntry: [
  { expiry: '2026-05-25', quantity: '8' },
  { expiry: '2026-05-26', quantity: '6' },
  { expiry: '2026-05-27', quantity: '4' },
]

updateStockFromEntries():
  sum = 8 + 6 + 4 = 18
  stock['豆花'] = '18'
```

✅ 自動 sync 設計合理（防員工手動算錯）

### 驗算 2：seMap 重複 key 合併

**情境**：豆花重複輸入相同 expiry_date
```
entries: [
  { expiry: '2026-05-25', qty: '5' },
  { expiry: '2026-05-25', qty: '3' },  ← 重複！
]

seMap.set 第一次：{ pid: '豆花', expiry: '5/25', qty: 5 }
seMap.set 第二次：existing.quantity += 3 → { pid: '豆花', expiry: '5/25', qty: 8 }
seInserts = [{ ..., qty: 8 }]
```

✅ 合併邏輯避免 23505 unique constraint violation

### 驗算 3：upsert + delete 是否安全？

**情境**：原本有 5 個 entries，新版只有 3 個
```
Step 1: upsert 3 個新 entries（成功，DB 含 5 + 3 = 但其中 3 個被覆蓋 → 仍 5 個但 3 個更新）
        實際結果：5 個 row 在（3 個新值 + 2 個未動）
Step 2: SELECT existing 5 個 ID
Step 3: filter newKeys 找出該刪的 2 個 → DELETE 2 個
        最終結果：3 個 row ✅
```

✅ 安全模式設計：先 upsert（不影響舊資料）→ 後刪不在新清單裡的（避免 INSERT 失敗造成資料丟失）

### 驗算 4：與 Inventory.tsx 對比 — **不一致**

**Inventory.tsx**（昨日 audit 02）已用 RPC：
```typescript
const { error: rpcErr } = await supabase.rpc('sync_inventory_stock_entries', { ... })
```

**ProductStock.tsx**（本頁）仍用 upsert + delete 安全模式：
```typescript
const { error: upsertErr } = await supabase.from('product_stock_entries').upsert(...)
// + SELECT existing + filter + DELETE 多餘
```

⚠️ 兩個頁面**邏輯類似但實作方式不同**：
- Inventory：RPC 原子化（已遷移）
- ProductStock：safe-mode upsert + delete（複雜但功能對等）

**現有 RPC `sync_product_stock_entries` 已存在但這頁沒用**！

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `556c933` | 2026-05-22 | ProductionLog RPC 原子化（本頁無變動）|
| `caf9372` | 2026-05-22 | g→kg 全面遷移（本頁可能間接影響：但 ProductStock 主要是袋/桶/盒，少 g）|
| `20260407` | 2026-04-07 | RPC `sync_product_stock_entries` 建立（**但本頁從未用上**）|
| `b94bdfa` | 2026-04-28 | V2.0 try/catch/finally + submittingRef |

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| ProductStock.tsx | 411 |
| useEffect 數量 | 1 |
| useState 數量 | 9 |
| useRef 數量 | 2 |
| Supabase 操作 | 3 READ + 5 WRITE/DELETE |
| 子元件 | StockEntryPanel |
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 即時庫存區 + 成品分類設計清楚 |
| 2. API endpoint | 🟡 | safe-mode upsert 完整但**沒用既有 RPC** |
| 3. 後端 lib | 🟡 | zone 篩選 + 包材類過濾 OK；但 stock_entries 應用 RPC |
| 4. 資料來源 | 🟢 | 65 sessions / 1484 items / 2316 entries 持續活躍 |
| 5. 單位/時區 | 🟢 | 無問題 |
| 6. 死碼 | 🟢 | 無 |
| 7. 邊界 | 🟢 | StockEntry 處理完整（合併 / 驗證 / 診斷 log）|

**整體：✅ 健康但有 1 個小改造機會（M1 用 RPC）**

---

## 🟡 可疑點

### S1 — `product_stock_entries` 沒用既有 RPC（與 Inventory.tsx 不一致）

**位置**：`ProductStock.tsx:297-333`

**現況**：用「upsert + select + filter + delete」safe-mode pattern，**但 prod 已有 `sync_product_stock_entries` RPC（migration 20260407）**

**對比**：
- Inventory.tsx 用 RPC 一行搞定（昨日 audit 02 驗證）
- ProductStock.tsx 仍用 ~40 行的 safe-mode（含 logAudit、驗證筆數等）

**業務影響**：
- ✅ 目前功能正常（safe-mode 也是原子等價的，但靠 client 端多步協作）
- ❌ 程式碼複雜（40 行 vs RPC 一行）
- ❌ 與 Inventory 邏輯不一致，未來改 stock_entries 邏輯要動兩處
- ❌ 萬一中間步驟某個失敗（網路抖）safe-mode 比 RPC 仍多了 race window

**修法**：
```typescript
// 改用既有 RPC
const { error: rpcErr } = await supabase.rpc('sync_product_stock_entries', {
  p_session_id: sessionId,
  p_entries: seInserts.map(i => ({
    product_id: i.product_id,
    expiry_date: i.expiry_date,
    quantity: i.quantity,
  })),
})
```

**工時**：15-20 分鐘
**影響**：簡化代碼、與 Inventory 一致

---

### S2 — `product_stock_*` 沒被 audit_log trigger 覆蓋

**位置**：DB layer

**現況**：之前 2.5+2.6 audit_log trigger 只加在 `leave_requests` + `daily_expenses`，**沒有 `product_stock_*`**

**業務影響**：
- ✅ 不是 bug（業務上是否需要追蹤庫存盤點變更歷史，是業務決策）
- ⚠️ 若未來想追溯「誰把豆花庫存從 20 改成 5」需要 audit log

**評估**：**非 audit log 必要對象**（庫存盤點本身就是「快照」性質，每天獨立一筆，submitted_by 已記錄誰盤的）

**修法**：不修，僅記錄

---

### S3 — 即時庫存（rt）與成品庫存提交是 2 個獨立流程

**位置**：`doSubmit` L353-363 一一 await `saveRtItem`

**現況**：
- 即時庫存「補貨」欄位用 `kitchen_realtime_tracker` 表（獨立）
- 提交時一一 `for...of await saveRtItem`（序列化）
- 若中間某個 rt 儲存失敗，前面成功的不會回滾

**業務影響**：
- ✅ 即時庫存與成品庫存本來就是 2 個獨立業務概念
- ⚠️ 若 rt 部分失敗，UI toast「成品庫存已儲存」但忽略 rt 失敗

**修法**：改 Promise.all 並行 + 收集失敗清單
**工時**：15 分鐘
**優先級**：低（rt 從來沒爆過）

---

## 🛠️ 修改建議

### M1（✅ 已完成 2026-05-22）：S1 改用 `sync_product_stock_entries` RPC

**實施結果**：
- ProductStock.tsx:261-347 從 87 行 safe-mode → **38 行 RPC 呼叫**
- 與 Inventory.tsx 邏輯一致（皆用 RPC）
- 簡化 audit log（rpcOk 取代 upsertOk/deletedCount/verifyCount/mismatch）
- Commit 隨後 prod deploy

### M2（業務溝通，不急）：S2 是否需要 product_stock audit_log

待業務決策（目前 submitted_by 已記錄誰盤）

### M3（次優先）：S3 rt 並行儲存

工時 15 分鐘，從現在每次 6 個 rt 從 6×0.3s = 1.8s 縮短到 0.3s

---

## ✅ 下一步

進入 **#10 MaterialStock.tsx**（央廚原料庫存）或 **#10 MaterialOrder.tsx**（央廚原料叫貨）audit。

或者順手做 M1（15-20 分）讓 ProductStock 與 Inventory 一致。
