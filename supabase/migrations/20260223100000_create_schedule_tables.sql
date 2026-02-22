-- 班次類型表
CREATE TABLE shift_types (
  id TEXT PRIMARY KEY DEFAULT ('shift_' || substr(md5(random()::text),1,8)),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  color TEXT DEFAULT '#6B5D55',
  group_id TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 排班表
CREATE TABLE schedules (
  id TEXT PRIMARY KEY DEFAULT ('sch_' || substr(md5(random()::text),1,8)),
  staff_id TEXT NOT NULL REFERENCES staff(id),
  date DATE NOT NULL,
  shift_type_id TEXT REFERENCES shift_types(id),
  custom_start TIME,
  custom_end TIME,
  note TEXT DEFAULT '',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

-- staff 表新增欄位
ALTER TABLE staff ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;

-- user_pins 表新增權限
ALTER TABLE user_pins ADD COLUMN IF NOT EXISTS can_schedule BOOLEAN DEFAULT false;

-- RLS
ALTER TABLE shift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shift_types_all" ON shift_types FOR ALL USING (true);
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_all" ON schedules FOR ALL USING (true);

-- Index
CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_staff ON schedules(staff_id);
