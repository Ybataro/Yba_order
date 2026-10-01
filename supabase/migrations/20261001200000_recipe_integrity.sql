-- 成品配方資料完整性（2026-10-01 健檢後）
-- 1) 存配方原料改單一交易：原本前端「先 delete 再 insert」兩次請求，insert 失敗時原料全部遺失
-- 2) 使用中的原物料/配方禁止刪除：原本無 FK，刪原物料後配方留孤兒，成本被靜默漏算（豆花 10000g 事件）

BEGIN;

CREATE OR REPLACE FUNCTION save_recipe_ingredients(p_recipe_id TEXT, p_rows JSONB)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM recipes WHERE id = p_recipe_id) THEN
    RAISE EXCEPTION 'recipe % not found', p_recipe_id;
  END IF;

  DELETE FROM recipe_ingredients WHERE recipe_id = p_recipe_id;

  INSERT INTO recipe_ingredients (id, recipe_id, material_id, custom_name, custom_price_per_g, amount_g, sort_order)
  SELECT x.id, p_recipe_id, x.material_id, x.custom_name, x.custom_price_per_g, x.amount_g, x.sort_order
  FROM jsonb_to_recordset(COALESCE(p_rows, '[]'::jsonb))
    AS x(id TEXT, material_id TEXT, custom_name TEXT, custom_price_per_g NUMERIC, amount_g NUMERIC, sort_order INT);
END;
$$;

GRANT EXECUTE ON FUNCTION save_recipe_ingredients(TEXT, JSONB) TO anon, authenticated;

ALTER TABLE recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT;

ALTER TABLE menu_item_ingredients
  ADD CONSTRAINT menu_item_ingredients_material_id_fkey
  FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT;

ALTER TABLE menu_item_ingredients
  ADD CONSTRAINT menu_item_ingredients_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';

COMMIT;
