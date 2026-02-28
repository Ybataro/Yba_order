-- Split quantity into takeout + delivery channels
ALTER TABLE frozen_sales ADD COLUMN takeout INT NOT NULL DEFAULT 0;
ALTER TABLE frozen_sales ADD COLUMN delivery INT NOT NULL DEFAULT 0;

-- Migrate existing data (assume all were takeout)
UPDATE frozen_sales SET takeout = quantity WHERE quantity > 0;

ALTER TABLE frozen_sales DROP COLUMN quantity;
