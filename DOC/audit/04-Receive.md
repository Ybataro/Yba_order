# 04 — 門店收貨 Receive.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/store/Receive.tsx`（455 行）
- 相關 hook：`src/hooks/useNotifications.ts`（247, 295, 339 三段查詢都依賴此頁）
- 相關 page：`src/pages/admin/BossDashboard.tsx`（L323 shipStatus）
- 相關 page：`src/pages/kitchen/Shipment.tsx`（L342 讀 received_at）

**路由**：`/store/:storeId/receive`（AuthGuard requiredRole="store"）
**呼叫者**：
- `StoreHome.tsx:19` 主入口 menu「收貨確認」
- `useNotifications.ts:267` 通知導向（央廚已出貨）
- `useNotifications.ts:355` 通知導向（央廚已回覆收貨差異）

**最後 commit**：`345e843`（本頁無變動）

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  業務循環                                                              │
│  央廚 14:00 confirm 出貨後 → 系統有狀態變化                            │
│   ├─ shipment_sessions.confirmed_at = now()                          │
│   └─ shipment_items.actual_qty 寫入                                   │
└─────────────────┬────────────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  useNotifications.ts:247-268（每 60s 輪詢）                            │
│  WHERE confirmed_at IS NOT NULL AND received_at IS NULL              │
│  → 跳「央廚已出貨，請確認收貨」通知                                    │
│  → 點擊 link → /store/:storeId/receive                                │
└─────────────────┬────────────────────────────────────────────────────┘
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Receive.tsx 載入（line 58-125）                                       │
│  sessionId = shipmentSessionId(storeId, today)                       │
│  讀 shipment_sessions + shipment_items                               │
│  → 顯示明細：叫貨 vs 實收（hasDiff = orderQty ≠ actualQty）           │
│  → 央廚主動出貨品項另區（isExtra = orderQty === 0）                   │
│  → 央廚回覆顯示（kitchen_reply）                                       │
└─────────────────┬────────────────────────────────────────────────────┘
                  │ 店長按「確認收貨完成」→ 二次確認 dialog
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  handleSubmit() (line 155-193)                                        │
│  ├─ UPDATE shipment_sessions: received_at, received_by, receive_note │
│  ├─ FOR EACH shipment_items: UPDATE received=true（line 181-187）    │
│  │   ⚠️ 與央廚 Shipment.tsx 寫的 received 共用同欄位 — S1 from 03    │
│  └─ logAudit('receive_submit', ...)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 與其他模組的牽連
```
useNotifications.ts:247-310（讀 received_at 判斷「未收貨」彈通知）
useNotifications.ts:337-360（讀 kitchen_reply 彈「央廚已回覆」通知）
BossDashboard.tsx:35, 119, 323（讀 received_at 顯示 shipStatus）
Shipment.tsx:342-351（讀 received_at 決定 shipment_items.received 寫入策略）
StoreHome.tsx:19（menu 入口）
exportReceivePdf.ts（收貨單 PDF 匯出）
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺元素
| 元素 | 位置 |
|---|---|
| TopNav 「{store} 收貨確認」 | L218 |
| 已編輯標示 | L220-225 |
| 「央廚已出貨」綠色 banner（未收貨時）| L227-232 |
| 進度條 `confirmedCount/total` | L246 |
| 「N 項數量異動」警示 | L249-254 |
| PDF 匯出按鈕 | L255-262 |
| 「央廚回覆」訊息區 | L268-284 |
| 差異警示 banner | L286-291 |
| 列：✓ 框 / 品名 / 叫貨 → 實收 | L302-360 |
| 央廚主動出貨區 | L362-414 |
| 差異備註 textarea | L417-422 |
| 二次確認 dialog（核銷全部品項，無法撤銷）| L432-450 |

#### 色彩規則
- 差異列：橘色背景 + 線值劃掉 → 紅字
- 已勾選：綠色背景
- 央廚主動出貨：粉色 SectionHeader

---

### 2. API endpoint 🟢

| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `shipment_sessions` | L64-68 | session 主表 |
| READ | `shipment_items` | L85-88 | 明細 |
| WRITE | `shipment_sessions` UPDATE | L164-171 | received_at + received_by + receive_note |
| WRITE | `shipment_items` UPDATE × N | L181-187 | **for loop 逐筆 update received=true** |

#### ⚠️ 結構性問題
- L181-187 用 **for loop 個別 update** N 筆 items（非 batch）
- 例：10 個品項 = 10 個 await
- 改進空間：用 `.update({received: true}).eq('session_id', sid)` 一次 update

---

### 3. 後端 lib 🟢

無新邏輯，與 Shipment.tsx 共用：
- `shipmentSessionId(storeId, date) = ${storeId}_${date}`
- `formatDualUnit(qty, unit, box_unit, box_ratio)` 顯示用

---

### 4. 資料來源 🚨（核心問題揭露）

#### prod 真實使用率（2026-05-22 SQL 驗證）
```sql
SELECT 
  count(*) FILTER (WHERE received_at IS NOT NULL) AS has_received_at,
  count(*) FILTER (WHERE receive_note IS NOT NULL AND receive_note != '') AS has_receive_note,
  count(*) FILTER (WHERE kitchen_reply IS NOT NULL AND kitchen_reply != '') AS has_kitchen_reply,
  count(*) AS total
FROM shipment_sessions;
```

| 欄位 | 有資料 | 比例 |
|---|---|---|
| total sessions | 134 | 100% |
| has_received_at | **25** | **19%** |
| has_receive_note | 7 | 5% |
| has_kitchen_reply | 3 | 2% |

#### 業務意義（2026-05-22 業務確認）
> **「業務上不需要『門店收貨』這個動作（貨到就到）」**

→ **Receive.tsx 整個頁面實際上是業務面廢用的**
→ 81% 的 shipment 從未被「收貨確認」過

---

### 5. 單位/時區 🟢

- ✅ 顯示用 `formatDualUnit`（與 Shipment / Order 一致）
- ✅ `today = getTodayTW()`，無時區問題

---

### 6. 死碼 🟡

#### 程式碼層面 — 整頁是「程序死碼」
無內部死碼語法問題。**問題在業務層面整頁廢用**（見 S1 / S2）。

---

### 7. 邊界 🟢

| 情境 | 處理 |
|---|---|
| supabase / storeId 缺 | early return |
| productsInitialized = false | early return（避免 productMap 用舊資料）|
| 該日無 shipment | 「今日尚無央廚出貨紀錄」 |
| 已收過貨 | isEdit + RefreshCw banner |
| 央廚有回覆 | 訊息區顯示 |
| 差異品項 | 橘色背景 + 警示 + 央廚異動數值 |
| 主動出貨品項 | 獨立區顯示 |
| 提交時二次確認 | dialog「核銷全部品項，無法撤銷」 |
| PDF 匯出 | 含完整 layout（exportReceivePdf）|

---

## 🔢 數學驗算

### 驗算 1：差異偵測 `hasDiff`

**情境**：芋圓叫 10、央廚實出 11
```typescript
orderQty = 10, actualQty = 11
isExtra = false  // 因為 orderQty > 0
hasDiff = !isExtra && orderQty !== actualQty
       = !false && (10 !== 11)
       = true  ✅

diff = round((actualQty - orderQty) * 10) / 10 = 1.0
顯示：「央廚異動 +1 袋」+ 橘色背景 + line-through 原叫貨量
```

### 驗算 2：主動出貨偵測 `isExtra`

**情境**：央廚主動送茶葉 5 包（門店沒叫）
```typescript
orderQty = 0, actualQty = 5
isExtra = orderQty === 0 = true  ✅
→ 進入「央廚主動出貨」區，不算 hasDiff
```

### 驗算 3：S1 received 欄位寫入衝突（驗證 03-Shipment.md S1）

**情境**：央廚已先在 Shipment.tsx 對芋圓打 ✓（writed received=true）
然後門店進來 Receive.tsx 看見「✓ 已勾選」（line 114, loadedConfirmed）
店長**沒有改動**直接按「確認收貨完成」

```typescript
// Receive.tsx:181-187
for (const item of shipmentItems) {
  await supabase
    .from('shipment_items')
    .update({ received: true })
    .eq('session_id', sessionId)
    .eq('product_id', item.productId)
}
```

**結果**：所有 items 都被 update 為 received=true（即使店長沒勾的）
**意義**：店長 UI 上看到的 ✓ 狀態（從央廚寫入而來）會被當作「全部收齊」處理

⚠️ 印證 **03-Shipment.md S1** 的雙重語意衝突，這裡是另一邊的寫入端

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `b94bdfa` | 2026-04-28 | V2.0 收貨二次確認 Dialog（避免誤觸提交）|
| 較早 | — | kitchen_reply 央廚回覆功能（從 prod 看僅 3 筆使用）|

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| Receive.tsx 行數 | 455 |
| useEffect 數量 | 1（load）|
| useState 數量 | 11 |
| Supabase 操作 | 2 READ + 2 WRITE（其中 1 個是 for loop 逐筆）|
| 子元件 | exportReceivePdf 匯出 |
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 完整、視覺良好 |
| 2. API endpoint | 🟡 | for loop update items 可改 batch |
| 3. 後端 lib | 🟢 | 與 Shipment 共用 |
| 4. 資料來源 | 🚨 | **整頁業務面廢用（81% 從未收貨）**|
| 5. 單位/時區 | 🟢 | 無問題 |
| 6. 死碼 | 🟡 | 業務層死碼，非程式層 |
| 7. 邊界 | 🟢 | 完整覆蓋 |

**整體：🚨 程式碼健康但業務整頁廢用 — 需要決策**

---

## 🎯 S2 業務決策 — 4 方向完整評估

業務已確認：**門店不需要「收貨」這個動作，貨到就到**。

但移除前必須評估「移除影響範圍」。本 audit 找出所有牽連點：

### 📌 影響範圍清單（全專案 grep 結果）

| 檔案 | 涉及內容 | 移除衝擊 |
|---|---|---|
| `App.tsx:17, 139` | Receive 路由 lazy import + route | 路由要拿掉 |
| `pages/store/Receive.tsx` | 整檔 455 行 | 整檔刪 |
| `pages/store/StoreHome.tsx:19` | menu「收貨確認」入口 | menu 刪 |
| `pages/admin/BossDashboard.tsx:35, 119, 323` | shipStatus = `received_at ? 'received' : 'shipped'` | 邏輯永遠回 'shipped'，需簡化 |
| `pages/kitchen/Shipment.tsx:124, 150, 165, 342, 348-351` | 讀 received_at / received_by / receive_note / kitchen_reply | 大段邏輯失效 |
| `hooks/useNotifications.ts:247-310` | 「央廚已出貨，請確認收貨」通知 | 整段通知邏輯刪除 |
| `hooks/useNotifications.ts:337-360` | 「央廚已回覆收貨差異」通知 | 整段通知刪除 |
| `lib/exportReceivePdf.ts` | 收貨單 PDF 匯出 | 整檔刪 |
| `notifications.ts:11` type | `'receive_discrepancy' \| 'kitchen_reply'` 兩個型別 | 移除 |
| DB schema | shipment_sessions: received_at/by, receive_note, kitchen_reply* | migration |

---

### 🟢 方案 A：保留 Receive.tsx 當「對帳檢視頁」
**改動**：
- 移除 BottomAction「確認收貨」按鈕 + 二次確認 dialog
- 移除 textarea + 差異備註
- 標題改「央廚出貨明細」
- 移除提交相關邏輯
- 保留 PDF 匯出、央廚回覆顯示、差異警示

**工時**：30 分鐘
**牽連**：useNotifications.ts:247 通知文案改「央廚已出貨，可查看明細」（不要再寫「請確認收貨」）

**優點**：保留差異對帳價值（店長想看央廚送多少）+ PDF 匯出（門店記錄用）
**缺點**：用過的 7 個 receive_note + 3 個 kitchen_reply 失去功能入口

---

### 🟡 方案 B：完全移除整頁 + DB 欄位
**改動**：
- 刪 Receive.tsx + 路由 + StoreHome menu + exportReceivePdf.ts
- 改 Shipment.tsx 移除所有 received_at / kitchen_reply 邏輯（line 124, 150, 165, 342, 348-351）
- 改 useNotifications.ts 移除 2 段邏輯
- 改 BossDashboard.tsx shipStatus 簡化
- DB migration：DROP COLUMN received_at, received_by, receive_note, kitchen_reply*

**工時**：2-3 小時 + 風險

**優點**：徹底乾淨、減少 6 個檔案的牽連
**缺點**：
- DB DROP COLUMN 是不可逆動作（雖然備份能還原）
- 失去未來「對帳查看」的價值
- 「央廚已出貨」這通知還要不要保留？

---

### 🟠 方案 C：保留檔案但隱藏入口
**改動**：
- StoreHome.tsx 移除 menu 入口
- App.tsx 路由保留（但無人會進）
- 其他不動

**工時**：5 分鐘
**優點**：最低風險、隨時可恢復
**缺點**：留下「未來自己也不知道是不是該刪」的不乾淨技術債

---

### 🟢 方案 D：自動回填 — 央廚 confirm 時 = 自動填 received_at
**改動**：
- Shipment.tsx doSubmit:304-312 加 `received_at: new Date().toISOString()`
- Receive.tsx 仍可進入（顯示為「已收貨」），但無人手動點
- DB 欄位 + 通知邏輯都保留

**工時**：15 分鐘
**優點**：最不破壞既有架構、未來可恢復「需要時門店再覆核」
**缺點**：received_at 變成「央廚確認時間」≈ confirmed_at 重複，語意混淆

---

## 🛠️ 我推薦的方案：A + 結合 03-Shipment.md S1

**推薦理由**：
1. **價值最高**：保留差異對帳檢視 + PDF 匯出（你之前說「兩家店都有用 PDF」場景）
2. **改動最聚焦**：只動 Receive.tsx 一頁 + 一處通知文案
3. **不破壞 DB 結構**：未來想恢復「門店確認」隨時可加
4. **天然解決 S1**：Receive.tsx 移除 handleSubmit → 不再寫 received → 央廚的 `prepared` 欄位（從 S1）變唯一寫入端，語意自然清楚

**綜合修法（整合 03-Shipment.md M1 一起做）**：
1. DB migration：`ALTER TABLE shipment_items ADD COLUMN prepared boolean default false; UPDATE shipment_items SET prepared=received;`
2. Shipment.tsx 改寫 `prepared` 而非 `received`
3. Receive.tsx 改為「對帳檢視頁」（移除提交按鈕、移除 textarea、改標題）
4. useNotifications.ts 改通知文案 + 修改篩選條件
5. staging 驗證 → prod

**總工時**：1.5-2 小時（含 staging + prod 部署）

---

## 📋 待你決定的問題

<必須回答>
1. **S2 方向選哪個？** A 對帳檢視頁 / B 完全移除 / C 隱藏入口 / D 自動回填
2. **「央廚已出貨」通知還要不要？**（讓店長知道貨在路上）

<推薦回答 A 的話補充>
3. **PDF 匯出按鈕保留嗎？**（門店可下載當對帳記錄）
4. **central reply（央廚回覆）功能保留嗎？**（雖然只 3 筆使用，但未來可能用）

---

## ✅ 下一步

等你決定 S2 方向後：
- 進入整合動工階段（DB migration + Shipment.tsx 改 prepared + Receive.tsx 改造）
- 或繼續 #05 Settlement audit 累積全貌再一起動手
