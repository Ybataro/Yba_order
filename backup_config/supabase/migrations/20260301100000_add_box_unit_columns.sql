-- 箱規雙單位：新增 box_unit / box_ratio 欄位
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS box_unit TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS box_ratio INTEGER DEFAULT NULL;

ALTER TABLE raw_materials
  ADD COLUMN IF NOT EXISTS box_unit TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS box_ratio INTEGER DEFAULT NULL;

-- 門店品項初始資料
UPDATE store_products SET box_unit='箱', box_ratio=6  WHERE id='p013';
UPDATE store_products SET box_unit='箱', box_ratio=25 WHERE id='p016';

-- 原物料（已是小單位）
UPDATE raw_materials SET box_unit='箱', box_ratio=8  WHERE id='m009';
UPDATE raw_materials SET box_unit='箱', box_ratio=12 WHERE id='m029';

-- 原物料（改 unit 為小單位，不遷移歷史數據）
UPDATE raw_materials SET unit='包', box_unit='袋', box_ratio=10 WHERE id='m007';
UPDATE raw_materials SET unit='瓶', box_unit='箱', box_ratio=6  WHERE id='m020';
UPDATE raw_materials SET unit='瓶', box_unit='箱', box_ratio=6  WHERE id='m026';
UPDATE raw_materials SET unit='瓶', box_unit='箱', box_ratio=20 WHERE id='m028';
