-- 排班系統大改版：職位表 + schedules/shift_types 新欄位

-- 崗位表
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY DEFAULT ('pos_' || substr(md5(random()::text),1,8)),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B5D55',
  group_id TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_all" ON positions FOR ALL USING (true);

-- schedules 新增欄位
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS position_id TEXT REFERENCES positions(id);
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS attendance_type TEXT DEFAULT 'work';
CREATE INDEX IF NOT EXISTS idx_schedules_attendance ON schedules(attendance_type);

-- shift_types 新增標籤
ALTER TABLE shift_types ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
