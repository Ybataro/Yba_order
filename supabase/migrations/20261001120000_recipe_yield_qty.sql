-- 成品配方：一批原料產出幾單位（例：原料合計做出 3 盒）
-- 每單位成本 = 原料合計 ÷ yield_qty；每克成本 = 原料合計 ÷ (total_weight_g × yield_qty)
-- 預設 1 = 舊行為不變
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS yield_qty NUMERIC(10,2) NOT NULL DEFAULT 1
  CHECK (yield_qty > 0);

NOTIFY pgrst, 'reload schema';
