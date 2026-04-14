-- Step 1a: 請假系統 V2 — 員工 Telegram ID
-- 用途：主管核准/駁回後通知員工本人；主管設定時從 PinManager 寫入
-- 不影響任何現有功能，純加欄位

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS telegram_id TEXT DEFAULT NULL;

COMMENT ON COLUMN staff.telegram_id IS '員工 Telegram Chat ID，用於請假結果通知。從 PinManager 假單主管 Tab 設定時同步寫入。';
