-- 央廚即時庫存：品項定義
CREATE TABLE IF NOT EXISTS kitchen_realtime_items (
  id TEXT PRIMARY KEY DEFAULT 'kri_' || substr(md5(random()::text), 1, 8),
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT '袋',
  sort_order INT NOT NULL DEFAULT 0,
  -- 對應出貨品項 product_id（可多個，JSON 陣列）
  shipment_product_ids TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kitchen_realtime_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kitchen_realtime_items_all" ON kitchen_realtime_items FOR ALL USING (true) WITH CHECK (true);

-- 央廚即時庫存：每日追蹤（補貨 + 剩餘快照）
CREATE TABLE IF NOT EXISTS kitchen_realtime_tracker (
  id TEXT PRIMARY KEY DEFAULT 'krt_' || substr(md5(random()::text), 1, 8),
  date DATE NOT NULL,
  item_key TEXT NOT NULL REFERENCES kitchen_realtime_items(id) ON DELETE CASCADE,
  restock_qty NUMERIC NOT NULL DEFAULT 0,
  remaining_qty NUMERIC NOT NULL DEFAULT 0,
  submitted_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, item_key)
);

ALTER TABLE kitchen_realtime_tracker ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kitchen_realtime_tracker_all" ON kitchen_realtime_tracker FOR ALL USING (true) WITH CHECK (true);

-- 種子資料
INSERT INTO kitchen_realtime_items (id, name, unit, sort_order, shipment_product_ids) VALUES
  ('kri_doujiang_douhua', '無糖豆漿(豆花用)', '袋', 1, '{}'),
  ('kri_doujiang_wutang', '無糖豆漿',         '袋', 2, '{p020}'),
  ('kri_doujiang_weitang', '微糖豆漿',        '袋', 3, '{p019}'),
  ('kri_zhepian',         '蔗片冰',           '袋', 4, '{p029}'),
  ('kri_xianru',          '鮮奶',             '瓶', 5, '{p017}'),
  ('kri_zimi_05',         '紫米紅豆料(0.5桶)', '份', 6, '{p030}'),
  ('kri_zimi_1',          '紫米紅豆料(1桶)',   '份', 7, '{p031}')
ON CONFLICT (id) DO NOTHING;
