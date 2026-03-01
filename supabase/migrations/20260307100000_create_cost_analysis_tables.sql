-- 擴充 raw_materials
ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS net_weight_g NUMERIC(10,1) DEFAULT NULL;

-- 成品配方
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '盒',
  total_weight_g NUMERIC(10,1) NOT NULL DEFAULT 0,
  solid_weight_g NUMERIC(10,1) DEFAULT NULL,
  liquid_weight_g NUMERIC(10,1) DEFAULT NULL,
  store_product_id TEXT DEFAULT NULL,
  notes TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 配方原料
CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_id TEXT DEFAULT NULL,
  custom_name TEXT DEFAULT NULL,
  custom_price_per_g NUMERIC(10,6) DEFAULT NULL,
  amount_g NUMERIC(10,1) NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- 販售品
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  serving_g NUMERIC(10,1) DEFAULT NULL,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 販售品配料
CREATE TABLE menu_item_ingredients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  recipe_id TEXT DEFAULT NULL,
  material_id TEXT DEFAULT NULL,
  custom_name TEXT DEFAULT NULL,
  custom_cost NUMERIC(10,4) DEFAULT NULL,
  amount_g NUMERIC(10,1) NOT NULL DEFAULT 0,
  sort_order INT DEFAULT 0
);

-- 索引
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_menu_item_ingredients_menu ON menu_item_ingredients(menu_item_id);

-- RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_access" ON recipes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON recipe_ingredients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON menu_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "all_access" ON menu_item_ingredients FOR ALL USING (true) WITH CHECK (true);
