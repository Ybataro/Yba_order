# 05 — 門店結算 Settlement.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/store/Settlement.tsx`（308 行 — 最小頁面之一）
- 計算 lib：`src/lib/settlement.ts`（46 行）
- 欄位定義：`src/data/settlementFields.ts`（54 行）
- Store：`src/stores/useSettlementStore.ts`

**路由**：`/store/:storeId/settlement`（AuthGuard requiredRole="store"）
**呼叫者**：`StoreHome.tsx` menu
**最後 commit**：`d5f6406 deploy: 2026-05-22_16:13`（本頁無變動）

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  業務循環                                                              │
│  店長 5/22 22:00 (興南) / 23:00 (樂華) 下班前進結帳                    │
│  selectedDate 預設今天                                                 │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Settlement.tsx 載入（L43-77）                                         │
│   sessionId = `${storeId}_${selectedDate}`                            │
│   讀 settlement_sessions + settlement_values                          │
│   loaded[field_id] = value（從 DB 載入既有）                          │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 渲染（settlementGroups 6 區塊）                                    │
│  ├─ 營運資訊：今日號數、上班人力                                       │
│  ├─ 結帳金額：POS、發票退款、開店找零（佰鈔+零錢）                     │
│  ├─ 支付方式：4 種電子支付、零用金、發票退款 2、前日未存、換零錢、次日零用│
│  ├─ 外送平台：UBER、foodpanda                                          │
│  ├─ 其它收支：其他支出 + 說明、其他收入 + 說明                         │
│  │  ↓ 顯示「應結總金額」（即時計算）                                   │
│  ├─ 實收盤點：千鈔/伍佰/佰鈔/50元/10元/5元/1元（multiplier 自動換算）  │
│  │  ↓ 顯示「鈔票總額」「當日實收現金」                                  │
│  └─ 結算摘要：當日結帳差額（diff）                                     │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 店長按「提交結帳資料」→ handleSubmit
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  handleSubmit (L120-165)                                              │
│  ├─ items = fields 過濾出非空 + map { session_id, field_id, value }   │
│  ├─ submitWithOffline                                                  │
│  │   - 線上：UPSERT settlement_sessions + settlement_values           │
│  │   - 離線：寫 IndexedDB queue                                       │
│  │   - 成功：showSuccessModal（含 cashTotal/billTotal/diff 摘要）     │
│  │   - logAudit + sendTelegramNotification                             │
│  └─ 完成                                                               │
└──────────────────────────────────────────────────────────────────────┘
```

### 計算公式（lib/settlement.ts 與 Settlement.tsx 雙重維護）
```
應結總金額 = posTotal + (開店佰鈔+零錢) + 前日未存
           - 電腦發票退款 + 發票退款
           - 電子支付總和 - 現金支出 - 外送費用
           - 其他支出 - 次日零用金 + 其他收入

當日實收現金 = Σ(面額 × 張數)
             = 千鈔×1000 + 伍佰×500 + 佰鈔×100
             + 50元×50 + 10元×10 + 5元×5 + 1元×1

當日結帳差額 = 當日實收現金 - 應結總金額
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟡

#### 視覺檢查清單
| 元素 | 預期 | 程式碼位置 |
|---|---|---|
| TopNav 「{storeName} 每日結帳」 | ✅ | L169 |
| DateNav | ✅ 可切日 | L172 |
| 已編輯標示 | 藍色 RefreshCw + 「已載入 {today}/{date} 結帳紀錄」 | L174-179 |
| 6 個 SectionHeader 分區塊 | 營運/結帳/支付/外送/其它/實收 | L185-256 |
| input type='text' 欄位 | otherExpenseNote / otherIncomeNote 說明欄 | L192-205 |
| input type='input' 欄位 | NumericInput + multiplier 預覽 | L212-232 |
| 應結總金額卡片（其它收支後）| 黃色 calc 即時顯示 | L235-240 |
| 鈔票總額 / 當日實收現金（實收盤點後）| 黃色雙列 | L243-251 |
| 結算摘要差額 | **diff !== 0 紅、=0 綠** | L258-266 |
| 提交按鈕 | BottomAction「提交/更新結帳資料」 | L268-273 |
| 成功 modal | cashTotal/billTotal/diff 摘要 | L277-305 |

#### ⚠️ 色彩語意問題（與 admin 報表 SettlementHistory 不一致）
- 本頁：`diff !== 0` 就紅色（嚴格）— L262
- admin SettlementHistory.tsx：`|diff| <= 10` 才綠色（容忍 ±10）
- **不一致** → 店長看本頁覺得 diff=-5 是「異常」，但 admin 報表把這當「正常」
- → 列入 **S1 可疑點**

---

### 2. API endpoint 🟢

| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `settlement_sessions` | L53-57 | 載入既有 session |
| READ | `settlement_values` | L61-64 | 載入欄位值 |
| WRITE | `settlement_sessions` UPSERT | submitWithOffline | 主表 |
| WRITE | `settlement_values` UPSERT | submitWithOffline | 明細（onConflict: session_id, field_id）|

#### 防呆驗證
- ✅ supabase / storeId null check（L45）
- ✅ 切日期時 reset form（L48-51）
- ✅ filter 出非空值才寫入（L134）— 避免空字串污染
- ⚠️ **沒有 try/catch/finally 防鎖死**（L120-165 比 Inventory.tsx 簡單，但仍可加）

---

### 3. 後端 lib 🟢

#### lib/settlement.ts（46 行）
```typescript
getVal(vals, fieldId)         → parseFloat(value || '') || 0   ← 純整數 prod 無浮點問題
computeSession(vals)          → 與 Settlement.tsx:81-105 同公式（**雙重維護！**）
```

⚠️ **見可疑點 S2** — `computeSession()` 與 `Settlement.tsx:computed useMemo` **公式重複寫**，未來改動有同步風險

#### data/settlementFields.ts（54 行）
23 個欄位定義 — 涵蓋營運/結帳/支付/外送/其他/實收 6 個 group。
✅ 7 個現金面額欄位有 `multiplier`（1000/500/100/50/10/5/1）
✅ 用 `unit` 顯示「元/張/枚/號/人」

---

### 4. 資料來源 🟢（純整數，無精度問題）

#### prod 真實規模（2026-05-22 SQL 實測）
| 指標 | 值 |
|---|---|
| settlement_sessions | 181 |
| settlement_values | 3369 |
| 涵蓋日期 | 2026-02-20 ~ 2026-05-21 |
| 涵蓋店家 | 2（樂華 + 興南）|

#### settlement_values 完整性驗證
所有 23 個 field_id **全部都是純整數字串**（無小數、無空值）。
- posTotal: 181/181 純整數
- 各電子支付欄位: 181/181 純整數
- 現金面額欄位: 179-181/181 純整數

✅ 印證昨天 1.5 浮點精度修法被跳過的正確性（prod 永遠不會有浮點）

---

### 5. 單位/時區 🟢

#### 時區
- ✅ `selectedDate` 用 `getTodayTW()`（L28）
- ✅ `updated_at: new Date().toISOString()` UTC，DB 自動轉

#### 單位流轉
| 階段 | 變數 | 單位 |
|---|---|---|
| 店長輸入 | `values[field.id]` string | 元/張/枚/號/人（依欄位）|
| multiplier 計算 | `parseFloat(values[id]) * field.multiplier` | 換算成元 |
| 應結總金額 | `expectedTotal` | 元 |
| 當日實收現金 | `cashTotal = Σ 面額 × 張數` | 元 |
| 差額 | `cashTotal - expectedTotal` | 元 |

---

### 6. 死碼 🟢

無發現死碼。

---

### 7. 邊界 🟡

| 情境 | 處理 | 位置 |
|---|---|---|
| supabase / storeId 缺 | early return | L45 |
| 切日期 | reset form | L48-51 |
| 既有 session 載入失敗 | setLoading(false) + 空白繼續 | L59 |
| 欄位空白 | filter 後不寫入 | L134 |
| parseFloat 失敗 | `|| 0` fallback | settlement.ts:8 |
| 離線提交 | submitWithOffline | L141 |
| **提交異常（網路斷）** | ❌ **沒 try/catch，setSubmitting 永遠不解鎖** | L120-165 |
| 重複提交（雙擊）| ❌ 無 submittingRef 防護 | — |

⚠️ **見可疑點 S3 — 提交防鎖死**

---

## 🔢 數學驗算

### 驗算 1：用 5/21 樂華真實資料驗算

prod SQL 取出 5/21 樂華資料：
```
posTotal=50764, orderCount=334, staffCount=5
openCashBills=10000, openCashCoins=3000
prevDayUndeposited=31500
invoiceRefund=0, invoiceRefund2=0
easyPay=1763, taiwanPay=0, allPay=0, linePay=12924
pettyCash=0, changeExchange=18000
uberFee=7916, pandaFee=728
otherExpense=0, otherIncome=0, nextDayPettyCash=10000
cash1000=35, cash500=12, cash100=3
coin50=13, coin10=151, coin5=85, coin1=28
```

```javascript
openCash = 10000 + 3000 = 13000
electronic = 1763 + 0 + 0 + 12924 = 14687
cashOut = 0 + 18000 = 18000
deliveryFees = 7916 + 728 = 8644

expectedTotal = 50764 + 13000 + 31500 - 0 + 0 
              - 14687 - 18000 - 8644 - 0 - 10000 + 0
              = 43933 元

billTotal = 35×1000 + 12×500 + 3×100 = 35000 + 6000 + 300 = 41300 元

cashTotal = 41300 + 13×50 + 151×10 + 85×5 + 28×1
          = 41300 + 650 + 1510 + 425 + 28 
          = 43913 元

diff = 43913 - 43933 = -20 元  ← 收銀台少 20 元
```

✅ 公式正確、純整數運算無精度誤差

### 驗算 2：「應結總金額」業務意義

```
posTotal + 開店找零 + 前日未存入  ← 應該收進的「總金額」
                  - 電腦發票退款            ← 退給客人
                  + 發票退款                ← ??? 為何這個是加？
                  - 電子支付                ← 不是現金，應扣
                  - 現金支出                ← 零用金/換零錢出去的
                  - 外送費用                ← 外送平台抽成
                  - 其他支出
                  - 次日零用金              ← 留給隔天用的
                  + 其他收入

= 收銀台 **應該有的現金**
```

⚠️ **設計疑問**：為何 `invoiceRefund` 是減、`invoiceRefund2` 是加？兩個都叫「發票退款」但符號相反。**這需要業務確認語意**。

→ 列入 **S4 業務疑問**（與昨天 SettlementHistory audit 同樣的疑點）

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `d5f6406` | 2026-05-22 | S1+S2 整合（本頁無變動）|
| `345e843` | 2026-05-22 | DOC + suggestion 死碼清理（本頁無變動）|
| `0cf6946` | 2026-05-21 | 第 2 批（含 SettlementHistory 月報 days 修正、audit_log trigger 對 settlement_sessions）|

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| Settlement.tsx 行數 | 308 |
| settlement.ts 行數 | 46 |
| settlementFields.ts 行數 | 54 |
| useEffect 數量 | 1 |
| useState 數量 | 5 |
| Supabase 操作 | 2 READ + 2 WRITE（via submitWithOffline）|
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟡 | diff 顏色閾值與 admin 不一致 |
| 2. API endpoint | 🟢 | 防呆完整（除提交防鎖死）|
| 3. 後端 lib | 🟡 | 公式雙重維護 |
| 4. 資料來源 | 🟢 | prod 純整數，無精度問題 |
| 5. 單位/時區 | 🟢 | 一致 |
| 6. 死碼 | 🟢 | 無 |
| 7. 邊界 | 🟡 | 提交鎖死與雙擊 |

**整體：🟡 健康但 4 個改善空間**

---

## 🟡 可疑點

### S1 — diff 顏色閾值與 admin 不一致

**位置**：`Settlement.tsx:262`

**對比**：
| 頁面 | 條件 | 顏色 |
|---|---|---|
| 店長端 Settlement.tsx:262 | `diff !== 0` 紅 / `== 0` 綠 | **嚴格** |
| admin SettlementHistory.tsx:126 | `Math.abs(diff) ≤ 10` 正常 / `> 10` 異常 | **±10 容忍** |

**業務影響**：
- 店長：看到 diff=-5 → 紅色「異常」→ 緊張、可能重數一遍
- admin 報表：同樣 diff=-5 → 標「正常」→ 老闆不會關心

**修法**：兩端統一閾值。考量到 admin 已經是 ±10，且實務上找零誤差 5-10 元正常，**建議店長端也改 ±10**。

```typescript
// L261-265
const diffAbs = Math.abs(computed.diff)
const isOk = diffAbs <= 10
<span className={`text-lg font-bold font-num ${isOk ? 'text-status-success' : 'text-status-danger'}`}>
  {formatCurrency(computed.diff)}
  {isOk && diffAbs > 0 && <span className="text-xs ml-1">（誤差容忍範圍內）</span>}
</span>
```

**待業務確認**：±10 合理嗎？還是 ±5？或保持嚴格 0？

---

### S2 — 計算公式雙重維護（重構機會）

**位置**：
- `Settlement.tsx:81-105` 的 `computed useMemo`
- `src/lib/settlement.ts:11-46` 的 `computeSession()`

**現況**：兩處公式**完全相同**但用不同方式維護：
- Settlement.tsx 用 `num()` helper（讀本地 values state）
- settlement.ts 用 `getVal()` helper（讀 DB 拿的 vals 陣列）

**風險**：未來改公式（例如 S4 確認 invoiceRefund 語意後）必須同步改兩處，**漏改 = 店長端與 admin 報表算出不同 diff**

**修法**：把計算改為一個函式，輸入 `Record<string, number>` 或 `SettlementValue[]`，內部統一邏輯。

**工時**：30-45 分鐘 + 雙頁面測試

---

### S3 — 提交無防鎖死 + 無雙擊防護

**位置**：`Settlement.tsx:120-165`

**現況**：
```typescript
const handleSubmit = async () => {
  setSubmitting(true)
  // ... await submitWithOffline ...
  setSubmitting(false)  // ← 萬一中間 throw，永遠不解鎖
}
```

對比 Inventory.tsx 與 Order.tsx 都有：
- try/catch/finally 確保 setSubmitting(false)
- submittingRef 防雙擊

**業務影響**：網路斷時店長按提交 → 卡住 → 按鈕灰掉永遠 → 只能 refresh 頁面（重填）。**結帳資料量大，丟失就麻煩**。

**修法**：套用 Inventory.tsx 同樣 pattern（try/catch/finally + submittingRef）

**工時**：10 分鐘

---

### S4 — `invoiceRefund` vs `invoiceRefund2` 符號相反但語意不明

**位置**：
- `settlement.ts:18-19, 26-27`
- `Settlement.tsx:85-86, 94`
- `settlementFields.ts:24, 33`

**現況**：
```typescript
// 公式：
- invoiceRefund   ← 「電腦發票退款」減
+ invoiceRefund2  ← 「發票退款」加  ← 為何加？
```

**疑點**：兩個欄位都叫「發票退款」但符號相反，**無註解、無業務文件**

**業務確認題**：
- `invoiceRefund` 是退錢給客人（收銀少了這筆）→ 減 ✅ 合理
- `invoiceRefund2` 是什麼？退款收回？發票錯誤的補正？
- 為何分兩欄而不是一欄含正負？

**修法**：先請業務說明語意 → 改欄位 label 與註解 → 補單元測試覆蓋

---

## 🛠️ 修改建議

### M1（✅ 已完成 2026-05-22）：S3 提交防鎖死 + 防雙擊
- 套用 Inventory.tsx pattern（try/catch/finally + submittingRef）
- 加 crashReport
- Commit `02b3679`

### M2（✅ 已完成 2026-05-22）：diff 顏色閾值改 ±10（與 admin 一致）

- 「結算摘要」與「成功 modal」兩處 diff 顯示
- `|diff| ≤ 10` 綠色（容忍）、`> 10` 紅色（異常）
- 非 0 但 ≤10 加註「誤差容忍範圍內」

### M3（重構，中風險）：S2 公式統一

把 Settlement.tsx 的 `computed` 改用 `computeSession()`，公式只在 lib 維護一份
工時 30-45 分鐘 + staging 測試

### M4（業務溝通）：S4 釐清 invoiceRefund 雙欄

需先請業務說明，後續再改

---

## ✅ 下一步

進入 **#06 Schedules.tsx**（門店/央廚排班 + 請假主管簽核）audit。

或者：
- **順手做 M1**（提交防鎖死，10 分鐘）
- 業務討論 M2 / M4

