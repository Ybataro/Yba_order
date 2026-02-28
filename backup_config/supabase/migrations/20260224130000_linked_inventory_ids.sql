-- 叫貨品項關聯盤點品項
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS linked_inventory_ids TEXT[] DEFAULT '{}';

-- 粉圓 → 粉圓(凍) + 粉圓(藏)
UPDATE store_products
  SET linked_inventory_ids = ARRAY['p1771513573239','p1771513626343']
  WHERE id = 'p013';
