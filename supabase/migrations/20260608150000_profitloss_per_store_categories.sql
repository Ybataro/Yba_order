-- 盈餘統計重構：一店一份分類 + 樂華電費分樓 + 水號標籤 + 央廚加會計費 + 央廚水費改名
-- 設計：
--   - expense_categories.store_id 從 'store'（樂華+興南共用）改成 'lehua' / 'xingnan' 各一份
--   - monthly_expenses.category_id 對應更新（樂華保留 s_xxx；興南新建 x_xxx）
--   - expense_rate_history.category_id 同步處理（樂華 s_xxx 保留，興南要新建 x_xxx + 複製 history）
-- 業務需求：
--   - 樂華：水費 label 加水號 Y050252739、電費拆 1F/2F
--   - 興南：水費 label 加水號 C1 7064203 1
--   - 央廚：水費改「台灣自來水（C1 23733904 4）」、新增會計費
--   - 雜費/杯碗備註功能：用既有 monthly_expenses.note 欄位（不需 schema 改）

BEGIN;

-- ============================================================
-- 步驟 1：把 store_id='store' 的分類「重新指定」為 'lehua'
--   （s_xxx id 不變，樂華保留歷史資料無痛接管）
-- ============================================================
UPDATE expense_categories SET store_id = 'lehua' WHERE store_id = 'store';

-- ============================================================
-- 步驟 2：為興南建立一份 x_xxx 分類（複製自樂華 s_xxx）
-- ============================================================
INSERT INTO expense_categories (id, label, store_id, sort_order, is_auto, auto_field, auto_rate)
SELECT
  'x_' || SUBSTRING(id FROM 3) AS id,
  label,
  'xingnan' AS store_id,
  sort_order,
  is_auto,
  auto_field,
  auto_rate
FROM expense_categories
WHERE store_id = 'lehua';

-- ============================================================
-- 步驟 3：把興南 monthly_expenses.category_id 從 s_xxx 改成 x_xxx
-- ============================================================
UPDATE monthly_expenses
SET category_id = 'x_' || SUBSTRING(category_id FROM 3)
WHERE store_id = 'xingnan' AND category_id LIKE 's_%';

-- ============================================================
-- 步驟 4：為興南複製 expense_rate_history（讓興南也吃到 5% / 30% / 28% / 2.2% 歷史費率）
-- ============================================================
INSERT INTO expense_rate_history (category_id, effective_from, rate, note)
SELECT
  'x_' || SUBSTRING(category_id FROM 3) AS category_id,
  effective_from,
  rate,
  note
FROM expense_rate_history
WHERE category_id LIKE 's_%'
ON CONFLICT (category_id, effective_from) DO NOTHING;

-- ============================================================
-- 步驟 5：樂華水費 label 加水號
-- ============================================================
UPDATE expense_categories SET label = '台北自來水（Y050252739）' WHERE id = 's_water';

-- ============================================================
-- 步驟 6：興南水費 label 加水號
-- ============================================================
UPDATE expense_categories SET label = '台北自來水（C1 7064203 1）' WHERE id = 'x_water';

-- ============================================================
-- 步驟 7：樂華電費 1F 改名 + 2F 新增
-- ============================================================
UPDATE expense_categories SET label = '電費 1F' WHERE id = 's_electricity';
INSERT INTO expense_categories (id, label, store_id, sort_order, is_auto, auto_field, auto_rate)
VALUES ('s_electricity_2f', '電費 2F', 'lehua', 14, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 步驟 8：央廚水費改名 + 加水號
-- ============================================================
UPDATE expense_categories SET label = '台灣自來水（C1 23733904 4）' WHERE id = 'k_water';

-- ============================================================
-- 步驟 9：央廚新增會計費
-- ============================================================
INSERT INTO expense_categories (id, label, store_id, sort_order, is_auto, auto_field, auto_rate)
VALUES ('k_accounting', '會計費', 'kitchen', 5, false, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- 央廚 sort_order 重排（讓會計費插在水費後、瓦斯費前；既有 k_water=5, k_gas=6 等需後挪）
UPDATE expense_categories SET sort_order = sort_order + 1
WHERE store_id = 'kitchen' AND id <> 'k_accounting' AND sort_order >= 5 AND id <> 'k_water';
UPDATE expense_categories SET sort_order = 5 WHERE id = 'k_water';
UPDATE expense_categories SET sort_order = 6 WHERE id = 'k_accounting';

COMMIT;

-- 通知 PostgREST reload schema（雖然這次沒加新欄位，但 category 大量變動仍建議）
NOTIFY pgrst, 'reload schema';
