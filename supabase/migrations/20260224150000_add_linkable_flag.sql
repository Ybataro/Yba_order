-- 品項新增「可被關聯」旗標
ALTER TABLE store_products
  ADD COLUMN IF NOT EXISTS linkable BOOLEAN DEFAULT false;

-- 預設：所有 inventory_only 品項 + 蔗片冰本身 設為可被關聯
UPDATE store_products SET linkable = true WHERE visible_in = 'inventory_only';
UPDATE store_products SET linkable = true WHERE id = 'p029';
