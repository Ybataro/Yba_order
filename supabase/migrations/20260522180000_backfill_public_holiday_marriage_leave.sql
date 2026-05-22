-- ============================================================
-- 國定假日 + 婚假 leave_balances backfill（2026-05-22）
--
-- 背景：2026-05-21 在 TRACKED_LEAVE_TYPES 新增 'public_holiday'(11)+'marriage_leave'(8)
--      但 useLeaveBalance.ts 的「自動補建」只在員工首次打開請假頁時觸發
--      → 沒打開的員工 admin「假別餘額」頁看不到此 2 假別
--
-- 修法：一次性 backfill 所有現有員工的 2026 年國定假日 + 婚假 balance
--      已有的不動（NOT EXISTS 保護）
-- ============================================================

INSERT INTO public.leave_balances (staff_id, leave_type, year, total_days, used_days)
SELECT s.id, lt.id, 2026, lt.days, 0
FROM public.staff s
CROSS JOIN (VALUES
  ('public_holiday'::text, 11.0::numeric(4,1)),
  ('marriage_leave'::text, 8.0::numeric(4,1))
) AS lt(id, days)
WHERE NOT EXISTS (
  SELECT 1 FROM public.leave_balances b
  WHERE b.staff_id = s.id
    AND b.leave_type = lt.id
    AND b.year = 2026
);
