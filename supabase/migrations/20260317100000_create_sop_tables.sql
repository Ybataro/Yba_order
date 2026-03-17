-- ============================================================
-- SOP 管理系統 — 4 張核心表
-- ============================================================

-- 1) sop_categories：配方分類
CREATE TABLE IF NOT EXISTS sop_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  image_url  TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active  BOOLEAN DEFAULT true
);

ALTER TABLE sop_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_categories_all" ON sop_categories FOR ALL USING (true) WITH CHECK (true);

-- 2) sop_recipes：配方
CREATE TABLE IF NOT EXISTS sop_recipes (
  id          TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES sop_categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  image_url   TEXT DEFAULT '',
  batch_sizes TEXT[] DEFAULT '{"1份"}',
  notes       TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

ALTER TABLE sop_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_recipes_all" ON sop_recipes FOR ALL USING (true) WITH CHECK (true);

-- 3) sop_ingredients：配料
CREATE TABLE IF NOT EXISTS sop_ingredients (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipe_id  TEXT NOT NULL REFERENCES sop_recipes(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  unit       TEXT DEFAULT '',
  amounts    JSONB DEFAULT '{}',
  notes      TEXT DEFAULT '',
  sort_order INT DEFAULT 0
);

ALTER TABLE sop_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_ingredients_all" ON sop_ingredients FOR ALL USING (true) WITH CHECK (true);

-- 4) sop_steps：步驟
CREATE TABLE IF NOT EXISTS sop_steps (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipe_id    TEXT NOT NULL REFERENCES sop_recipes(id) ON DELETE CASCADE,
  step_number  INT NOT NULL DEFAULT 1,
  title        TEXT DEFAULT '',
  description  TEXT DEFAULT '',
  duration_min REAL DEFAULT 0,
  notes        TEXT DEFAULT '',
  sort_order   INT DEFAULT 0
);

ALTER TABLE sop_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sop_steps_all" ON sop_steps FOR ALL USING (true) WITH CHECK (true);

-- Indexes for FK lookups
CREATE INDEX idx_sop_recipes_category ON sop_recipes(category_id);
CREATE INDEX idx_sop_ingredients_recipe ON sop_ingredients(recipe_id);
CREATE INDEX idx_sop_steps_recipe ON sop_steps(recipe_id);

-- Seed 9 categories
INSERT INTO sop_categories (id, name, sort_order) VALUES
  ('cat_base',      '基礎物料',   0),
  ('cat_dorayaki',  '銅鑼燒',     1),
  ('cat_icecream',  '冰淇淋',     2),
  ('cat_snowice',   '韓式雪冰',   3),
  ('cat_sheetice',  '新口味片冰', 4),
  ('cat_taro_ball', '芋圓白玉',   5),
  ('cat_zone_a',    'A區',        6),
  ('cat_zone_b',    'B區',        7),
  ('cat_zone_c',    'C區',        8);
