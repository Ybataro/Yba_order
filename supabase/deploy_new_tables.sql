-- ============================================
-- Yba Order - 新增表（貼到 Supabase SQL Editor 執行）
-- 包含：樓層功能 + 營運資料表
-- ============================================

-- ============================================
-- A. 門店樓層
-- ============================================

create table store_zones (
  id text primary key,
  store_id text not null,
  zone_code text not null,
  zone_name text not null,
  sort_order int default 0
);

create table zone_products (
  id serial primary key,
  zone_id text not null references store_zones(id) on delete cascade,
  product_id text not null,
  sort_order int default 0,
  unique(zone_id, product_id)
);

alter table store_zones enable row level security;
create policy "anon_all_store_zones" on store_zones for all using (true) with check (true);

alter table zone_products enable row level security;
create policy "anon_all_zone_products" on zone_products for all using (true) with check (true);

-- Seed: 樂華 1F+2F、興南 1F
insert into store_zones (id, store_id, zone_code, zone_name, sort_order) values
  ('lehua_1f', 'lehua', '1F', '1樓', 0),
  ('lehua_2f', 'lehua', '2F', '2樓', 1),
  ('xingnan_1f', 'xingnan', '1F', '1樓', 0);

-- Seed: 全部品項預設指向各店 1F
insert into zone_products (zone_id, product_id, sort_order)
select 'lehua_1f', id, sort_order from store_products;

insert into zone_products (zone_id, product_id, sort_order)
select 'xingnan_1f', id, sort_order from store_products;

-- ============================================
-- B. 門店物料盤點
-- ============================================

create table inventory_sessions (
  id text primary key,
  store_id text not null,
  date date not null,
  zone_code text not null default '',
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, date, zone_code)
);

create table inventory_items (
  id serial primary key,
  session_id text not null references inventory_sessions(id) on delete cascade,
  product_id text not null,
  on_shelf numeric,
  stock numeric,
  discarded numeric,
  unique(session_id, product_id)
);

-- ============================================
-- C. 門店叫貨
-- ============================================

create table order_sessions (
  id text primary key,
  store_id text not null,
  date date not null,
  deadline timestamptz not null,
  almond_1000 text default '',
  almond_300 text default '',
  bowl_k520 text default '',
  bowl_750 text default '',
  note text default '',
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, date)
);

create table order_items (
  id serial primary key,
  session_id text not null references order_sessions(id) on delete cascade,
  product_id text not null,
  quantity numeric not null default 0,
  unique(session_id, product_id)
);

-- ============================================
-- D. 門店每日結帳
-- ============================================

create table settlement_sessions (
  id text primary key,
  store_id text not null,
  date date not null,
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(store_id, date)
);

create table settlement_values (
  id serial primary key,
  session_id text not null references settlement_sessions(id) on delete cascade,
  field_id text not null,
  value text not null default '',
  unique(session_id, field_id)
);

-- ============================================
-- E. 央廚出貨 + 門店收貨確認
-- ============================================

create table shipment_sessions (
  id text primary key,
  store_id text not null,
  date date not null,
  confirmed_by text,
  confirmed_at timestamptz,
  receive_note text default '',
  received_at timestamptz,
  unique(store_id, date)
);

create table shipment_items (
  id serial primary key,
  session_id text not null references shipment_sessions(id) on delete cascade,
  product_id text not null,
  order_qty numeric not null default 0,
  actual_qty numeric not null default 0,
  received boolean default false,
  unique(session_id, product_id)
);

-- ============================================
-- F. 央廚原物料庫存盤點
-- ============================================

create table material_stock_sessions (
  id text primary key,
  date date not null unique,
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table material_stock_items (
  id serial primary key,
  session_id text not null references material_stock_sessions(id) on delete cascade,
  material_id text not null,
  stock_qty numeric,
  bulk_qty numeric,
  unique(session_id, material_id)
);

-- ============================================
-- G. 央廚原物料叫貨
-- ============================================

create table material_order_sessions (
  id text primary key,
  date date not null unique,
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table material_order_items (
  id serial primary key,
  session_id text not null references material_order_sessions(id) on delete cascade,
  material_id text not null,
  quantity numeric not null default 0,
  unique(session_id, material_id)
);

-- ============================================
-- RLS: 營運資料表全部開放 anon
-- ============================================

alter table inventory_sessions enable row level security;
create policy "anon_all" on inventory_sessions for all using (true) with check (true);
alter table inventory_items enable row level security;
create policy "anon_all" on inventory_items for all using (true) with check (true);

alter table order_sessions enable row level security;
create policy "anon_all" on order_sessions for all using (true) with check (true);
alter table order_items enable row level security;
create policy "anon_all" on order_items for all using (true) with check (true);

alter table settlement_sessions enable row level security;
create policy "anon_all" on settlement_sessions for all using (true) with check (true);
alter table settlement_values enable row level security;
create policy "anon_all" on settlement_values for all using (true) with check (true);

alter table shipment_sessions enable row level security;
create policy "anon_all" on shipment_sessions for all using (true) with check (true);
alter table shipment_items enable row level security;
create policy "anon_all" on shipment_items for all using (true) with check (true);

alter table material_stock_sessions enable row level security;
create policy "anon_all" on material_stock_sessions for all using (true) with check (true);
alter table material_stock_items enable row level security;
create policy "anon_all" on material_stock_items for all using (true) with check (true);

alter table material_order_sessions enable row level security;
create policy "anon_all" on material_order_sessions for all using (true) with check (true);
alter table material_order_items enable row level security;
create policy "anon_all" on material_order_items for all using (true) with check (true);

-- ============================================
-- H. 央廚成品庫存盤點
-- ============================================

create table product_stock_sessions (
  id text primary key,
  date date not null unique,
  submitted_by text,
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table product_stock_items (
  id serial primary key,
  session_id text not null references product_stock_sessions(id) on delete cascade,
  product_id text not null,
  stock_qty numeric,
  unique(session_id, product_id)
);

alter table product_stock_sessions enable row level security;
create policy "anon_all" on product_stock_sessions for all using (true) with check (true);
alter table product_stock_items enable row level security;
create policy "anon_all" on product_stock_items for all using (true) with check (true);
