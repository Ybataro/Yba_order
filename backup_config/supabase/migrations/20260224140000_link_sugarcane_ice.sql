-- 蔗片冰 → 蔗片冰(1)~(4)冰箱
UPDATE store_products
  SET linked_inventory_ids = ARRAY[
    'p029',
    'p1771513693518',
    'p1771513729598',
    'p1771513755567',
    'p1771513777998'
  ]
  WHERE id = 'p029';
