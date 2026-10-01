-- 叫貨品項 → 央廚原物料 對應（如門店「鮮奶」= 原物料「鮮奶」× 936g）
-- 價格只維護在 raw_materials.purchase_price；叫貨價格統計顯示「原料$X」一鍵套用到 our_cost（不自動覆寫）
-- recipe_grams 沿用為「1 個叫貨單位含多少克」，配方或原料共用（不改名：避免與已上線前端不相容）
-- 配方與原料二擇一
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS material_id TEXT DEFAULT NULL REFERENCES raw_materials(id) ON DELETE SET NULL;

ALTER TABLE store_products
  ADD CONSTRAINT store_products_cost_source_one CHECK (recipe_id IS NULL OR material_id IS NULL);

NOTIFY pgrst, 'reload schema';
