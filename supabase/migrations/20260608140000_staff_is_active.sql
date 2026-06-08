-- staff 加 is_active 欄位，用於標記離職員工從登入畫面隱藏
-- 設計：default true 保證 32 名既有員工不受影響
-- 業務語意：is_active=false 代表離職，登入畫面不顯示；其他歷史資料（排班/出貨/請假）保留
-- 配套：PinManager「停用」狀態下提供「設為離職」按鈕，同步寫 staff.is_active=false

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_staff_is_active ON staff(is_active) WHERE is_active = true;

-- 通知 PostgREST reload schema cache，否則 REST API 會回 PGRST204 找不到新欄位
NOTIFY pgrst, 'reload schema';
