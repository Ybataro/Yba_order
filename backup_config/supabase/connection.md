# Supabase 連線資訊

## Project
- Project Name: Yba_order
- URL: https://qshfgheqsnsghwqaqehi.supabase.co
- Anon Key: sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN
- Dashboard: https://supabase.com/dashboard/project/qshfgheqsnsghwqaqehi

## Tables (31)
### 基礎 (6)
stores, store_products, staff, frozen_product_defs, settlement_fields, settlement_field_groups

### 樓層 (2)
store_zones, zone_products

### 營運 (10)
inventory_sessions, inventory_items, order_sessions, order_items,
settlement_sessions, settlement_values, shipment_sessions, shipment_items,
material_stock_sessions, material_stock_items

### 天氣 (1)
weather_records

### 權限 (2)
user_pins, audit_logs

### 費用 (2)
daily_expenses, frozen_sales

### 排班 (4)
shift_types, schedules, tag_presets, positions

### 庫存批次 (2)
inventory_stock_entries, product_stock_sessions, product_stock_items,
material_order_sessions, material_order_items

### 系統設定 (1)
app_settings (telegram_bot_token, telegram_chat_id, telegram_group_chat_id)

### 品項排序 (1)
store_item_sort

### 消耗品 (1)
supply_tracker

### 請假 (2)
leave_requests, leave_balances

## Telegram
- Bot Token: 存在 app_settings 表 (key: telegram_bot_token)
- Yen_Yba Chat ID: 存在 app_settings 表 (key: telegram_chat_id)
- 群組 Chat ID: -4715692611 (硬編碼在 src/lib/telegram.ts)
- 主管 Chat ID: 8515675347 (硬編碼在 src/stores/useLeaveStore.ts，僅請假通知)

## Migrations
所有 migration SQL 檔案在 supabase/migrations/ 目錄下
