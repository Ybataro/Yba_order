-- 央廚回覆欄位（收貨差異回饋）
ALTER TABLE shipment_sessions ADD COLUMN kitchen_reply TEXT DEFAULT '';
ALTER TABLE shipment_sessions ADD COLUMN kitchen_reply_at TIMESTAMPTZ;
ALTER TABLE shipment_sessions ADD COLUMN kitchen_reply_by TEXT DEFAULT '';
