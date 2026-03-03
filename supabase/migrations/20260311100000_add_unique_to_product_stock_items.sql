-- 確保 product_stock_items 有 (session_id, product_id) 唯一約束
-- 支援 upsert 安全模式（避免 DELETE+INSERT 導致資料遺失）
ALTER TABLE product_stock_items
  DROP CONSTRAINT IF EXISTS product_stock_items_session_product_unique;

ALTER TABLE product_stock_items
  ADD CONSTRAINT product_stock_items_session_product_unique
  UNIQUE (session_id, product_id);
