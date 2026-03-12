-- 每日營業額紀錄（用於叫貨建議演算法）
CREATE TABLE IF NOT EXISTS daily_revenue (
  id SERIAL PRIMARY KEY,
  store_id TEXT NOT NULL,
  date DATE NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (store_id, date)
);

ALTER TABLE daily_revenue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_revenue_all" ON daily_revenue FOR ALL USING (true) WITH CHECK (true);
