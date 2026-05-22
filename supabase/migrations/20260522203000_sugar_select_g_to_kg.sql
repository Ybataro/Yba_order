-- ============================================================
-- 補修：sugar_select 欄位 JSON 內部數值 g → kg 遷移（2026-05-22）
--
-- 背景：前一次 migration（20260522200000）只處理「純數字字串」field_value
--      但 sugar_select 欄位的 field_value 是 JSON：{"白砂":600,"冰糖":250}
--      這些 JSON 內的數字沒被 ×0.001 → UI 改 kg 後仍顯示 g 數字（如 595kg、150kg）
--
-- 修法：用 jsonb 操作遍歷每個 key/value，把 value ÷ 1000，trim_scale 整理小數位
-- ============================================================

BEGIN;

-- 對所有 sugar_select 欄位的 JSON value 做 ÷1000
WITH sugar_field_keys AS (
  SELECT DISTINCT field_key FROM production_field_defs WHERE field_type = 'sugar_select'
),
-- 解開 JSON 後重新組合（每個 value ÷1000）
recomputed AS (
  SELECT
    pli.id,
    jsonb_object_agg(
      kv.key,
      trim_scale((kv.value::text::numeric) / 1000.0)::text::numeric
    )::text AS new_value
  FROM public.production_log_items pli
  JOIN sugar_field_keys s ON s.field_key = pli.field_key
  CROSS JOIN LATERAL jsonb_each(pli.field_value::jsonb) AS kv(key, value)
  WHERE pli.field_value LIKE '{%}'  -- 只動 JSON 格式
    AND pli.field_value::jsonb IS NOT NULL
  GROUP BY pli.id
)
UPDATE public.production_log_items pli
SET field_value = r.new_value
FROM recomputed r
WHERE pli.id = r.id;

-- 驗證：抽樣看是否轉成功
DO $$
DECLARE
  sample_value text;
BEGIN
  SELECT field_value INTO sample_value
  FROM production_log_items pli
  JOIN production_field_defs pfd ON pfd.field_key = pli.field_key
  WHERE pfd.field_type = 'sugar_select'
    AND pli.field_value LIKE '{%}'
  LIMIT 1;
  RAISE NOTICE 'Sample after migration: %', sample_value;
END $$;

COMMIT;
