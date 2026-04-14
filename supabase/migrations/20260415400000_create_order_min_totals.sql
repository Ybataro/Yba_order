-- 叫貨最低總量提醒設定
-- 每門店每品項各自設定閾值，有紀錄=啟用，無紀錄=關閉
CREATE TABLE IF NOT EXISTS store_order_min_totals (
  id          BIGSERIAL PRIMARY KEY,
  store_id    TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  min_total   NUMERIC(10,2) NOT NULL CHECK (min_total > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, product_id)
);

ALTER TABLE store_order_min_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_store_order_min_totals"
  ON store_order_min_totals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 索引：按門店快速撈全部設定
CREATE INDEX idx_store_order_min_totals_store_id
  ON store_order_min_totals (store_id);
