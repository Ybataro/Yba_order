# 03 — 央廚出貨 Shipment.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/kitchen/Shipment.tsx`（852 行）
- 相關 page：`src/pages/store/Receive.tsx`（455 行）— 門店收貨
- 相關 page：`src/pages/kitchen/OrderSummary.tsx`（440 行）— 央廚叫貨彙總

**路由**：`/kitchen/shipments`（AuthGuard requiredRole="kitchen"）
**呼叫者**：`KitchenHome.tsx`
**最後 commit**：`345e843`（本頁無變動，但時區 fix 影響 selectedDate）

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  業務循環                                                              │
│  央廚 5/23 08:00 上班 → 進 /kitchen/shipments                         │
│  selectedDate 預設 today (5/23) → 看各店 5/23 訂單明細                │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Shipment.tsx 載入（line 67-189）                                     │
│  並行對「每個 store」載 4 件事：                                        │
│   a) order_items.quantity → orderQty[store][pid]                     │
│      初始預設 actualQty = orderQty（央廚未動前等於門店叫貨量）        │
│   b) order_sessions.note → orderNotes[store].freeText                │
│   c) shipment_sessions（已存在）→ confirmed_by/received_at/reply 等   │
│   d) shipment_items.actual_qty + received → 含 extraItems 分離       │
│      （order_qty=0 且 actual_qty>0 = 央廚主動出貨 extraItems）       │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 結構（line 460-700+）                                              │
│  ├─ DateNav（可切日，可往前看歷史）                                    │
│  ├─ 確認人員選擇（kitchenStaff dropdown）→ confirmBy                  │
│  ├─ 每店 tab（樂華 / 興南）                                            │
│  ├─ 每店明細（productsByCategory 分組）：                              │
│  │   - 品項名 | 央廚實際出貨量（DualUnitInput）| ✓ 打勾                │
│  │   - hasDiff（actual ≠ order）→ 黃色 border 警示                    │
│  ├─ 「未叫貨品項」extraItems（央廚主動出貨）                          │
│  └─ 收貨回饋區（如果已 received_at）：                                 │
│      - 顯示「未收到品項」清單                                          │
│      - 央廚可回覆（kitchen_reply）「下次補出 / 已知悉 / 已補出」       │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 央廚按「確認出貨」 → handleSubmit
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  doSubmit() (line 290-395)                                            │
│  ├─ 驗證 confirmBy 有選                                                │
│  ├─ shipment_sessions UPSERT (id=`${store}_${date}`)                  │
│  │   confirmed_by, confirmed_at = now()                              │
│  ├─ shipment_items 組陣列：                                            │
│  │   - 正常品項：order_qty + actual_qty                               │
│  │   - extraItems（order_qty=0）                                      │
│  ├─ 讀 received_at（門店是否已收貨）→ storeHasConfirmed                │
│  ├─ items 加 received flag                                             │
│  │   storeHasConfirmed=true → 全部 received=true                      │
│  │   else → 用央廚個別 ✓ 打勾的狀態                                    │
│  ├─ 去重（同 session_id + product_id 取最後）                          │
│  ├─ shipment_items UPSERT + 刪除多餘的舊品項                          │
│  ├─ logAudit('shipment_submit', ...)                                  │
│  └─ sendTelegramNotification                                          │
└──────────────────────────────────────────────────────────────────────┘
```

### 與 Receive.tsx 的交互
```
央廚 confirm 出貨   ←→  門店收貨確認（兩個獨立流程）
shipment_sessions:                shipment_sessions:
  confirmed_at = now()              received_at = now()
  confirmed_by = staff              received_by = staff
shipment_items:                   shipment_items:
  actual_qty (SSOT)                 received = true（全部）
  received（看央廚 ✓ 打勾）

⚠️ 兩端對 shipment_items.received 的寫入語意衝突 — 見 S1
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺元素清單
| 元素 | 位置 |
|---|---|
| TopNav 「央廚出貨」 + 確認人員 dropdown | L460-485 |
| DateNav | L489 |
| 各店 tab（樂華 / 興南，stores 載入順序）| L495-510 |
| 該店訂單備註區（freeText）| L515-525 |
| 品項分類 SectionHeader | L530+ |
| 每列：品項名 / 央廚實際出貨量 input / ✓ 打勾 | L539-578 |
| 差異 badge：actual_qty ≠ order_qty → 黃色框 | L569 hasDiff |
| 未叫貨品項區（央廚主動出貨）| L587-650 |
| 收貨回饋區（kitchen_reply）| L655-720 |
| 快速回覆按鈕：「下次補出 / 已知悉 / 已補出」 | L446 quickReplies |

#### 色彩規則
- 差異品項：`!border-status-warning`（黃色框）
- 已打勾 ✓ 確認：`bg-status-success` 綠色
- 央廚未回覆 + 門店未收到品項：橘色警示

---

### 2. API endpoint 🟡（操作多但有結構性問題）

#### Supabase 操作清單
| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `order_items` | L96-98 | 各店該日叫貨明細 |
| READ | `order_sessions` | L108-112 | 該店該日訂單備註 |
| READ | `shipment_sessions` | L122-126 | 已存在的出貨 + 收貨狀態 |
| READ | `shipment_items` | L132-135 | 含 actual_qty + received |
| READ | `shipment_sessions` 即時讀 received_at | L342-343 | 提交時判斷門店是否已收貨 |
| WRITE | `shipment_sessions` UPSERT | L304-312 | confirmed_by/at |
| WRITE | `shipment_items` UPSERT | L362-364 | actual_qty + received |
| DELETE | `shipment_items` 多餘的舊品項 | L378-380 | 安全模式取代「先刪後 insert」|
| WRITE | `shipment_sessions` UPDATE | L417-424 | kitchen_reply（央廚回覆）|

#### 防呆與處理
- ✅ supabase null check（L68）
- ✅ productsInitialized gate（L69）— 避免 productMap 用靜態舊值
- ✅ 確認人員必填（L291-294）
- ✅ 去重（L353-358）— 同 session_id + product_id 防 upsert 500
- ✅ 安全模式：先 upsert 再刪多餘（避免 DELETE 成功 INSERT 失敗）
- ✅ 歷史日提交需二次確認（L397-403 showHistoryConfirm）

#### ⚠️ 結構性問題
- 載入時對「每個 store」做 4 個 sequential queries → 樂華 + 興南 = **8 個 await**（loadAll 內 for of L83）
- 改進空間：用 `Promise.all` 並行載入

---

### 3. 後端 lib 🟢

#### sessionId
```typescript
shipmentSessionId(storeId, date) = `${storeId}_${date}`
// 例：'lehua_2026-05-23'
```
✅ 與 order_sessions / settlement_sessions 同模式，且 UNIQUE (store_id, date)

#### 主動出貨邏輯（extraItems）
央廚可加「門店沒叫但要送」的品項：
- 寫入時 `order_qty = 0, actual_qty > 0`（L335-339）
- 載入時偵測：`item.order_qty === 0 && item.actual_qty > 0` → 歸入 extraItems（L142-146）

✅ 設計合理，業務面：央廚發現該店沒叫某必需品就主動補

---

### 4. 資料來源 🟡（揭露真實 P1）

#### prod 真實資料（2026-05-22 SQL 實測）
| 指標 | 數量 |
|---|---|
| shipment_sessions 總數 | 134 |
| 有 confirmed_at | ~134（全部）|
| **有 received_at** | **25（19%）** ⚠️ |
| 有 kitchen_reply | 3（2%）|
| 有 receive_note | 7（5%）|

#### shipment_items.received 矛盾分析
```
session_received=false (109 sessions, received_at IS NULL)
  ├─ items received=true: 1663 筆  ← ⚠️ 矛盾！session 未收貨但 items 標已收
  └─ items received=false: 66 筆
session_received=true (25 sessions)
  ├─ items received=true: 423 筆
  └─ items received=false: 8 筆
```

→ **見可疑點 S1（最重要）**：`shipment_items.received` 欄位有**雙重寫入語意衝突**

---

### 5. 單位/時區 🟢

#### 單位流轉
| 階段 | 變數 | 單位 |
|---|---|---|
| 訂貨輸入 | `order_items.quantity` | 袋/桶/盒（與品項 unit 一致） |
| 央廚 actual_qty | `string` → `parseFloat` | 同上 |
| 主動出貨 extraItems | `string` → `parseFloat` | 同上 |
| 寫 DB | `actual_qty: number` | 同上 |

✅ 與 order_items.quantity 同單位，無轉換
✅ 央廚不用處理 bag_weight g↔袋（產品定義裡有，但出貨頁直接用整袋數）

#### 時區
- ✅ `selectedDate` 用 `getTodayTW()`（L30）
- ✅ `confirmed_at: new Date().toISOString()`（UTC，DB 自動轉）

---

### 6. 死碼 🟢

Grep 未發現死碼

---

### 7. 邊界 🟢

| 情境 | 處理 | 位置 |
|---|---|---|
| supabase 缺 | early return | L68 |
| productsInitialized = false | early return（避免靜態舊資料）| L69 |
| 切日期 | useEffect 重載所有 store | L67 |
| 該店該日無訂單 | orderItems = [] → 全部 actualQty 空字串 | L100 |
| 該店該日已出貨 | editData[store.id] = true | L129 |
| 央廚主動出貨偵測 | order_qty=0 && actual_qty>0 → extraItems | L142-146 |
| 提交歷史日 | 二次確認 modal | L398-401 |
| 確認人員未選 | toast error + return | L291-294 |
| 提交時門店已收貨 | shipment_items.received 全 true | L344-351 |
| 同 session+pid 重複 | dedup（取最後一筆）| L353-358 |
| 舊有但新列表沒有的 items | DELETE 多餘 | L371-380 |
| 全空 items | 直接 DELETE 該 session 所有 items | L381-383 |
| 央廚回覆無內容 | toast error | L408-411 |
| kitchen_reply 寫失敗 | toast + early return | L426-430 |

---

## 🔢 數學驗算

### 驗算 1：actual_qty SSOT 流向

**情境**：5/23 樂華叫芋圓 10 袋，央廚實際出 11 袋（多送 1）

```
order_items (store: lehua, date: 5/23)
  product_id='芋圓1F', quantity=10  ← order_items.quantity 永不被覆蓋

央廚進入 Shipment 頁
  Shipment.tsx L101-104 載入 → aqData['lehua']['芋圓1F'] = '10'

央廚改成 11
  setActualQty(...) → aqData['lehua']['芋圓1F'] = '11'

點「確認出貨」→ doSubmit
  shipItems = [{ session_id: 'lehua_5/23', product_id: '芋圓1F', 
                 order_qty: 10, actual_qty: 11 }]
  
DB 寫入後
  shipment_items.actual_qty = 11  ← SSOT，被建議量算法 / 前日用量計算讀
  shipment_items.order_qty = 10   ← 凍結快照，給收貨頁顯示「央廚多送 1」
```

✅ 與 business-flow.md SSOT 一致：「order_items.quantity 永不被覆蓋、actual_qty 是後續計算 SSOT」

### 驗算 2：主動出貨邏輯

**情境**：央廚發現興南沒叫「茶葉」但需要送 5 包

```
央廚開「未叫貨品項」picker → 選茶葉 → 填 5
  extraItems['xingnan']['茶葉'] = '5'

doSubmit
  shipItems = [...正常 items, 
    { session_id: 'xingnan_5/23', product_id: '茶葉', 
      order_qty: 0,  ← 因為原本沒叫
      actual_qty: 5 }]

下次載入時 L142-146
  item.order_qty === 0 && item.actual_qty > 0 → exData['xingnan']['茶葉'] = '5'
  ✅ 正確被歸類回 extraItems，不影響正常品項列表
```

### 驗算 3：`shipment_items.received` 矛盾 — 真實 bug 確認

**情境**：央廚對某品項打 ✓ 但門店從未點收貨
```
央廚 5/21 13:00 在出貨頁 → 對芋圓打 ✓ → 確認出貨
  Shipment.tsx L344  
    sessionData?.received_at = null  → storeHasConfirmed = false
  L347-351 
    currentConfirmed['xingnan']['芋圓'] = true（剛打勾的）
    shipItem 寫入 received = true
    其他沒打勾的 received = false

DB 結果：
  shipment_sessions.received_at = NULL  ← 門店從未確認
  shipment_items.received = true  ← 但這個品項標已收（央廚意思是「我準備好了」）
                                    ← 與 Receive.tsx 寫入的「門店收到了」共用同欄位
```

⚠️ **語意衝突**：同一個 `shipment_items.received` 欄位被兩端寫入但意思不同 — 詳見 S1

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `345e843` | 2026-05-22 | DOC 文件 + suggestion.ts 死碼清理（本頁無變動）|
| `b94bdfa` | 2026-04-28 | 多項 Race Condition 修復（含本頁 productsInitialized guard L69）|
| 較早 | — | 主動出貨（extraItems）功能加入 |

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| Shipment.tsx 行數 | 852 |
| useEffect 數量 | 1 大 loadAll（內含 for of 每店 4 query）|
| useState 數量 | 12 |
| Supabase 操作 | 5 READ + 3 WRITE + 1 DELETE |
| 子元件 | 無（Modal 等都 inline）|
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 多店 tab + 差異警示 + 快速回覆 |
| 2. API endpoint | 🟡 | 操作完整但 loadAll 應改 Promise.all 並行 |
| 3. 後端 lib | 🟢 | sessionId 規則一致、主動出貨邏輯清楚 |
| 4. 資料來源 | 🟡 | **shipment_items.received 雙重語意衝突（S1）**|
| 5. 單位/時區 | 🟢 | 直接整數，無 g↔袋換算 |
| 6. 死碼 | 🟢 | 無發現 |
| 7. 邊界 | 🟢 | 15 種邊界 case 都覆蓋 |

**整體：🟡 健康但 1 個 P1 結構性問題（S1）**

---

## 🟡 可疑點

### 🎯 業務決策（2026-05-22 釐清）

**S2 收貨機制**：✅ **業務上不需要「門店收貨」動作**，貨到就到 → received_at 永遠 NULL 是 OK，Receive.tsx 整個頁面實際上是廢的。

**S1 received 欄位**：✅ **要拆兩個欄位**（prepared + received），分清「央廚備好」vs「門店收貨」語意

---

### S1 — `shipment_items.received` 欄位雙重語意衝突（P1，最重要）

**位置**：
- 央廚寫入：`Shipment.tsx:347-351`
- 門店寫入：`Receive.tsx:181-187`

**真實 prod 資料矛盾**（2026-05-22 SQL 驗證）：
```
109 sessions 標「未收貨」（received_at IS NULL）
但其中 1663 筆 items 標 received=true
```

**Root Cause**：
- 央廚 UI 有「品項 ✓ 打勾」按鈕（line 573-577）→ 央廚自己標「該品項已準備好」
- 門店 Receive.tsx 提交收貨時 → 對所有 items 強制 update received=true（line 181-187）
- **兩端共用同一欄位但語意完全不同**

**業務影響**：
1. 「收貨」這個業務動作的真實狀態無法從 `shipment_items.received` 反推
2. 央廚員工的 ✓ 打勾，**門店若進 Receive 看到的「✓ 確認狀態」會被誤認為「自己已收貨」**
3. 報表/分析時無法清楚分辨「央廚備好但門店未收」vs「門店已收貨」

**修法**（**業務已決：方案 A 拆兩欄位**）：
- 加 DB 欄位 `shipment_items.prepared boolean default false`（央廚 ✓ 打勾用）
- 既有 `shipment_items.received` 改純門店端寫（但業務面 S2 已決不再用）
- 央廚 Shipment.tsx 寫入時改用 `prepared`
- migration 同時把現存 prod 資料的 `received` 全部複製到 `prepared`（保留歷史 ✓ 紀錄）

**動工步驟**（推估 1-1.5h，含 staging 驗證）：
1. 寫 migration：`ALTER TABLE shipment_items ADD COLUMN prepared boolean DEFAULT false`
2. 寫 migration：`UPDATE shipment_items SET prepared=received` （遷移歷史 ✓ 標記）
3. 改 `Shipment.tsx:347-351` 寫入 `prepared` 而非 `received`
4. 改 `Shipment.tsx:147` 讀取改用 `prepared`
5. Receive.tsx：保留現有讀寫 received 邏輯（雖然 S2 廢用，但不主動拆）
6. staging 驗證 → prod

### S2 — Receive.tsx 整個頁面是廢用設計（業務確認 2026-05-22）

**位置**：`Receive.tsx:155-193` 整個 handleSubmit

**真實狀況**（prod 驗證）：
- 134 個 shipment_sessions 只有 25 個有 received_at
- 對應你之前的描述「**門店不需手動點收貨**」實際代碼仍要求門店主動 submit
- **真實情境：門店員工幾乎不點這個按鈕**，因為貨已經到了不需確認

**業務影響**：
- `received_at` 大部分為 NULL → 任何依賴此欄位的功能（出貨頁判斷門店是否收貨）幾乎不會 trigger
- `received_by`、`receive_note`、`unreceived_items` 也跟著沒用

**業務真相**（2026-05-22 釐清）：**業務上不需要「門店收貨」動作**，貨到就到。

**待決策**（4 個方向）：
- A：保留 Receive.tsx 頁面當「**對帳檢視頁**」（看央廚送的 vs 我們叫的差異），不再要求 submit
- B：完全移除 Receive.tsx + 路由 + Home 入口 + 相關 DB 欄位（receive_note / received_at / kitchen_reply）
- C：保留但隱藏入口（從 StoreHome 移除按鈕）
- D：自動回填 — 央廚 confirm 時 = 自動填 received_at（最不破壞既有設計）

⚠️ 移除前需確認：`hooks/useNotifications.ts:247` 有讀 shipment_sessions 通知門店「央廚已出貨」— 這還要保留

### S3 — loadAll 序列化載入（效能）

**位置**：`Shipment.tsx:83 for (const store of stores)`

**現況**：對 stores（樂華+興南）依序載入，每店 4 次 query，總共 8 次 await
**改進**：`Promise.all(stores.map(...))` → 2 倍快

**影響**：使用者開頁多等 0.5-1 秒（不嚴重，但容易改）

---

## 🛠️ 修改建議

### M1（**業務已決，可動工**）：S1 拆 `prepared` + `received` 欄位

詳細步驟見 S1 段落（6 步驟，1-1.5h）。

**重點**：
- DB migration 不破壞既有資料（`prepared = received` 複製過去）
- 前端只動 Shipment.tsx 兩處（讀寫）
- Receive.tsx 不動

### M2（**業務已決，需再選 4 方向**）：S2 Receive.tsx 廢用後處置

待你回答 S2 段落的 A/B/C/D 方向後再動。

### M3（效能優化，順手）：S3 並行載入

`for of` → `Promise.all`，預估 30 分鐘 + staging 驗證

---

## ✅ 下一步

進入 **#04 Receive（門店收貨）** audit — 與本頁強相關，建議**接著做**確認兩端 SSOT 完整圖像。

或者：
- 先請業務確認 S1 / S2 兩個結構性問題的修法方向
- 或繼續做下一頁 audit 累積全貌
