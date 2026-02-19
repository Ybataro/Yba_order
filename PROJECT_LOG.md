# 專案開發日誌 (PROJECT LOG)

## 專案名稱
阿爸的芋圓 — 門店盤點叫貨 & 中央廚房生產出貨庫存管理系統

---

## 2026-02-17（Day 1）

### 完成事項

#### 1. 需求分析（產品經理 Agent）
- 收集用戶需求：門店打烊盤點、叫貨、結帳、央廚生產出貨庫存管理
- 分析 5 張實際紙本表格照片：
  - 興南店打烊盤點表
  - 樂華店每日結帳表
  - 樂華店每日用量及損耗表
  - 央廚每日叫貨表
  - 央廚原物料盤點及叫貨表
- 產出完整 PRD 文檔 → `docs/PRD.md`
- 定義 MVP 範圍：門店盤點+結帳+叫貨+央廚管理+收貨確認
- 定義 12 張資料表結構
- 整理 33 個門店品項 + 29 個央廚原物料品項

#### 2. 設計規範（設計師 Agent）
- 參考 yba-dessert.netlify.app 網站配色（souk 品牌色系）
- 參考用戶提供的 5 張店面色卡（蓮藕色、銀藕色、摩卡藕灰等）
- 確立 Apple/LINE 風格的簡約設計方向
- 重點設計數字輸入體驗（Tab 流、decimal 鍵盤、自動全選）
- 產出完整 DESIGN_SPEC 文檔 → `docs/DESIGN_SPEC.md`
- 包含：配色方案、字體規範、間距圓角、組件設計、12 個頁面佈局、交互規範、Tailwind Token

#### 3. 前端開發（開發工程師 Agent）
- 初始化 Vite + React 19 + TypeScript 5.9 專案
- 安裝依賴：react-router-dom, zustand, react-hook-form, zod, lucide-react, tailwind-merge, date-fns, sonner 等
- 配置 Tailwind CSS 品牌色板、字體、圓角
- 配置 path alias (@/ → src/)
- 建立全局樣式（index.css）含亮色/暗色模式 CSS 變數

**核心元件（6 個）：**
| 元件 | 檔案 | 說明 |
|------|------|------|
| NumericInput | components/NumericInput.tsx | decimal 鍵盤、自動全選、Tab 流 |
| SectionHeader | components/SectionHeader.tsx | 粘性分組標題 + 進度顯示 |
| ProgressBar | components/ProgressBar.tsx | 盤點完成進度條 |
| TopNav | components/TopNav.tsx | 頂部導航（返回、標題、日期） |
| BottomAction | components/BottomAction.tsx | 固定底部提交按鈕 |
| Toast | components/Toast.tsx | 成功/錯誤/提示通知（Context API） |

**資料定義（4 個）：**
| 檔案 | 說明 |
|------|------|
| data/storeProducts.ts | 33 個門店品項（6 分類） |
| data/rawMaterials.ts | 29 個央廚原物料（5 分類） |
| data/stores.ts | 2 家門店（樂華、興南） |
| data/settlementFields.ts | 34 個結帳欄位（7 分組） |

**門店端頁面（6 個）：**
| 頁面 | 路由 | 說明 |
|------|------|------|
| StoreHome | /store/:storeId | Apple 風格功能卡片入口 |
| Inventory | /store/:storeId/inventory | 物料盤點（架上/庫存/倒掉） |
| Settlement | /store/:storeId/settlement | 每日結帳（自動計算差額） |
| Usage | /store/:storeId/usage | 用量損耗表（自動計算） |
| Order | /store/:storeId/order | 叫貨（含建議量） |
| Receive | /store/:storeId/receive | 收貨確認（勾選+差異備註） |

**央廚端頁面（6 個）：**
| 頁面 | 路由 | 說明 |
|------|------|------|
| KitchenHome | /kitchen | 央廚功能卡片入口 |
| OrderSummary | /kitchen/orders | 各店叫貨總表+加總 |
| Shipment | /kitchen/shipments | 出貨表（門店切換+勾選確認） |
| MaterialStock | /kitchen/materials | 原物料庫存（最低庫存警示） |
| ProductStock | /kitchen/products | 成品庫存盤點 |
| MaterialOrder | /kitchen/material-orders | 原物料叫貨 |

#### 4. 建構驗證
- TypeScript 編譯：✅ 零錯誤
- Vite build：✅ 成功
- 產出大小：300KB JS + 17KB CSS (gzip: 93KB + 4KB)
- 專案備份：`Yba_order_backup_20260217`

---

### 技術決策記錄

| 決策 | 選擇 | 理由 |
|------|------|------|
| 框架 | React + TypeScript | PRD 指定，生態成熟 |
| 建構工具 | Vite 7 | 快速 HMR，開發體驗佳 |
| 樣式方案 | Tailwind CSS 3 | 設計規範指定，快速開發 |
| 路由 | React Router v7 | SPA 多頁面切換 |
| 狀態管理 | 暫用 useState（Zustand 已安裝待用） | MVP 階段本地狀態足夠 |
| 數字輸入 | inputMode="decimal" + 正則驗證 | 手機原生數字鍵盤最流暢 |
| 焦點管理 | data attribute + querySelectorAll | 比 ref 更簡潔，不需 forwardRef |
| 資料 | 本地模擬資料 | 先確認 UI 流程，再串 Supabase |

---

### 已知問題 / 待改進
1. 目前使用模擬隨機資料，每次重整會變
2. Settlement 頁面的「應結總金額」計算邏輯需與實際業務確認
3. 品項順序需與門店實際貨架動線對齊（需用戶確認）
4. 深色模式 UI 已定義 CSS 變數但尚未加入切換按鈕
5. 尚未加入離線提示與本地暫存功能

---

## 2026-02-18（Day 2）

### 完成事項

#### 1. 手機測試環境
- Vite 配置 `server.host: true`，支援區網手機連線測試

#### 2. UI 佈局優化 — 間距壓縮
- **門店物料盤點（Inventory）**：3 個輸入框從垂直堆疊改為水平一行排列，每品項高度縮減為原來 1/3
- **央廚原物料庫存（MaterialStock）**：品名/庫存/散裝/週用/警示全部壓成一行，新增欄位標題列
- 新增分類欄位標題列（品名 | 架上 | 庫存 | 倒掉）方便識別

#### 3. 輸入框樣式調整
- 輸入框尺寸縮小：72px→56px 寬、h-10→h-9 高
- 空白輸入框底色加深：`#FAF8F6`→`#EDE6DF`，與白色卡片背景明確區隔
- 數字文字顏色加深：`#6B5D55`→`#3D2E26`（深咖啡），字重 medium→semibold
- 原物料庫存頁面庫存與散裝輸入框間距加大（8px）
- 底部按鈕留白加大：`pb-24`→`pb-32`，防止底部品項被按鈕遮擋

#### 4. 天氣預報叫貨建議（門店叫貨頁面）
- 新增天氣預報卡片 UI：明日天氣圖示、溫度範圍、降雨機率
- 天氣影響標籤（pill badges）：根據溫度+降雨自動顯示各品類調整建議
- 建議量計算邏輯加入天氣係數：
  - 高溫 ≥30°C：冰品+20%、液體+10%、熱品-10%
  - 低溫 ≤18°C：熱品+20%、冰品-30%
  - 降雨 ≥60%：配料-15%、主食-15%
  - 好天氣：配料+10%
- 目前使用模擬天氣資料，Phase 2 串接中央氣象署 API

#### 5. 央廚出貨表異動流程
- 出貨表新增「叫貨量」（唯讀）vs「實出量」（可編輯）雙欄設計
- 數量異動時：輸入框橘色邊框、品項淡橘底色、顯示差異量
- 頂部統計「X 項數量異動」警示
- **門店收貨確認同步顯示異動**：
  - 橘色警示橫幅提醒異動數量
  - 異動品項：叫貨量加刪除線 → 箭頭 → 實收量橘色粗體
  - 品名下方顯示「央廚異動 +0.5 盒」

#### 6. 列印功能（央廚叫貨總表）
- 新增「列印 A4 叫貨總表」按鈕
- 雙版面設計：螢幕版（手機卡片）+ 列印版（A4 正式表格）
- 列印表格含：品項/單位/各店數量/加總/備註（空白手寫欄）
- 品類分組有底色區隔，加總欄黃色突顯
- A4 portrait、10mm 邊距、10px 字體，所有品項一頁放得下

#### 7. 人員確認功能
- 新增人員資料檔 `src/data/staff.ts`
- **央廚人員**：關堉勝、陳宣辰、陳佑欣、胡廷瑜、張馨予
- **樂華店**：顏伊偲、蔡博達
- **興南店**：陳宣佑、郭峻豪
- 門店首頁新增「當班人員」下拉選單（依門店顯示對應人員）
- 央廚 4 個操作頁面皆加入確認/盤點/叫貨人員下拉：
  - 出貨表 → 確認人員
  - 原物料庫存盤點 → 盤點人員
  - 成品庫存盤點 → 盤點人員
  - 原物料叫貨 → 叫貨人員
- 未選人員按提交會彈出錯誤提示
- 人員名單 Phase 2 改為後台管理

#### 8. 叫貨備註功能
- 門店叫貨備註區新增固定備註項目（橫向排列）：
  - 杏仁茶瓶：1000ml __ 個 / 300ml __ 個
  - 紙碗：K520 __ 箱 / 750 __ 箱
  - 其他備註（自由輸入）
- 央廚叫貨總表底部新增「各店叫貨備註」區塊：
  - 按店分列顯示固定項目數量 + 自由備註
  - A4 列印版同步顯示備註
  - 分店增加自動迴圈顯示

#### 9. 結帳/叫貨頁面間距與對齊
- 每日結帳：各欄位行距 py-2.5→py-1.5
- POS 結帳金額輸入框加寬至 90px（6 位數）、其他欄位 72px（5 位數）
- 叫貨頁：欄位標題與數字統一固定寬度 w-[40px] 對齊，行距 py-2.5→py-1.5

#### 10. 建議叫貨量四捨五入規則
- 配料類/加工品類/主食類/液體類/冰品類/其他：以 1 為單位四捨五入
- 紫米紅豆湯：以 0.5 為單位
- 豆花(冷)(熱)：以 0.5 為單位

#### 11. 品項資料調整
- 刪除：豆花糖水、薑汁
- 移動：紅豆料(0.5桶/1桶) → 加工品類（紫米紅豆湯上方），改名「紫米紅豆料」
- 移動：芝麻湯圓、鮮奶 → 其他區
- 單位修改：芝麻糊 CC→盒、粉圓糖水 壺→袋、炒糖糖水 壺→袋、杏仁茶 CC→份

#### 12. 備份
- 專案備份：`Yba_order_backup_20260218`、`Yba_order_backup_20260218_v2`

---

### Day 2 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| vite.config.ts | 新增 `server.host: true` |
| src/index.css | 輸入框底色/文字色/字重調整、底部留白加大、A4 列印樣式 |
| src/data/staff.ts | **新增** 人員資料定義 |
| src/pages/store/StoreHome.tsx | 新增當班人員下拉選單 |
| src/pages/store/Inventory.tsx | 盤點輸入框改為水平一行排列 |
| src/data/storeProducts.ts | 品項增刪移動+單位修改 |
| src/pages/store/Order.tsx | 天氣卡片+四捨五入建議量+固定備註項目+欄位對齊 |
| src/pages/store/Settlement.tsx | 結帳欄位間距縮小+POS輸入框加寬 |
| src/pages/store/Receive.tsx | 新增異動同步顯示（叫貨量→實收量對比） |
| src/pages/kitchen/OrderSummary.tsx | 列印按鈕+A4表格+各店備註區塊 |
| src/pages/kitchen/Shipment.tsx | 新增確認人員+叫貨量vs實出量異動設計 |
| src/pages/kitchen/MaterialStock.tsx | 佈局壓縮一行+盤點人員下拉 |
| src/pages/kitchen/ProductStock.tsx | 新增盤點人員下拉 |
| src/pages/kitchen/MaterialOrder.tsx | 新增叫貨人員下拉 |

---

### 已知問題 / 待改進（更新）
1. ~~目前使用模擬隨機資料，每次重整會變~~ → ✅ Day 6 全部改用 Supabase 真實資料
2. Settlement 頁面的「應結總金額」計算邏輯需與實際業務確認
3. 品項順序需與門店實際貨架動線對齊（需用戶確認）
4. 深色模式 UI 已定義 CSS 變數但尚未加入切換按鈕
5. 尚未加入離線提示與本地暫存功能
6. ~~天氣資料目前為模擬~~ → ✅ Day 6 已串接中央氣象署 API
7. ~~人員名單目前寫死在前端~~ → ✅ Day 4 已改為後台管理 + Supabase
8. ~~門店當班人員選擇後尚未傳遞到子頁面~~ → ✅ Day 6 已透過 URL params 傳遞

---

## 2026-02-19（Day 3）

### 完成事項

#### 1. 品項資料大幅更新（storeProducts.ts）
- **配料類**：花生 5天→2天、小薏仁 1桶/3天→2盒/2天
- **加工品類（變動最多）**：
  - 芋泥漿 0.5桶→1袋
  - 芝麻糊移至芋泥漿下方，期效7天/1盒/2天
  - 嫩仙草移除「/1天」
  - 豆花(冷)(熱)從液體類移入加工品類
  - 新增：芋頭湯材料(0.5桶/1桶)、薏仁湯、芋頭湯(冷/熱)
  - 紫米紅豆湯 0.5桶/1天→1桶/1天
- **主食類**：白玉新增期效「冷凍45天」
- **液體類**：粉圓糖水/炒糖糖水→4500g/1袋、杏仁茶期效7→3
- **冰品類**：杯裝冰淇淋全加期效6個月、蔗片冰加8公斤/袋
- **其他**：芝麻湯圓單位改盒(含baseStock)、鮮奶保留瓶(含baseStock)

#### 2. 叫貨建議四捨五入規則更新
- 新增薏仁湯、芋頭湯(冷/熱)以 0.5 為單位四捨五入

#### 3. 後台管理系統（全新建立）
- **5 個管理頁面**：
  - `ProductManager.tsx` — 門店品項 CRUD + 分類管理
  - `MaterialManager.tsx` — 原物料 CRUD + 分類管理
  - `StaffManager.tsx` — 央廚/門店人員管理
  - `StoreManager.tsx` — 門店資訊管理
  - `SettlementManager.tsx` — 結帳欄位管理
- **5 個 Zustand Stores**（含 persist middleware → localStorage）：
  - `useProductStore.ts` — 品項 + 分類 CRUD/排序
  - `useMaterialStore.ts` — 原物料 + 分類 CRUD/排序
  - `useStaffStore.ts` — 人員 CRUD（央廚/門店分開）
  - `useStoreStore.ts` — 門店 CRUD
  - `useSettlementStore.ts` — 結帳欄位 + 分組 CRUD/排序
- **共用元件**：`AdminModal.tsx`、`AdminTable.tsx`、`CategoryManager.tsx`
- **AdminHome.tsx** — 後台首頁（6 張功能卡片）

#### 4. QR Code 管理頁面
- **新增 `QRCodePage.tsx`**：
  - 動態讀取門店列表產生 QR codes
  - 各門店 → `/store/{storeId}`
  - 央廚 → `/kitchen`
  - 後台 → `/admin`
  - BASE_URL 可編輯（預設 `window.location.origin`）
  - 每個 QR code 卡片含：標題 + QR + 可點擊連結
  - 「列印全部」按鈕（A4 排版）

#### 5. Supabase 雲端整合
- **新增 `src/lib/supabase.ts`** — Supabase client（讀環境變數，無設定自動降級）
- **6 張資料表**（`supabase/migration.sql`）：
  - `stores` — 門店
  - `store_products` — 門店品項
  - `raw_materials` — 原物料
  - `staff` — 人員（用 group_id 區分央廚/門店）
  - `settlement_fields` — 結帳欄位
  - `categories` — 分類（scope: product/material/settlement）
- **RLS Policy**：全部 anon 可 SELECT/INSERT/UPDATE/DELETE
- **Seed Data**：所有初始資料已寫入 migration SQL
- **改寫 5 個 Zustand Stores**：
  - 移除 `persist` middleware
  - 新增 `loading` / `initialized` 狀態
  - 初始化時從 Supabase fetch
  - CRUD 操作：樂觀更新（先更新 local state → 非同步寫 Supabase）
  - 分類操作接 `categories` 表
  - 無 Supabase 環境變數時自動降級為本地預設資料
- **新增 `src/hooks/useInitStores.ts`** — App 啟動時初始化所有 stores

#### 6. Netlify 部署
- GitHub repo：https://github.com/Ybataro/Yba_order
- Netlify 連結 GitHub 自動部署
- Build command：`npm run build`
- Publish directory：`dist`
- 環境變數已設定（VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY）
- SPA fallback：`public/_redirects`（`/* → /index.html 200`）
- 線上版：https://yba-order.netlify.app

#### 7. TypeScript 嚴格模式修正
- 修正 stores 中 supabase 在 `.map()` callback 內的 null 檢查（Netlify 環境較嚴格）
- 修正 `Order.tsx` 天氣條件型別比較錯誤（`'sunny' as const` → `as WeatherCondition`）

#### 8. 備份
- 專案備份：`Yba_order_backup_20260219`

---

### Day 3 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| package.json | 新增 qrcode.react、@supabase/supabase-js |
| src/App.tsx | 新增 /admin/qrcode 路由 + useInitStores 初始化 |
| src/pages/admin/AdminHome.tsx | 新增第 6 張 QR Code 管理卡片 |
| src/pages/admin/QRCodePage.tsx | **新增** QR Code 管理頁面 |
| src/lib/supabase.ts | **新增** Supabase client |
| src/hooks/useInitStores.ts | **新增** Store 初始化 hook |
| src/stores/useProductStore.ts | 改接 Supabase（移除 persist，加 loading/initialized） |
| src/stores/useMaterialStore.ts | 改接 Supabase |
| src/stores/useStaffStore.ts | 改接 Supabase |
| src/stores/useStoreStore.ts | 改接 Supabase |
| src/stores/useSettlementStore.ts | 改接 Supabase |
| src/pages/store/Order.tsx | 修正天氣條件型別 |
| src/data/storeProducts.ts | 品項大幅調整 |
| supabase/migration.sql | **新增** 6 張表 + RLS + seed data |
| .env.example | **新增** 環境變數範例 |
| public/_redirects | **新增** Netlify SPA fallback |

---

### Day 3 Git 記錄

```
130d89a fix: 修正 TypeScript 嚴格模式編譯錯誤
b78581c feat: QR Code 頁面 + Supabase 雲端整合 + Netlify 部署準備
bad6c7c feat: 建立後台管理系統 + Zustand 狀態管理
```

---

## 2026-02-19（Day 4）

### 完成事項

#### 1. 營運資料表建立（deploy_new_tables.sql）
- **10 張新表**（session + items 模式）：
  - `store_zones` / `zone_products` — 門店樓層+品項對應
  - `inventory_sessions` / `inventory_items` — 門店物料盤點
  - `order_sessions` / `order_items` — 門店叫貨
  - `settlement_sessions` / `settlement_values` — 門店每日結帳
  - `shipment_sessions` / `shipment_items` — 央廚出貨+門店收貨
  - `material_stock_sessions` / `material_stock_items` — 央廚原物料庫存
  - `material_order_sessions` / `material_order_items` — 央廚原物料叫貨
  - `product_stock_sessions` / `product_stock_items` — 央廚成品庫存
- 全部表加 RLS anon policy
- Seed data：樂華 1F+2F、興南 1F、品項預設指向各店 1F

#### 2. 全頁面 Supabase 提交邏輯
- 新增 `src/lib/session.ts` — Session ID 產生器（inventorySessionId, orderSessionId, settlementSessionId 等）
- 所有操作頁面皆實作 upsert 邏輯：
  - 門店：盤點、叫貨、結帳、收貨確認
  - 央廚：出貨、原物料庫存盤點、原物料叫貨、成品庫存盤點
- 載入時檢查既有 session，載入已填資料、支援修改後重新提交

#### 3. 盤點分樓層功能
- **新增 `useZoneStore.ts`** — 樓層 Zustand store（CRUD + Supabase 同步）
- **新增 `useZoneFilteredProducts.ts`** — 依樓層篩選品項的 hook
- **新增 `ZoneManager.tsx`** — 後台樓層品項管理頁面
- 盤點頁面支援 `?zone=1F` 篩選，各樓層人員可同時用手機輸入
- QR Code 頁面產生各樓層專用 QR
- 樂華店：1F + 2F（品項分兩層）
- 興南店：1F only（全部品項在 1F）

#### 4. 盤點「全部」合併檢視
- 選擇「全部」時顯示合併後的完整盤點（唯讀）
- 各樓層數據自動加總

#### 5. 歷史叫貨查詢及統計
- **新增 `OrderHistory.tsx`** — /admin/order-history
- **明細模式**：按日期分組，可展開收合，顯示各品項叫貨數量
- **統計模式**：按分類統計品項合計/日均/叫貨次數
- 支援門店叫貨 + 原物料叫貨切換
- 篩選：今日/本週/本月/自訂日期 + 門店篩選

#### 6. 其他改善
- 央廚成品庫存盤點接上 Supabase
- 物料盤點編輯模式顯示已修改品項標記
- 後台子頁面返回鍵統一導向 /admin
- .env 加入 .gitignore 避免金鑰外洩
- 修正 supabase null 的 TypeScript 嚴格模式錯誤

---

### Day 4 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| supabase/deploy_new_tables.sql | **新增** 10 張營運資料表 + 樓層表 |
| src/lib/session.ts | **新增** Session ID 產生器 + 台灣時區 helpers |
| src/stores/useZoneStore.ts | **新增** 樓層 Zustand store |
| src/hooks/useZoneFilteredProducts.ts | **新增** 樓層品項篩選 hook |
| src/pages/admin/ZoneManager.tsx | **新增** 後台樓層品項管理 |
| src/pages/admin/OrderHistory.tsx | **新增** 歷史叫貨查詢及統計 |
| src/pages/admin/AdminHome.tsx | 新增樓層管理+歷史叫貨選單項 |
| src/App.tsx | 新增 zones / order-history 路由 |
| src/hooks/useInitStores.ts | 加入 useZoneStore 初始化 |
| src/pages/store/Inventory.tsx | 接 Supabase + 樓層篩選 |
| src/pages/store/Order.tsx | 接 Supabase（含截止時間邏輯） |
| src/pages/store/Settlement.tsx | 接 Supabase |
| src/pages/store/Receive.tsx | 接 Supabase |
| src/pages/kitchen/Shipment.tsx | 接 Supabase |
| src/pages/kitchen/MaterialStock.tsx | 接 Supabase |
| src/pages/kitchen/MaterialOrder.tsx | 接 Supabase |
| src/pages/kitchen/ProductStock.tsx | 接 Supabase |
| src/pages/admin/QRCodePage.tsx | 新增樓層專用 QR |
| .gitignore | 加入 .env |

---

### Day 4 Git 記錄

```
cbfc638 feat: 物料盤點編輯模式顯示已修改品項標記
73472e9 chore: 將 .env 加入 gitignore 避免金鑰外洩
5d05b5a feat: 央廚成品庫存盤點接上 Supabase
3097c77 feat: 盤點「全部」模式顯示合併檢視（唯讀）
fc06a1c fix: 後台子頁面返回鍵固定導向 /admin
cc63369 fix: 修正 supabase 可能為 null 的 TypeScript 嚴格模式錯誤
3644fab feat: 新增歷史叫貨查詢及統計頁面 + 樓層盤點修正
398a684 feat: 盤點分樓層功能 + 營運資料表 + 全頁面 Supabase 提交邏輯
```

---

## 2026-02-19（Day 5）

### 完成事項

#### 1. 品項價格欄位
- `store_products` 表新增 `our_cost` / `franchise_price` 欄位（numeric, default 0）
- `StoreProduct` 介面加 `ourCost?: number` / `franchisePrice?: number`
- `useProductStore` — initialize 讀取新欄位、add/update 同步新欄位
- `ProductManager` — Modal 新增「我們價格」「加盟價格」兩個輸入欄位

#### 2. 結帳歷史查詢（/admin/settlement-history）
- **新增 `SettlementHistory.tsx`**
- 查詢 `settlement_sessions` JOIN `settlement_values`
- 篩選：今日/本週/本月/自訂日期 + 門店篩選
- **明細模式**：
  - 按日期列出每筆結帳，顯示營業額/號數/客單價/差額
  - 展開顯示 POS 金額/實收(鈔票+鐵櫃)/差額/支付方式明細
  - 差額 ±10 內綠色，超出紅色
- **月報統計模式**：
  - 四宮格摘要：總營業額/日均營業額/總號數/平均客單價
  - 各支付方式佔比（金額+百分比）
  - 差額統計（正常筆數 vs 異常筆數）

#### 3. 叫貨價格統計（/admin/order-pricing）
- **新增 `OrderPricing.tsx`**
- 篩選：本週/本月/自訂日期 + 門店篩選（全部加總 or 指定門店）
- **主表格（橫向可捲動）**：
  - 列 = 各品項（按分類分組）
  - 欄 = 日期範圍內每日數量 + 總數量 + 我們價格 + 我們總價 + 加盟價格 + 加盟總價
  - 品項左欄 sticky 不隨捲動
- **底部摘要**：
  - 營業額/號數/客單價（按日，從 settlement_sessions 帶入）
  - 我們成本合計 + 成本%
  - 加盟成本合計 + 成本%

#### 4. Route + 選單更新
- `App.tsx` 新增 `/admin/settlement-history` + `/admin/order-pricing` 路由
- `AdminHome.tsx` 新增「結帳歷史查詢」+「叫貨價格統計」兩個選單項目

---

### Day 5 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| supabase/deploy_new_tables.sql | 新增 ALTER TABLE store_products（our_cost, franchise_price） |
| src/data/storeProducts.ts | StoreProduct 介面加 ourCost / franchisePrice |
| src/stores/useProductStore.ts | initialize/add/update 同步價格欄位 |
| src/pages/admin/ProductManager.tsx | Modal 新增「我們價格」「加盟價格」 |
| src/pages/admin/SettlementHistory.tsx | **新增** 結帳歷史查詢頁面 |
| src/pages/admin/OrderPricing.tsx | **新增** 叫貨價格統計頁面 |
| src/App.tsx | 新增 settlement-history / order-pricing 路由 |
| src/pages/admin/AdminHome.tsx | 新增 2 個選單項目 |

---

### Day 5 Git 記錄

```
13dd907 feat: 新增結帳歷史查詢及叫貨價格統計報表
```

---

## 2026-02-19（Day 6）

### 完成事項

#### 1. 門店當班人員傳遞
- StoreHome 導航到子頁面時帶上 `?staff={staffId}` URL 參數
- 4 個子頁面（盤點/結帳/叫貨/收貨）讀取 `useSearchParams` → `submitted_by`
- 提交 Supabase upsert 時自動帶入人員 ID
- 未選人員仍可操作，不強制

#### 2. 叫貨建議量改用近 7 日平均
- 移除 `mockSuggested` 隨機資料
- 新增 useEffect 查詢該門店近 7 日 `order_sessions` + `order_items`
- 計算各品項日均用量 × 天氣係數 × 四捨五入規則
- 無歷史資料時建議量顯示 0

#### 3. 天氣 API 串接（中央氣象署）
- **新增 `src/lib/weather.ts`** — 天氣 API fetch + 資料轉換
- API：中央氣象署 F-C0032-001（36 小時一般天氣預報）
- 取「新北市」明日預報：最高溫/最低溫/降雨機率/天氣現象
- 天氣描述 → 內部 condition（sunny/cloudy/partly_cloudy/rainy）映射
- API key 由 `VITE_CWA_API_KEY` 環境變數提供
- 無 API key 或請求失敗時 fallback 預設天氣（不影響叫貨功能）

#### 4. 數據匯出 Excel
- 安裝 `xlsx` 套件
- **新增 `src/lib/exportExcel.ts`** — 通用 Excel 匯出工具函數
- 3 個報表頁面加匯出按鈕：
  - 歷史叫貨查詢（統計模式）→ `叫貨統計_YYYY-MM.xlsx`
  - 結帳歷史查詢（統計模式）→ `結帳歷史_YYYY-MM.xlsx`
  - 叫貨價格統計 → `叫貨價格_YYYY-MM.xlsx`

#### 5. 全專案 mock 資料清除
- **門店叫貨（Order.tsx）**：`mockStock` → 查詢最新 `inventory_sessions` + `inventory_items`（跨樓層加總）
- **央廚原物料叫貨（MaterialOrder.tsx）**：`mockStock` → 查詢最新 `material_stock_items`（stock_qty + bulk_qty）
- **央廚原物料叫貨（MaterialOrder.tsx）**：`weeklyUsage` → 查詢近 7 日 `material_order_items` 日均
- **央廚原物料庫存（MaterialStock.tsx）**：`weeklyUsage` → 查詢近 7 日 `material_order_items` 日均
- **央廚叫貨總表（OrderSummary.tsx）**：`mockOrders` + `mockNotes` → 查詢今日 `order_sessions` JOIN `order_items`
- **門店每日用量（Usage.tsx）**：`mockData` → 前日叫貨量 + 最新盤點庫存/倒掉量 + 今日央廚出貨量
- 全專案已無殘留 mock 或 Math.random

---

### Day 6 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| package.json | 新增 xlsx 依賴 |
| .env | 新增 VITE_CWA_API_KEY |
| .env.example | 新增 VITE_CWA_API_KEY= |
| src/lib/weather.ts | **新增** 中央氣象署天氣 API 整合 |
| src/lib/exportExcel.ts | **新增** 通用 Excel 匯出工具 |
| src/pages/store/StoreHome.tsx | 導航連結加上 ?staff= 參數 |
| src/pages/store/Inventory.tsx | 讀取 staff 參數 → submitted_by |
| src/pages/store/Settlement.tsx | 讀取 staff 參數 → submitted_by |
| src/pages/store/Order.tsx | staff 傳遞 + 天氣 API + 建議量改用 7 日均 + 庫存改用真實資料 |
| src/pages/store/Receive.tsx | 讀取 staff 參數 → received_by |
| src/pages/store/Usage.tsx | 移除 mockData，改用 Supabase 真實資料 |
| src/pages/kitchen/OrderSummary.tsx | 移除 mockOrders/mockNotes，改用 Supabase |
| src/pages/kitchen/MaterialStock.tsx | 新增近 7 日原物料叫貨日均查詢 |
| src/pages/kitchen/MaterialOrder.tsx | mockStock → Supabase 庫存 + 週用量查詢 |
| src/pages/admin/OrderHistory.tsx | 新增 Excel 匯出按鈕 |
| src/pages/admin/SettlementHistory.tsx | 新增 Excel 匯出按鈕 |
| src/pages/admin/OrderPricing.tsx | 新增 Excel 匯出按鈕 |

---

### Day 6 Git 記錄

```
e37ff81 feat: Day 6 — 當班人員傳遞、叫貨建議量、天氣API、Excel匯出
c0444c1 feat: 叫貨頁庫存欄改用真實盤點資料
edeffca feat: 央廚頁面移除所有 mock 資料，改用 Supabase 真實資料
5becfa6 feat: Usage 頁面移除 mock 資料，改用 Supabase 真實資料
```

---

## 2026-02-19（Day 7）

### 完成事項

#### 1. 叫貨價格統計 — 新增「本日」篩選
- `DateRange` 型別加入 `'today'`
- 篩選按鈕列新增「本日」（排在最前：本日/本週/本月/自訂）
- `useMemo` switch 新增 `case 'today'` → `{ startDate: today, endDate: today }`

#### 2. 叫貨價格統計 — 修正日期時區 Bug（關鍵修正）
- **根因**：`getMonday()` 和 `getDateRange()` 使用 `d.toISOString().split('T')[0]`，`toISOString()` 輸出 UTC 時間，台灣 UTC+8 導致日期少一天
- **修正**：新增 `toLocalDateStr(d: Date)` 函數，使用 `getFullYear()/getMonth()/getDate()` 產生本地日期字串
- 全部替換 `d.toISOString().split('T')[0]` → `toLocalDateStr(d)`

#### 3. 叫貨價格統計 — 價格欄改用 NumericInput
- 「我們價」「加盟價」改用 `NumericInput` 元件（和前台叫貨一致的輸入體驗）
- 點擊即可輸入、自動全選、無值時空白（不顯示 0）
- 有值時綠色背景（filled 狀態）
- `onBlur` 時透過 `useProductStore.update()` 樂觀更新 + Supabase 同步
- 總價欄仍為自動計算、唯讀

#### 4. 叫貨價格統計 — 分類標題列 sticky 修正
- 拆掉原本的 `colSpan` 整行合併
- 改為第一格（類別名稱）`sticky left-0 z-10` + 第二格 `colSpan` 填滿背景
- 水平捲動時分類標題固定不動

#### 5. 叫貨價格統計 — 品項列表與前台叫貨同步
- 移除 `activeProductIds` 過濾（原本只顯示有叫貨紀錄的品項）
- 改為顯示 `store_products` 全部品項（和前台門店叫貨完全一致）
- 分類迴圈改為 `products.filter(p => p.category === cat)`
- Excel 匯出同步改為匯出全部品項

#### 6. 叫貨價格統計 — 年度成本統計區塊（新功能）
- 獨立 `useEffect` 從 Supabase fetch 整年 `order_sessions` + `order_items`
- 按月計算我們成本 / 加盟成本（使用當前品項價格 × 歷史叫貨數量）
- UI：每月一行，顯示金額 + 橫條圖（bar）視覺化成本高低起伏
- 年度選擇器下拉（2025 起）、門店篩選同步套用
- 只顯示到當前月份（不顯示未來月份）
- 底部年度合計卡片：年度我們成本 / 年度加盟成本

#### 7. 備份
- 專案備份：`Yba_order_backup_20260219_v2`

---

### Day 7 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| src/pages/admin/OrderPricing.tsx | 本日篩選 + 時區修正 + NumericInput 價格編輯 + 分類 sticky + 全品項顯示 + 年度成本統計 |

---

### Day 7 Git 記錄

```
2833b13 fix: 叫貨價格統計頁面修正 — 時區Bug、本日篩選、價格可編輯、品項同步
c63421b feat: 叫貨價格統計新增年度成本統計區塊
```

---

## 下一步計畫（Phase 4）

### 進階功能
1. 天氣記錄與用量分析
2. 推播通知（庫存不足、叫貨提醒）
3. PDF 匯出
4. 權限/登入系統
5. 離線暫存與同步

---

## 檔案結構總覽
```
Yba_order/
├── docs/
│   ├── PRD.md                    # 產品需求文檔
│   └── DESIGN_SPEC.md            # 設計規範文檔
├── supabase/
│   ├── migration.sql             # 基礎 6 張表 + 樓層+營運表 + RLS + seed data
│   └── deploy_new_tables.sql     # 營運資料表（獨立部署用，含品項價格欄位）
├── public/
│   └── _redirects                # Netlify SPA fallback
├── src/
│   ├── components/               # 核心 UI 元件
│   │   ├── NumericInput.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── TopNav.tsx
│   │   ├── BottomAction.tsx
│   │   ├── Toast.tsx
│   │   ├── AdminModal.tsx
│   │   ├── AdminTable.tsx
│   │   └── CategoryManager.tsx
│   ├── hooks/
│   │   ├── useInitStores.ts          # Store 初始化
│   │   └── useZoneFilteredProducts.ts # 樓層品項篩選
│   ├── pages/
│   │   ├── store/                # 6 個門店頁面
│   │   │   ├── StoreHome.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── Settlement.tsx
│   │   │   ├── Usage.tsx
│   │   │   ├── Order.tsx
│   │   │   └── Receive.tsx
│   │   ├── kitchen/              # 6 個央廚頁面
│   │   │   ├── KitchenHome.tsx
│   │   │   ├── OrderSummary.tsx
│   │   │   ├── Shipment.tsx
│   │   │   ├── MaterialStock.tsx
│   │   │   ├── ProductStock.tsx
│   │   │   └── MaterialOrder.tsx
│   │   └── admin/                # 11 個後台頁面
│   │       ├── AdminHome.tsx
│   │       ├── ProductManager.tsx
│   │       ├── MaterialManager.tsx
│   │       ├── StaffManager.tsx
│   │       ├── StoreManager.tsx
│   │       ├── SettlementManager.tsx
│   │       ├── QRCodePage.tsx
│   │       ├── ZoneManager.tsx         # Day 4 新增
│   │       ├── OrderHistory.tsx        # Day 4 新增
│   │       ├── SettlementHistory.tsx   # Day 5 新增
│   │       └── OrderPricing.tsx        # Day 5 新增
│   ├── stores/                   # 6 個 Zustand stores
│   │   ├── useProductStore.ts
│   │   ├── useMaterialStore.ts
│   │   ├── useStaffStore.ts
│   │   ├── useStoreStore.ts
│   │   ├── useSettlementStore.ts
│   │   └── useZoneStore.ts           # Day 4 新增
│   ├── data/                     # 5 個資料定義（預設/fallback）
│   │   ├── storeProducts.ts
│   │   ├── rawMaterials.ts
│   │   ├── stores.ts
│   │   ├── settlementFields.ts
│   │   └── staff.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── supabase.ts
│   │   ├── session.ts               # Day 4 新增：Session ID + 時區
│   │   ├── weather.ts               # Day 6 新增：中央氣象署天氣 API
│   │   └── exportExcel.ts           # Day 6 新增：Excel 匯出工具
│   ├── App.tsx                   # 路由設定
│   ├── main.tsx                  # 入口
│   └── index.css                 # 全局樣式 + 設計 Token
├── .env.example                  # 環境變數範例
├── tailwind.config.js
├── vite.config.ts
├── package.json
├── CONTINUE_TOMORROW.md          # 明日繼續指南
└── PROJECT_LOG.md                # 本檔案
```
