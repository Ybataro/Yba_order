-- ============================================================
-- 生產記錄全面 g → kg 遷移（2026-05-22）
--
-- 背景：生產記錄欄位（production_field_defs）與糖種（sugar_types）
--      原本以 g 為單位，數字過大不直觀（例：冰塊 60000g）
--      業務決定全面改為 kg：60000g → 60kg
--
-- 安全性分析（2026-05-22 驗證）：
--   ProductionStats.tsx 所有統計都是「比例性計算」（simpleAvg, simpleMin/Max,
--   unitAvg = Σv/q, weightedAvg = Σv/Σq），分子分母同 ×0.001 結果不變
--   因此資料 ×0.001 + unit 改 kg 是數學等價，不破壞統計
--
-- 順手清理：將既有 Kg(大寫) 與 kg(小寫) 統一為小寫 kg（SI 標準）
--
-- 範圍：
--   1) production_log_items.field_value × 0.001（只動 g 單位欄位的純數字）
--   2) production_field_defs.unit: 'g' → 'kg' / 'Kg' → 'kg'
--   3) sugar_types.unit: 'g' → 'kg'
-- ============================================================

-- 安全檢查：必須在 transaction 內，任一步失敗全部回滾
BEGIN;

-- ── 1. 把 production_log_items 內 g 單位欄位的值 × 0.001 ──
-- 只動「純數字字串」且 > 0 的，避免破壞非數字資料
-- 用 trim_scale 移除 numeric 除法的尾隨 0（避免「10.0000000000000000」這種顯示）
WITH g_field_keys AS (
  SELECT DISTINCT field_key FROM production_field_defs WHERE unit = 'g'
)
UPDATE public.production_log_items
SET field_value = trim_scale((field_value::numeric) / 1000.0)::text
WHERE field_key IN (SELECT field_key FROM g_field_keys)
  AND field_value ~ '^[0-9]+(\.[0-9]+)?$'
  AND field_value::numeric > 0;

-- ── 2. production_field_defs.unit: 'g' → 'kg' ──
UPDATE public.production_field_defs SET unit = 'kg' WHERE unit = 'g';

-- ── 3. production_field_defs.unit: 'Kg' → 'kg'（順手統一） ──
UPDATE public.production_field_defs SET unit = 'kg' WHERE unit = 'Kg';

-- ── 4. sugar_types.unit: 'g' → 'kg' ──
UPDATE public.sugar_types SET unit = 'kg' WHERE unit = 'g';

-- ── 驗證：應該沒有任何 g 殘留 ──
DO $$
DECLARE
  g_field_count INT;
  g_sugar_count INT;
BEGIN
  SELECT count(*) INTO g_field_count FROM production_field_defs WHERE unit = 'g' OR unit = 'Kg';
  SELECT count(*) INTO g_sugar_count FROM sugar_types WHERE unit = 'g';
  IF g_field_count > 0 OR g_sugar_count > 0 THEN
    RAISE EXCEPTION '殘留: production_field_defs g=%, sugar_types g=%', g_field_count, g_sugar_count;
  END IF;
END $$;

COMMIT;
