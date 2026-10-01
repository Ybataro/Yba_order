-- 原物料改「停用」取代刪除：停用後不出現在盤點/叫貨/配方等選單，歷史紀錄（叫貨、盤點、配方）保留
-- 慣例同 staff.is_active（20260608140000）
ALTER TABLE raw_materials ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

NOTIFY pgrst, 'reload schema';
