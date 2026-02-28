-- 標籤預設管理表
CREATE TABLE tag_presets (
  id TEXT PRIMARY KEY DEFAULT ('tp_' || substr(md5(random()::text),1,8)),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tag_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tag_presets_all" ON tag_presets FOR ALL USING (true);

-- 匯入現有預設標籤
INSERT INTO tag_presets (name) VALUES
  ('進貨'), ('開門'), ('關門'), ('值日生'), ('清潔'),
  ('開車'), ('掃廁所'), ('倒垃圾'), ('盤點'), ('陪車'), ('廁所')
ON CONFLICT (name) DO NOTHING;
