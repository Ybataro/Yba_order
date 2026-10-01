-- 階段 A（部署前端「之前」跑）：recipe_grams 改名 unit_grams（配方/原物料共用，舊名不準）
-- 先新增並複製，保留舊欄位 → 舊前端在部署空窗期仍可正常存檔
BEGIN;
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS unit_grams NUMERIC(10,1) DEFAULT NULL CHECK (unit_grams IS NULL OR unit_grams > 0);
UPDATE store_products SET unit_grams = recipe_grams WHERE recipe_grams IS NOT NULL;
NOTIFY pgrst, 'reload schema';
COMMIT;
