# YBA DB Schema — 表結構與關係

> 撰寫日期：2026-05-22
> 資料源：prod (`supabase-db` on VPS 5.104.87.209) public schema
> Public schema 共 98 張表，**YBA 用 60 張**（其他 38 張屬仙德宮/芋頭等共用此 Supabase 的專案）
> 用量數據：來自 prod `pg_class.reltuples`（autovacuum 統計，可能略過時但反映數量級）

---

## 一、表分類總覽

### 🏪 核心業務表（38 張）

| 業務區塊 | session 表 | items 表 | 補充表 |
|---|---|---|---|
| **盤點** | `inventory_sessions` (251) | `inventory_items` (7897) | `inventory_stock_entries` (2290)、`frozen_sales` (527) |
| **叫貨** | `order_sessions` (569) | `order_items` (8924) | `store_order_min_totals`、`store_order_hidden` |
| **出貨** | `shipment_sessions` (112) | `shipment_items` (1992) | — |
| **結算** | `settlement_sessions` (154) | `settlement_values` (3369) | `settlement_fields`、`daily_revenue` (340) |
| **央廚成品庫存** | `product_stock_sessions` (60) | `product_stock_items` (1442) | `product_stock_entries` (2226) |
| **央廚原料庫存** | `material_stock_sessions` | `material_stock_items` (332) | — |
| **央廚原料叫貨** | `material_order_sessions` | `material_order_items` (46) | — |
| **生產記錄** | `production_log_sessions` (300) | `production_log_items` (3296) | — |
| **雜支** | — | `daily_expenses` (104) | `expense_categories`、`monthly_expenses` |
| **排班** | — | `schedules` (1728) | `shift_types`、`positions`、`tag_presets` |
| **請假 V2** | — | `leave_requests` (17) | `leave_balances` (94) |
| **供應追蹤** | — | `supply_tracker` (1245) | — |
| **冷凍** | — | `frozen_sales` (527) | `frozen_product_defs` |
| **即時庫存** | — | `kitchen_realtime_items` | `kitchen_realtime_tracker` (137) |

### ⚙️ 配置/主檔（17 張）
| 表 | 筆數 | 用途 |
|---|---|---|
| `stores` | 3 | 樂華、興南、央廚（id: lehua / xingnan / kitchen） |
| `staff` | 32 | 全員工主檔（含 group_id 對應 store/kitchen） |
| `store_products` | 59 | 產品主檔（含 visibleIn / bag_weight / box_ratio） |
| `raw_materials` | — | 央廚原物料主檔 |
| `categories` | — | 通用分類（scope='product' / 'settlement'）|
| `store_zones` | — | 門店區域（鹹/甜/凍/裝）|
| `zone_products` | 187 | 區域↔產品多對多 |
| `store_item_sort` | — | 門店自訂品項順序 |
| `settlement_fields` | — | 結帳欄位定義 |
| `recipes` | — | 央廚成品配方 |
| `recipe_ingredients` | 52 | 配方原料明細 |
| `menu_items` | — | 門店販售品 |
| `menu_item_ingredients` | — | 販售品配料明細 |
| `sop_categories` | — | SOP 分類 |
| `sop_recipes` | 59 | SOP 配方 |
| `sop_ingredients` | 274 | SOP 配方原料 |
| `sop_steps` | 84 | SOP 配方步驟 |
| `production_zone_defs` | — | 生產區域定義 |
| `production_item_defs` | — | 生產品項定義 |
| `production_field_defs` | 112 | 生產欄位定義 |
| `sugar_types` | — | 糖種定義 |

### 🔐 認證 / 設定（4 張）
| 表 | 筆數 | 用途 |
|---|---|---|
| `user_pins` | 32 | PIN 認證主表（含 role、allowed_stores、is_leave_approver、can_schedule 等 flags）|
| `app_settings` | — | key/value 系統設定（含 telegram_bot_token、leave_notify_*）|
| `weather_records` | 1914 | 氣象資料（CWA API 快取） |
| `tag_presets` | — | 排班 tag 預設值 |

### 📜 Audit / Logs（2 張）
| 表 | 筆數 | 來源 |
|---|---|---|
| `audit_logs` | 1993 | **舊版 application audit log**（手動寫入，2026-04 之前）|
| `audit_log` | 新 | **2026-05-21 trigger-based**（自動，限 leave_requests + daily_expenses）|

### ❌ 非 YBA 的表（38 張，存在但不該動）
仙德宮：`pilgrimages_*`、`pudu_*`、`temple_*`、`jigai_records`、`zodiac_hours`、`members`、`member_groups`、`daily_briefs`、`annual_services`、`pilgrimage_*`、`announcements`、`temple_pins`、`temple_expense_categories`、`finance_*`、`cms_content`
芋頭：`taro_*`、`taro_menu_items`、`taro_subcategories`、`taro_categories`
其他：`news_cache`、`documents`、`addons`、`admin_users`、`orders`、`order_history`（舊版）、`tables`、`system_settings`、`site_settings`、`service_type_config`、`schema_migrations`

---

## 二、SSOT 關係圖（最重要）

### 訂貨流（5 表 SSOT）
```
┌─────────────────┐         ┌─────────────────┐
│ order_sessions  │1───────∞│ order_items     │
│ (門店一日叫貨) │ session_id│ quantity = SSOT │ ← 門店原始需求，永不被覆蓋
└─────────────────┘  CASCADE └─────────────────┘
        │
        │ 央廚出貨對應同 store_id + 同 date
        ▼
┌─────────────────┐         ┌─────────────────┐
│ shipment_sessions│1──────∞│ shipment_items  │
│ (央廚一日出貨) │ session_id│ actual_qty = SSOT│ ← 央廚實際出貨量（含主動）
└─────────────────┘  CASCADE │ order_qty       │ ← 出貨時記錄的叫貨量
                              └─────────────────┘
        │
        │ 門店收貨 update received_at
        ▼
┌─────────────────┐         ┌─────────────────────────┐
│ inventory_sessions│1─────∞│ inventory_items         │
│ (門店每日盤點)  │ session_id│ on_shelf+stock+discarded│
└─────────────────┘  CASCADE └─────────────────────────┘
                              + inventory_stock_entries
```

### 結帳流（3 表）
```
┌────────────────────┐         ┌─────────────────────────┐
│ settlement_sessions │1──────∞│ settlement_values       │
│ (門店一日結帳)     │ session_id│ {field_id, value(text)}│
└────────────────────┘  CASCADE └─────────────────────────┘
        │ 計算
        ▼
   settlement_fields（欄位定義 = 用 ID 對應 settlement_values.field_id）
        │
        └─→ lib/settlement.ts computeSession() → posTotal, expectedTotal, diff, avgPrice
```

### 請假 V2 流（3 表）
```
┌────────────────┐
│ user_pins      │ ← is_leave_approver + leave_approver_scope + leave_approver_order
└────────┬───────┘
         │ staff_id
         ▼
┌────────────────┐         ┌─────────────────┐
│ staff          │←────────│ leave_requests  │ ← V2 雙主管狀態機（見 business-flow.md）
│ telegram_id    │ CASCADE │ approver1/2_id  │
└────────┬───────┘         │ reviewed_by     │
         │                 └─────────────────┘
         │                          │
         │ CASCADE                  │ approve 時自動扣
         ▼                          ▼
┌─────────────────┐         ┌─────────────────────┐
│ leave_balances  │         │ schedules           │
│ used_days       │←────────│ attendance_type     │
└─────────────────┘ 原子RPC  └─────────────────────┘
   increment/decrement
```

### 成本配方流（2 層）
```
recipes（央廚成品配方）─── recipe_ingredients（含 material_id）
                                │
                                ▼
                          raw_materials（價格）→ cost/g 計算
                                │
                                │ 配方 reference
                                ▼
menu_items（門店販售品）── menu_item_ingredients（recipe_id OR material_id）
   selling_price                │
                                ▼
                          getMenuItemCost() → 毛利率
```

---

## 三、Foreign Key 全表（YBA 部分）

### ✅ 有 ON DELETE CASCADE（資料完整性保護）
| 子表 | FK 欄位 | → 父表 |
|---|---|---|
| `inventory_items.session_id` | `inventory_sessions.id` | ✅ |
| `order_items.session_id` | `order_sessions.id` | ✅ |
| `shipment_items.session_id` | `shipment_sessions.id` | ✅ |
| `settlement_values.session_id` | `settlement_sessions.id` | ✅ |
| `production_log_items.session_id` | `production_log_sessions.id` | ✅ |
| `recipe_ingredients.recipe_id` | `recipes.id` | ✅ |
| `menu_item_ingredients.menu_item_id` | `menu_items.id` | ✅ |
| `sop_recipes.category_id` | `sop_categories.id` | ✅ |
| `sop_ingredients.recipe_id` | `sop_recipes.id` | ✅ |
| `sop_steps.recipe_id` | `sop_recipes.id` | ✅ |
| `kitchen_realtime_tracker.item_key` | `kitchen_realtime_items.id` | ✅ |
| `leave_balances.staff_id` | `staff.id` | ✅ |
| `leave_requests.staff_id` | `staff.id` | ✅ |
| `schedules.staff_id` | `staff.id` | ✅ |
| `user_pins.staff_id` | `staff.id` | ✅ |

### ⚠️ NO ACTION（手動清理需要）
| 子表 | FK 欄位 | → 父表 | 風險 |
|---|---|---|---|
| `schedules.shift_type_id` | `shift_types.id` | 刪 shift_type 會失敗（被引用） |
| `schedules.position_id` | `positions.id` | 同上 |

### 🚨 缺 FK（潛在孤兒風險）
| 子表 | 欄位 | 應該 → | 影響 |
|---|---|---|---|
| `menu_item_ingredients.recipe_id` | text | `recipes.id` | 刪 recipe 不會清此欄，**目前 prod 0 筆孤兒**但隨時會發生 |
| `menu_item_ingredients.material_id` | text | `raw_materials.id` | 同上 |
| `recipe_ingredients.material_id` | text | `raw_materials.id` | 同上 |
| `kitchen_realtime_items.shipment_deductions` | jsonb | 內含 `product_id` | 沒 FK 保護（jsonb 本來就不能 FK），**目前 prod 0 筆孤兒** |
| `zone_products.product_id` | text | `store_products.id` | 同上 |

**修補建議**：缺 FK 的關係可由 application code 在刪除主表時手動清理子表（昨晚已修部分），或加 DB trigger。

---

## 四、RLS 安全狀態 🚨

### Prod 真實狀況
```sql
SELECT count(*) FROM pg_policies WHERE schemaname='public';
-- 96 個 policies，全部都是 USING (true) — 完全開放
```

### 風險評估
- ✅ **不會被外部攻擊**：Kong API Gateway 在 `127.0.0.1:8000`（內網），NPM 反向代理才對外
- ⚠️ **被合法員工繞過**：員工開 F12 → 拿到 ANON_KEY → 可直接 fetch `api.yen-design.com/rest/v1/...` 改任何資料
- 對 2 店 + 央廚的信任環境，**風險可接受但長期該收緊**

### 建議收緊策略（未來）
1. 按 role 區分 SELECT / INSERT / UPDATE / DELETE
2. 高敏感表（`user_pins`, `settlement_values`）只允許 admin role 寫
3. 中間配 RPC function 處理跨 role 操作

---

## 五、Trigger 清單

### ✅ Active triggers
| Trigger | 表 | 動作 |
|---|---|---|
| `trg_audit_leave_requests` | `leave_requests` | AFTER INSERT/UPDATE/DELETE → 寫 `audit_log` |
| `trg_audit_daily_expenses` | `daily_expenses` | 同上 |

兩個 trigger 由 `2026-05-21 21:00` migration 建立（檔案：`supabase/migrations/20260521210000_audit_log_infrastructure.sql`）。

### Function 清單
| Function | 用途 |
|---|---|
| `audit_log_trigger()` | 通用 audit trigger（用 `TG_TABLE_NAME` dispatch）|
| `set_actor(text)` | 設定 session var `app.actor_id`（**目前未被 application 呼叫**，actor_id 都是 NULL）|
| `increment_leave_used(...)` | 原子 INSERT/UPDATE 假別餘額 |
| `decrement_leave_used(...)` | 原子 DECREMENT（內建 GREATEST(0, ...) 防負數）|

---

## 六、關鍵 schema 細節

### `user_pins`（認證主表）
```
id                       uuid (PK)
staff_id                 text (FK→staff, UNIQUE)
pin_hash                 text (SHA-256)
role                     text ('admin'|'kitchen'|'store')
allowed_stores           text[] (store 角色限制可訪問門店)
is_active                boolean
can_schedule             boolean (任何角色可有排班權)
can_popup                boolean (請假主管可看 popup？)
is_leave_approver        boolean (V2 請假主管 flag)
leave_approver_scope     text ('kitchen'|'lehua'|'xingnan')
leave_approver_order     int (1 or 2，雙主管簽核順序)
allowed_pages            text[] (kitchen 角色可訪問頁面)
```

### `staff`
```
id                       text (PK, 'staff_xxx' or 'k1'/'s1' 等舊式)
name                     text
group_id                 text ('kitchen' / 'lehua' / 'xingnan'，對應請假 scope)
sort_order               int
telegram_id              text (請假通知用，2026-04 加)
rest_days                int[] (排班用)
default_shift_type_id    text (排班預設班次)
```

### `leave_requests` (V2)
完整 V2 schema（2026-04 重寫，已詳列在 `lib/leave.ts`）：
- 雙主管簽核欄位：approver1_id/at/note + approver2_id/at/note
- admin 最終審核：reviewed_by/at + admin_approve_note
- 駁回：rejected_by/at + reject_reason
- 病假：photo_submitted
- 向後相容欄位：manager_reviewed_by/at（舊版單主管欄位，已不再被新邏輯使用）

### `settlement_values`
```
field_id  text  ← 對應 settlement_fields.id
value     text  ← ⚠️ 是 TEXT，不是 numeric。但 prod 內所有值都是整數字串
```

### `app_settings`（key/value 設定，含敏感資訊）
| key 範例 | 用途 |
|---|---|
| `telegram_bot_token` | TG bot token（46 字長）|
| `telegram_chat_id` | 主推 chat_id |
| `leave_notify_lehua`、`leave_notify_xingnan`、`leave_notify_kitchen`、`leave_notify_admin` | V1 legacy 請假通知對象（V2 走 user_pins 但 fallback 還在）|
| `settlement_diff_threshold` | （未來可加）結帳差額警示閾值 |

---

## 七、容量規劃

### 現況（2026-05-22）
| 指標 | 值 |
|---|---|
| Prod DB 總大小 | 85 MB |
| YBA 表合計 | ~12 MB |
| 最大表 | `inventory_items` 1.5MB（8000 筆） |
| 成長率（推估）| 每月約 +1MB（每天 ~200 筆 inventory_items + 300 筆 order_items）|

### 容量警戒線
- VPS 磁碟剩 55GB → DB 還能成長 500+ 倍
- 目前完全不需要擔心容量

---

## 八、查詢效能注意點

### 已有的 Index（主要）
- 所有 `xxx_items.session_id` 都有 index（FK 自動建）
- `leave_requests.staff_id` + `(status, staff_id)` 複合 index
- `leave_balances.(staff_id, year)` 複合 index + UNIQUE `(staff_id, leave_type, year)`
- `audit_log.(table_name, record_id, changed_at)` 複合 index

### 可能漏 Index 的查詢（待 audit 確認）
- `inventory_items.product_id`（多店多日交叉查時用到）
- `order_items.product_id`（同上）
- `shipment_items.product_id`（同上）
- 不過 prod 量級不大（~9000 筆），seq scan 也才 10ms

---

## 九、相關文件
- `DOC/architecture.md` — 全局系統架構
- `DOC/business-flow.md` — 業務流程與狀態機（待寫）
- `DOC/audit/*.md` — 每頁 7 維度 audit
- `supabase/migrations/` — 所有 schema 變更 SQL（時間排序）
