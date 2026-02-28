-- 員工固定週休日 + 預設班次
ALTER TABLE staff ADD COLUMN rest_days INT[] DEFAULT '{}';
ALTER TABLE staff ADD COLUMN default_shift_type_id TEXT;
