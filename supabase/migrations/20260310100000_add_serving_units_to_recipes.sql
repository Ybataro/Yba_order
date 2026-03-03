-- 成品配方新增「份量單位」定義
-- 格式：[{ "label": "1匙", "grams": 30 }, ...]
ALTER TABLE recipes ADD COLUMN serving_units JSONB DEFAULT '[]';
