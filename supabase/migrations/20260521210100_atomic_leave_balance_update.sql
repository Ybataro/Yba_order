-- ============================================================
-- 假別餘額原子化（2026-05-21）
--
-- 目的：取代 application code 的「讀 leave_balances → +days → 寫」兩步操作
-- 解決：兩個 admin 同時核准同一員工的假單時可能超扣（讀到舊的 used_days）
--
-- 用法（application）：
--   const { error } = await supabase.rpc('increment_leave_used', {
--     p_staff_id: 'staff_xxx',
--     p_leave_type: 'sick_leave',
--     p_year: 2026,
--     p_days: 0.5,
--     p_default_days: 30,
--   })
--
-- 行為：
--   - 若該 (staff_id, leave_type, year) 已有記錄：UPDATE used_days = used_days + p_days
--   - 若無記錄：INSERT (total_days = p_default_days, used_days = p_days)
--   - 全程在單一 statement 完成（PostgreSQL 對單 statement 自動 atomic）
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_leave_used(
  p_staff_id     TEXT,
  p_leave_type   TEXT,
  p_year         INTEGER,
  p_days         NUMERIC(4,1),
  p_default_days NUMERIC(4,1) DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.leave_balances (staff_id, leave_type, year, total_days, used_days)
  VALUES (p_staff_id, p_leave_type, p_year, p_default_days, p_days)
  ON CONFLICT (staff_id, leave_type, year)
  DO UPDATE SET used_days = public.leave_balances.used_days + EXCLUDED.used_days;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_leave_used(TEXT, TEXT, INTEGER, NUMERIC, NUMERIC)
  TO anon, authenticated;

-- ── 相應的「回滾」版本（給 remove 函數用）────────────────
-- 注意：used_days 不能變負數（Math.max(0, ...) 邏輯保留在 SQL 內）

CREATE OR REPLACE FUNCTION public.decrement_leave_used(
  p_staff_id   TEXT,
  p_leave_type TEXT,
  p_year       INTEGER,
  p_days       NUMERIC(4,1)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.leave_balances
  SET used_days = GREATEST(0, used_days - p_days)
  WHERE staff_id = p_staff_id
    AND leave_type = p_leave_type
    AND year = p_year;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_leave_used(TEXT, TEXT, INTEGER, NUMERIC)
  TO anon, authenticated;
