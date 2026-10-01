-- 階段 B（新前端部署「之後」、確認 unit_grams 與 recipe_grams 一致才跑）
-- 1) store_products.recipe_grams：已由 unit_grams 取代
-- 2) recipes.store_product_id：1:1 綁定設計從未使用（UI 不曾設定），由 store_products.recipe_id 取代
BEGIN;
DO $$
BEGIN
  -- 新前端只寫 unit_grams，兩欄不同屬正常；只擋「舊前端在空窗期新建對應，值只進了 recipe_grams」
  IF EXISTS (SELECT 1 FROM store_products WHERE recipe_grams IS NOT NULL AND unit_grams IS NULL) THEN
    RAISE EXCEPTION '有 recipe_grams 未複製到 unit_grams（空窗期舊前端存檔），停止';
  END IF;
  IF EXISTS (SELECT 1 FROM recipes WHERE store_product_id IS NOT NULL) THEN
    RAISE EXCEPTION 'recipes.store_product_id 有非空值，停止';
  END IF;
END $$;
ALTER TABLE store_products DROP COLUMN recipe_grams;
ALTER TABLE recipes DROP COLUMN store_product_id;
NOTIFY pgrst, 'reload schema';
COMMIT;
