CREATE TABLE frozen_product_defs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  spec TEXT NOT NULL,
  price INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE frozen_product_defs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "frozen_product_defs_all" ON frozen_product_defs FOR ALL USING (true);

-- Seed initial data
INSERT INTO frozen_product_defs (id, name, spec, price, sort_order) VALUES
  ('taro_ball',       '芋圓',       '包 300g',    135, 0),
  ('white_ball',      '白玉',       '包 300g',    135, 1),
  ('peanut_ice',      '花生冰淇淋', '杯',         235, 2),
  ('sesame_ice',      '芝麻冰淇淋', '杯',         235, 3),
  ('strawberry_ice',  '草莓冰淇淋', '杯',         280, 4),
  ('almond_tea_300',  '杏仁茶',     '袋 300g',    65,  5),
  ('almond_tea_1000', '杏仁茶',     '袋 1000g',   180, 6);
