# 07 — 央廚叫貨彙總 OrderSummary.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/kitchen/OrderSummary.tsx`（440 行）
- Modal：`src/components/InventoryStockModal.tsx`（161 行）— 查門店盤點庫存用
- PDF 匯出：`src/lib/exportOrderSummaryPdf.ts`

**路由**：`/kitchen/orders`（AuthGuard requiredRole="kitchen"）
**呼叫者**：`KitchenHome.tsx` menu
**最後 commit**：`02b3679`（本頁無變動）

**業務角色**：央廚每天 08:00 上班第一個看的頁面 — 看「**今天各店叫了什麼、要出多少、剩多少**」

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  業務循環                                                              │
│  央廚 5/23 08:00 上班 → 進 /kitchen/orders                            │
│  selectedDate 預設 today (5/23)                                        │
│  → 看「昨晚門店訂的、今天央廚要出的貨」                                │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  OrderSummary 載入（L134-205）                                         │
│  並行查 4 件：                                                          │
│  ├─ a) 各店 order_sessions + order_items（WHERE date=today）           │
│  │     → storeOrders[storeId][productId] = quantity                   │
│  │     → storeNotes[storeId].freeText = session.note                   │
│  ├─ b) 央廚最新成品庫存 product_stock_sessions（.lte('date', today)）  │
│  │     → productStock[productId] = stock_qty                          │
│  └─ c) （Modal 開啟時）某店歷史盤點 inventory_sessions/items           │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 渲染（單張橫向表格）                                                │
│  欄位順序：                                                             │
│    品項 | [庫存] | 樂華 | 興南 | [加總] | [剩餘]                      │
│      ←央廚成品庫存                  ←getTotal     ←stock - total       │
│                                                                        │
│  顏色語意：                                                             │
│    有叫貨列 → amber 背景                                                │
│    加總 → 紅色框                                                        │
│    剩餘庫存 ≥0 → 綠 / <0 → 紅                                          │
└────────────────────────┬─────────────────────────────────────────────┘
                         │
                         ▼
   PDF 匯出 / 查門店庫存 Modal（另一視角看門店有多少）
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺檢查清單
| 元素 | 預期 | 位置 |
|---|---|---|
| TopNav 「各店叫貨總表」 | ✅ | L283 |
| DateNav | ✅ 切日 | L286 |
| 「查看門店庫存」select | dropdown 選店 → 開 Modal | L289-303 |
| 摘要 banner | 「N / M 品項有叫貨」 | L311-318 |
| PDF 按鈕 | exportOrderSummaryPdf | L319-326 |
| 表頭 sticky | 品項 / 庫存 / 各店 / 加總 / 剩餘 | L332-340 |
| 分類 SectionHeader | productsByCategory | L342-399 |
| 列：品項 + 庫存 + N 店 + 加總 + 剩餘 | 完整橫向結構 | L348-394 |
| 有叫貨列底色 | amber 50/40 | L357 |
| 加總紅框 | 強調 hasOrder | L378-381 |
| 剩餘庫存 < 0 紅 | warning 客戶端 | L386-390 |
| 各店備註區 | mb-4 space-y-2 卡片 | L402-421 |
| InventoryStockModal | 查門店盤點庫存（跨店對照）| L425-437 |

#### 色彩規則
- 表頭 #5A4632 深棕底白字 sticky
- 庫存欄 yellow-100 底（強調央廚有的存貨）
- 加總欄 red-50 + ring-red-200（強調央廚要出的量）
- 剩餘 < 0 紅、≥ 0 綠（明確語意）

---

### 2. API endpoint 🟢

#### Supabase 操作清單
| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `order_sessions` join `order_items` | L149-152 | 各店今日叫貨明細 |
| READ | `product_stock_sessions` | L175-181 | 央廚最新庫存日期 |
| READ | `product_stock_items` | L184-187 | 央廚成品庫存值 |
| READ | `inventory_sessions` | L61-66 | （Modal）門店盤點 session |
| READ | `inventory_items` | L80-83 | （Modal）門店盤點明細 |
| READ | `inventory_stock_entries` | L105-108 | （Modal）到期日批次 |

#### 防呆驗證
- ✅ supabase null check（L135）
- ✅ Modal 開啟才載入門店庫存（避免不必要查詢）
- ✅ 用 `.lte('date', selectedDate)` 取最近一筆庫存（容忍週三/日無盤點）
- ⚠️ **沒有 fetchError state**（與其他頁面不同）— 載入失敗無友善提示
- ⚠️ **load() 失敗只 console.error，無 setLoading(false) 處理**（如查詢 reject）

---

### 3. 後端 lib 🟢（純展示頁，無複雜邏輯）

#### 關鍵函數
| 函數 | 邏輯 | 位置 |
|---|---|---|
| `getTotal(productId)` | 加總所有店叫貨量 | L215-216 |
| `getStock(product)` | 含聚合品項處理（linkedInventoryIds 加總）| L219-232 |
| `resolvedStock` | 整理後的庫存 map（給 PDF 用）| L235-242 |
| `hasNotes(storeId)` | 判斷有無備註 | L254-258 |

#### 設計亮點
- 純讀取頁面，無複雜計算
- 聚合品項處理（linkedInventoryIds 加總庫存）— 與 Order.tsx 一致
- 「剩餘庫存」即時顯示 `stock - total` 提供決策資訊

---

### 4. 資料來源 🟢

#### prod 真實規模（2026-05-22 SQL 實測）

**5/22 各店叫貨**：
```
store     items_count  total_qty
lehua     26           9096      ← ⚠️ 含杏仁茶 ml 數字 SUM 沒意義
xingnan   12           48.5
```
（樂華 9096 = 杏仁茶 ml 數字 + 其他袋裝品總和，混合單位 SUM 是無意義）

**央廚成品庫存**：
- 5/22 product_stock_sessions 有 1 筆（22 個 items）
- 5/21、5/19 也有
- 週三（5/20）休息日無盤點 → fallback 用 `.lte` 取最近一筆 ✅

✅ 設計理性，符合業務「央廚一周三、日休息」實況

---

### 5. 單位/時區 🟡（混合單位顯示沒問題，但加總可疑）

#### 單位處理
| 階段 | 變數 | 單位 |
|---|---|---|
| order_items.quantity | DB 整數/小數 | 依品項 unit |
| storeOrders[sid][pid] | sum | 同上 |
| getTotal(pid) | Σ stores | 同上 |
| **加總顯示** | `formatDualUnit(total, unit, box_unit, box_ratio)` | 單品項合理 |
| **跨品項 SUM** | 沒有顯示，但 prod SQL 直接 SUM(quantity)=9096 | ⚠️ 無意義 |

✅ **UI 上**：每個品項有自己的 unit + formatDualUnit，**不會跨品項加總**，OK
⚠️ **如果未來想顯示「總出貨量」摘要**，要注意不能無腦 SUM

#### 時區
- ✅ `getTodayTW()`
- ✅ 純讀，無時間運算

---

### 6. 死碼 🟢

無發現

---

### 7. 邊界 🟡

| 情境 | 處理 | 位置 |
|---|---|---|
| supabase 缺 | early return | L135 |
| 切日期 | 重載 effect | L205 |
| 某店今日無叫貨 | `storeOrders[sid] = {}` 空物件 | L143-146 |
| 央廚當日無盤點（週三/日）| `.lte('date', selectedDate)` 取最近 | L178 |
| 央廚從未盤點 | `latestSession` 為 null → productStock={} | L181 |
| 門店 Modal 載入失敗 | catch + console.error | L120-122 |
| **主 load() 失敗** | ❌ 無 catch，setLoading 卡 | — |
| 聚合品項 | linkedInventoryIds 加總 | L219-232 |
| 同店多筆 session | sessions.forEach 會合併（但前端不該發生）| L154-170 |

⚠️ **見可疑點 S1** — 主 load 缺 try/catch

---

## 🔢 數學驗算

### 驗算 1：「剩餘庫存」業務意義

**情境**：芋圓央廚庫存 50 袋，樂華叫 30、興南叫 15

```typescript
stock = 50 (央廚成品庫存)
storeOrders['lehua']['芋圓1F'] = 30
storeOrders['xingnan']['芋圓1F'] = 15

getTotal('芋圓1F') = 30 + 15 = 45
remaining = stock - total = 50 - 45 = 5 袋  ← 綠色（夠出）

→ 若 remaining < 0 → 紅色「庫存不夠」 → 央廚知道要趕做
```

✅ 對央廚生產決策有實際幫助

### 驗算 2：「庫存」聚合品項處理

**情境**：芋圓有 linkedInventoryIds=['芋圓1F', '芋圓2F']

```typescript
product = { id: '芋圓1F', linkedInventoryIds: ['芋圓1F', '芋圓2F'] }
// 但實際上 OrderSummary 是看「**央廚成品**庫存」(product_stock_items)
// 央廚的庫存通常沒有樓層概念（央廚就是一個地方）
// linkedInventoryIds 是「**門店**端」的概念（樓層）

getStock(product):
  ids = ['芋圓1F', '芋圓2F']
  productStock['芋圓1F'] = 30  // 央廚有 30
  productStock['芋圓2F'] = null  // 央廚不存這個
  total = 30 + 0 = 30
  found = true
  return 30
```

⚠️ **見可疑點 S2** — linkedInventoryIds 是門店端的概念，央廚庫存看到應該是「芋圓總」這個 SKU，不該分樓層加總。**邏輯雖然不出錯但語意奇怪**

### 驗算 3：5/22 央廚實況

**樂華 5/22 叫貨**：26 品項 9096 件（含杏仁茶 ml 9000）
**興南 5/22 叫貨**：12 品項 48.5 件

對央廚的意義：
- 兩店共叫 26+12=38 個 product_id 紀錄
- 央廚要對照「**今天有 22 個成品庫存紀錄**」決定要生產哪些
- 剩餘 < 0 的品項 → 紅色 → 優先生產

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `02b3679` | 2026-05-22 | M1+M2 Settlement（本頁無變動）|
| `d5f6406` | 2026-05-22 | S1+S2（本頁無變動）|
| `b94bdfa` | 2026-04-28 | Race Condition 修復（本頁可能有相關 productsInitialized）|

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| OrderSummary.tsx | 440 |
| useEffect 數量 | 1（load）|
| useState 數量 | 9 |
| useMemo 數量 | 5 |
| useCallback 數量 | 3 |
| Supabase 操作 | 6 READ（含 Modal 內查）|
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 橫向表格清楚、顏色語意完整 |
| 2. API endpoint | 🟡 | 無 fetchError state 與主 load try/catch |
| 3. 後端 lib | 🟢 | 純展示頁無複雜邏輯 |
| 4. 資料來源 | 🟢 | 容忍央廚週三/日無盤點 |
| 5. 單位/時區 | 🟡 | 跨品項 SUM 是無意義（UI 沒做但要小心未來）|
| 6. 死碼 | 🟢 | 無 |
| 7. 邊界 | 🟡 | 主 load 缺 try/catch |

**整體：🟡 健康度高，2 個小改善**

---

## 🟡 可疑點

### S1 — 主 load() 缺 try/catch（網路失敗會卡載入中）

**位置**：`OrderSummary.tsx:137-202`

**現況**：
```typescript
const load = async () => {
  setLoading(true)
  // ... 多個 supabase 查詢 ...
  setLoading(false)
}
load()
```

**風險**：若中間任一查詢拋錯（如網路斷）→ setLoading(false) 不執行 → 永遠「載入中...」

**修法**（與 Settlement.tsx 同 pattern）：
```typescript
try {
  // ... 查詢 ...
} catch (err) {
  console.error('[OrderSummary] load failed:', err)
  showToast('資料載入失敗，請稍後重試', 'error')
} finally {
  setLoading(false)
}
```

**工時**：5 分鐘

### S2 — linkedInventoryIds 在央廚庫存場景語意奇怪

**位置**：`OrderSummary.tsx:219-232 getStock()`

**問題**：
- `linkedInventoryIds` 是「門店端」設計（樓層 1F+2F）
- 央廚成品庫存（`product_stock_items`）沒有樓層概念
- 但 `getStock` 仍把 linkedInventoryIds 全部加總

**實際影響**：
- 央廚通常 productStock 只存 parent productId（例如 '芋圓1F' parent 那個）
- linkedInventoryIds 的子 ID 通常 productStock 沒紀錄 → null → 不影響加總
- **目前 prod 不會錯**，但邏輯設計「**借用了門店端的概念到央廚**」

**建議**：不修，加註解說明即可。
若未來央廚改成多倉庫（多個央廚），這個邏輯可以複用。

### S3 — 表頭 sticky 寫死 top-14（與 NarrowLayout 有耦合）

**位置**：`OrderSummary.tsx:332`

**現況**：`className="sticky top-14"` 假設 TopNav 高度 56px(=14×4)

**風險**：若未來 TopNav 改高度 → 表頭會錯位

**修法**：用 CSS variable 或常數抽出
**工時**：低優先

---

## 🛠️ 修改建議

### M1（順手做）：S1 主 load 加 try/catch + 加 fetchError state

預估 10 分鐘，套用 SettlementHistory 的 3 態 pattern（loading / error / data）。

### M2（文件補強）：S2 加註解

5 分鐘，純註解說明 linkedInventoryIds 在央廚場景的語意。

---

## ✅ 下一步

進入 **#08 KitchenShipment 已 audit**（03 已做），可選：
- **#08 ProductStock.tsx**（央廚成品庫存盤點頁）
- **#08 MaterialStock.tsx**（央廚原料庫存盤點頁）
- **#08 ProductionLog.tsx**（央廚生產記錄頁）

