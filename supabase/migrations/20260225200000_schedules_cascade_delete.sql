-- 修改 schedules.staff_id FK 為 ON DELETE CASCADE
-- 刪除人員時自動清除該人的排班記錄
ALTER TABLE schedules
  DROP CONSTRAINT IF EXISTS schedules_staff_id_fkey,
  ADD CONSTRAINT schedules_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
