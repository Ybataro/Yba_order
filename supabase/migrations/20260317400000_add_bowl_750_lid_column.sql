-- 新增 750 蓋欄位到 order_sessions
ALTER TABLE order_sessions ADD COLUMN IF NOT EXISTS bowl_750_lid TEXT DEFAULT '';

-- 更新 kri_bowl_750_lid 的 deduction 改用獨立欄位 bowl_750_lid
UPDATE kitchen_realtime_items
SET shipment_deductions = '[{"type":"order_note","field":"bowl_750_lid","ratio":1}]'
WHERE id = 'kri_bowl_750_lid';
