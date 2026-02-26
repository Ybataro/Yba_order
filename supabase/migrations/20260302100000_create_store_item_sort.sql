-- 每店品項排序：允許各門店/央廚獨立控制品項顯示順序

CREATE TABLE store_item_sort (
  store_id TEXT NOT NULL,        -- 'lehua', 'xingnan', 'kitchen'
  scope TEXT NOT NULL,           -- 'product' or 'material'
  item_type TEXT NOT NULL,       -- 'category' or 'item'
  item_key TEXT NOT NULL,        -- 分類名 or 品項 ID
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, scope, item_type, item_key)
);

ALTER TABLE store_item_sort ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_store_item_sort" ON store_item_sort
  FOR ALL USING (true) WITH CHECK (true);
