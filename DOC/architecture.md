# YBA 阿爸的芋圓 — 系統架構

> 撰寫日期：2026-05-22
> 用途：建立全局認識，作為後續 `DOC/audit/*.md` 個別 audit 的基礎
> 業務流程獨立在 `DOC/business-flow.md`
> DB schema 詳述獨立在 `DOC/db-schema.md`

---

## 一、系統定位

連鎖餐飲管理系統 — 涵蓋盤點 / 叫貨 / 出貨 / 收貨 / 結算 / 排班 / 請假 / 雜支 / 生產記錄。
**規模**：2 門市（樂華、興南）+ 1 央廚 + admin 後台。
**每日真實使用中**，零容忍生產事故。

---

## 二、技術棧

### 前端
| 層 | 技術 | 備註 |
|---|---|---|
| Runtime | Node 24 + npm 11 (Windows 開發) | |
| Framework | **React 19** + **TypeScript 5.9** | strict mode（noUnusedLocals 等全開） |
| Build | **Vite 7** | path alias `@/` → `./src/` |
| Routing | **react-router-dom v7** | lazy-loaded，WideLayout vs NarrowLayout 兩種佈局 |
| State | **Zustand**（12 個 store）| 啟動時 `useInitStores()` 並行初始化 4 個關鍵 store |
| 樣式 | **Tailwind CSS 3** | 自訂 design token（brand-/surface-/status-）|
| 表單 | **react-hook-form** + **zod** | |
| 日期 | **date-fns** + 自訂 `lib/utils.ts`（時區安全） | |
| 通知 | **sonner**（包在 `components/Toast.tsx`）| |
| 匯出 | **jspdf** + **xlsx** | PDF 含 CJK 字體 fallback |
| 離線 | **IndexedDB**（`lib/offlineQueue.ts`）| `submitWithOffline()` wrapper |
| 認證 | PIN 碼 4 位 + **SHA-256**（Web Crypto）+ **sessionStorage** | |

### 後端（Supabase 自架，VPS Docker）
| 元件 | 說明 |
|---|---|
| **PostgreSQL 15.6** | `supabase-db` 容器，port 5432（本機限定） |
| **PostgREST 12.2** | `supabase-rest` 容器 |
| **Kong 2.8** | `supabase-kong` 容器，API Gateway port 8000 |
| **Supabase Storage** | `supabase-storage` 容器（SOP 圖片）|
| **Supabase Studio** | `supabase-studio` 容器（DB UI）|
| **GoTrue Auth** | 已部署但 YBA 未使用（走 PIN 自家認證）|
| API URL | `https://api.yen-design.com`（Kong 透過 NPM 代理） |

### 部署
| 項 | 值 |
|---|---|
| Prod 前端 | `https://order.yen-design.com`（VPS Docker `site-yba-order` nginx 容器）|
| Staging 前端 | `https://staging.yen-design.com`（`site-yba-order-staging` + 獨立 Supabase 三件套）|
| VPS | `5.104.87.209` |
| 部署腳本 | `deploy.sh`（prod）/ `deploy-staging.sh`（staging）|

---

## 三、目錄結構（src/）

```
src/
├── pages/
│   ├── store/      ← 門店員工 8 頁
│   ├── kitchen/    ← 央廚員工 10 頁
│   ├── admin/      ← 後台 32 頁
│   └── PinEntry.tsx
├── components/     ← 42 個共用元件
│   └── schedule/   ← 排班專用元件 5 個
├── stores/         ← 12 個 Zustand store
├── hooks/          ← 13 個 custom hook
├── lib/            ← 32 個 lib（含 __tests__/）
└── data/           ← 靜態資料（fallback）
```

---

## 四、Zustand Stores 清單（12 個）

> 啟動時透過 `hooks/useInitStores.ts` 並行初始化前 4 個關鍵 store

| Store | 用途 | 關鍵方法 |
|---|---|---|
| **useStoreStore** | 門店清單（樂華/興南/央廚）| `getName(id)` / `items` |
| **useProductStore** | 產品主檔（成品 + 門店銷售品）| `items`、`categories`、`getProduct(id)` |
| **useMaterialStore** | 央廚原物料 | `items`、`categories` |
| **useStaffStore** | 員工清單（kitchen + 各 store）| `kitchenStaff`、`getStoreStaff(id)` |
| **useZoneStore** | 門店區域（鹹/甜/凍/裝）+ 區域品項對應 | `getStoreZones(id)`、`getZoneProductIds(id)` |
| **useScheduleStore** | 排班紀錄 | |
| **useSettlementStore** | 結帳紀錄與欄位定義 | |
| **useLeaveStore** | 請假 V2 完整流程（含 approver1/2/admin）| `approve` / `approver1Approve` / `remove` 等 |
| **useFrozenProductStore** | 冷凍品 | |
| **useSopStore** | SOP 配方/步驟 | |
| **useCostStore** | 成本配方（recipe + menu_item_ingredients）| |
| **useProductionZoneStore** | 央廚生產區域定義 + 糖種 | |

---

## 五、Custom Hooks（13 個）

| Hook | 用途 |
|---|---|
| **useInitStores** | App 啟動時並行初始化 4 個關鍵 store，回傳 `isReady` |
| **useVersionCheck** | 5 分鐘檢查 `/version.json`，過版本通知刷新 |
| useAllowedPages | 從 user_pins 取當前 user 可訪問頁面清單 |
| useAppSetting | 讀寫 `app_settings` 表（key/value 設定）|
| useCanSchedule | 從 user_pins 判斷 `can_schedule` flag |
| useKitchenRealtimeStock | 央廚即時庫存（含 deduction 計算）|
| useLeaveBalance | 員工假別餘額（**首次載入時自動補建缺少的假別**）|
| useNotifications | 系統通知 |
| useOnlineStatus | navigator.onLine + Supabase ping |
| useStoreOrderVisibility | 門店叫貨頁面顯示/隱藏品項 |
| useStoreSortOrder | 門店品項自訂排序 |
| useSupplyTracker | 供應追蹤 |
| useZoneFilteredProducts | 按 zone 過濾產品清單 |

---

## 六、Lib 清單（32 個）

### 認證 / 通訊
| 檔案 | 說明 |
|---|---|
| `supabase.ts` | Supabase client（env 缺則為 null）|
| `auth.ts` | `hashPin` / `getSession` / `setSession` / `isAuthorized` |
| `session.ts` | `getTodayTW` / `getYesterdayTW`（Asia/Taipei 時區 SSOT）|
| `telegram.ts` | V2 請假主管/admin chat_id 查詢 + 推播 + 照片壓縮上傳 |

### 業務邏輯
| 檔案 | 說明 |
|---|---|
| **`suggestion.ts`** | **建議量演算法 V3**（Tier 0/0b/0c 同星期幾匹配 + IQR 中位數）|
| **`settlement.ts`** | 結算計算（`getVal` / `computeSession` / 差額 + 客單價）|
| **`costAnalysis.ts`** | 配方成本（`getRecipeCost` / `getMenuItemCost`）|
| **`profitLoss.ts`** | 月損益計算 |
| **`leave.ts`** | `TRACKED_LEAVE_TYPES`（7 種假別 SSOT）+ `calcLeaveDays` + `LeaveStatus` 狀態機 |
| **`schedule.ts`** | 排班相關常數 / utility |
| **`shelfLife.ts`** | 保鮮期 / 生產緊急度計算 |
| `holidays.ts` | 國定假日判定（`getDayType`）|
| `frozenProducts.ts` | 冷凍品定義 |
| `supplyItems.ts` | 供應品項 |
| `orderMinTotal.ts` | 最低叫貨總量設定 |
| `auditLog.ts` | 應用層 audit log（DB trigger 是另一層）|

### 工具 / 格式
| 檔案 | 說明 |
|---|---|
| **`utils.ts`** | `formatCurrency` / `getTodayString` / **`addDays`**（時區安全，2026-05-21 抽出 SSOT）/ **`getMondayOfWeek`** |
| `sortByStore.ts` | 多店資料排序 |
| `weather.ts` + `backfillWeather.ts` | 氣象資料（CWA API）|
| `notificationSound.ts` | 通知音效 |
| `crashReport.ts` | 全域錯誤回報 |

### 離線 / Offline
| 檔案 | 說明 |
|---|---|
| `offlineQueue.ts` | IndexedDB queue |
| `offlineSync.ts` | 上線時批次同步 |
| `submitWithOffline.ts` | 通用 wrapper：嘗試線上 → 失敗排入 queue |

### 匯出
| 檔案 | 說明 |
|---|---|
| `exportExcel.ts` | xlsx 通用匯出 |
| `exportPdf.ts` | jsPDF + autotable（含 CJK 字體）|
| `exportOrderSummaryPdf.ts` | 叫貨摘要專用 |
| `exportReceivePdf.ts` | 收貨單專用 |
| `exportSchedulePdf.ts` | 排班表專用 |
| `savePdf.ts` | 行動裝置 PDF 下載 helper |

### 測試
| 檔案 | 說明 |
|---|---|
| `__tests__/costAnalysis.test.ts` | costAnalysis 單元測試 |
| `__tests__/utils.test.ts` | utils 單元測試 |

---

## 七、頁面清單

### 🏪 門店 8 頁（`/store/:storeId/*`，role=store）

| Path | 元件 | 用途 |
|---|---|---|
| `/store/:storeId` | `StoreHome` | 門店首頁（菜單入口）|
| `/store/:storeId/inventory` | `Inventory` | 盤點 |
| `/store/:storeId/settlement` | `Settlement` | 結帳 |
| `/store/:storeId/usage` | `Usage` | 用量 |
| `/store/:storeId/order` | `Order` | **叫貨**（核心，含建議量）|
| `/store/:storeId/receive` | `Receive` | 收貨確認 |
| `/store/:storeId/order-history` | `StoreOrderHistory` | 叫貨歷史 |
| `/store/:storeId/expense` | `StoreDailyExpense` | 雜支記錄 |
| `/store/:storeId/schedule` | `StoreSchedules` | 排班 + 請假主管簽核 |

### 🏭 央廚 10 頁（`/kitchen/*`，role=kitchen）

| Path | 元件 | 用途 |
|---|---|---|
| `/kitchen` | `KitchenHome` | 央廚首頁 |
| `/kitchen/orders` | `OrderSummary` | 各門店叫貨彙總 |
| `/kitchen/shipments` | `Shipment` | **出貨**（actual_qty SSOT）|
| `/kitchen/materials` | `MaterialStock` | 原物料庫存 |
| `/kitchen/products` | `ProductStock` | 成品庫存 |
| `/kitchen/material-orders` | `MaterialOrder` | 原料叫貨 |
| `/kitchen/schedule` | `ProductionSchedule` | 生產排程 |
| `/kitchen/staff-schedule` | `KitchenSchedules` | 排班 + 請假主管簽核 |
| `/kitchen/expense` | `KitchenDailyExpense` | 雜支 |
| `/kitchen/production-log` | `ProductionLog` | 每日生產記錄 |

### 👑 Admin 32 頁（`/admin/*`，role=admin）— 詳見 [AdminHome 分組](#八adminhome-分組)

### 🔐 認證
| Path | 元件 | 說明 |
|---|---|---|
| `/` | `<Navigate to="/store/lehua">` | 預設導向 |
| 任何 protected route 未登入 | `PinEntry` | 4 位數 PIN 登入 |

### 🛡️ 路由守門
- **`AuthGuard`**（`requiredRole` prop）：role 不符直接擋下顯示「權限不足」
- **`ScheduleGuard`**：檢查 `can_schedule` flag（admin/kitchen/store 通用）

### 📐 佈局
- **`WideLayout`**：PC 全寬（用於 `/admin/schedule` 排班行事曆）
- **`NarrowLayout`**：手機寬度 max-w-lg（其他全部頁面）

---

## 八、AdminHome 分組（5 大區）

### 常用功能（5）
- `dashboard` 老闆儀表板
- `order-history` 歷史叫貨查詢
- `settlement-history` 結帳歷史查詢
- `expenses` 雜支管理
- `leave` 請假管理

### 生產管理（6）
- `materials` 央廚原物料管理
- `recipes` 成品配方管理
- `menu-items` 販售品管理
- `production-zones` 生產區域管理
- `kitchen-realtime-items` 即時庫存品項
- `sop` SOP 管理（含 `sop/:categoryId` 詳細頁）

### 基礎設定（9）
- `products` 門店品項管理
- `staff` 人員管理
- `stores` 門店管理
- `settlement-fields` 結帳欄位管理
- `zones` 樓層品項管理
- `schedule` 排班管理（WideLayout）
- `shift-types` 班次與職位管理
- `item-sort` 品項排序管理
- `order-visibility` 叫貨品項管理

### 報表分析（7）
- `order-pricing` 叫貨價格統計
- `profit-loss` 盈餘統計
- `weather-analysis` 天氣用量分析
- `schedule-stats` 工時統計
- `frozen-stats` 冷凍品統計
- `cost-analysis` 成本分析
- `production-stats` 生產紀錄總表

### 系統管理（3）
- `qrcode` QR Code 管理
- `pins` PIN 碼管理
- `audit` 操作記錄

---

## 九、SSOT 約定（重要！避免重複計算）

### 訂貨資料三層
```
order_items.quantity      = 門店原始需求（永不被覆蓋）
shipment_items.actual_qty = 央廚實際出貨量（含主動出貨）
                          = 報表 + 建議量 + 前日用量唯一真實來源
shipment_items.order_qty  = 出貨時記錄的叫貨量（供收貨頁顯示「央廚異動」）
```

### 庫存資料雙來源
```
inventory_items.on_shelf  = 架上量（g 數需配合 store_products.bag_weight 轉袋數）
inventory_items.stock     = 庫存量
inventory_items.discarded = 廢棄量
```

### 時區
- **app 時區永遠是 Asia/Taipei**
- 取今天用 `getTodayTW()`（`lib/session.ts`）
- 算日期前後用 `addDays(dateStr, n)`（`lib/utils.ts`，2026-05-21 抽 SSOT）
- 算週一用 `getMondayOfWeek(dateStr)`
- **嚴禁** `new Date(str + 'T00:00:00').toISOString().split('T')[0]`（會偏移 -8 小時，舊 bug 來源）

### 假別
- **`TRACKED_LEAVE_TYPES`** = 7 種假別 SSOT（`lib/leave.ts:4-12`）
- 新增/刪除假別只動這個常數，所有相關頁面自動同步
- 既有員工首次打開請假頁，`useLeaveBalance` 會自動補建缺少的假別餘額

### 金額
- **prod 所有金額存整數**（settlement_values.value 雖然是 text 型別但內容都是整數字串）
- 浮點累加風險目前不存在（2026-05-21 驗證過）

### Telegram 通知對象（V2 請假）
- 主管：從 `user_pins` 的 `is_leave_approver` + `leave_approver_scope` + `leave_approver_order` 查
- 員工本人：`staff.telegram_id`
- Admin：`user_pins.role='admin'` join `staff.telegram_id`
- **舊版 `app_settings.leave_notify_*` 已逐步遷移**，但 fallback 仍存在 `telegram.ts`

---

## 十、環境變數

```
VITE_SUPABASE_URL=https://api.yen-design.com
VITE_SUPABASE_ANON_KEY=<JWT 簽 anon role>
VITE_CWA_API_KEY=<中央氣象局>
```

**Staging build 用 `.env.staging`**（透過 `vite build --mode staging`），URL 改為 `api-staging.yen-design.com`。

---

## 十一、已知技術債（待 audit 確認）

來自 2026-05-21 admin 5 大頁勘查與生產管理 6 頁勘查的 staging 已知問題：

| 區塊 | 狀況 |
|---|---|
| V1 legacy `telegram.ts` LEAVE_NOTIFY_MAP | 仍存在 fallback 路徑，應該排程清理 |
| SOP storage 孤兒檔案 | 刪 SOP 分類時 storage 沒清（目前 prod 4=4 對齊，但會在第一次刪 SOP 時發生）|
| SopDetail batch_sizes 改變後 amounts 對不上 | 真 bug，未修 |
| ProductionZoneManager FieldTab 首次進入空白 | useState 沒監聽 zones 載入 |
| MenuItemManager sort_order 用 length | 有重複可能 |
| KitchenRealtimeItems deduction 改變不回算歷史 | 設計問題，影響庫存追蹤 |
| RLS policy 全部 `USING (true)` | 員工 F12 拿 ANON_KEY 可繞前端守門 |
| 主管 PIN 你不知道 | 無法測請假主管簽核流程 |

---

## 十二、相關文件

| 文件 | 內容 |
|---|---|
| `DOC/architecture.md` | 本檔（系統架構）|
| `DOC/db-schema.md` | 97 張表詳細結構 |
| `DOC/business-flow.md` | 業務流程與狀態機 |
| `DOC/audit/*.md` | 每個頁面 7 維度 audit |
| `CLAUDE.md`（root）| 工程協議 + 全域指令 |
| `~/.claude/.../memory/` | 跨 session 記憶（VPS / Supabase 設定 / 部署 SOP）|
