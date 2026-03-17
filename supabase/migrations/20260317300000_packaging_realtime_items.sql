-- 包材類移至即時庫存區
-- deduction type: order_note → 從 order_sessions 備註欄位扣除（各店合計）

INSERT INTO kitchen_realtime_items (id, name, unit, sort_order, shipment_deductions, is_active) VALUES
('kri_bowl_k520',    '520(碗)',          '箱', 10, '[{"type":"order_note","field":"bowl_k520","ratio":1}]', true),
('kri_bowl_750',     '750(碗)',          '箱', 11, '[{"type":"order_note","field":"bowl_750","ratio":1}]', true),
('kri_bowl_750_lid', '750(蓋)',          '箱', 12, '[{"type":"order_note","field":"bowl_750","ratio":1}]', true),
('kri_almond_1000',  '杏仁茶瓶 1000ml', '瓶', 13, '[{"type":"order_note","field":"almond_1000","ratio":1}]', true),
('kri_almond_300',   '杏仁茶瓶 300ml',  '瓶', 14, '[{"type":"order_note","field":"almond_300","ratio":1}]', true);
