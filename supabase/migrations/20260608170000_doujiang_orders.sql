-- 店內豆漿叫貨：每週訂貨記錄表 + 央廚成品倒掉欄位
-- 業務：每週一訂貨，公式 上週使用量 = 上週庫存 + 前次進貨 − 訂貨日庫存 − 過期損耗
-- 本週訂貨量 = 上週使用量 − 訂貨日庫存 + 上週使用量÷7×3，保底 5 桶
-- SKU 限定 p019 微糖豆漿 + p020 無糖豆漿（排除 p1773123026632 豆花用）

BEGIN;

-- ============================================================
-- 1. 央廚成品庫存補上「倒掉」欄位（與門店 inventory_items.discarded 語意一致）
-- ============================================================
ALTER TABLE product_stock_items
  ADD COLUMN IF NOT EXISTS discarded numeric DEFAULT 0;

-- ============================================================
-- 2. 豆漿叫貨歷史表
-- ============================================================
CREATE TABLE IF NOT EXISTS doujiang_orders (
  id text PRIMARY KEY DEFAULT 'dj_' || to_char(now(), 'YYYYMMDDHH24MISS') || substr(md5(random()::text), 1, 4),
  order_date date NOT NULL UNIQUE,                  -- 每週訂貨日（週一）

  -- 微糖（p019）
  weitang_prev_stock numeric DEFAULT 0,             -- 上週庫存（首次手動，之後自動取上一筆 weitang_order_stock）
  weitang_prev_received numeric DEFAULT 0,          -- 前次進貨（自動 = 上週 shipment_items.actual_qty 合計）
  weitang_order_stock numeric DEFAULT 0,            -- 訂貨日庫存合計（自動 = 樂華+興南+央廚）
  weitang_discarded numeric DEFAULT 0,              -- 過期損耗合計（自動 = 上週 inventory.discarded + product_stock.discarded）
  weitang_usage numeric DEFAULT 0,                  -- 上週使用量（公式自動）
  weitang_recommended numeric DEFAULT 0,            -- 系統推薦本週訂貨量（公式自動，保底 5）
  weitang_actual_ordered numeric DEFAULT 0,         -- admin 實際送出量（可事後修）

  -- 無糖（p020）
  wutang_prev_stock numeric DEFAULT 0,
  wutang_prev_received numeric DEFAULT 0,
  wutang_order_stock numeric DEFAULT 0,
  wutang_discarded numeric DEFAULT 0,
  wutang_usage numeric DEFAULT 0,
  wutang_recommended numeric DEFAULT 0,
  wutang_actual_ordered numeric DEFAULT 0,

  -- 訂貨日各方庫存快照（供歷史回溯，金額用 jsonb 儲存）
  snapshot_kitchen jsonb DEFAULT '{}'::jsonb,       -- { weitang: 6, wutang: 7 }
  snapshot_lehua jsonb DEFAULT '{}'::jsonb,
  snapshot_xingnan jsonb DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'draft',             -- 'draft' | 'sent'
  sent_at timestamptz,
  note text DEFAULT '',
  submitted_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doujiang_orders_date ON doujiang_orders(order_date DESC);

ALTER TABLE doujiang_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all_doujiang_orders ON doujiang_orders;
CREATE POLICY anon_all_doujiang_orders ON doujiang_orders
  USING (true) WITH CHECK (true);

COMMIT;

-- 通知 PostgREST reload schema（新欄位 + 新表）
NOTIFY pgrst, 'reload schema';
