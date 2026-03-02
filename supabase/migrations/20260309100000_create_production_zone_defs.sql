-- ============================================================
-- 生產紀錄 DB 驅動：區域/品項/欄位定義 + 糖種類
-- ============================================================

-- 1. 區域定義
CREATE TABLE IF NOT EXISTS production_zone_defs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '',
  notice TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE production_zone_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_zone_defs_all" ON production_zone_defs FOR ALL USING (true) WITH CHECK (true);

-- 2. 品項定義
CREATE TABLE IF NOT EXISTS production_item_defs (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES production_zone_defs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE production_item_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_item_defs_all" ON production_item_defs FOR ALL USING (true) WITH CHECK (true);

-- 3. 欄位定義
CREATE TABLE IF NOT EXISTS production_field_defs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  item_id TEXT NOT NULL REFERENCES production_item_defs(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT DEFAULT 'numeric',
  unit TEXT DEFAULT '',
  options TEXT[] DEFAULT '{}',
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(item_id, field_key)
);

ALTER TABLE production_field_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "production_field_defs_all" ON production_field_defs FOR ALL USING (true) WITH CHECK (true);

-- 4. 糖種類（全域共享）
CREATE TABLE IF NOT EXISTS sugar_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

ALTER TABLE sugar_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sugar_types_all" ON sugar_types FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Seed: 6 區域
-- ============================================================
INSERT INTO production_zone_defs (id, name, icon, notice, sort_order) VALUES
  ('paste',      '漿區',   '🫙', '甜度需達標準值方可出貨，稠度以攪拌棒測試', 0),
  ('ball',       '球區',   '⚪', '豆花洞洞數須記錄，芝麻糊/杏仁茶甜度需達標', 1),
  ('ingredient', '料區',   '🫘', '各料甜度需達標準值，盒數需與生產排程一致', 2),
  ('ice',        '製冰區', '🧊', '牛奶需確認保存期限，甜度依標準配比', 3),
  ('syrup',      '糖水區', '🍯', '糖水甜度需每批測量，蔗片糖水桶數需記錄', 4),
  ('dumpling',   '圓仔區', '🟤', '麵團狀態需準確記錄，加水量影響口感', 5);

-- ============================================================
-- Seed: 18 品項
-- ============================================================

-- 漿區 (paste) — 3 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('taro_paste',     'paste', '芋泥漿',  0),
  ('grass_jelly',    'paste', '嫩仙草',  1),
  ('silver_ear_soup','paste', '銀耳湯',  2);

-- 球區 (ball) — 4 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('tofu',          'ball', '豆花',    0),
  ('sesame_paste',  'ball', '芝麻糊',  1),
  ('almond_tea',    'ball', '杏仁茶',  2),
  ('taro_ball',     'ball', '芋泥球',  3);

-- 料區 (ingredient) — 4 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('peanut',    'ingredient', '花生',    0),
  ('red_bean',  'ingredient', '紅豆',    1),
  ('mung_bean', 'ingredient', '綠豆',    2),
  ('barley',    'ingredient', '小薏仁',  3);

-- 製冰區 (ice) — 3 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('peanut_ice',     'ice', '花生冰',  0),
  ('sesame_ice',     'ice', '芝麻冰',  1),
  ('strawberry_ice', 'ice', '草莓冰',  2);

-- 糖水區 (syrup) — 3 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('fried_syrup',     'syrup', '炒糖水',    0),
  ('tapioca_syrup',   'syrup', '粉圓糖水',  1),
  ('sugarcane_syrup', 'syrup', '蔗片糖水',  2);

-- 圓仔區 (dumpling) — 2 品項
INSERT INTO production_item_defs (id, zone_id, name, sort_order) VALUES
  ('taro_dumpling', 'dumpling', '芋圓', 0),
  ('white_ball',    'dumpling', '白玉', 1);

-- ============================================================
-- Seed: ~70 欄位
-- field_type: numeric | select | text | sugar_select
-- 所有原本 key='sugar' type='numeric' 的欄位改為 sugar_select
-- ============================================================

-- === 漿區 ===
-- 芋泥漿
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_taro_paste_sugar',        'taro_paste', 'sugar',        '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_taro_paste_water',        'taro_paste', 'water',        '水',   'numeric', 'ml', '{}', 1),
  ('f_taro_paste_sweetness',    'taro_paste', 'sweetness',    '甜度', 'numeric', '°',  '{}', 2),
  ('f_taro_paste_thickness',    'taro_paste', 'thickness',    '稠度', 'numeric', '',   '{}', 3),
  ('f_taro_paste_bucket_count', 'taro_paste', 'bucket_count', '桶數', 'numeric', '桶', '{}', 4);

-- 嫩仙草
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_grass_jelly_dongcheng',     'grass_jelly', 'dongcheng',     '東城', 'numeric', 'g',  '{}', 0),
  ('f_grass_jelly_zhuangyuan',    'grass_jelly', 'zhuangyuan',    '狀元', 'numeric', 'g',  '{}', 1),
  ('f_grass_jelly_starch_water',  'grass_jelly', 'starch_water',  '粉水', 'numeric', 'ml', '{}', 2),
  ('f_grass_jelly_solidification','grass_jelly', 'solidification','凝固', 'numeric', '',   '{}', 3),
  ('f_grass_jelly_bucket_count',  'grass_jelly', 'bucket_count',  '桶數', 'numeric', '桶', '{}', 4);

-- 銀耳湯
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_silver_ear_sugar',        'silver_ear_soup', 'sugar',        '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_silver_ear_water',        'silver_ear_soup', 'water',        '水',   'numeric', 'ml', '{}', 1),
  ('f_silver_ear_red_date',     'silver_ear_soup', 'red_date',     '紅棗', 'numeric', 'g',  '{}', 2),
  ('f_silver_ear_goji',         'silver_ear_soup', 'goji',         '枸杞', 'numeric', 'g',  '{}', 3),
  ('f_silver_ear_sweetness',    'silver_ear_soup', 'sweetness',    '甜度', 'numeric', '°',  '{}', 4),
  ('f_silver_ear_bucket_count', 'silver_ear_soup', 'bucket_count', '桶數', 'numeric', '桶', '{}', 5);

-- === 球區 ===
-- 豆花
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_tofu_powder',       'tofu', 'powder',       '粉',   'numeric', 'g',  '{}', 0),
  ('f_tofu_gypsum',       'tofu', 'gypsum',       '石膏', 'numeric', 'g',  '{}', 1),
  ('f_tofu_water',        'tofu', 'water',        '水',   'numeric', 'ml', '{}', 2),
  ('f_tofu_holes',        'tofu', 'holes',        '洞洞', 'numeric', '',   '{}', 3),
  ('f_tofu_bucket_count', 'tofu', 'bucket_count', '桶數', 'numeric', '桶', '{}', 4);

-- 芝麻糊
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_sesame_paste_sugar',     'sesame_paste', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_sesame_paste_water',     'sesame_paste', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_sesame_paste_sweetness', 'sesame_paste', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_sesame_paste_portion',   'sesame_paste', 'portion',   '份量', 'numeric', '份', '{}', 3);

-- 杏仁茶
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_almond_tea_sugar',     'almond_tea', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_almond_tea_water',     'almond_tea', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_almond_tea_sweetness', 'almond_tea', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_almond_tea_portion',   'almond_tea', 'portion',   '份量', 'numeric', '份', '{}', 3);

-- 芋泥球
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_taro_ball_sugar',     'taro_ball', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_taro_ball_water',     'taro_ball', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_taro_ball_sweetness', 'taro_ball', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_taro_ball_box_count', 'taro_ball', 'box_count', '盒數', 'numeric', '盒', '{}', 3);

-- === 料區 ===
-- 花生
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_peanut_sugar',     'peanut', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_peanut_water',     'peanut', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_peanut_sweetness', 'peanut', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_peanut_box_count', 'peanut', 'box_count', '盒數', 'numeric', '盒', '{}', 3);

-- 紅豆
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_red_bean_sugar',     'red_bean', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_red_bean_water',     'red_bean', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_red_bean_sweetness', 'red_bean', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_red_bean_box_count', 'red_bean', 'box_count', '盒數', 'numeric', '盒', '{}', 3);

-- 綠豆
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_mung_bean_sugar',     'mung_bean', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_mung_bean_water',     'mung_bean', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_mung_bean_sweetness', 'mung_bean', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_mung_bean_box_count', 'mung_bean', 'box_count', '盒數', 'numeric', '盒', '{}', 3);

-- 小薏仁
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_barley_sugar',     'barley', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_barley_water',     'barley', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_barley_sweetness', 'barley', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_barley_box_count', 'barley', 'box_count', '盒數', 'numeric', '盒', '{}', 3);

-- === 製冰區 ===
-- 花生冰
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_peanut_ice_sugar',     'peanut_ice', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_peanut_ice_water',     'peanut_ice', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_peanut_ice_sweetness', 'peanut_ice', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_peanut_ice_box_count', 'peanut_ice', 'box_count', '盒數', 'numeric', '盒', '{}', 3),
  ('f_peanut_ice_milk',      'peanut_ice', 'milk',      '牛奶', 'numeric', 'ml', '{}', 4);

-- 芝麻冰
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_sesame_ice_sugar',     'sesame_ice', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_sesame_ice_water',     'sesame_ice', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_sesame_ice_sweetness', 'sesame_ice', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_sesame_ice_box_count', 'sesame_ice', 'box_count', '盒數', 'numeric', '盒', '{}', 3),
  ('f_sesame_ice_milk',      'sesame_ice', 'milk',      '牛奶', 'numeric', 'ml', '{}', 4);

-- 草莓冰
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_strawberry_ice_sugar',     'strawberry_ice', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_strawberry_ice_water',     'strawberry_ice', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_strawberry_ice_sweetness', 'strawberry_ice', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_strawberry_ice_box_count', 'strawberry_ice', 'box_count', '盒數', 'numeric', '盒', '{}', 3),
  ('f_strawberry_ice_milk',      'strawberry_ice', 'milk',      '牛奶', 'numeric', 'ml', '{}', 4);

-- === 糖水區 ===
-- 炒糖水
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_fried_syrup_sugar',     'fried_syrup', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_fried_syrup_water',     'fried_syrup', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_fried_syrup_sweetness', 'fried_syrup', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_fried_syrup_portion',   'fried_syrup', 'portion',   '份量', 'numeric', '份', '{}', 3);

-- 粉圓糖水
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_tapioca_syrup_sugar',     'tapioca_syrup', 'sugar',     '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_tapioca_syrup_water',     'tapioca_syrup', 'water',     '水',   'numeric', 'ml', '{}', 1),
  ('f_tapioca_syrup_sweetness', 'tapioca_syrup', 'sweetness', '甜度', 'numeric', '°',  '{}', 2),
  ('f_tapioca_syrup_portion',   'tapioca_syrup', 'portion',   '份量', 'numeric', '份', '{}', 3);

-- 蔗片糖水
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_sugarcane_syrup_sugar',        'sugarcane_syrup', 'sugar',        '糖',   'sugar_select', 'g',  '{}', 0),
  ('f_sugarcane_syrup_water',        'sugarcane_syrup', 'water',        '水',   'numeric', 'ml', '{}', 1),
  ('f_sugarcane_syrup_sweetness',    'sugarcane_syrup', 'sweetness',    '甜度', 'numeric', '°',  '{}', 2),
  ('f_sugarcane_syrup_bucket_count', 'sugarcane_syrup', 'bucket_count', '桶數', 'numeric', '桶', '{}', 3);

-- === 圓仔區 ===
-- 芋圓
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_taro_dumpling_water_ml',     'taro_dumpling', 'water_ml',    '加水量',     'numeric', 'ml', '{}',                     0),
  ('f_taro_dumpling_dough_state',  'taro_dumpling', 'dough_state', '麵團狀態',   'select',  '',   '{"偏軟","適中","偏硬"}', 1),
  ('f_taro_dumpling_bag_count',    'taro_dumpling', 'bag_count',   '包裝袋數',   'numeric', '包', '{}',                     2);

-- 白玉
INSERT INTO production_field_defs (id, item_id, field_key, label, field_type, unit, options, sort_order) VALUES
  ('f_white_ball_water_ml',    'white_ball', 'water_ml',    '加水量',     'numeric', 'ml', '{}',                     0),
  ('f_white_ball_dough_state', 'white_ball', 'dough_state', '麵團狀態',   'select',  '',   '{"偏軟","適中","偏硬"}', 1),
  ('f_white_ball_bag_count',   'white_ball', 'bag_count',   '包裝袋數',   'numeric', '包', '{}',                     2);

-- ============================================================
-- Seed: 5 種初始糖
-- ============================================================
INSERT INTO sugar_types (id, name, sort_order) VALUES
  ('sugar_ersha',    '二砂',             0),
  ('sugar_white',    '精製特砂(白砂)',    1),
  ('sugar_brown',    '大PS紅糖(黑糖)',    2),
  ('sugar_rock',     '冰糖',             3),
  ('sugar_cane',     '甘蔗原汁',         4);
