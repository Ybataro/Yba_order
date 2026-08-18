-- 公司貸款/負債表（2026-08-18）
-- 用途：盈餘統計「總覽」tab 扣除貸款月繳，得出可支配現金
-- 層級：公司層級，不分店（各店 P&L 不受影響）

CREATE TABLE IF NOT EXISTS loans (
  id                TEXT PRIMARY KEY,
  bank              TEXT NOT NULL,              -- 貸款銀行（台新/玉山）
  name              TEXT NOT NULL,              -- 名稱（福祥路154號房貸）
  total_amount      BIGINT NOT NULL DEFAULT 0,  -- 貸款總金額
  rate              NUMERIC,                    -- 利率（0.0249 = 2.49%）
  periods           INTEGER,                    -- 期數（月）
  remaining_amount  BIGINT NOT NULL DEFAULT 0,  -- 剩餘貸款總額（快照）
  remaining_as_of   TEXT NOT NULL,              -- 快照基準月 YYYY-MM
  monthly_principal BIGINT NOT NULL DEFAULT 0,  -- 月繳本金費用
  monthly_interest  BIGINT NOT NULL DEFAULT 0,  -- 月繳利息費用
  is_active         BOOLEAN NOT NULL DEFAULT true,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  note              TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_all_loans ON loans;
CREATE POLICY anon_all_loans ON loans FOR ALL USING (true) WITH CHECK (true);

-- 初始 5 筆（依 2026-08 明細表）
INSERT INTO loans (id, bank, name, total_amount, rate, periods, remaining_amount, remaining_as_of, monthly_principal, monthly_interest, sort_order) VALUES
  ('loan_1', '台新', '福祥路154號房貸',      6880000, 0.0249, 240,  5032641, '2026-08', 25408, 10643, 1),
  ('loan_2', '台新', '福祥路154號房貸增貸',  1450000, 0.0347, 240,  1319444, '2026-08',  5147,  3889, 2),
  ('loan_3', '台新', '阿爸芋圓信貸',         1600000, NULL,    60,  1197395, '2026-08', 24776,  6530, 3),
  ('loan_4', '台新', '阿爸芋圓信貸',         4000000, NULL,    60,  2807009, '2026-08', 62931, 15333, 4),
  ('loan_5', '玉山', '中正路1194巷央廚房貸', 17200000, 0.0226, 240, 16241865, '2026-08', 71179, 30589, 5)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
