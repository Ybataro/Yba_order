-- 成品配方新增分類欄位
ALTER TABLE recipes ADD COLUMN category TEXT DEFAULT '未分類';
