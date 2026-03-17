# Yba_order VPS 搬移計畫

> 目標：將 Yba_order 從 Vercel + Supabase Cloud 搬移到 Contabo VPS 自架環境
> 搬移日期：預計近期執行
> 整理日期：2026-03-17

---

## 一、現有架構總覽

### 目前環境
| 項目 | 現況 |
|------|------|
| 前端託管 | Vercel (`yba-order.vercel.app`) |
| 後端 DB | Supabase Cloud (`qshfgheqsnsghwqaqehi.supabase.co`) |
| Edge Function | Supabase Cloud (`send-telegram-photo`) |
| DNS | 無自訂 domain（使用 Vercel 預設） |
| 環境變數 | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CWA_API_KEY` |

### 目標環境（VPS）
| 項目 | 目標 |
|------|------|
| 前端託管 | VPS nginx:alpine 容器 (`site-yba-order`, 已存在於 docker-compose) |
| 後端 DB | VPS 自架 Supabase (`api.yen-design.com`) |
| Edge Function | 需改為 Node/Express 容器或直接前端呼叫 Telegram API |
| DNS | `order.yen-design.com`（Cloudflare A record 已預留） |
| 環境變數 | 改為 VPS Supabase URL + ANON_KEY |

---

## 二、資料庫清單（57 張表，共 ~18,500+ 筆）

### 基礎/設定 (10 表, 399 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `stores` | 2 | 門店定義（樂華、興南） |
| `staff` | 29 | 員工資料 |
| `categories` | 24 | 產品分類 |
| `store_products` | 59 | 門店品項（含價格/連結庫存/箱袋單位） |
| `raw_materials` | 32 | 央廚原物料 |
| `store_zones` | 4 | 門店樓層區域 |
| `zone_products` | 187 | 樓層-品項對應 |
| `settlement_fields` | 25 | 結帳欄位定義 |
| `app_settings` | 8 | 系統設定（telegram token/chat_id 等） |
| `user_pins` | 29 | PIN 登入（含角色/權限/允許頁面） |

### 營運資料 (14 表, 12,552 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `order_sessions` | 519 | 叫貨單 |
| `order_items` | 7,431 | 叫貨明細 |
| `inventory_sessions` | 77 | 盤點單 |
| `inventory_items` | 2,164 | 盤點明細 |
| `shipment_sessions` | 37 | 出貨單 |
| `shipment_items` | 601 | 出貨明細 |
| `material_order_sessions` | 4 | 原物料叫貨 |
| `material_order_items` | 26 | 原物料叫貨明細 |
| `material_stock_sessions` | 4 | 原物料庫存 |
| `material_stock_items` | 112 | 原物料庫存明細 |
| `settlement_sessions` | 50 | 結帳單 |
| `settlement_values` | 924 | 結帳值 |
| `product_stock_sessions` | 17 | 成品庫存 |
| `product_stock_items` | 461 | 成品庫存明細 |

### 追蹤/分析 (4 表, 3,228 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `audit_logs` | 765 | 操作紀錄 |
| `weather_records` | 1,853 | 天氣紀錄 |
| `daily_revenue` | 340 | 每日營收 |
| `supply_tracker` | 270 | 叫貨追蹤 |

### 排班 (4 表, 1,074 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `schedules` | 1,048 | 排班紀錄 |
| `shift_types` | 14 | 班次類型 |
| `positions` | 5 | 職位 |
| `tag_presets` | 7 | 排班標籤預設 |

### 冷凍品 (2 表, 161 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `frozen_product_defs` | 7 | 冷凍品定義 |
| `frozen_sales` | 154 | 冷凍品銷售 |

### 費用 (3 表, 82 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `daily_expenses` | 55 | 每日支出 |
| `expense_categories` | 24 | 費用分類 |
| `monthly_expenses` | 3 | 月度費用 |

### 請假 (2 表, 44 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `leave_requests` | 1 | 請假申請 |
| `leave_balances` | 43 | 假期餘額 |

### 成本/配方 (4 表, 75 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `recipes` | 22 | 成品配方 |
| `recipe_ingredients` | 52 | 配方原料 |
| `menu_items` | 1 | 販售品 |
| `menu_item_ingredients` | 0 | 販售品成分 |

### 生產 (6 表, 867 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `production_zone_defs` | 6 | 生產區域定義 |
| `production_item_defs` | 20 | 生產品項定義 |
| `production_field_defs` | 112 | 生產欄位定義 |
| `sugar_types` | 5 | 糖度類型 |
| `production_log_sessions` | 59 | 生產紀錄 |
| `production_log_items` | 665 | 生產紀錄明細 |

### 即時庫存 (2 表, 19 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `kitchen_realtime_items` | 7 | 即時庫存品項定義 |
| `kitchen_realtime_tracker` | 12 | 即時庫存追蹤 |

### 庫存批次 (2 表, 857 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `inventory_stock_entries` | 488 | 門店庫存批次 |
| `product_stock_entries` | 369 | 成品庫存批次 |

### 品項排序 (1 表, 22 筆)
| 表名 | 筆數 | 說明 |
|------|------|------|
| `store_item_sort` | 22 | 門店品項排序（稀疏覆寫） |

### SOP 管理 (4 表, 426 筆) ⭐ 新增
| 表名 | 筆數 | 說明 |
|------|------|------|
| `sop_categories` | 9 | SOP 分類 |
| `sop_recipes` | 59 | SOP 配方 |
| `sop_ingredients` | 274 | SOP 配料 |
| `sop_steps` | 84 | SOP 步驟 |

---

## 三、Migration 檔案清單（45 個）

```
01. 20260219123027_create_weather_records.sql
02. 20260219134511_add_visible_in_to_store_products.sql
03. 20260219150409_add_price_columns_to_store_products.sql
04. 20260220072911_add_received_by_to_shipment_sessions.sql
05. 20260220200000_create_user_pins.sql
06. 20260220210000_create_audit_logs.sql
07. 20260221100000_create_daily_expenses.sql
08. 20260222141000_drop_translation_columns_from_store_products.sql
09. 20260223100000_create_schedule_tables.sql
10. 20260223200000_create_frozen_sales.sql
11. 20260223210000_create_frozen_product_defs.sql
12. 20260223220000_frozen_sales_split_channels.sql
13. 20260223230000_add_kitchen_reply_to_shipment_sessions.sql
14. 20260224100000_schedule_overhaul.sql
15. 20260224110000_schedule_tags.sql
16. 20260224120000_tag_presets.sql
17. 20260224130000_linked_inventory_ids.sql
18. 20260224140000_link_sugarcane_ice.sql
19. 20260224150000_add_linkable_flag.sql
20. 20260225100000_inventory_stock_entries.sql
21. 20260225200000_schedules_cascade_delete.sql
22. 20260225300000_add_monthly_salary_to_staff.sql
23. 20260226100000_create_app_settings.sql
24. 20260227100000_add_allowed_pages.sql
25. 20260228100000_product_stock_entries.sql
26. 20260228200000_add_can_popup.sql
27. 20260301100000_add_box_unit_columns.sql
28. 20260302100000_create_store_item_sort.sql
29. 20260303100000_add_rest_days_to_staff.sql
30. 20260304100000_create_supply_tracker.sql
31. 20260305100000_add_bag_weight_to_store_products.sql
32. 20260306100000_create_leave_tables.sql
33. 20260307100000_create_cost_analysis_tables.sql
34. 20260308100000_create_production_log.sql
35. 20260309100000_create_production_zone_defs.sql
36. 20260310100000_add_serving_units_to_recipes.sql
37. 20260310150000_leave_two_stage_review.sql
38. 20260310200000_kitchen_realtime_inventory.sql
39. 20260310300000_kitchen_realtime_deduction_ratio.sql
40. 20260311100000_add_unique_to_product_stock_items.sql
41. 20260311200000_add_unique_to_shipment_items.sql
42. 20260312100000_add_category_to_recipes.sql
43. 20260312200000_daily_revenue.sql
44. 20260317100000_create_sop_tables.sql        ⭐ 新增
45. 20260317100001_seed_sop_data.sql             ⭐ 新增（含 seed 資料）
```

> 注意：前幾張表（stores, staff, categories, store_products, raw_materials, store_zones, zone_products, settlement_fields）
> 是在 Supabase Dashboard 手動建立的，沒有對應 migration。搬移時需要先用 `pg_dump` 匯出完整 schema。

---

## 四、Edge Function — 需特殊處理

### `send-telegram-photo` (Deno)
- **用途**：將照片（base64）透過 Telegram Bot API 傳送到指定 chat
- **呼叫來源**：`src/lib/telegram.ts` 第 167 行、237 行
- **環境變數**：`TELEGRAM_BOT_TOKEN`（在 Supabase Cloud Dashboard 設定）

### 搬移方案（二選一）
1. **方案 A：新增 Node/Express 容器**（類似 `api-look-and-learn`）
   - 建立 `api-yba-telegram` 容器，包裝 Telegram Bot API 呼叫
   - 前端改呼叫 `https://api.yen-design.com/yba-telegram/send-photo`
   - 需在 kong.yml 或 NPM 加 proxy route

2. **方案 B：前端直接呼叫 Telegram API**
   - 將 `telegram_bot_token` 從 `app_settings` 讀出後直接呼叫 `api.telegram.org`
   - 優點：不需額外容器。缺點：token 暴露在前端（但 PIN 驗證後才能存取）
   - 現有 `src/lib/telegram.ts` 第 143/194 行已有直接呼叫的 pattern（文字訊息用）

---

## 五、程式碼結構摘要

### Stores (12 個)
```
useStoreStore, useProductStore, useMaterialStore, useStaffStore,
useSettlementStore, useZoneStore, useFrozenProductStore, useCostStore,
useProductionZoneStore, useSopStore, useScheduleStore*, useExpenseStore*
(* 部分 store 非 useInitStores 初始化，在頁面內獨立初始化)
```

### Pages (51 個)
- Store: 9 (StoreHome, Inventory, Settlement, Usage, Order, Receive, DailyExpense, OrderHistory, Schedules)
- Kitchen: 10 (KitchenHome, OrderSummary, Shipment, MaterialStock, ProductStock, MaterialOrder, ProductionSchedule, DailyExpense, ProductionLog, Schedules)
- Admin: 32 (AdminHome, BossDashboard, ProductManager, MaterialManager, StaffManager, StoreManager, SettlementManager, QRCodePage, ZoneManager, OrderHistory, SettlementHistory, OrderPricing, WeatherAnalysis, PinManager, AuditLog, ExpenseManagement, ProfitLoss, ShiftTypeManager, ScheduleStats, FrozenStats, AdminSchedule, ItemSortManager, LeaveManagement, RecipeManager, MenuItemManager, CostAnalysis, ProductionZoneManager, KitchenRealtimeItems, ProductionStats, SopManager, SopDetail)

### 環境變數需替換
| 變數 | 現值（Cloud） | 目標（VPS） |
|------|-------------|-----------|
| `VITE_SUPABASE_URL` | `https://qshfgheqsnsghwqaqehi.supabase.co` | `https://api.yen-design.com` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN` | VPS ANON_KEY（見 MEMORY） |
| `VITE_CWA_API_KEY` | 不變 | 不變（氣象局 API 無關 Supabase） |

---

## 六、VPS 現狀（已就緒的部分）

1. **`site-yba-order` 容器已定義**於 `docker-compose.yml`
   - `nginx:alpine` + `./sites/yba-order:/usr/share/nginx/html:ro`
   - 已掛載 `spa.conf`（SPA 路由 fallback）
   - 已加入 `proxy-net` 網路

2. **DNS 子網域 `order.yen-design.com`** — Cloudflare A record 已預留

3. **VPS Supabase** — PostgreSQL + PostgREST + Kong + Studio 已運行

4. **NPM (Nginx Proxy Manager)** — 待新增 proxy host: `order.yen-design.com` → `site-yba-order:80`

---

## 七、搬移步驟 Checklist

### Step 1: DB Schema + 資料匯出
- [ ] 從 Supabase Cloud 用 `pg_dump` 匯出完整 schema + 資料
- [ ] 或用 REST API 逐表匯出 JSON（57 表）
- [ ] 確認包含所有 indexes、RLS policies

### Step 2: VPS DB 匯入
- [ ] SSH 進 VPS，在 `supabase-db` 容器內建立 `yba_order` schema（或使用 `public`）
- [ ] 匯入 schema 定義（CREATE TABLE + INDEX + RLS）
- [ ] 匯入資料（INSERT）
- [ ] 驗證 57 表 + 筆數一致

### Step 3: Kong API Gateway 設定
- [ ] 更新 `kong.yml` 加入 Yba_order 的 REST API 路由（若需隔離 schema）
- [ ] 或直接共用現有 PostgREST（同一個 `public` schema，需注意表名衝突）
  - 現有 VPS 已有賢德宮 20 表，表名無衝突

### Step 4: 前端 build + 部署
- [ ] 建立 `.env.vps` 檔案（VPS URL + ANON_KEY）
- [ ] `cp .env.vps .env && npm run build`
- [ ] `scp -r dist/* root@5.104.87.209:/root/vps-deploy/sites/yba-order/`
- [ ] `ssh root@5.104.87.209 "docker restart site-yba-order"`

### Step 5: DNS + SSL
- [ ] Cloudflare: `order.yen-design.com` → A record `5.104.87.209`
- [ ] NPM: 新增 proxy host `order.yen-design.com` → `site-yba-order:80`
- [ ] NPM: 啟用 Let's Encrypt SSL

### Step 6: Edge Function 替代
- [ ] 決定方案 A（Node 容器）或 B（前端直呼）
- [ ] 實作 + 測試 Telegram 照片傳送功能

### Step 7: 驗證
- [ ] 開啟 `https://order.yen-design.com` 確認頁面載入
- [ ] 測試 PIN 登入（admin/kitchen/store）
- [ ] 測試叫貨、盤點、出貨、結帳流程
- [ ] 測試排班、SOP、生產紀錄
- [ ] 測試 Telegram 通知（文字 + 照片）
- [ ] 確認天氣 API 正常（CWA key 不變）

### Step 8: 切換 + 清理
- [ ] 確認 VPS 版本穩定後，停用 Vercel 部署
- [ ] 保留 Supabase Cloud 一段時間做備份，之後再刪除
- [ ] 更新 `MEMORY.md` 及 `CLAUDE.md` 指向新環境

---

## 八、注意事項

1. **表名衝突檢查**：VPS 現有賢德宮 20 表 + Yba_order 57 表 = 77 表，全部在 `public` schema。已確認無同名表（唯一共用表名 `user_pins` 兩邊都有，但結構不同！）
   - 解決方案：Yba_order 使用獨立 schema（如 `yba`），或重命名其中一個 `user_pins`

2. **Supabase Edge Function** 在自架版不可用（需 Deno Deploy），必須替換

3. **`vercel.json` 路由改寫** — Vercel 用 `rewrites` 做 SPA fallback，VPS 改用 `spa.conf`（已存在）

4. **CORS** — Supabase Cloud 預設允許所有 origin；VPS Kong 需確認 CORS 設定包含 `order.yen-design.com`

5. **Realtime** — 目前程式碼未使用 Supabase Realtime（無 subscription），搬移不受影響

6. **Storage** — Yba_order 未使用 Supabase Storage（SOP 圖片用外部 URL），搬移不受影響

7. **備份** — VPS 已有每日 3:00 AM 自動 `pg_dump`，搬入後自動涵蓋
