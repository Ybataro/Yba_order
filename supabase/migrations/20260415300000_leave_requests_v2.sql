-- Step 1c: 請假系統 V2 — leave_requests 新欄位
-- 原則：所有欄位皆用 ADD COLUMN IF NOT EXISTS + DEFAULT，不動現有欄位
-- 舊欄位 manager_reviewed_by / manager_reviewed_at 保留（舊資料相容）

-- ── 代理人（必填，文字輸入）────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS proxy_name TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN leave_requests.proxy_name IS '代理人姓名，送假時必填，文字自由輸入';

-- ── 其他假別自填 ────────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS other_leave_type_name TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN leave_requests.other_leave_type_name IS '假別選「其他」時必填：實際假別名稱（如：陪產假）';

-- ── 病假照片補傳狀態 ─────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS photo_submitted BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN leave_requests.photo_submitted IS '病假診斷書是否已上傳（透過 Telegram 傳給主管）。false=尚未補傳，true=已補傳';

-- ── 第一主管簽核 ─────────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS approver1_id   TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approver1_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approver1_note TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN leave_requests.approver1_id   IS '第一主管 staff_id';
COMMENT ON COLUMN leave_requests.approver1_at   IS '第一主管簽核時間';
COMMENT ON COLUMN leave_requests.approver1_note IS '第一主管核准備注（必填）';

-- ── 第二主管簽核 ─────────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS approver2_id   TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approver2_at   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS approver2_note TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN leave_requests.approver2_id   IS '第二主管 staff_id';
COMMENT ON COLUMN leave_requests.approver2_at   IS '第二主管簽核時間';
COMMENT ON COLUMN leave_requests.approver2_note IS '第二主管核准備注（必填）';

-- ── 後台最終核准備注 ──────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS admin_approve_note TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN leave_requests.admin_approve_note IS 'Admin 最終核准備注（必填）';

-- ── 駁回人統一記錄 ──────────────────────────────────────
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS rejected_by TEXT        DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN leave_requests.rejected_by IS '駁回者 staff_id（任一關駁回皆記錄）';
COMMENT ON COLUMN leave_requests.rejected_at IS '駁回時間';

-- ── status 完整狀態機說明（無 CHECK CONSTRAINT，用應用層控制）──
-- pending              → 員工已送出，等第一主管審核
-- approver1_approved   → 第一主管已核准，等第二主管審核
-- manager_approved     → 雙主管都已核准，等 admin 最終審核
-- approved             → 完全核准，已寫入排班表 + 扣假別餘額
-- rejected             → 任一關駁回（rejected_by 記錄駁回者）
-- （員工可在 rejected 狀態修改後重送，清除所有簽核欄位 → 回到 pending）

-- ── Index：加速主管查詢待審核清單 ────────────────────────
CREATE INDEX IF NOT EXISTS idx_leave_requests_status_staff
  ON leave_requests(status, staff_id);
