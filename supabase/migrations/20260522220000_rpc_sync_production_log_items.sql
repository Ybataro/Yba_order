-- ============================================================
-- 生產記錄 items 原子同步 RPC（2026-05-22）
--
-- 背景：ProductionLog.tsx:230-260 用 delete-then-insert 非原子
--      若 DELETE 成功但 INSERT 失敗 → DB 該 session 變空（資料丟失）
--
-- 修法：仿 sync_inventory_stock_entries pattern，包成 RPC 在 DB 端原子化
-- ============================================================

CREATE OR REPLACE FUNCTION sync_production_log_items(
  p_session_id TEXT,
  p_items JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM production_log_items WHERE session_id = p_session_id;
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO production_log_items (session_id, item_key, field_key, field_value)
    SELECT
      p_session_id,
      (elem->>'item_key')::TEXT,
      (elem->>'field_key')::TEXT,
      (elem->>'field_value')::TEXT
    FROM jsonb_array_elements(p_items) AS elem;
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION sync_production_log_items(TEXT, JSONB) TO anon, authenticated;
