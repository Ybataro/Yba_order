-- 對調央廚成品庫存盤點「即時庫存區」無糖豆漿 / 微糖豆漿 顯示順序
-- 業務需求：微糖豆漿排前面、無糖豆漿排後面
-- 原順序：1=豆花用 / 2=無糖 / 3=微糖
-- 新順序：1=豆花用 / 2=微糖 / 3=無糖

UPDATE kitchen_realtime_items SET sort_order = 3 WHERE id = 'kri_doujiang_wutang';
UPDATE kitchen_realtime_items SET sort_order = 2 WHERE id = 'kri_doujiang_weitang';
