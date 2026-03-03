-- 確保 shipment_items 有 (session_id, product_id) 唯一約束
-- 支援 upsert 安全模式（避免 DELETE+INSERT 導致打勾狀態遺失）
ALTER TABLE shipment_items
  DROP CONSTRAINT IF EXISTS shipment_items_session_product_unique;

ALTER TABLE shipment_items
  ADD CONSTRAINT shipment_items_session_product_unique
  UNIQUE (session_id, product_id);
