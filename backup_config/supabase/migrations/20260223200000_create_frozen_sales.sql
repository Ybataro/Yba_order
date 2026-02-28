CREATE TABLE frozen_sales (
  id SERIAL PRIMARY KEY,
  store_id TEXT NOT NULL,
  date DATE NOT NULL,
  zone_code TEXT NOT NULL DEFAULT '',
  product_key TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  submitted_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, zone_code, product_key)
);

ALTER TABLE frozen_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frozen_sales_all" ON frozen_sales FOR ALL USING (true);

CREATE INDEX idx_frozen_sales_date ON frozen_sales(date);
CREATE INDEX idx_frozen_sales_store ON frozen_sales(store_id, date);
