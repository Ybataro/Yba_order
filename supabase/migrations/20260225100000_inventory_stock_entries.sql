-- 庫存到期日批次明細表
CREATE TABLE inventory_stock_entries (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  UNIQUE(session_id, product_id, expiry_date)
);

ALTER TABLE inventory_stock_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_stock_entries_all" ON inventory_stock_entries FOR ALL USING (true);

CREATE INDEX idx_inventory_stock_entries_session ON inventory_stock_entries(session_id);
CREATE INDEX idx_inventory_stock_entries_product ON inventory_stock_entries(session_id, product_id);
