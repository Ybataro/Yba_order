-- 將 shipment_product_ids (TEXT[]) 改為 shipment_deductions (JSONB)
-- 支援帶換算比例的扣除：[{"product_id":"p021","ratio":4},{"product_id":"p022","ratio":4}]
-- ratio 意義：出貨 1 單位該品項 → 扣 ratio 單位即時庫存品項

-- 1. 新增 JSONB 欄位
ALTER TABLE kitchen_realtime_items ADD COLUMN IF NOT EXISTS shipment_deductions JSONB NOT NULL DEFAULT '[]';

-- 2. 遷移舊資料：將 TEXT[] 轉成 JSONB（ratio 預設 1）
UPDATE kitchen_realtime_items
SET shipment_deductions = (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', pid, 'ratio', 1)), '[]'::jsonb)
  FROM unnest(shipment_product_ids) AS pid
)
WHERE array_length(shipment_product_ids, 1) > 0;

-- 3. 移除舊欄位
ALTER TABLE kitchen_realtime_items DROP COLUMN IF EXISTS shipment_product_ids;

-- 4. 更新豆花用豆漿：勾選豆花(冷) p021 ratio 4 + 豆花(熱) p022 ratio 4
UPDATE kitchen_realtime_items
SET shipment_deductions = '[{"product_id":"p021","ratio":4},{"product_id":"p022","ratio":4}]'::jsonb
WHERE id = 'kri_doujiang_douhua';
