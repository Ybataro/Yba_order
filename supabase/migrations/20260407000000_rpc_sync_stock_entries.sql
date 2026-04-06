-- V2.0：到期日批次原子同步 RPC
-- 解決前端先讀→算 Diff→刪→寫的弱網殘留問題
-- 整個操作在單一 Transaction 內完成（原子性）

-- 盤點到期日批次
CREATE OR REPLACE FUNCTION sync_inventory_stock_entries(
  p_session_id TEXT,
  p_entries JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM inventory_stock_entries WHERE session_id = p_session_id;
  IF jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO inventory_stock_entries (session_id, product_id, expiry_date, quantity)
    SELECT
      p_session_id,
      (elem->>'product_id')::TEXT,
      (elem->>'expiry_date')::DATE,
      (elem->>'quantity')::NUMERIC
    FROM jsonb_array_elements(p_entries) AS elem;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 央廚成品到期日批次
CREATE OR REPLACE FUNCTION sync_product_stock_entries(
  p_session_id TEXT,
  p_entries JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM product_stock_entries WHERE session_id = p_session_id;
  IF jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO product_stock_entries (session_id, product_id, expiry_date, quantity)
    SELECT
      p_session_id,
      (elem->>'product_id')::TEXT,
      (elem->>'expiry_date')::DATE,
      (elem->>'quantity')::NUMERIC
    FROM jsonb_array_elements(p_entries) AS elem;
  END IF;
END;
$$ LANGUAGE plpgsql;
