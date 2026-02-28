-- Add bag_weight column to store_products
-- bag_weight = grams per bag (e.g. 3000 = 1 bag = 3000g)
-- NULL = feature disabled, on_shelf remains in unit count
-- When set, on_shelf stores grams, stock stores bag count
ALTER TABLE store_products ADD COLUMN IF NOT EXISTS bag_weight INTEGER DEFAULT NULL;
