# YBA 業務流程與狀態機

> 撰寫日期：2026-05-22
> 用途：說明 YBA 連鎖餐飲的核心業務流程、各表 SSOT 角色、資料生命週期
> 補完 `architecture.md` 第九章「SSOT 約定」與 `db-schema.md` 第二章「SSOT 關係圖」

---

## 一、核心循環：每日訂貨流（最重要的業務）

> ⚠️ 注意：YBA 的訂貨循環**跨夜進行**（前一日 23:50 訂隔日的貨），與一般「早上叫午前出」流程不同。

### 🕐 真實時序（5/22 → 5/23 完整一輪）

```
日期    時間   角色          動作                     寫入                          SSOT 結果
─────  ────  ──────────  ──────────────────────  ──────────────────────────  ───────────────────
                          🌅 前一日（5/22）夜間結束營業
                          
5/22   08:00 央廚         確認昨晚收到的叫貨單     OrderSummary 頁面（讀）       —
                          
5/22   14:00 央廚         出貨（含主動加減）        shipment_sessions             actual_qty（SSOT）
                                                  + shipment_items              order_qty (快照)
                                                                                received_at = now()
                                                                                ← 央廚 confirm 時自動填
                                                                                
                          🏪 門店收到貨後當日營業
                          
5/22   22:00 興南店長     結帳                     settlement_sessions+values    posTotal/expected/diff
5/22   23:00 樂華店長     結帳                     同上                          同上
                                                  
5/22   22:30 興南店長     盤點                     inventory_sessions+items      on_shelf/stock/discarded
5/22   23:30 樂華店長     盤點                     同上                          → 拿來算建議量
                                                  
5/22   23:35 系統         算建議量（隔日 5/23）    讀 actual_qty + 氣象          suggestion.ts V3
                                                                                tier 0/0b/0c + IQR
                                                  
5/22   23:50 各店店長     進叫貨頁                 order_sessions+items          quantity (SSOT)
              (在頁面選 5/23 日期)                 store_id+date=5/23            ← 永不被覆蓋
                                                                                
                          🚚 隔日（5/23）央廚出貨
                          
5/23   08:00 央廚         確認 5/22 23:50 那批單   OrderSummary（讀 5/23 訂單）   —
5/23   14:00 央廚         出貨給 5/23 當日營業用   shipment 寫 date=5/23         actual_qty
                          （門店自動收貨完成）      received_at = now()           
                                                  
                          ↻ 循環下一輪
```

### 🔑 SSOT 關鍵時間軸（不是時鐘時間，是業務節點）

| 業務節點 | 寫入表 | SSOT 欄位 | 觸發者 |
|---|---|---|---|
| **訂貨產生**（晚上 23:50）| `order_sessions + order_items` | `quantity` | 門店店長手動 |
| **建議量產生**（晚上 23:35）| 無（即時算）| `suggestion.ts` 輸出 | 自動觸發於叫貨頁 |
| **出貨確認**（隔日 14:00）| `shipment_sessions + shipment_items` | `actual_qty`, `order_qty`, `received_at` | 央廚 confirm |
| **盤點數據**（晚上 22:30/23:30）| `inventory_sessions + inventory_items` | `on_shelf`, `stock`, `discarded` | 門店店長 |
| **結帳數據**（晚上 22:00/23:00）| `settlement_sessions + settlement_values` | `posTotal`, `cashTotal`, `diff` | 門店店長 |

### 🏖️ 央廚休息日邏輯

**央廚每週三、日休息** → 無出貨。

| 訂貨日（夜間）| 出貨日 | 補貨量 |
|---|---|---|
| 週一 23:50 | 週二 | 1 天量 |
| 週二 23:50 | 週三休 → **實際週四出** | **2 天量**（週三、週四份）|
| 週三 | （央廚休，無人訂）| — |
| 週四 23:50 | 週五 | 1 天量 |
| 週五 23:50 | 週六 | **2 天量**（週六、週日份）|
| 週六 23:50 | 週日休 → **實際週一出** | （週六晚已涵蓋週日，週日不需重訂）|
| 週日 | （央廚休，無人訂）| — |

⚠️ **TODO 確認系統行為**：
- ❓ 系統是否在週二、週六**自動提醒「明天央廚休息，需訂 2 天量」**？
- ❓ 建議量算法是否會偵測休息日**自動 ×2**？
- 📌 已知需求方向：**系統提醒「明天是休息日」** — 待 audit Order.tsx 時驗證實作

### 🏪 門店休息日
- 興南店、樂華店**無公休日**（全年無休）

### 自動收貨機制（重要！）
**央廚 confirm 出貨時 → 自動寫 `shipment_sessions.received_at = now()`**
→ 門店**不需手動點收貨**，但 Receive.tsx 頁面仍可進入查看央廚異動明細。

→ 待 audit Shipment.tsx + Receive.tsx 確認此邏輯實際在哪段代碼。

### 🌙 跨夜訂貨情境（兩種真實場景）

**店長下班時間決定 selectedDate 邏輯**（Order.tsx:87 + session.ts:51）：

| 此刻時間 | 預設 `selectedDate` | 店長意圖叫貨日 | 是否需手動切日 |
|---|---|---|---|
| 5/22 22:30-23:59 | **5/22** | 5/23 央廚出貨用 | ✅ 需手動選 5/23 |
| 5/23 00:00-07:59 | **5/22**（yesterday）| 5/23 央廚出貨用 | ✅ 需手動選 5/23 |
| 5/23 08:00 之後 | **5/23**（today）| 5/24 央廚出貨用 | ✅ 需手動選 5/24 |

**設計邏輯**：`getOrderDeadline(date) = 隔天 08:00 TW`，截止前預設顯示「未截止那張單」讓店長可繼續編輯。

**店長使用習慣（你描述的）**：
1. 多數店長下班後 00:00-01:59 才進入叫貨頁 → 系統預設 5/22 → **店長手動切到 5/23** 才開始叫貨
2. 22:30-23:59 進入叫貨頁 → 系統預設今天 → 同樣手動切隔天

⚠️ **UX 隱憂（待 audit 確認**：跨夜進入時預設「昨天日期」可能造成誤改昨晚那張單。要看代碼是否有「自動跳到下一個未叫的日期」邏輯。

### 🏖️ 央廚休息日提示（已實作）

Order.tsx:94-97 有 `isKitchenRestDay` 邏輯：
```typescript
const isKitchenRestDay = (() => {
  const dow = new Date(selectedDate + 'T00:00:00+08:00').getDay()
  return dow === 3 || dow === 0  // 週三、週日
})()
```

✅ 代碼有偵測選到「央廚休息日」的情境（詳細 UI 警告 + 是否自動 ×2 量待 audit Order.tsx 時細查）。

### 🎯 `order_sessions.date` SSOT 真相（容易被誤判的關鍵）

**`date` 欄位儲存「訂單目標日」，不是「訂單建立日」**。

prod 真實驗證（2026-05-22 查詢）：
```
id                  date          updated_tw（建立時間）
xingnan_2026-05-22  2026-05-22    2026-05-22 00:35   ← 剛跨日的訂單
lehua_2026-05-22    2026-05-22    2026-05-21 23:32   ← 前一晚 23:32 訂的
lehua_2026-05-21    2026-05-21    2026-05-20 23:32   ← 前一晚 23:32 訂的
```

**意義**：
- `date` = 目標日（央廚要在這天出貨、門店要在這天用的日期）
- `submitted_at` = 真實建立時間（多為前一晚 22:30~01:00）
- `id` 採 `{store_id}_{date}` 格式，且有 `UNIQUE (store_id, date)` 約束 → 同店同目標日只能有一筆訂單

**設計合理性**：
- ✅ 月報 / 統計查詢用 `date` 篩選 → 自然按「使用日」歸戶（合乎業務直覺）
- ✅ 央廚查「今天要出哪些」用 `WHERE date = today` → 一次撈到當天所有店訂單
- ✅ 不會因「跨日訂貨」造成業績算到錯的日子

⚠️ **過去誤判**：sub-agent 曾報「OrderHistory 日期 UTC 邊界問題」P1，**但代碼用 `date` 欄位篩選（純字串日期），完全沒有時區轉換**，不是 bug。

### 三個關鍵 SSOT

| SSOT 欄位 | 真實含義 | 寫入時機 | 讀取者 |
|---|---|---|---|
| **`order_items.quantity`** | 門店原始需求意圖 | 門店送出叫貨單時，**永不被任何後續流程覆蓋** | 歷史叫貨查詢、央廚 OrderSummary |
| **`shipment_items.actual_qty`** | 央廚實際出貨數量（含主動補貨） | 央廚出貨時 | **報表**、**建議量算法**、**前日用量計算**、`useKitchenRealtimeStock` |
| **`shipment_items.order_qty`** | 出貨時記錄的叫貨量（凍結快照） | 央廚出貨時，從 `order_items.quantity` 複製過來 | 門店收貨頁顯示「央廚異動」差距 |

⚠️ **千萬不要**讀 `order_items.quantity` 來算前日用量或建議量 — 因為央廚主動加減的量不會反映。

---

## 二、訂貨流詳細：各頁角色

### 📋 門店叫貨頁 `/store/:storeId/order`（Order.tsx）

**讀**：
- `inventory_sessions` + `inventory_items`（前日盤點作建議量參考）
- `order_sessions` + `order_items`（今天已叫過嗎？防重複）
- `product_stock_sessions` + `product_stock_items`（央廚今日成品量）

**演算法調用**：`lib/suggestion.ts` V3
- Tier 0/0b/0c：找同星期幾的歷史日匹配
- IQR 中位數濾波（剔除外送單等異常）
- 溫度分群（高溫 vs 低溫）+ 雨量分群
- 覆蓋天數獨立計算

**寫**：
- `order_sessions`（含 store_id + date + 杏仁茶瓶罐量 + 紙碗量 + note）
- `order_items` × N（每個品項一筆 quantity）

**防呆**：
- `store_order_min_totals` 最低總量提醒（顯示 modal）
- `store_order_hidden` 隱藏部分品項
- `store_item_sort` 自訂排序

### 🏭 央廚出貨頁 `/kitchen/shipments`（Shipment.tsx）

**讀**：
- `order_items` join `order_sessions`（門店今天叫了多少）
- `shipment_sessions` + `shipment_items`（央廚是否已出過）

**邏輯**：
- 央廚員工調整 `actual_qty`（可改大或改小）
- 新增「**主動出貨**」的品項（門店沒叫但央廚要送）
- 「確認出貨」後寫入 + 通知門店

**寫**：
- `shipment_sessions`（store_id + date + confirmed_at + 之後 received_at）
- `shipment_items`（actual_qty + order_qty 雙寫）

### 📦 門店收貨頁 `/store/:storeId/receive`（Receive.tsx）

**讀**：
- `shipment_sessions` + `shipment_items`（看央廚出了什麼）
- 比對 `order_qty` vs `actual_qty` 顯示央廚異動

**寫**：
- `update shipment_sessions set received_at = now()`

---

## 三、結帳流程（settlement）

### 流程
```
門店店長下班前
  │
  ├─ 進結帳頁 /store/:storeId/settlement
  │
  ├─ 填寫 settlement_fields 定義的欄位
  │  ├─ posTotal（POS 結帳金額）
  │  ├─ orderCount（今日號數）  
  │  ├─ cash1000/500/100 + coin50/10/5/1（實點現金）
  │  ├─ easyPay/taiwanPay/allPay/linePay（電子支付）
  │  ├─ uberFee/pandaFee（外送平台）
  │  └─ otherExpense/otherIncome（其他）
  │
  └─ 送出 → settlement_sessions（每店每日 1 筆）+ settlement_values × N
              │
              ▼
         computeSession() 計算（lib/settlement.ts）
              │
              ├─ cashTotal = Σ (面額 × 張數)
              ├─ expectedTotal = posTotal + 開店零錢 + 前日 - 退款 - 電子 - 支出
              ├─ diff = cashTotal - expectedTotal
              │   └─ |diff| ≤ 10 → 正常（綠）；> 10 → 異常（紅）
              └─ avgPrice = posTotal / orderCount
```

### 「差額」物理意義
- `diff > 0` = 收銀台**多錢**（可能少給找零、或入帳少算）
- `diff < 0` = 收銀台**少錢**（可能多給找零、漏入帳）
- `|diff| ≤ 10` 視為正常（給找零誤差容差）

---

## 四、請假流程 V2 狀態機

### 完整狀態圖
```
                            員工送單
                               │
                               ▼
                          ┌──────────┐
                          │ pending  │
                          └────┬─────┘
                               │
                ┌──────────────┴──────────────┐
                │                              │
        第一主管核准                       第一主管駁回
                │                              │
                ▼                              ▼
   ┌───────────────────┐               ┌──────────────┐
   │ 有第二主管嗎？     │               │   rejected   │← 員工可改後重送
   └────┬──────────────┘               │              │  (清空所有 approver
        │                              │              │   欄位+回到 pending)
   有─→ │ approver1_approved           └──────────────┘
        │      │
        │      ├─ 第二主管核准 → manager_approved
        │      └─ 第二主管駁回 → rejected
        │
   無─→ manager_approved（直接跳）
        │
        ▼
   ┌─────────────────────┐
   │  manager_approved   │ ← 等 admin 後台最終審核
   └──────┬──────────────┘
          │
          ├─ admin 核准 → approved → 寫 schedules + 扣 leave_balances（atomic）
          │                                          
          └─ admin 駁回 → rejected
```

### 5 個狀態（lib/leave.ts:25-30）
| Status | 中文 | 下一步可能 |
|---|---|---|
| `pending` | 待第一主管審核 | → approver1_approved / manager_approved / rejected |
| `approver1_approved` | 待第二主管審核 | → manager_approved / rejected |
| `manager_approved` | 待最終審核 | → approved / rejected |
| `approved` | 已核准 | （終態，可由 admin 刪除）|
| `rejected` | 已駁回 | （終態，員工可重送 → 回 pending） |

### 7 種假別（lib/leave.ts:4-12）
| ID | 中文 | 預設天數 | 需要照片 |
|---|---|---|---|
| `annual_leave` | 特休 | 7 | ❌ |
| `sick_leave` | 病假 | 30 | ✅ |
| `personal_leave` | 事假 | 14 | ❌ |
| `comp_leave` | 補休 | 0 | ❌ |
| `public_holiday` | 國定假日 | 11 | ❌ |
| `marriage_leave` | 婚假 | 8 | ❌ |
| `other_leave` | 其他 | 0 | ❌ |

### 主管 / Admin 路由規則
- **主管**從 `user_pins` 查：`is_leave_approver=true` + `leave_approver_scope=員工所屬 store/kitchen`
- **第一主管** = `leave_approver_order=1`
- **第二主管** = `leave_approver_order=2`（可不存在）
- **Admin** = `user_pins.role='admin'`

### Approve 時的副作用（樂觀鎖 + RPC 原子操作）
```
admin 按核准（manager_approved → approved）
  │
  ├─ 1. UPDATE leave_requests
  │     WHERE id=? AND status='manager_approved'（樂觀鎖）
  │     → 若 0 rows updated 則回滾（race condition 防護）
  │
  ├─ 2. UPSERT schedules（每天一筆 attendance_type=leave_type）
  │     若失敗 → 回滾 status 為 manager_approved
  │
  ├─ 3. RPC increment_leave_used()
  │     ON CONFLICT (staff_id, leave_type, year) DO UPDATE
  │     若失敗 → 回滾 schedules + status
  │
  ├─ 4. notifyStaffLeaveResult(staff_id, ...)
  │     從 staff.telegram_id 取 chat_id 推播
  │
  └─ Trigger: trg_audit_leave_requests
       └─ INSERT audit_log（old_data + new_data 全 jsonb 快照）
```

---

## 五、央廚生產循環

### 每日生產記錄 `/kitchen/production-log`（ProductionLog.tsx）
```
央廚員工
  │
  ├─ 進生產記錄頁
  │
  ├─ 看 production_zone_defs（區域定義）
  │  ├─ 例：熱台、冷台、冰櫃
  │  └─ 每個區域有對應 production_item_defs（要記的品項）
  │
  ├─ 對每個品項填 production_field_defs 定義的欄位
  │  ├─ 例：芋圓 → 數量、糖種、批次
  │  └─ 糖種選擇 → 從 sugar_types 取
  │
  └─ 送出 → production_log_sessions + production_log_items
```

### 即時庫存 `useKitchenRealtimeStock`
```
kitchen_realtime_items（哪些品項要追蹤即時庫存）
  │ shipment_deductions: [{product_id, ratio}]
  │ 例：「豆漿」對應 出貨「豆花」每 1 單位扣 4 g 豆漿
  │
  └─ kitchen_realtime_tracker（每日追蹤）
       │ 計算邏輯：
       │ - 取 BASE_DATE 起所有 shipment_items.actual_qty
       │ - 對每個 deduction，扣減對應數量
       │ = 即時庫存 = 進貨 - 出貨換算
```

⚠️ **設計限制**：若改動 `shipment_deductions` 設定，**不會回溯重算歷史**。
- 例：5/10 出貨豆花 100 單，5/11 才設「豆花扣豆漿×4」→ 5/10 的豆漿不會被扣 400g
- 已知問題，待修

---

## 六、排班流程

### `schedules` 表角色
```
一日一筆 × 員工 = 員工出勤狀態
  │
  ├─ attendance_type=NULL → 正常上班，看 shift_type_id 決定班次
  ├─ attendance_type='annual_leave' 等 → 請假（leave_requests approve 時自動寫）
  └─ 其他 → 自訂
```

### 多種排班入口
| 頁面 | 角色 | 範圍 |
|---|---|---|
| `/admin/schedule`（WideLayout）| admin（任何 can_schedule）| PC 全寬月行事曆 |
| `/store/:storeId/schedule` | store 主管 | 該店員工排班 |
| `/kitchen/staff-schedule` | kitchen 主管 | 央廚員工排班 |

### 排班修改使用 `ScheduleEditModal` 或 `ShiftPickerModal`
- ScheduleEditModal：admin 後台用
- ShiftPickerModal：門店/央廚用

⚠️ **要同步改**：兩個 Modal 邏輯一樣，修一個要記得修另一個（2026-04-28 commit b94bdfa 同步修過）

---

## 七、雜支記錄

### 流程
```
員工
  │
  ├─ 門店：/store/:storeId/expense → DailyExpense.tsx
  ├─ 央廚：/kitchen/expense → DailyExpense.tsx
  │
  └─ 填寫雜支
       ├─ 選 expense_categories（已 active 的分類）
       ├─ 填金額、備註、收據編號
       │
       └─ 寫 daily_expenses（store_id + date + item_name + amount + note + submitted_by）
            │
            └─ Trigger: trg_audit_daily_expenses（自動 audit log）
```

### 對應的 admin 後台
- `/admin/expenses` ExpenseManagement.tsx 純查詢 + Excel/PDF 匯出
- 目前**沒有編輯/刪除按鈕**（純檢視）

---

## 八、成本配方體系

### 三層引用
```
raw_materials（原物料 + 價格）
  │ price + net_weight_g → cost/g
  │
  ↓ 被引用
recipes（央廚成品）
  └─ recipe_ingredients (recipe_id + material_id + amount_g)
       │
       └─ 計算 cost = Σ (amount_g × cost/g)
            │
            ↓ 被引用
menu_items（門店販售品）
  └─ menu_item_ingredients (menu_item_id + recipe_id OR material_id + amount_g)
       │
       └─ 計算 cost = Σ (amount_g × cost/g) 同上
            │
            └─ 毛利率 = (selling_price - cost) / selling_price
```

### 關鍵特性
- **動態計算**：原料漲價會即時影響所有引用的配方/販售品成本（**沒有快照**）
- **無 FK 保護**：刪 recipe 不會清 menu_item_ingredients 引用（潛在孤兒）
- 業務決策題：要不要做歷史成本快照？

---

## 九、SSOT 違反案例（潛在 bug 來源）

### ✅ 已修
- 時區計算（2026-05-21 統一到 `addDays` + `getMondayOfWeek`）
- 假別餘額扣除（2026-05-21 改 atomic RPC）

### ⚠️ 待修
- `menu_item_ingredients.recipe_id` 無 FK
- `kitchen_realtime_items.shipment_deductions` 改動不回溯歷史
- `app_settings.telegram_*` V1 legacy 與 user_pins V2 並存

---

## 十、Telegram 通知對象 SSOT（V2 vs V1）

### V2（新）— 從 user_pins + staff 查
```typescript
getLeaveApproverChatIds(scope: 'kitchen'|'lehua'|'xingnan', order?: 1|2)
  → SELECT user_pins WHERE is_leave_approver=true AND leave_approver_scope=scope
                       AND (order ? leave_approver_order=order : true)
                       AND is_active=true
  → JOIN staff.telegram_id

getAdminApproverChatIds()
  → SELECT user_pins WHERE role='admin' AND is_active=true
  → JOIN staff.telegram_id
```

### V1（舊，legacy fallback）— 從 app_settings 查
```typescript
getLeaveNotifyTargets(storeContext)
  → SELECT app_settings WHERE key='leave_notify_{scope}'
  → JSON.parse(value) as Array<{name, chat_id}>
```

### 在 useLeaveStore 內的 fallback 順序
```typescript
const adminChatIds = await getAdminApproverChatIds()  // V2 優先
const targets = adminChatIds.length > 0
  ? adminChatIds
  : await getAdminNotifyTargets()  // V1 fallback
```

**未來目標**：完全移除 V1 路徑（待所有主管確定 telegram_id 都填好）

---

## 十一、相關文件
- `DOC/architecture.md` — 全局系統架構
- `DOC/db-schema.md` — 97 張表詳細結構
- `DOC/audit/*.md` — 每頁 7 維度 audit
- `src/lib/leave.ts` — 假別 SSOT 常數
- `src/lib/settlement.ts` — 結帳計算
- `src/lib/suggestion.ts` — V3 建議量算法
