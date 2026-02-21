-- daily_expenses
CREATE TABLE daily_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  date DATE NOT NULL,
  item_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  submitted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE daily_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_daily_expenses" ON daily_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_daily_expenses_store_date ON daily_expenses(store_id, date);

-- expense_categories
CREATE TABLE expense_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  store_id TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER DEFAULT 0,
  is_auto BOOLEAN DEFAULT false,
  auto_field TEXT,
  auto_rate NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_expense_categories" ON expense_categories FOR ALL USING (true) WITH CHECK (true);

-- monthly_expenses
CREATE TABLE monthly_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL,
  year_month TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES expense_categories(id),
  amount INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(store_id, year_month, category_id)
);
ALTER TABLE monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_monthly_expenses" ON monthly_expenses FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_monthly_expenses_store_month ON monthly_expenses(store_id, year_month);

-- Seed: 門店費用類別
INSERT INTO expense_categories (id, label, store_id, sort_order, is_auto, auto_field, auto_rate) VALUES
('s_biz_tax',      '營業稅',            'store', 1,  true,  'posTotal',      0.05),
('s_uber_fee',     'Uber平台抽成',      'store', 2,  true,  'uberFee',       0.30),
('s_panda_fee',    'foodpanda平台抽成',  'store', 3,  true,  'pandaFee',      0.28),
('s_linepay_fee',  'Line Pay手續費',    'store', 4,  true,  'linePay',       0.022),
('s_material_cost','叫料成本',           'store', 5,  true,  'orderCost',     null),
('s_labor',        '人事成本',           'store', 10, false, null, null),
('s_insurance',    '勞健保費用',         'store', 11, false, null, null),
('s_rent',         '房租',               'store', 12, false, null, null),
('s_electricity',  '電費',               'store', 13, false, null, null),
('s_telecom',      '電信費',             'store', 14, false, null, null),
('s_gas',          '瓦斯費',             'store', 15, false, null, null),
('s_accounting',   '會計費',             'store', 16, false, null, null),
('s_water',        '台北自來水',         'store', 17, false, null, null),
('s_cups_bowls',   '杯碗',               'store', 18, false, null, null),
('s_daily_misc',   '雜費',               'store', 19, true,  'dailyExpense',  null);

-- Seed: 央廚費用類別
INSERT INTO expense_categories (id, label, store_id, sort_order, is_auto, auto_field, auto_rate) VALUES
('k_labor',        '人事成本',           'kitchen', 1,  false, null, null),
('k_rent',         '房租',               'kitchen', 2,  false, null, null),
('k_elec_1f',      '電費 1F 單相',      'kitchen', 3,  false, null, null),
('k_elec_2f',      '電費 2F 三相',      'kitchen', 4,  false, null, null),
('k_water',        '水費',               'kitchen', 5,  false, null, null),
('k_gas',          '瓦斯費',             'kitchen', 6,  false, null, null),
('k_broadband',    '大大寬頻',           'kitchen', 7,  false, null, null),
('k_truck',        '貨車分期',           'kitchen', 8,  false, null, null),
('k_daily_misc',   '雜費',               'kitchen', 9,  true,  'dailyExpense',  null);
