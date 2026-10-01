-- 叫貨品項 → 成品配方 對應（僅用於顯示「配方原料成本」參考值，一鍵套用到 our_cost；不自動覆寫）
-- 方向：品項綁配方 × 克數（一個配方可對應多個品項，如花生冰淇淋 盒/杯）
-- recipe_grams = 此品項 1 個叫貨單位含多少克配方成品（盒=1600、杯=380；以克計價的品項填 1）
-- 註：recipes.store_product_id（1:1，從未使用）由本設計取代，待清理
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS recipe_id TEXT DEFAULT NULL REFERENCES recipes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipe_grams NUMERIC(10,1) DEFAULT NULL CHECK (recipe_grams IS NULL OR recipe_grams > 0);

NOTIFY pgrst, 'reload schema';
