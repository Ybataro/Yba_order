-- 2026-05-23：費率歷史版本 + 月度覆寫
-- 動機：
--   1. 7月 Uber 抽成可能從 30% 漲到 32%，需要「下個月起生效」而不影響歷史月份
--   2. 會計師繳費單可能跟系統算的 5% 營業稅略有差異，每月可手動覆寫

-- ============================================================
-- 1. 費率歷史表（按月份生效）
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_rate_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id text NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  -- 生效起始月份（含），格式 'YYYY-MM'
  -- 例如 '2026-07' 表示從 2026 年 7 月開始用這個費率
  effective_from text NOT NULL,
  rate           numeric NOT NULL,
  note           text DEFAULT '',
  created_at     timestamp with time zone DEFAULT now(),
  UNIQUE (category_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_expense_rate_history_category
  ON expense_rate_history (category_id, effective_from DESC);

ALTER TABLE expense_rate_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_expense_rate_history" ON expense_rate_history;
CREATE POLICY "anon_all_expense_rate_history" ON expense_rate_history
  USING (true) WITH CHECK (true);

-- 把現有 expense_categories.auto_rate 灌入 history 作為起始版本
-- effective_from 用 '2024-01' 表示「一直以來就是這個費率」
INSERT INTO expense_rate_history (category_id, effective_from, rate, note)
SELECT id, '2024-01', auto_rate, '系統初始費率'
FROM expense_categories
WHERE is_auto = true AND auto_rate IS NOT NULL
ON CONFLICT (category_id, effective_from) DO NOTHING;

-- ============================================================
-- 2. monthly_expenses 加 override_amount 欄
-- ============================================================
-- 用途：自動計算費用（如營業稅、Uber 抽成）每月可手動覆寫實際金額
-- - override_amount IS NULL → 用 auto_rate × raw 計算
-- - override_amount IS NOT NULL → 用手動值
-- 對手動類別（如人事成本）也可寫入 amount（保持向後相容）
ALTER TABLE monthly_expenses
  ADD COLUMN IF NOT EXISTS override_amount integer;

COMMENT ON COLUMN monthly_expenses.override_amount IS
  '自動類別的覆寫值（NULL=用 auto_rate 計算，有值=用此手動值）';

-- ============================================================
-- 3. 查詢函式：取「指定月份」對應的有效費率
-- ============================================================
-- 用法：SELECT get_effective_rate('s_uber_fee', '2026-07');
CREATE OR REPLACE FUNCTION get_effective_rate(
  p_category_id text,
  p_year_month  text
) RETURNS numeric AS $$
DECLARE
  v_rate numeric;
BEGIN
  SELECT rate INTO v_rate
  FROM expense_rate_history
  WHERE category_id = p_category_id
    AND effective_from <= p_year_month
  ORDER BY effective_from DESC
  LIMIT 1;

  -- 若 history 沒記錄，fallback 到 expense_categories.auto_rate
  IF v_rate IS NULL THEN
    SELECT auto_rate INTO v_rate
    FROM expense_categories
    WHERE id = p_category_id;
  END IF;

  RETURN v_rate;
END;
$$ LANGUAGE plpgsql STABLE;
