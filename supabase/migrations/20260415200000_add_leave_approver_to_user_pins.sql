-- Step 1b: 請假系統 V2 — 主管設定欄位加入 user_pins
-- 三個欄位各自獨立，不影響現有 can_schedule / allowed_pages / can_popup 邏輯

ALTER TABLE user_pins
  ADD COLUMN IF NOT EXISTS is_leave_approver   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_approver_scope TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS leave_approver_order INTEGER DEFAULT 1;

-- leave_approver_scope 合法值：'kitchen' | 'lehua' | 'xingnan'
--   對應 staff.group_id，表示此主管負責哪個群組的請假審核
-- leave_approver_order：1 = 第一主管（收到 pending），2 = 第二主管（收到 approver1_approved）
--   同一 scope 必須設滿 1+2 兩人才啟用雙簽；若只有 1 人則擋住送假，提示需設定兩位主管

COMMENT ON COLUMN user_pins.is_leave_approver   IS '是否為請假審核主管';
COMMENT ON COLUMN user_pins.leave_approver_scope IS '負責審核的群組：kitchen | lehua | xingnan';
COMMENT ON COLUMN user_pins.leave_approver_order IS '簽核順序：1=第一主管 2=第二主管';
