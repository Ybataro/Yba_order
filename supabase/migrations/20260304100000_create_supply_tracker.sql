CREATE TABLE supply_tracker (
  id SERIAL PRIMARY KEY,
  store_id TEXT NOT NULL,
  date DATE NOT NULL,
  zone_code TEXT NOT NULL DEFAULT '',
  supply_key TEXT NOT NULL,
  restock_qty INT NOT NULL DEFAULT 0,
  remaining_qty INT NOT NULL DEFAULT 0,
  submitted_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, date, zone_code, supply_key)
);

ALTER TABLE supply_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "supply_tracker_all" ON supply_tracker FOR ALL USING (true);

CREATE INDEX idx_supply_tracker_store_date ON supply_tracker(store_id, date);
