# 01 — 門店叫貨 Order.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/store/Order.tsx`（846 行）
- 核心 lib：`src/lib/suggestion.ts`（869 行）— V3 建議量演算法
- 時間 lib：`src/lib/session.ts`（61 行）— deadline / TW 時區 helper
- 假日 lib：`src/lib/holidays.ts`（172 行）— 2021-2026 國定假日表
- 最低總量 lib：`src/lib/orderMinTotal.ts`（65 行）

**路由**：`/store/:storeId/order`（AuthGuard requiredRole="store"）
**呼叫者**：`StoreHome.tsx`、`NotificationBell.tsx`（通知點擊）
**最後 commit**：`a8c60fc deploy: 2026-05-21_22:30`（包含時區 SSOT 抽出 utils）

---

## 📐 依賴鏈

```
┌────────────────────────────────────────────────────────────────────────┐
│  使用者觸發                                                              │
│  店長進入 /store/:storeId/order                                          │
└─────────────────┬──────────────────────────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Order.tsx 預設日期邏輯（line 84-87）                                    │
│   today      = getTodayTW()              ← 'Asia/Taipei' SSOT          │
│   yesterday  = getYesterdayTW()                                         │
│   defaultDate = !isPastDeadline(getOrderDeadline(yesterday))            │
│                 ? yesterday : today                                     │
│   意義：昨日叫貨截止（昨日+1 的 08:00 TW）未到 → 顯示昨日，否則今日       │
└─────────────────┬──────────────────────────────────────────────────────┘
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│  DateNav 切日（max="tomorrow"）→ selectedDate state                     │
│  isKitchenRestDay = dow in {0,3}                                       │
│  isRestDayEve     = dow in {2,6}     ← 觸發 banner「需 ×2 量」          │
└─────────────────┬──────────────────────────────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        ▼                    ▼
┌─────────────────┐  ┌──────────────────────────────────────────────────┐
│ 載入既有訂單     │  │  並行資料載入（5 個 useEffect）                    │
│ order_sessions  │  │                                                   │
│   .eq(id=sessionId) │ a) stock          ← inventory_items (架上+庫存) │
│ + order_items   │  │    (selectedDate-1 起 lookback 10 天，取最近一筆) │
└─────────────────┘  │ b) prevUsage      ← D-1 庫存 + D-1 叫貨           │
                     │                     - D 庫存 - D 倒掉             │
                     │ c) kitchenStock   ← product_stock_items 最新       │
                     │ d) suggested      ← computeSuggestions() 🔥        │
                     │ e) minTotals      ← store_order_min_totals         │
                     └─────────────────┬─────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  computeSuggestions()（suggestion.ts:670+）                              │
│                                                                          │
│  Step 1: loadHistoricalData() — 5 表並行查 + 分批 IN 上限                 │
│    - inventory_sessions/items, order_sessions/items                     │
│    - shipment_sessions/items (用 actual_qty 作為 usage 補位)             │
│    - weather_records, daily_revenue                                     │
│    - 10 分快取（_cache module-level）                                    │
│                                                                          │
│  Step 2: 建立 dailyUsages[] — 三種策略（優先序）                          │
│    策略一：D-1 庫存 + D-1 叫貨 - D 庫存 - D 倒掉（盤點公式）              │
│    策略二：用 shipment_items.actual_qty 補漏（SSOT 對齊 business-flow）  │
│    策略三：用 order_items.quantity 兜底（早期 Excel 匯入無出貨記錄）      │
│                                                                          │
│  Step 3: matchDaysV3() — 六階段匹配                                      │
│    Tier 0  : 同 DOW + 同季節 + 溫差≤5°C + 同降雨 ≥3 筆                  │
│    Tier 0b : 同 DOW + 同季節 + 溫差≤8°C ≥3 筆                            │
│    Tier 0c : 同 DOW ≥3 筆（用 IQR 2.5 寬鬆係數）                         │
│    Tier 1  : 同 dayType + 同季節 + 溫差≤5°C + 同降雨 ≥2 筆               │
│    Tier 2  : 同 dayType + 同季節 + 溫差≤8°C ≥2 筆                        │
│    Tier 3  : 同 dayType / 同季節 / 最近14天兜底                          │
│                                                                          │
│  Step 4: calcMedianUsage() — IQR 中位數（取代加權平均，剔除外送單異常）   │
│                                                                          │
│  Step 5: coverDates 覆蓋天數                                              │
│    selectedDate 本身 + 隔天起連續休息日（週三/日）                       │
│    例：週二叫 → 覆蓋[週二, 週三] = 2天                                   │
│    例：週六叫 → 覆蓋[週六, 週日] = 2天                                   │
│    🔥 各天獨立 estimateDailyUsageV3 → 用該 dow 歷史，而非單純 ×2          │
│                                                                          │
│  Step 6: 最終建議量                                                       │
│    suggested = max(totalDemand, safetyGap) → roundToUnit()              │
└─────────────────┬───────────────────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  UI 渲染（buildSortedByCategory + productsByCategory）                   │
│  每列：產品名 | 央廚 | 前日用量 | 庫存 | 建議 | 叫貨量 | 總量警示         │
└─────────────────┬───────────────────────────────────────────────────────┘
                  │ 店長填寫 → handleSubmit
                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  submitWithOffline() wrapper                                            │
│   - 線上：UPSERT order_sessions + order_items (onConflict: session_id) │
│   - 離線：寫 IndexedDB queue                                            │
│   - 成功：偵測 totalAndAlert.isBelow → OrderAlertModal 提示             │
│   - logAudit('order_submit', ...) 寫 audit_logs                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺檢查清單
| 元素 | 預期 | 程式碼位置 |
|---|---|---|
| TopNav 標題 | `{storeName} 叫貨` + History icon | L556-566 |
| DateNav | max="tomorrow"，可往前/後切日 | L570 |
| 央廚休息日警告 banner | 黃色 ⚠ 「此日為央廚休息日（週三/週日），正常不需叫貨」 | L572-578 |
| 「已載入舊單」badge | 藍色 RefreshCw + 日期文字 | L582-587 |
| 最新盤點按鈕 | Package icon + stockDate 顯示 | L589-601 |
| 天氣卡片 | 圖示 + 溫度範圍 + 降雨 % | L607-634 |
| 建議量說明 banner | 黃色 Lightbulb + 「含休息日覆蓋」字樣（isRestDayEve）| L636-639 |
| 「一鍵套用全部建議量」按鈕 | btn-secondary | L641-643 |
| 列標題 sticky | 品項/央廚/前日用量/庫存/建議/叫貨量/總量 | L645-661 |
| 每列數值 | 庫存=0 紅色加粗、負數 prevUsage 紅色 | L675-676 |
| DualUnitInput | 含 box_unit/box_ratio 雙單位輸入 | L685-696 |

#### 色彩規則（在地化金融餐飲）
| 角色 | 顏色 | CSS 變數 |
|---|---|---|
| 庫存 = 0 | 紅色加粗 `text-status-danger font-bold` | L676 |
| 前日用量 < 0（盤點異常）| 紅色 | L675 |
| 建議量 | 藍色 `text-status-info` | L679 |
| 央廚休息日警告 | 黃色 `bg-status-warning/10 text-status-warning` | L574 |
| 已載入舊單 | 藍色 `bg-status-info/10` | L583 |

---

### 2. API endpoint 🟢

#### Supabase 查詢清單（讀寫各幾個）
| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `order_sessions` | L127-130, L298-299, L375 | 載既有單、查歷史叫貨量 |
| READ | `order_items` | L137-139, L304-305 | 載既有品項、查歷史 |
| READ | `inventory_sessions` | L188-193, L281-282, L313-314, L395 | 找最近盤點 / 算 prevUsage |
| READ | `inventory_items` | L211-213, L287-288, L320-321, L404 | 庫存 + 倒掉 |
| READ | `inventory_stock_entries` | L241-243 | 到期日批次（用於 modal）|
| READ | `product_stock_sessions/items` | L373-385 | 央廚成品庫存 |
| READ | `weather_records` | suggestion.ts:221 | 歷史氣象 |
| READ | `daily_revenue` | suggestion.ts:223 | 營業額相似度加分 |
| WRITE | `order_sessions`（UPSERT）| submitWithOffline | 訂單主表 |
| WRITE | `order_items`（UPSERT）| submitWithOffline | 品項明細 |

#### 防呆驗證
- ✅ `if (!supabase || !storeId)` early return（L119, L181, L265）
- ✅ 切日期時清空表單（L120-125）避免殘留前一天資料
- ✅ submit 用 try/catch/finally 防鎖死（L490, L549-551）

---

### 3. 後端 lib 🔥（最複雜的部分）

#### 3.1 session.ts 時間 SSOT
```typescript
// L39  getTodayTW(): 'Asia/Taipei' 今天 YYYY-MM-DD
// L44  getYesterdayTW(): 昨天
// L51  getOrderDeadline(orderDate): 隔天 00:00 UTC = 隔天 08:00 TW
// L59  isPastDeadline(deadline): now() >= deadline
```
✅ 時區處理一致，全用 `Asia/Taipei`，無時區陷阱

#### 3.2 suggestion.ts V3 演算法
✅ **設計合理**：六階段匹配（Tier 0/0b/0c/1/2/3）+ IQR 中位數
✅ **快取**：10 分鐘 module-level cache（_cache）
✅ **批次查詢**：500 筆/批 `.in()` 避免上限
✅ **多策略 fallback**：盤點公式 → 出貨 actual_qty → 叫貨量兜底
✅ **覆蓋天獨立計算**：休息日不用 ×2，各天用該 dow 歷史

ℹ️ **見可疑點 S2** — daily_revenue 是設計上的歷史背景資料（非 bug，改善機會）
⚠️ **見可疑點 S3** — Tier 0 門檻 ≥3 筆對新店可能太嚴格

#### 3.3 orderMinTotal.ts
```typescript
// L15 fetchOrderMinTotals(storeId): 查 store_order_min_totals
// 用途：店長設定「某品項至少要叫 N」防漏訂
// totalAndAlert（Order.tsx:453-465）即時算出 isBelow
```
✅ 設計合理，UI 在 submit 後彈 OrderAlertModal

---

### 4. 資料來源 🟢（daily_revenue 是設計上的歷史背景資料）

#### 上游鏈路驗證（2026-05-22 prod 實測）
| 表 | 真實筆數 | 最早 | 最新 | 狀態 |
|---|---|---|---|---|
| `inventory_sessions` | 275 | 2026-02-19 | 2026-05-21 | ✅ 持續更新 |
| `order_sessions` | 616 | 2024-11-01 | 2026-05-22 | ✅ 持續更新 |
| `shipment_sessions` | 134 | 2026-02-19 | 2026-05-21 | ✅ 持續更新 |
| `weather_records` | 1917 | 2021-01-01 | 2026-05-23 | ✅ 持續更新 |
| `daily_revenue` | 340 | 2024-11-01 | 2025-10-11 | ℹ️ **設計上的歷史背景**（2026-02 系統上線前手動補的） |

#### `daily_revenue` 角色澄清（業務確認 2026-05-22）

**業務真相**：
- 系統 **2026-02 正式上線**
- 為了讓建議量演算法有歷史背景參考，**手動補了 2024-11~2025-10 之間的營業額** 作為「凍結的歷史快照」
- 從正式上線後**不再寫入此表**（現行業務改用即時 settlement_sessions）
- 因此 `daily_revenue` 是**設計上的歷史背景資料**，不是 bug

**對建議量演算法的影響**：
- ✅ `targetRevenue` 推算（suggestion.ts:756-764）從**歷史 dailyUsages** 取，不依賴 daily_revenue 最新狀態
- ✅ `revenueBonus()` 加分對 2024-11~2025-10 的歷史日完全正常
- ⚠️ 對 2026-02 之後的歷史日（候選匹配日）查不到 → bonus = 0
- **真實影響**：bonus 占總分 0-15 / 100+ 比重 → **不影響建議量正確性**，只影響「相似營業額日」優先排序的精度

→ 列入 **S2 改善機會**（非緊急），詳見下方修改建議

---

### 5. 單位/時區 🟢

#### 單位流轉表
| 階段 | 變數 | 單位 | 來源 |
|---|---|---|---|
| 商品定義 | `store_products.unit` | 件/袋/盒 | 主檔 |
| 雙單位 | `box_unit / box_ratio` | 1 箱 = N 件 | 主檔 |
| bag_weight | `store_products.bag_weight` | g | 主檔 |
| 盤點 on_shelf | g 數 | 需 ÷ bag_weight 轉袋 | L233-234, L290-291, L323-324 |
| 盤點 stock | 已是袋數 | 直接相加 | 同上 |
| linkedInventoryIds | 跨子品項加總 | getLinkedSum() | L35-41, L96-102 |
| 叫貨 quantity | 整袋數（小數位視 product.integerOnly）| `parseFloat(orders[p.id])` | L507 |

#### 時區
- ✅ 全程用 `getTodayTW()`、`addDays()`（含 +08:00 標記）、`getDOW()`
- ✅ Order.tsx 內 4 處 `new Date(... + 'T00:00:00+08:00')`（L95, L271, L276, L469）→ **全部正確**
- ✅ 無 `toISOString().split('T')[0]` 過時 pattern

---

### 6. 死碼 🟡

#### 🗑️ 死碼盤點結果（grep 驗證後）
| 名稱 | 位置 | 真實狀態 | 處置 |
|---|---|---|---|
| `restDayMultiplier` | suggestion.ts:41, 849 | ✅ **全專案 0 處讀取**，真死碼 | ✅ **2026-05-22 已清** |
| `restMul` 區域變數 | suggestion.ts:782 | 配合 restDayMultiplier 一起清 | ✅ **2026-05-22 已清** |
| `matchDaysV2()` | suggestion.ts:456-583 | ❌ **不是死碼** — matchDaysV3:686 仍呼叫作為 Tier 1/2/3 fallback | ❌ **保留** |
| `estimateDailyUsage()` 舊版 | 注解 line 9 提及但 grep 不到 | ❌ **早已被移除**，只剩過時註解 | ✅ **2026-05-22 修註解** |

#### ESLint
- 未在本次審查跑 `npm run lint`（之前 commit 多次無錯）

---

### 7. 邊界 🟢

#### 完整邊界 case 表格
| 情境 | 處理 | 程式碼位置 |
|---|---|---|
| 未登入 | AuthGuard 攔下顯示 PinEntry | App.tsx 路由層 |
| Supabase 連線失敗 | early return + setLoading(false) | L119, L181 |
| products 還未 initialize | productsReady gate | L181, L265, L404 |
| 切日期時 | 清空 orders/note/isEdit | L120-125 |
| 央廚休息日（週三/日）選到 | 黃色 banner 警告 | L572-578 |
| 央廚休息日前一天（週二/六）| isRestDayEve → banner 文字加「含休息日覆蓋」| L468-471, L638 |
| 無歷史盤點 | stock = {} + 提示 | L195-200 |
| 無 weather 資料 | defaultWeather fallback | L154-155 |
| 無歷史用量 | matched=[]、suggested=0 | suggestion.ts:611-613 |
| 跨樓層盤點加總 | inventoryIdMap + getLinkedSum | L71-82, L170-178 |
| bag_weight 換算 | onShelf / bag_weight = 袋數 | L233-234 |
| linkedInventoryIds 跨關聯 | sum 多個子品項 | L334-345 |
| 提交時部分 quantity 空 | filter(p => orders[p.id]) 後再 map | L502-508 |
| 離線提交 | submitWithOffline → IndexedDB queue | submitWithOffline.ts |
| 提交異常 | try/catch + sendCrashReport | L545-548 |
| 提交後低於 minTotal | 跳 OrderAlertModal | L522-536 |
| 切換門店 | clearSuggestionCache | L432-434 |
| Tier 0/0b/0c 不夠筆數 | fallback 到 Tier 1/2/3 | suggestion.ts:matchDaysV3 |

---

## 🔢 數學驗算

### 驗算 1：覆蓋天數邏輯（業務 SSOT 對齊）

**情境**：今天是 5/22（週五），店長要叫「**明天 5/23（週六）**」的貨

```typescript
selectedDate = '2026-05-23'   // 週六
isRestDayEve = dow(5/23)=6 → true ✅ 觸發 banner 提醒

// suggestion.ts:771-778
coverDates = ['2026-05-23']    // 當天先加
cursor = addDays('2026-05-23', 1) = '2026-05-24'  // 週日
isKitchenRestDay('2026-05-24') → dow=0 → true
coverDates = ['2026-05-23', '2026-05-24']
cursor = addDays('2026-05-24', 1) = '2026-05-25'  // 週一
isKitchenRestDay('2026-05-25') → dow=1 → false
loop exit

coverDays = 2  ✅ 對應「週六叫 → 覆蓋週六+週日」業務規則
```

### 驗算 2：「週六覆蓋週六+週日」用什麼歷史？

❌ 你以為的（V2 舊邏輯）：用「**歷史週六**」的量 ×2
✅ 實際 V3 做法（suggestion.ts:798-811）：
```typescript
coverDetails[0] = { date: '2026-05-23', dow=6 → 用「歷史週六」估 }  例 25 袋
coverDetails[1] = { date: '2026-05-24', dow=0 → 用「歷史週日」估 }  例 30 袋（週日量更大）
totalDemand = 25 + 30 = 55 袋
```

**V3 更準確**：週日通常比週六量大，分別計算更貼近真實需求。

### 驗算 3：IQR 中位數剔除外送大單

**假設**：某品項 Tier 0 匹配到 7 個歷史日用量：
```
sorted = [10, 12, 14, 15, 18, 20, 95]   ← 95 是某天外送大單
n=7, Q1=sorted[1]=12, Q3=sorted[5]=20
IQR = 20 - 12 = 8
lower = 12 - 1.5×8 = 0
upper = 20 + 1.5×8 = 32
filtered = [10, 12, 14, 15, 18, 20]   ← 95 被剔除 ✅
median = (14 + 15) / 2 = 14.5
```

✅ 演算法正確，IQR 1.5 標準係數運作良好

### 驗算 4：defaultDate 跨夜邏輯（業務驗證）

**情境 A**：店長 5/22 23:30 進入叫貨頁
```
today = '2026-05-22', yesterday = '2026-05-21'
getOrderDeadline('2026-05-21') = '2026-05-22T00:00:00Z' = 2026-05-22 08:00 TW
isPastDeadline(...) → now=23:30 TW < 08:00 TW（隔天）→ false
defaultDate = yesterday = '2026-05-21' ⚠️
```
**店長看到 5/21**，但他想叫 5/23 的貨 → **需手動切日 2 次**

**情境 B**：店長 5/23 00:30 進入
```
today = '2026-05-23', yesterday = '2026-05-22'
deadline('2026-05-22') = 2026-05-23 08:00 TW
isPastDeadline → 00:30 < 08:00 → false
defaultDate = yesterday = '2026-05-22'
```
**店長看到 5/22**，他想叫 5/23 → 需切日 1 次

→ 列入 **S1 可疑點**（UX 改善建議）

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `a8c60fc` | 2026-05-21 | （包含時區 SSOT 抽 utils）|
| `498258c` | 2026-05-04 | PIN 碼管理補上生產紀錄頁面權限（與本頁無關）|
| `b94bdfa` | 2026-04-28 | 修復收貨/出貨/排班/盤點多項 Race Condition（含本頁的 productsInitialized guard）|
| `a9b588d` | 2026-04 | 建議量算法 V3（Tier 0/0b/0c + IQR 中位數）|
| `35bbea1` | 2026-04-14 | 叫貨防呆最低總量提醒（store_order_min_totals + OrderAlertModal）|

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| Order.tsx 行數 | 846 |
| useEffect 數量 | 6（init、stock、prevUsage、kitchenStock、suggestion、minTotals）|
| State 數量 | 16 |
| Supabase 查詢點 | 12（READ）+ 2（WRITE via submitWithOffline）|
| 依賴 lib | 11（suggestion / session / submit / utils / weather / backfillWeather / orderMinTotal / sortByStore / useStoreSortOrder / useStoreOrderVisibility / auditLog）|
| suggestion.ts 行數 | 869 |
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 視覺元素完整、央廚休息日提示已實作 |
| 2. API endpoint | 🟢 | 12 個 READ + 2 個 WRITE，防呆完整 |
| 3. 後端 lib | 🟢 | V3 演算法設計優秀（Tier 0/0b/0c + IQR + 覆蓋天獨立計算）|
| 4. 資料來源 | 🟢 | daily_revenue 為設計上的歷史背景資料（非 bug），改善空間見 S2 |
| 5. 單位/時區 | 🟢 | 全用 `addDays` / `getDOW` / +08:00 標記，無偏移風險 |
| 6. 死碼 | 🟡 | matchDaysV2 / estimateDailyUsage 舊版函式可清（128+ 行）|
| 7. 邊界 | 🟢 | 18 種邊界 case 全覆蓋 |

**整體：✅ 健康度高，2 個次要 issue 待清**

---

## 🟡 可疑點

### S1 — 跨夜進入時 defaultDate 直覺不足

**位置**：`Order.tsx:84-88`

**現象**：店長 5/22 22:30~翌日 07:59 進入叫貨頁，預設顯示「**昨天的日期**」（因為昨天截止時間是今天 08:00 還沒到）。

**業務影響**：
- 店長真實意圖是叫「明天用的貨」→ 看到昨天 → **需手動切日 1~2 次**
- 萬一沒注意 → 把昨天那張單覆蓋掉

**建議**（待業務確認）：
- 方案 A：預設改為「下一個尚未叫過的日期」
- 方案 B：跨夜時段顯眼提示「**你現在看的是昨天日期，要叫明天請切日**」
- 方案 C：維持現狀（功能正確，只是 UX 不直覺）

### S2 — daily_revenue 未從 settlement 自動補入（改善機會，非 bug）

**位置**：`suggestion.ts:223` 的 revenueMap 載入 + 多處 `revenueBonus()` 加分

**現況澄清**（2026-05-22）：
- `daily_revenue` 是**設計上的歷史背景資料**，最初手動補 2024-11~2025-10
- 系統 2026-02 上線後不再寫入此表
- **對「2026-02 後當作匹配候選的歷史日」相似度加分失效**

**改善建議**（非緊急）：
從 `settlement_sessions + settlement_values` 算每日 revenue 自動回寫 daily_revenue。
做法：
```sql
-- 邏輯：每筆 settlement 完成時 trigger 或定時 job 寫入
INSERT INTO daily_revenue (date, store_id, revenue)
SELECT date, store_id, SUM(...) AS revenue
FROM settlement_sessions s JOIN settlement_values sv ...
ON CONFLICT (date, store_id) DO UPDATE ...
```

**待業務決策**：值得實作嗎？
- ✅ 好處：建議量算法的「相似營業額日」加分對近期歷史日也生效（精度小提升）
- ❌ 成本：新增 trigger 或定時 job，多一個維護點
- ❌ 影響有限：bonus 占總分 0-15 / 100+，IQR 中位數已能剔除外送大單異常

### S3 — Tier 0 門檻 ≥3 筆對新季節品可能太嚴格

**位置**：`suggestion.ts:matchDaysV3 Tier 0/0b/0c`

**現象**：Tier 0 要求「同 DOW + 同季節 + 溫差≤5 + 同降雨 ≥3 筆」才生效。

**情境問題**：
- 新品（如 2026-04 上市）→ 累積到「3 個同週幾 + 同條件」需要 21+ 天
- 季節性轉換期（夏轉秋）→ 同季節歷史可能不足
- 短期 fallback 到 Tier 1/2/3（沒同 DOW 概念）→ **準確度下降**

**建議**：
1. 對新品（歷史 < 30 天）降低門檻為 ≥2 筆
2. 或加 telemetry：log 每天有多少品項命中 Tier 0 vs fallback

---

## 🛠️ 修改建議

### M1（已完成 ✅ 2026-05-22）：清死碼 `restDayMultiplier`

**原本計畫**：清 `matchDaysV2` + `estimateDailyUsage` + `restDayMultiplier`

**Grep 驗證後修正**：
- ❌ `matchDaysV2` 仍被 `matchDaysV3` 呼叫作為 Tier 1/2/3 fallback（line 686）→ **保留**
- ❌ `estimateDailyUsage` 舊版函式早已被移除，只剩 line 9 過時註解 → **修註解**
- ✅ `restDayMultiplier` + `restMul` 真死碼（全專案 0 處讀取）→ **已刪除**

**改動**：
- `suggestion.ts:9` 過時註解修正
- `suggestion.ts:41` 移除 `SuggestionBreakdown.restDayMultiplier` 欄位
- `suggestion.ts:780-782` 移除 `restMul` 區域變數
- `suggestion.ts:849` 移除 breakdown 寫入

**驗證**：
- ✅ `tsc -b --noEmit` 零錯誤
- ✅ `grep restDayMultiplier|restMul` 全絕跡

**教訓**：審計時假設「函式名叫 V2 = 死碼」**錯**。命名是歷史，**用 grep 驗證引用**才是事實。

### M2（業務優化，非緊急）：daily_revenue 從 settlement 自動補入

**背景**：daily_revenue 是 2026-02 上線前手動補的歷史背景資料，2026-02 後不再寫入。

**改善**：讓 2026-02 之後的歷史日也享有 `revenueBonus()` 加分（小幅提升匹配精度）。

**做法**：
```sql
-- 從 settlement_sessions + settlement_values 算每店每日 revenue
-- 方法 A：DB trigger（settlement_sessions INSERT 時自動）
-- 方法 B：定時 job（每晚跑一次，補昨天的）
-- 方法 C：寫個 backfill script 一次補完歷史
INSERT INTO daily_revenue (date, store_id, revenue)
SELECT s.date, s.store_id, 
       (SELECT value::numeric FROM settlement_values WHERE session_id=s.id AND field_id='posTotal')
FROM settlement_sessions s
WHERE s.date >= '2026-02-01'
ON CONFLICT (date, store_id) DO UPDATE SET revenue=EXCLUDED.revenue;
```

**決策待業務**：
- ✅ 好處：建議量算法的「相似營業額日」加分對近期歷史日也生效
- ❌ 成本：多一個 trigger 或定時 job 維護點
- ❌ 影響有限：bonus 占總分 0-15 / 100+，IQR 中位數已能剔除外送大單異常
- 🟡 **建議排序：第二優先（先做 M1，再看是否需 M2）**

### M3（UX 優化）：跨夜叫貨日期預設

建議在 `defaultDate` 邏輯加判斷：
```typescript
// 若跨夜時段（22:00~08:00）且 selectedDate 與 today 差異 > 1 天
// → 加一段提示文字「⚠️ 您現在看的是昨天日期，要叫明天請切日」
```

或更激進：跨夜進入時預設「今天」而非「昨天」（需與店長確認使用習慣）

---

## ✅ 下一步

進入 **#02 InventoryLog（門店盤點）** audit，預估該頁複雜度與本頁相當（含 frozen_sales、stock_entries、雙單位處理）。
