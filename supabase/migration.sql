-- ============================================
-- Yba Order - Supabase Migration
-- ============================================

-- 1. 門店
create table stores (
  id text primary key,
  name text not null,
  code text not null,
  sort_order int default 0
);

-- 2. 門店品項
create table store_products (
  id text primary key,
  name text not null,
  category text not null,
  unit text not null,
  shelf_life_days text,
  base_stock text,
  sort_order int default 0
);

-- 3. 原物料
create table raw_materials (
  id text primary key,
  name text not null,
  category text not null,
  spec text default '',
  unit text not null,
  notes text,
  sort_order int default 0
);

-- 4. 人員
create table staff (
  id text primary key,
  name text not null,
  group_id text not null,  -- 'kitchen' 或門店 id
  sort_order int default 0
);

-- 5. 結帳欄位
create table settlement_fields (
  id text primary key,
  label text not null,
  group_name text not null,
  type text not null default 'input',
  multiplier int,
  unit text,
  sort_order int default 0
);

-- 6. 分類
create table categories (
  id serial primary key,
  scope text not null,       -- 'product' | 'material' | 'settlement'
  name text not null,
  sort_order int default 0
);

-- ============================================
-- RLS Policies: anon 可 SELECT/INSERT/UPDATE/DELETE
-- ============================================

alter table stores enable row level security;
create policy "anon_all_stores" on stores for all using (true) with check (true);

alter table store_products enable row level security;
create policy "anon_all_store_products" on store_products for all using (true) with check (true);

alter table raw_materials enable row level security;
create policy "anon_all_raw_materials" on raw_materials for all using (true) with check (true);

alter table staff enable row level security;
create policy "anon_all_staff" on staff for all using (true) with check (true);

alter table settlement_fields enable row level security;
create policy "anon_all_settlement_fields" on settlement_fields for all using (true) with check (true);

alter table categories enable row level security;
create policy "anon_all_categories" on categories for all using (true) with check (true);

-- ============================================
-- Seed Data: 門店
-- ============================================

insert into stores (id, name, code, sort_order) values
  ('lehua', '樂華店', 'lehua', 0),
  ('xingnan', '興南店', 'xingnan', 1);

-- ============================================
-- Seed Data: 門店品項
-- ============================================

insert into store_products (id, name, category, unit, shelf_life_days, base_stock, sort_order) values
  ('p001', '紅豆', '配料類（盒裝）', '盒', '7', '2盒/2天', 0),
  ('p002', '綠豆', '配料類（盒裝）', '盒', '7', '2盒/2天', 1),
  ('p003', '花生', '配料類（盒裝）', '盒', '7', '2盒/2天', 2),
  ('p004', '小薏仁', '配料類（盒裝）', '盒', '7', '2盒/2天', 3),
  ('p005', '芋泥球', '加工品類', '盒', '3', '1盒/2天', 4),
  ('p006', '芋泥漿', '加工品類', '袋', '7', '1袋', 5),
  ('p010', '芝麻糊', '加工品類', '盒', '7', '1盒/2天', 6),
  ('p007', '嫩仙草', '加工品類', '桶', '4', null, 7),
  ('p021', '豆花(冷)', '加工品類', '桶', '4', '1桶', 8),
  ('p022', '豆花(熱)', '加工品類', '桶', '1', '1桶', 9),
  ('p030', '紫米紅豆料(0.5桶)', '加工品類', '份', null, null, 10),
  ('p031', '紫米紅豆料(1桶)', '加工品類', '份', null, null, 11),
  ('p008', '紫米紅豆湯', '加工品類', '桶', null, '1桶/1天', 12),
  ('p033', '芋頭湯材料(0.5桶)', '加工品類', '份', null, null, 13),
  ('p034', '芋頭湯材料(1桶)', '加工品類', '份', null, null, 14),
  ('p009', '銀耳湯', '加工品類', '桶', '3', '1桶', 15),
  ('p035', '薏仁湯', '加工品類', '桶', '3', '1桶', 16),
  ('p036', '芋頭湯(冷)', '加工品類', '桶', '3', '1桶', 17),
  ('p037', '芋頭湯(熱)', '加工品類', '桶', '1', '1桶', 18),
  ('p011', '芋圓', '主食類（袋裝）', '袋', '冷凍45天', '3000g/袋', 19),
  ('p012', '白玉', '主食類（袋裝）', '袋', '冷凍45天', '3000g/袋', 20),
  ('p013', '粉圓', '主食類（袋裝）', '袋', null, '3000g/袋', 21),
  ('p014', '粉圓糖水', '液體類', '袋', null, '4500g/1袋', 22),
  ('p015', '炒糖糖水', '液體類', '袋', null, '4500g/1袋', 23),
  ('p019', '微糖豆漿', '液體類', '袋', '開封3天', '2500g/袋', 24),
  ('p020', '無糖豆漿', '液體類', '袋', '開封3天', '2500g/袋', 25),
  ('p023', '杏仁茶', '液體類', '份', '3', null, 26),
  ('p024', '花生冰淇淋(盒)', '冰品類', '盒', '6個月', null, 27),
  ('p025', '芝麻冰淇淋(盒)', '冰品類', '盒', '6個月', null, 28),
  ('p026', '花生冰淇淋(杯)', '冰品類', '杯', '6個月', null, 29),
  ('p027', '芝麻冰淇淋(杯)', '冰品類', '杯', '6個月', null, 30),
  ('p028', '草莓冰淇淋(杯)', '冰品類', '杯', '6個月', null, 31),
  ('p029', '蔗片冰', '冰品類', '袋', null, '8公斤/袋', 32),
  ('p016', '芝麻湯圓', '其他', '盒', null, '盒', 33),
  ('p017', '鮮奶', '其他', '瓶', null, '瓶', 34),
  ('p032', '冷凍薑汁', '其他', '瓶', '冷藏7天', null, 35);

-- ============================================
-- Seed Data: 原物料
-- ============================================

insert into raw_materials (id, name, category, spec, unit, notes, sort_order) values
  ('m001', '綠豆(天鶴牌)', '雜糧類', '50斤/袋', '袋', null, 0),
  ('m002', '紅豆(台灣)', '雜糧類', '50斤/袋', '袋', null, 1),
  ('m003', '小薏仁(珍珠麥)', '雜糧類', '25斤/袋', '袋', null, 2),
  ('m004', '二砂', '雜糧類', '50斤/袋', '袋', null, 3),
  ('m005', '大PS紅糖(黑糖)', '雜糧類', '50斤/袋', '袋', null, 4),
  ('m006', '精製特砂(白砂)', '雜糧類', '', '袋', null, 5),
  ('m007', '冰糖', '雜糧類', '50斤/袋(10包)', '袋', null, 6),
  ('m008', '三花樹薯粉(太白粉)', '雜糧類', '50斤/袋', '袋', null, 7),
  ('m009', '光中杏仁粉(杏仁茶)', '雜糧類', '1箱8包', '包', null, 8),
  ('m010', '長糯米', '雜糧類', '50斤/袋', '袋', null, 9),
  ('m011', '圓糯米', '雜糧類', '', '袋', null, 10),
  ('m012', '紫米', '雜糧類', '', '袋', null, 11),
  ('m013', '聖旻陣薏仁片', '雜糧類', '50斤/袋', '袋', null, 12),
  ('m014', '部落米', '堅果類', '20斤/袋', '袋', null, 13),
  ('m015', '進口(生)花生片', '堅果類', '', '袋', '一次訂貨量最少100斤', 14),
  ('m016', '大黑芝麻(粒)', '堅果類', '10斤/包', '包', null, 15),
  ('m017', '3號銀耳', '乾貨類', '半斤/包', '包', '乾貨滿7000免運', 16),
  ('m018', '1.5紅棗', '乾貨類', '5斤/包', '包', null, 17),
  ('m019', '0.5枸杞', '乾貨類', '', '包', null, 18),
  ('m020', '狀元仙草', '罐裝/袋裝類', '1箱6瓶', '箱', '叫貨最少7箱', 19),
  ('m021', '東城門仙草', '罐裝/袋裝類', '1箱4袋', '袋', '一次8箱', 20),
  ('m022', '新地瓜粉', '罐裝/袋裝類', '20公斤', '包', null, 21),
  ('m023', '粉粿粉', '罐裝/袋裝類', '20公斤', '包', null, 22),
  ('m024', 'A2', '其他供應商', '', '包', null, 23),
  ('m025', '天然熟石灰', '其他供應商', '1公斤/袋裝', '包', null, 24),
  ('m026', '甘蔗原汁', '其他供應商', '6瓶/箱', '箱', null, 25),
  ('m027', '花生醬', '其他供應商', '', '包', null, 26),
  ('m028', '鮮奶', '其他供應商', '1箱20瓶', '箱', null, 27),
  ('m029', '冰淇淋液', '其他供應商', '1箱12瓶', '瓶', null, 28);

-- ============================================
-- Seed Data: 人員
-- ============================================

insert into staff (id, name, group_id, sort_order) values
  ('k1', '關堉勝', 'kitchen', 0),
  ('k2', '陳宣辰', 'kitchen', 1),
  ('k3', '陳佑欣', 'kitchen', 2),
  ('k4', '胡廷瑜', 'kitchen', 3),
  ('k5', '張馨予', 'kitchen', 4),
  ('s1', '顏伊偲', 'lehua', 0),
  ('s2', '蔡博達', 'lehua', 1),
  ('s3', '陳宣佑', 'xingnan', 0),
  ('s4', '郭峻豪', 'xingnan', 1);

-- ============================================
-- Seed Data: 結帳欄位
-- ============================================

insert into settlement_fields (id, label, group_name, type, multiplier, unit, sort_order) values
  ('orderCount', '今日號數', '營運資訊', 'input', null, '號', 0),
  ('staffCount', '上班人力', '營運資訊', 'input', null, '人', 1),
  ('posTotal', 'POS結帳金額', '結帳金額', 'input', null, '元', 2),
  ('invoiceRefund', '電腦發票退款', '結帳金額', 'input', null, null, 3),
  ('openCashBills', '開店佰鈔', '結帳金額', 'input', null, null, 4),
  ('openCashCoins', '開店零錢', '結帳金額', 'input', null, null, 5),
  ('easyPay', '遊悠付', '支付方式', 'input', null, null, 6),
  ('taiwanPay', '台灣PAY', '支付方式', 'input', null, null, 7),
  ('allPay', '全支付', '支付方式', 'input', null, null, 8),
  ('linePay', 'LINEPAY', '支付方式', 'input', null, null, 9),
  ('pettyCash', '零用金申請', '支付方式', 'input', null, null, 10),
  ('invoiceRefund2', '發票退款', '支付方式', 'input', null, null, 11),
  ('prevDayUndeposited', '前日未存入金額', '支付方式', 'input', null, null, 12),
  ('changeExchange', '換零錢', '支付方式', 'input', null, null, 13),
  ('uberFee', 'UBER訂單費用', '外送平台', 'input', null, null, 14),
  ('pandaFee', 'foodpanda訂單費用', '外送平台', 'input', null, null, 15),
  ('otherExpense', '其它支出', '其它收支', 'input', null, null, 16),
  ('otherExpenseNote', '其它支出說明', '其它收支', 'text', null, null, 17),
  ('otherIncome', '其它收入', '其它收支', 'input', null, null, 18),
  ('otherIncomeNote', '其它收入說明', '其它收支', 'text', null, null, 19),
  ('cash1000', '仟鈔', '實收盤點', 'input', 1000, '張', 20),
  ('cash500', '伍佰鈔', '實收盤點', 'input', 500, '張', 21),
  ('cash100', '佰鈔', '實收盤點', 'input', 100, '張', 22),
  ('coin50', '50元', '實收盤點', 'input', 50, '枚', 23),
  ('coin10', '10元', '實收盤點', 'input', 10, '枚', 24),
  ('coin5', '5元', '實收盤點', 'input', 5, '枚', 25),
  ('coin1', '1元', '實收盤點', 'input', 1, '枚', 26),
  ('safe1000', '仟鈔', '鐵櫃內盤點', 'input', 1000, '張', 27),
  ('safe100', '佰鈔', '鐵櫃內盤點', 'input', 100, '張', 28),
  ('safe50', '50元(1盒3000)', '鐵櫃內盤點', 'input', 3000, '盒', 29),
  ('safe10', '10元(1盒1000)', '鐵櫃內盤點', 'input', 1000, '盒', 30),
  ('safe5', '5元(1盒500)', '鐵櫃內盤點', 'input', 500, '盒', 31);

-- ============================================
-- Seed Data: 分類
-- ============================================

insert into categories (scope, name, sort_order) values
  ('product', '配料類（盒裝）', 0),
  ('product', '加工品類', 1),
  ('product', '主食類（袋裝）', 2),
  ('product', '液體類', 3),
  ('product', '冰品類', 4),
  ('product', '其他', 5),
  ('material', '雜糧類', 0),
  ('material', '堅果類', 1),
  ('material', '乾貨類', 2),
  ('material', '罐裝/袋裝類', 3),
  ('material', '其他供應商', 4),
  ('settlement', '營運資訊', 0),
  ('settlement', '結帳金額', 1),
  ('settlement', '支付方式', 2),
  ('settlement', '外送平台', 3),
  ('settlement', '其它收支', 4),
  ('settlement', '實收盤點', 5),
  ('settlement', '鐵櫃內盤點', 6);
