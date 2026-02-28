-- 排班記錄增加獨立標籤欄位
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
