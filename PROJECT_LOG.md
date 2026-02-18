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
1. 目前使用模擬隨機資料，每次重整會變
2. Settlement 頁面的「應結總金額」計算邏輯需與實際業務確認
3. 品項順序需與門店實際貨架動線對齊（需用戶確認）
4. 深色模式 UI 已定義 CSS 變數但尚未加入切換按鈕
5. 尚未加入離線提示與本地暫存功能
6. 天氣資料目前為模擬，Phase 2 需串接中央氣象署開放資料 API
7. 人員名單目前寫死在前端，Phase 2 需改為後台管理
8. 門店當班人員選擇後尚未傳遞到子頁面（盤點/結帳/叫貨提交時帶上人名）

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

#### 3. 備份
- 專案備份：`Yba_order_backup_20260219`

#### 4. Netlify 部署更新
- 重新建置 dist 並更新線上版

---

### Day 3 修改檔案清單

| 檔案 | 修改內容 |
|------|----------|
| src/data/storeProducts.ts | 品項大幅調整：新增/移動/刪除/修改期效與baseStock |
| src/pages/store/Order.tsx | 新增薏仁湯/芋頭湯四捨五入規則 |

---

## 下一步計畫（Day 3 下半）

### Phase 2：後台管理系統 + Supabase 串接
1. 建立管理後台頁面（品項管理、人員管理）
2. 建立 Supabase 專案與資料表
3. 設定 Row Level Security
4. 建立 Supabase 客戶端 (`src/lib/supabase.ts`)
5. 逐頁替換模擬資料為 CRUD 操作
6. 加入使用者認證（QR Code 角色判定）

### Phase 3：部署與進階
7. 叫貨建議量計算（近 7 日平均用量）
8. 老闆報表（日/週/月報）
9. 數據匯出功能
10. 天氣 API 串接（中央氣象署）

---

## 檔案結構總覽
```
Yba_order/
├── docs/
│   ├── PRD.md                    # 產品需求文檔
│   └── DESIGN_SPEC.md            # 設計規範文檔
├── src/
│   ├── components/               # 6 個核心元件
│   │   ├── NumericInput.tsx
│   │   ├── SectionHeader.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── TopNav.tsx
│   │   ├── BottomAction.tsx
│   │   └── Toast.tsx
│   ├── pages/
│   │   ├── store/                # 6 個門店頁面
│   │   │   ├── StoreHome.tsx
│   │   │   ├── Inventory.tsx
│   │   │   ├── Settlement.tsx
│   │   │   ├── Usage.tsx
│   │   │   ├── Order.tsx
│   │   │   └── Receive.tsx
│   │   └── kitchen/              # 6 個央廚頁面
│   │       ├── KitchenHome.tsx
│   │       ├── OrderSummary.tsx
│   │       ├── Shipment.tsx
│   │       ├── MaterialStock.tsx
│   │       ├── ProductStock.tsx
│   │       └── MaterialOrder.tsx
│   ├── data/                     # 5 個資料定義
│   │   ├── storeProducts.ts
│   │   ├── rawMaterials.ts
│   │   ├── stores.ts
│   │   ├── settlementFields.ts
│   │   └── staff.ts              # Day 2 新增：人員資料
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx                   # 路由設定
│   ├── main.tsx                  # 入口
│   └── index.css                 # 全局樣式 + 設計 Token
├── tailwind.config.js
├── vite.config.ts
├── package.json
├── CONTINUE_TOMORROW.md          # 明日繼續指南
└── PROJECT_LOG.md                # 本檔案
```
