-- Batch 3: 操作記錄表
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  staff_id TEXT,
  staff_name TEXT,
  store_id TEXT,
  session_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_staff_id ON audit_logs(staff_id);
