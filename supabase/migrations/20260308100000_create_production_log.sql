-- 每日生產紀錄：每區每日一筆 session
CREATE TABLE production_log_sessions (
  id TEXT PRIMARY KEY,
  zone_key TEXT NOT NULL,
  date DATE NOT NULL,
  submitted_by TEXT,
  supervisor_by TEXT,
  tasting_note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(zone_key, date)
);

-- 每日生產紀錄：品項欄位明細（key-value 模式）
CREATE TABLE production_log_items (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES production_log_sessions(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  field_value TEXT NOT NULL DEFAULT '',
  UNIQUE(session_id, item_key, field_key)
);

-- RLS
ALTER TABLE production_log_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_log_sessions_all" ON production_log_sessions FOR ALL USING (true);
ALTER TABLE production_log_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_log_items_all" ON production_log_items FOR ALL USING (true);

-- Index
CREATE INDEX idx_production_log_sessions_date ON production_log_sessions(date);
CREATE INDEX idx_production_log_sessions_zone ON production_log_sessions(zone_key);
CREATE INDEX idx_production_log_items_session ON production_log_items(session_id);
