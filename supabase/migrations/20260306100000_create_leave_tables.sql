-- 請假申請表
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  day_part TEXT NOT NULL DEFAULT 'full',
  reason TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  leave_days NUMERIC(4,1) NOT NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  reject_reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 假別餘額表
CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_days NUMERIC(4,1) NOT NULL,
  used_days NUMERIC(4,1) NOT NULL DEFAULT 0,
  UNIQUE(staff_id, leave_type, year)
);

-- RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_all" ON leave_requests FOR ALL USING (true);
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_balances_all" ON leave_balances FOR ALL USING (true);

-- Index
CREATE INDEX idx_leave_requests_staff ON leave_requests(staff_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_balances_staff_year ON leave_balances(staff_id, year);
