-- Batch 2: QR+PIN 登入系統
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'store';

CREATE TABLE IF NOT EXISTS user_pins (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'store',
  allowed_stores TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_user_pins" ON user_pins FOR ALL USING (true) WITH CHECK (true);
