-- 兩階段請假審核：員工 → 主管審核 → 後台最終審核
-- 新增主管審核欄位
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manager_reviewed_by TEXT;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS manager_reviewed_at TIMESTAMPTZ;

-- 將各店 Telegram 通知對象存入 app_settings（JSON array）
-- 格式: [{"name":"伊偲","chat_id":"7250361245"}, ...]
INSERT INTO app_settings (key, value) VALUES
  ('leave_notify_lehua',   '[{"name":"伊偲","chat_id":"7250361245"}]'),
  ('leave_notify_xingnan', '[{"name":"阿佑","chat_id":"7855426610"}]'),
  ('leave_notify_kitchen', '[]'),
  ('leave_notify_admin',   '[{"name":"管理者","chat_id":"7920645981"},{"name":"老闆娘","chat_id":"8515675347"}]')
ON CONFLICT (key) DO NOTHING;
