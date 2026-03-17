-- ============================================================
-- SOP Seed Data — 配方、原料、步驟
-- ============================================================

-- ── 基礎物料 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_fengguo',       'cat_base', '粉粿',         '{"1份"}', '', 0),
  ('sop_taro_soup',     'cat_base', '芋頭湯（豆花用）', '{"1份"}', '', 1),
  ('sop_honey_tea',     'cat_base', '蜜香紅茶糖漿', '{"1份"}', '', 2),
  ('sop_coffee_foam',   'cat_base', '咖啡奶泡',     '{"1份"}', '200g 鮮奶加 10g 咖啡奶泡比例剛好', 3),
  ('sop_pineapple_s',   'cat_base', '鳳梨漿（小）', '{"1份"}', '', 4),
  ('sop_pineapple_l',   'cat_base', '鳳梨漿（大）', '{"1份"}', '', 5),
  ('sop_xiancao_new',   'cat_base', '（新）燒仙草', '{"1份"}', '', 6),
  ('sop_xiancao_lotus', 'cat_base', '（新）燒仙草 蓮藕粉', '{"1份"}', '', 7);

-- 粉粿
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_001', 'sop_fengguo', '粉',   'kg', '{"1份":1}', 0),
  ('ing_002', 'sop_fengguo', '冷水', 'kg', '{"1份":1.2}', 1),
  ('ing_003', 'sop_fengguo', '熱水', 'kg', '{"1份":3.2}', 2),
  ('ing_004', 'sop_fengguo', '黑糖', 'kg', '{"1份":0.8}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_001', 'sop_fengguo', 1, '拌粉', '冷水拌粉加黑糖攪拌均勻', 0),
  ('stp_002', 'sop_fengguo', 2, '煮水', '3.2公斤熱水煮開至100度', 1),
  ('stp_003', 'sop_fengguo', 3, '攪拌', '粉水倒入攪拌至稠狀', 2),
  ('stp_004', 'sop_fengguo', 4, '蒸', '倒出至鐵盤進蒸箱蒸5分鐘再悶5分鐘', 3);

-- 芋頭湯
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_005', 'sop_taro_soup', '芋頭絲', 'kg', '{"1份":3.5}', 0),
  ('ing_006', 'sop_taro_soup', '冰糖',   'kg', '{"1份":0.6}', 1),
  ('ing_007', 'sop_taro_soup', '白砂',   'kg', '{"1份":0.5}', 2),
  ('ing_008', 'sop_taro_soup', '米酒22度', '瓶蓋', '{"1份":3}', 3),
  ('ing_009', 'sop_taro_soup', '熱水',   'cc', '{"1份":8000}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_005', 'sop_taro_soup', 1, '煮', '閥響就直接轉 800W 10分鐘，降閥開蓋', 0);

-- 蜜香紅茶糖漿
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_010', 'sop_honey_tea', '紅茶',       'g',  '{"1份":200}', 0),
  ('ing_011', 'sop_honey_tea', '水',         'cc', '{"1份":5000}', 1),
  ('ing_012', 'sop_honey_tea', '白甘蔗汁',   '瓶', '{"1份":1}', 2),
  ('ing_013', 'sop_honey_tea', '二砂',       'kg', '{"1份":3}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_006', 'sop_honey_tea', 1, '煮茶', '水滾下茶葉悶30分鐘', 0),
  ('stp_007', 'sop_honey_tea', 2, '調味', '下甘蔗汁跟二砂攪拌至融化', 1),
  ('stp_008', 'sop_honey_tea', 3, '冰鎮', '冰鎮', 2);

-- 咖啡奶泡
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_014', 'sop_coffee_foam', '澳洲即溶咖啡', 'g', '{"1份":13}', 0),
  ('ing_015', 'sop_coffee_foam', '熱水',         'g', '{"1份":50}', 1),
  ('ing_016', 'sop_coffee_foam', '蜂蜜',         'g', '{"1份":50}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_009', 'sop_coffee_foam', 1, '沖泡', '即溶咖啡加熱水攪拌融化', 0),
  ('stp_010', 'sop_coffee_foam', 2, '打發', '再加蜂蜜打至變色即成奶泡', 1);

-- 鳳梨漿（小）
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_017', 'sop_pineapple_s', '鳳梨',   'kg', '{"1份":1}', 0),
  ('ing_018', 'sop_pineapple_s', '白砂',   'g',  '{"1份":100}', 1),
  ('ing_019', 'sop_pineapple_s', '黑糖',   'g',  '{"1份":75}', 2),
  ('ing_020', 'sop_pineapple_s', '水',     'cc', '{"1份":500}', 3),
  ('ing_021', 'sop_pineapple_s', '地瓜粉', 'g',  '{"1份":12}', 4),
  ('ing_022', 'sop_pineapple_s', '玉米粉', 'g',  '{"1份":18}', 5),
  ('ing_023', 'sop_pineapple_s', '冷水（勾芡）', 'cc', '{"1份":550}', 6);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_011', 'sop_pineapple_s', 1, '煮', '滾 25分鐘', 0);

-- 鳳梨漿（大）
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_024', 'sop_pineapple_l', '鳳梨',   'kg', '{"1份":8}', 0),
  ('ing_025', 'sop_pineapple_l', '白砂',   'g',  '{"1份":840}', 1),
  ('ing_026', 'sop_pineapple_l', '黑糖',   'g',  '{"1份":640}', 2),
  ('ing_027', 'sop_pineapple_l', '水',     'cc', '{"1份":5000}', 3),
  ('ing_028', 'sop_pineapple_l', '地瓜粉', 'g',  '{"1份":96}', 4),
  ('ing_029', 'sop_pineapple_l', '玉米粉', 'g',  '{"1份":144}', 5),
  ('ing_030', 'sop_pineapple_l', '冷水（勾芡）', 'cc', '{"1份":1200}', 6);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_012', 'sop_pineapple_l', 1, '煮', '滾 25分鐘', 0);

-- （新）燒仙草
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_031', 'sop_xiancao_new', '東城仙草汁', 'cc', '{"1份":4000}', 0),
  ('ing_032', 'sop_xiancao_new', '員林',       'g',  '{"1份":400}', 1),
  ('ing_033', 'sop_xiancao_new', '熱水',       'cc', '{"1份":11000}', 2),
  ('ing_034', 'sop_xiancao_new', '地瓜粉',     'g',  '{"1份":50}', 3),
  ('ing_035', 'sop_xiancao_new', '玉米粉',     'g',  '{"1份":50}', 4),
  ('ing_036', 'sop_xiancao_new', '粉水',       'cc', '{"1份":500}', 5);

-- （新）燒仙草 蓮藕粉
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_037', 'sop_xiancao_lotus', '東城仙草汁', 'cc', '{"1份":3000}', 0),
  ('ing_038', 'sop_xiancao_lotus', '狀元仙草汁', 'cc', '{"1份":2000}', 1),
  ('ing_039', 'sop_xiancao_lotus', '熱水',       'cc', '{"1份":10000}', 2),
  ('ing_040', 'sop_xiancao_lotus', '蓮藕粉',     'g',  '{"1份":100}', 3),
  ('ing_041', 'sop_xiancao_lotus', '粉水',       'cc', '{"1份":500}', 4);

-- ── 銅鑼燒 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_dora_jpn',     'cat_dorayaki', '日本名店配方',     '{"1份"}', '', 0),
  ('sop_dora_charcoal','cat_dorayaki', '銅鑼燒 竹炭',     '{"1份"}', '', 1),
  ('sop_dora_orig',    'cat_dorayaki', '銅鑼燒 原味',     '{"1份"}', '', 2),
  ('sop_dora_choco',   'cat_dorayaki', '銅鑼燒 巧克力',   '{"1份"}', '', 3),
  ('sop_dora_earl',    'cat_dorayaki', '銅鑼燒 伯爵紅茶', '{"1份"}', '', 4),
  ('sop_dora_matcha',  'cat_dorayaki', '銅鑼燒 抹茶',     '{"1份"}', '', 5);

-- 日本名店配方
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_050', 'sop_dora_jpn', '蛋',       'g', '{"1份":200}', 0),
  ('ing_051', 'sop_dora_jpn', '上白糖',   'g', '{"1份":175}', 1),
  ('ing_052', 'sop_dora_jpn', '蜂蜜',     'g', '{"1份":12.5}', 2),
  ('ing_053', 'sop_dora_jpn', '小蘇打',   'g', '{"1份":5}', 3),
  ('ing_054', 'sop_dora_jpn', '水',       'g', '{"1份":50}', 4),
  ('ing_055', 'sop_dora_jpn', '日本清酒', 'g', '{"1份":50}', 5),
  ('ing_056', 'sop_dora_jpn', '低筋麵粉', 'g', '{"1份":175}', 6),
  ('ing_057', 'sop_dora_jpn', '糯米粉',   'g', '{"1份":25}', 7);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_020', 'sop_dora_jpn', 1, '混合糖蛋', '上白糖過篩，加入蜂蜜，一個雞蛋，攪勻', 0),
  ('stp_021', 'sop_dora_jpn', 2, '加蛋',     '再加入剩餘雞蛋，攪勻', 1),
  ('stp_022', 'sop_dora_jpn', 3, '加粉',     '加入日本酒，粉，攪勻。麵糊靜置30分鐘', 2),
  ('stp_023', 'sop_dora_jpn', 4, '加蘇打',   '將小蘇打與水攪勻，倒入靜置後的麵糊中，攪勻', 3),
  ('stp_024', 'sop_dora_jpn', 5, '煎',       '烤盤抹少許油，預熱，倒入麵糊，表面鼓泡翻面，煎至兩面上色即可', 4);

-- 竹炭
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_058', 'sop_dora_charcoal', '蛋',       '顆', '{"1份":3}', 0),
  ('ing_059', 'sop_dora_charcoal', '上白糖',   'g',  '{"1份":100}', 1),
  ('ing_060', 'sop_dora_charcoal', '蜂蜜',     'g',  '{"1份":40}', 2),
  ('ing_061', 'sop_dora_charcoal', '小蘇打',   'g',  '{"1份":2}', 3),
  ('ing_062', 'sop_dora_charcoal', '水',       'g',  '{"1份":100}', 4),
  ('ing_063', 'sop_dora_charcoal', '橄欖油',   'g',  '{"1份":5}', 5),
  ('ing_064', 'sop_dora_charcoal', '米酒',     'g',  '{"1份":2}', 6),
  ('ing_065', 'sop_dora_charcoal', '低筋麵粉', 'g',  '{"1份":200}', 7),
  ('ing_066', 'sop_dora_charcoal', '竹炭',     'g',  '{"1份":8}', 8);

-- 原味
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_067', 'sop_dora_orig', '蛋',       '顆', '{"1份":3}', 0),
  ('ing_068', 'sop_dora_orig', '上白糖',   'g',  '{"1份":80}', 1),
  ('ing_069', 'sop_dora_orig', '蜂蜜',     'g',  '{"1份":40}', 2),
  ('ing_070', 'sop_dora_orig', '小蘇打',   'g',  '{"1份":2}', 3),
  ('ing_071', 'sop_dora_orig', '水',       'g',  '{"1份":100}', 4),
  ('ing_072', 'sop_dora_orig', '橄欖油',   'g',  '{"1份":5}', 5),
  ('ing_073', 'sop_dora_orig', '米酒',     'g',  '{"1份":2}', 6),
  ('ing_074', 'sop_dora_orig', '低筋麵粉', 'g',  '{"1份":200}', 7);

-- 巧克力
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_075', 'sop_dora_choco', '蛋',       '顆', '{"1份":3}', 0),
  ('ing_076', 'sop_dora_choco', '三溫糖',   'g',  '{"1份":120}', 1),
  ('ing_077', 'sop_dora_choco', '蜂蜜',     'g',  '{"1份":35}', 2),
  ('ing_078', 'sop_dora_choco', '小蘇打',   'g',  '{"1份":2}', 3),
  ('ing_079', 'sop_dora_choco', '水',       'g',  '{"1份":120}', 4),
  ('ing_080', 'sop_dora_choco', '橄欖油',   'g',  '{"1份":5}', 5),
  ('ing_081', 'sop_dora_choco', '米酒',     'g',  '{"1份":4}', 6),
  ('ing_082', 'sop_dora_choco', '低筋麵粉', 'g',  '{"1份":200}', 7),
  ('ing_083', 'sop_dora_choco', '巧克力粉', 'g',  '{"1份":25}', 8);

-- 伯爵紅茶
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_084', 'sop_dora_earl', '蛋',           '顆', '{"1份":3}', 0),
  ('ing_085', 'sop_dora_earl', '三溫糖',       'g',  '{"1份":100}', 1),
  ('ing_086', 'sop_dora_earl', '蜂蜜',         'g',  '{"1份":30}', 2),
  ('ing_087', 'sop_dora_earl', '小蘇打',       'g',  '{"1份":2}', 3),
  ('ing_088', 'sop_dora_earl', '伯爵紅茶粉',   'g',  '{"1份":15}', 4),
  ('ing_089', 'sop_dora_earl', '橄欖油',       'g',  '{"1份":5}', 5),
  ('ing_090', 'sop_dora_earl', '水',           'g',  '{"1份":200}', 6),
  ('ing_091', 'sop_dora_earl', '低筋麵粉',     'g',  '{"1份":200}', 7);

-- 抹茶
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_092', 'sop_dora_matcha', '蛋',       '顆', '{"1份":3}', 0),
  ('ing_093', 'sop_dora_matcha', '上白糖',   'g',  '{"1份":150}', 1),
  ('ing_094', 'sop_dora_matcha', '蜂蜜',     'g',  '{"1份":35}', 2),
  ('ing_095', 'sop_dora_matcha', '小蘇打',   'g',  '{"1份":2}', 3),
  ('ing_096', 'sop_dora_matcha', '鮮奶',     'g',  '{"1份":150}', 4),
  ('ing_097', 'sop_dora_matcha', '抹茶粉',   'g',  '{"1份":15}', 5),
  ('ing_098', 'sop_dora_matcha', '綠藻',     'g',  '{"1份":10}', 6),
  ('ing_099', 'sop_dora_matcha', '水',       'g',  '{"1份":100}', 7),
  ('ing_100', 'sop_dora_matcha', '低筋麵粉', 'g',  '{"1份":200}', 8);

-- ── 冰淇淋 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_ice_yuzu',    'cat_icecream', '醋勁大發柚子冰淇淋', '{"1份"}', '一杯380g', 0),
  ('sop_ice_thai',    'cat_icecream', '泰奶冰淇淋',         '{"1份"}', '一杯380g', 1),
  ('sop_ice_straw',   'cat_icecream', '草莓冰淇淋',         '{"1份"}', '一杯380g', 2),
  ('sop_ice_mango',   'cat_icecream', '芒果優格冰淇淋',     '{"1份"}', '', 3),
  ('sop_ice_peanut',  'cat_icecream', '花生冰',             '{"1份"}', '一次量約5600，一盒裝3800', 4),
  ('sop_ice_sesame',  'cat_icecream', '芝麻冰',             '{"1份"}', '一次量約5600，一盒裝3800', 5),
  ('sop_ice_taro',    'cat_icecream', '芋頭冰',             '{"1份"}', '一次量約5600', 6);

-- 柚子冰淇淋
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_110', 'sop_ice_yuzu', '柚子醋',   'g', '{"1份":1200}', 0),
  ('ing_111', 'sop_ice_yuzu', '柚子',     'g', '{"1份":300}', 1),
  ('ing_112', 'sop_ice_yuzu', '冰淇淋液', '瓶', '{"1份":2}', 2),
  ('ing_113', 'sop_ice_yuzu', '鮮奶',     '瓶', '{"1份":2}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_030', 'sop_ice_yuzu', 1, '混合', '柚子醋加冰淇淋液鮮奶一起打，時間5秒', 0),
  ('stp_031', 'sop_ice_yuzu', 2, '製冰', '冰淇淋機22分鐘裝杯', 1);

-- 泰奶冰淇淋
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_114', 'sop_ice_thai', '茶',       'g', '{"1份":400}', 0),
  ('ing_115', 'sop_ice_thai', '熱水',     'g', '{"1份":2000}', 1),
  ('ing_116', 'sop_ice_thai', '煉乳',     '瓶', '{"1份":1}', 2),
  ('ing_117', 'sop_ice_thai', '冰淇淋液', '瓶', '{"1份":3}', 3),
  ('ing_118', 'sop_ice_thai', '鮮奶',     '瓶', '{"1份":1}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_032', 'sop_ice_thai', 1, '煮茶', '茶跟熱水滾後煮20分鐘燜10分鐘', 0),
  ('stp_033', 'sop_ice_thai', 2, '過濾混合', '過濾後加冰淇淋液鮮奶，煉乳一起打均勻', 1),
  ('stp_034', 'sop_ice_thai', 3, '製冰', '冰淇淋機22分鐘裝杯', 2);

-- 草莓冰淇淋
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_119', 'sop_ice_straw', '新鮮草莓', 'g',  '{"1份":2000}', 0),
  ('ing_120', 'sop_ice_straw', '白砂糖',   'g',  '{"1份":550}', 1),
  ('ing_121', 'sop_ice_straw', '檸檬汁',   'cc', '{"1份":20}', 2),
  ('ing_122', 'sop_ice_straw', '伏特加酒', 'cc', '{"1份":20}', 3),
  ('ing_123', 'sop_ice_straw', '冰淇淋液', '瓶', '{"1份":2}', 4),
  ('ing_124', 'sop_ice_straw', '鮮奶',     '瓶', '{"1份":2}', 5);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_035', 'sop_ice_straw', 1, '炒草莓', '草莓加糖炒至融化再加酒跟檸檬汁', 0),
  ('stp_036', 'sop_ice_straw', 2, '混合', '草莓糖漿加冰淇淋液鮮奶一起打，時間5秒', 1),
  ('stp_037', 'sop_ice_straw', 3, '製冰', '冰淇淋機22分鐘裝杯', 2);

-- 芒果優格冰淇淋
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_125', 'sop_ice_mango', '芒果',     'g',  '{"1份":220}', 0),
  ('ing_126', 'sop_ice_mango', '無糖優格', 'g',  '{"1份":250}', 1),
  ('ing_127', 'sop_ice_mango', '砂糖',     'g',  '{"1份":80}', 2),
  ('ing_128', 'sop_ice_mango', '檸檬汁',   'cc', '{"1份":20}', 3),
  ('ing_129', 'sop_ice_mango', '萊姆酒',   '',   '{"1份":0}', 4),
  ('ing_130', 'sop_ice_mango', '鹽',       '',   '{"1份":0}', 5);

-- 花生冰
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_131', 'sop_ice_peanut', '花生漿',   'g', '{"1份":1000}', 0),
  ('ing_132', 'sop_ice_peanut', '特砂',     'g', '{"1份":500}', 1),
  ('ing_133', 'sop_ice_peanut', '鮮奶',     'g', '{"1份":946}', 2),
  ('ing_134', 'sop_ice_peanut', '冰淇淋液', 'g', '{"1份":1030}', 3),
  ('ing_135', 'sop_ice_peanut', '過濾水',   'g', '{"1份":1600}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_038', 'sop_ice_peanut', 1, '打漿', '果汁機高速打花生醬+特砂+水 5分鐘', 0),
  ('stp_039', 'sop_ice_peanut', 2, '製冰', '再加鮮奶，冰淇淋液一起倒入機器製冰 25分鐘', 1);

-- 芝麻冰
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_136', 'sop_ice_sesame', '熟芝麻',   'g', '{"1份":1000}', 0),
  ('ing_137', 'sop_ice_sesame', '特砂',     'g', '{"1份":500}', 1),
  ('ing_138', 'sop_ice_sesame', '鮮奶',     'g', '{"1份":946}', 2),
  ('ing_139', 'sop_ice_sesame', '冰淇淋液', 'g', '{"1份":1030}', 3),
  ('ing_140', 'sop_ice_sesame', '過濾水',   'g', '{"1份":1600}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_040', 'sop_ice_sesame', 1, '打漿', '果汁機高速打芝麻+特砂+水 5分鐘', 0),
  ('stp_041', 'sop_ice_sesame', 2, '製冰', '再加鮮奶，冰淇淋液一起倒入機器製冰 25分鐘', 1);

-- 芋頭冰
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_141', 'sop_ice_taro', '芋頭',     'g', '{"1份":1500}', 0),
  ('ing_142', 'sop_ice_taro', '特砂',     'g', '{"1份":600}', 1),
  ('ing_143', 'sop_ice_taro', '鮮奶',     'g', '{"1份":1892}', 2),
  ('ing_144', 'sop_ice_taro', '冰淇淋液', 'g', '{"1份":1030}', 3),
  ('ing_145', 'sop_ice_taro', '過濾水',   'g', '{"1份":1000}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_042', 'sop_ice_taro', 1, '打漿', '果汁機高速打芋頭+特砂+水 5分鐘', 0),
  ('stp_043', 'sop_ice_taro', 2, '製冰', '再加鮮奶，冰淇淋液一起倒入機器製冰 23分鐘', 1);

-- ── 韓式雪冰 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_snow_peanut',   'cat_snowice', '韓式雪冰 花生',       '{"1份"}', '', 0),
  ('sop_snow_sesame',   'cat_snowice', '韓式雪冰 芝麻',       '{"1份"}', '', 1),
  ('sop_snow_taro',     'cat_snowice', '韓式雪冰 芋頭',       '{"1份"}', '濃度 16，轉速 25', 2),
  ('sop_snow_taro_new', 'cat_snowice', '韓式雪冰 芋頭（新）', '{"1份"}', '', 3);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_150', 'sop_snow_peanut', '花生漿',   'g', '{"1份":200}', 0),
  ('ing_151', 'sop_snow_peanut', '鮮奶',     'g', '{"1份":400}', 1),
  ('ing_152', 'sop_snow_peanut', '霜淇淋液', 'g', '{"1份":200}', 2);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_153', 'sop_snow_sesame', '芝麻漿',   'g', '{"1份":600}', 0),
  ('ing_154', 'sop_snow_sesame', '鮮奶',     'g', '{"1份":200}', 1),
  ('ing_155', 'sop_snow_sesame', '霜淇淋液', 'g', '{"1份":200}', 2);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_156', 'sop_snow_taro', '芋泥漿',   'g', '{"1份":600}', 0),
  ('ing_157', 'sop_snow_taro', '鮮奶',     'g', '{"1份":400}', 1),
  ('ing_158', 'sop_snow_taro', '霜淇淋液', 'g', '{"1份":200}', 2);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_159', 'sop_snow_taro_new', '蜜芋頭',   'g', '{"1份":300}', 0),
  ('ing_160', 'sop_snow_taro_new', '義美鮮奶', 'g', '{"1份":500}', 1),
  ('ing_161', 'sop_snow_taro_new', '過濾水',   'g', '{"1份":500}', 2),
  ('ing_162', 'sop_snow_taro_new', '特砂',     'g', '{"1份":150}', 3);

-- ── 新口味片冰 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_sheet_coffee',  'cat_sheetice', '咖啡片冰', '{"1份"}', '', 0),
  ('sop_sheet_xiancao', 'cat_sheetice', '仙草片冰', '{"1份"}', '', 1),
  ('sop_sheet_lime',    'cat_sheetice', '萊姆片冰', '{"1份"}', '', 2);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_163', 'sop_sheet_coffee',  '澳洲咖啡', 'g',  '{"1份":60}', 0),
  ('ing_164', 'sop_sheet_coffee',  '過濾水',   'cc', '{"1份":3000}', 1);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_165', 'sop_sheet_xiancao', '東城仙草', 'cc', '{"1份":1500}', 0),
  ('ing_166', 'sop_sheet_xiancao', '水',       'cc', '{"1份":3000}', 1),
  ('ing_167', 'sop_sheet_xiancao', '二砂',     'g',  '{"1份":450}', 2);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_168', 'sop_sheet_lime', '萊姆汁', 'cc', '{"1份":100}', 0),
  ('ing_169', 'sop_sheet_lime', '水',     'cc', '{"1份":400}', 1),
  ('ing_170', 'sop_sheet_lime', '二砂',   'g',  '{"1份":35}', 2);

-- ── 芋圓白玉 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_taro_ball',      'cat_taro_ball', '1鋼芋圓（新）',   '{"1份"}', '', 0),
  ('sop_tangyuan',       'cat_taro_ball', '湯圓做法（新）',   '{"1份"}', '1鋼共需要3鍋共30公斤', 1),
  ('sop_purple_tangyuan','cat_taro_ball', '紫米湯圓做法（新）','{"1份"}', '1鋼共需要3鍋共30公斤', 2),
  ('sop_charcoal_ty',    'cat_taro_ball', '竹炭湯圓',         '{"1份"}', '一缸白玉(30公斤米)加一包竹炭粉500g', 3),
  ('sop_matcha_ty',      'cat_taro_ball', '抹茶湯圓',         '{"1份"}', '小山園 若竹', 4),
  ('sop_algae_ty',       'cat_taro_ball', '綠藻湯圓',         '{"1份"}', '', 5);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_171', 'sop_taro_ball', '芋頭',   'kg', '{"1份":24}', 0),
  ('ing_172', 'sop_taro_ball', '新粉A2', 'kg', '{"1份":8}', 1),
  ('ing_173', 'sop_taro_ball', '水',     'cc', '{"1份":3000}', 2),
  ('ing_174', 'sop_taro_ball', '二砂',   'kg', '{"1份":4}', 3);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_175', 'sop_tangyuan', '圓糯米', 'kg', '{"1份":5}', 0),
  ('ing_176', 'sop_tangyuan', '長糯米', 'kg', '{"1份":5}', 1),
  ('ing_177', 'sop_tangyuan', '水（每缸）', 'cc', '{"1份":5000}', 2),
  ('ing_178', 'sop_tangyuan', '粿母（每缸）', 'kg', '{"1份":5}', 3);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_179', 'sop_purple_tangyuan', '圓糯米', 'kg', '{"1份":5}', 0),
  ('ing_180', 'sop_purple_tangyuan', '長糯米', 'kg', '{"1份":2.5}', 1),
  ('ing_181', 'sop_purple_tangyuan', '紫米',   'kg', '{"1份":2.5}', 2),
  ('ing_182', 'sop_purple_tangyuan', '水（每缸）', 'cc', '{"1份":5000}', 3),
  ('ing_183', 'sop_purple_tangyuan', '粿母（每缸）', 'kg', '{"1份":5}', 4);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_184', 'sop_charcoal_ty', '湯圓',   'g', '{"1份":300}', 0),
  ('ing_185', 'sop_charcoal_ty', '竹炭粉', 'g', '{"1份":4}', 1);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_186', 'sop_matcha_ty', '麵糰', 'g', '{"1份":600}', 0),
  ('ing_187', 'sop_matcha_ty', '抹茶粉', 'g', '{"1份":10}', 1);

INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_188', 'sop_algae_ty', '麵糰', 'g', '{"1份":600}', 0),
  ('ing_189', 'sop_algae_ty', '綠藻粉', 'g', '{"1份":8}', 1);

-- ── A區 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_tofu_full',      'cat_zone_a', '1桶豆花桶 9800（新）', '{"1份"}', '大鍋82度', 0),
  ('sop_tofu_half',      'cat_zone_a', '半桶豆花桶 4900',      '{"1份"}', '大鍋82度', 1),
  ('sop_sugar_fry5',     'cat_zone_a', '炒糖（5份）炒食機',    '{"1份"}', '豆花糖水，濃縮糖漿稀釋3倍（豆花使用再加冰塊）', 2),
  ('sop_sugar_fry1',     'cat_zone_a', '炒糖（1份）厚鋁鍋',    '{"1份"}', '豆花糖水，濃縮糖漿稀釋3倍', 3),
  ('sop_sesame_paste',   'cat_zone_a', '芝麻糊 半桶',          '{"1份"}', '冰上淋漿，半桶=3.5盒', 4),
  ('sop_taro_ball_new',  'cat_zone_a', '新芋泥球',             '{"1份"}', '蒸的重量=盒數×1.9', 5),
  ('sop_honey_taro',     'cat_zone_a', '蜜芋頭',              '{"1份"}', '共裝4盒，1盒1.7kg', 6),
  ('sop_honey_taro_pc',  'cat_zone_a', '蜜芋頭 25升壓力鍋',   '{"1份"}', '1大盒', 7),
  ('sop_barley_taro',    'cat_zone_a', '薏仁芋頭湯',          '{"1份"}', '', 8);

-- 1桶豆花
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_200', 'sop_tofu_full', '無糖豆漿',   'ml', '{"1份":10000}', 0),
  ('ing_201', 'sop_tofu_full', '純地瓜粉',   'g',  '{"1份":130}', 1),
  ('ing_202', 'sop_tofu_full', '石膏',       'g',  '{"1份":24}', 2),
  ('ing_203', 'sop_tofu_full', '冷水',       'g',  '{"1份":600}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_050', 'sop_tofu_full', 1, '煮豆漿', '豆漿煮到85度', 0),
  ('stp_051', 'sop_tofu_full', 2, '沖粉水', '地瓜粉+石膏+冷水混合，沖完加蓋子燜30分鐘', 1);

-- 半桶豆花
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_204', 'sop_tofu_half', '無糖豆漿', 'ml', '{"1份":5000}', 0),
  ('ing_205', 'sop_tofu_half', '純地瓜粉', 'g',  '{"1份":65}', 1),
  ('ing_206', 'sop_tofu_half', '石膏',     'g',  '{"1份":12}', 2),
  ('ing_207', 'sop_tofu_half', '冷水',     'g',  '{"1份":300}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_052', 'sop_tofu_half', 1, '煮豆漿', '豆漿煮到85度（大鍋82度）', 0),
  ('stp_053', 'sop_tofu_half', 2, '沖粉水', '地瓜粉+石膏+冷水混合，沖完加蓋子燜30分鐘', 1);

-- 炒糖 5份
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_208', 'sop_sugar_fry5', '二砂', 'g', '{"1份":14000}', 0),
  ('ing_209', 'sop_sugar_fry5', '黑糖', 'g', '{"1份":1000}', 1),
  ('ing_210', 'sop_sugar_fry5', '水',   'g', '{"1份":10000}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_054', 'sop_sugar_fry5', 1, '炒糖', '第一次下9000g二砂中火攪拌等化水', 0),
  ('stp_055', 'sop_sugar_fry5', 2, '降溫', '關火等溫度降至145度', 1),
  ('stp_056', 'sop_sugar_fry5', 3, '加水', '下925熱水等3分鐘，再下9075熱水開中火攪拌至化開', 2),
  ('stp_057', 'sop_sugar_fry5', 4, '二次糖', '再下5000g二砂，等2分鐘後最後下1000黑糖', 3);

-- 炒糖 1份
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_211', 'sop_sugar_fry1', '二砂', 'g', '{"1份":2800}', 0),
  ('ing_212', 'sop_sugar_fry1', '黑糖', 'g', '{"1份":200}', 1),
  ('ing_213', 'sop_sugar_fry1', '水',   'g', '{"1份":2000}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_058', 'sop_sugar_fry1', 1, '炒糖', '下1300g二砂+200g黑糖炒至化漿', 0),
  ('stp_059', 'sop_sugar_fry1', 2, '焦化', '停止攪動直至小冒泡下160g熱水，不動等約3分鐘等焦化', 1),
  ('stp_060', 'sop_sugar_fry1', 3, '煮糖', '再下1850g熱水慢慢煮至糖化開再下1500g二砂煮至滾，小火3分鐘', 2);

-- 芝麻糊
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_214', 'sop_sesame_paste', '黑芝麻', 'g',  '{"1份":1200}', 0),
  ('ing_215', 'sop_sesame_paste', '水量',   'g',  '{"1份":6750}', 1),
  ('ing_216', 'sop_sesame_paste', '白砂',   'g',  '{"1份":150}', 2),
  ('ing_217', 'sop_sesame_paste', '黑糖',   'g',  '{"1份":30}', 3),
  ('ing_218', 'sop_sesame_paste', '冰糖',   'g',  '{"1份":250}', 4),
  ('ing_219', 'sop_sesame_paste', '長糯米', 'g',  '{"1份":100}', 5),
  ('ing_220', 'sop_sesame_paste', '部落米', 'g',  '{"1份":150}', 6),
  ('ing_221', 'sop_sesame_paste', '糯米水', 'cc', '{"1份":1000}', 7);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_061', 'sop_sesame_paste', 1, '煮', '煮 13 分鐘', 0);

-- 新芋泥球
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_222', 'sop_taro_ball_new', '芋頭',     'kg', '{"1份":1}', 0),
  ('ing_223', 'sop_taro_ball_new', '糖（細冰糖）', '', '{"1份":0}', 1),
  ('ing_224', 'sop_taro_ball_new', '冰塊',     '',   '{"1份":0}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_062', 'sop_taro_ball_new', 1, '計算', '蒸的重量=盒數×1.9，糖=芋頭kg÷8，冰塊=芋頭kg×180', 0),
  ('stp_063', 'sop_taro_ball_new', 2, '備註', '5、6盒以上冰塊總重多加400，糖多加30~40g', 1);

-- 蜜芋頭
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_225', 'sop_honey_taro', '芋頭', 'kg', '{"1份":5}', 0),
  ('ing_226', 'sop_honey_taro', '特砂', 'kg', '{"1份":1.2}', 1),
  ('ing_227', 'sop_honey_taro', '冰糖', 'kg', '{"1份":1}', 2),
  ('ing_228', 'sop_honey_taro', '米酒', '瓶蓋', '{"1份":2}', 3),
  ('ing_229', 'sop_honey_taro', '冷水', 'cc', '{"1份":6000}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_064', 'sop_honey_taro', 1, '煮', '冷水下後糖直接下，開4200w滾後轉800w 40分鐘再400w 20分鐘', 0),
  ('stp_065', 'sop_honey_taro', 2, '攪拌', '中間要攪拌約4次，讓生芋頭與熟芋頭混合，全程蓋蓋子開小洞', 1),
  ('stp_066', 'sop_honey_taro', 3, '冰鎮', '冰鎮也要蓋蓋子', 2);

-- 蜜芋頭 壓力鍋
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_230', 'sop_honey_taro_pc', '芋頭', 'kg', '{"1份":2.5}', 0),
  ('ing_231', 'sop_honey_taro_pc', '特砂', 'kg', '{"1份":0.6}', 1),
  ('ing_232', 'sop_honey_taro_pc', '冰糖', 'kg', '{"1份":0.5}', 2),
  ('ing_233', 'sop_honey_taro_pc', '米酒', '瓶蓋', '{"1份":2}', 3),
  ('ing_234', 'sop_honey_taro_pc', '冷水', 'cc', '{"1份":3000}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_067', 'sop_honey_taro_pc', 1, '煮', '冷水下後米酒，糖直接下，開2000w煮到滾後再煮3分鐘', 0),
  ('stp_068', 'sop_honey_taro_pc', 2, '冰鎮', '降閥開蓋冰鎮', 1);

-- 薏仁芋頭湯
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_235', 'sop_barley_taro', '薏仁片', 'g',  '{"1份":700}', 0),
  ('ing_236', 'sop_barley_taro', '芋頭簽', 'g',  '{"1份":900}', 1),
  ('ing_237', 'sop_barley_taro', '冰糖',   'g',  '{"1份":750}', 2),
  ('ing_238', 'sop_barley_taro', '熱水',   'cc', '{"1份":12000}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_069', 'sop_barley_taro', 1, '煮', '800w 30分鐘', 0);

-- ── B區 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_barley',       'cat_zone_b', '薏仁料',     '{"2.3盒","4.6盒","6.6盒"}', '1盒 料1500 湯600', 0),
  ('sop_mungbean',     'cat_zone_b', '綠豆料',     '{"2盒","4盒","6盒"}', '1盒 料1300 湯700', 1),
  ('sop_redbean',      'cat_zone_b', '紅豆料',     '{"2盒","4盒","6盒"}', '1盒 料1300 湯700', 2),
  ('sop_kidney',       'cat_zone_b', '花豆',       '{"1盒","2盒","3盒","4盒"}', '', 3),
  ('sop_peanut_new',   'cat_zone_b', '花生（新壓力鍋）', '{"2盒","3盒"}', '隔水加熱', 4),
  ('sop_peanut_15l',   'cat_zone_b', '花生 15L',   '{"2盒","4盒"}', '1盒 料1300 湯700', 5),
  ('sop_peanut_35l',   'cat_zone_b', '花生 35L',   '{"6盒","8盒"}', '', 6),
  ('sop_purple_soup',  'cat_zone_b', '紫米紅豆湯', '{"1份"}', '', 7),
  ('sop_barley_soup',  'cat_zone_b', '薏仁湯',     '{"1份"}', '', 8);

-- 薏仁料（多批次）
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_250', 'sop_barley', '小薏仁', 'g',  '{"2.3盒":750,"4.6盒":1500,"6.6盒":2200}', 0),
  ('ing_251', 'sop_barley', '白砂',   'g',  '{"2.3盒":250,"4.6盒":500,"6.6盒":800}', 1),
  ('ing_252', 'sop_barley', '熱水',   'cc', '{"2.3盒":6500,"4.6盒":15000,"6.6盒":15000}', 2),
  ('ing_253', 'sop_barley', '起鍋後加熱水', 'cc', '{"2.3盒":0,"4.6盒":1500,"6.6盒":3000}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_070', 'sop_barley', 1, '泡洗', '先用熱水泡5分鐘，再洗2次', 0),
  ('stp_071', 'sop_barley', 2, '煮', '大火滾後小火 40分鐘', 1);

-- 綠豆料
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_254', 'sop_mungbean', '綠豆', 'g',  '{"2盒":900,"4盒":1890,"6盒":2890}', 0),
  ('ing_255', 'sop_mungbean', '熱水', 'g',  '{"2盒":3200,"4盒":6500,"6盒":9800}', 1),
  ('ing_256', 'sop_mungbean', '二砂', 'g',  '{"2盒":700,"4盒":1400,"6盒":2100}', 2),
  ('ing_257', 'sop_mungbean', '冰塊', 'g',  '{"2盒":2655,"4盒":5310,"6盒":7965}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_072', 'sop_mungbean', 1, '煮', '電磁爐120度煮，閥響8分鐘關火', 0),
  ('stp_073', 'sop_mungbean', 2, '燜', '燜30分手動洩閥', 1),
  ('stp_074', 'sop_mungbean', 3, '蜜糖', '蜜糖30分鐘', 2);

-- 紅豆料
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_258', 'sop_redbean', '紅豆', 'kg', '{"2盒":1.24,"4盒":2.34,"6盒":3.44}', 0),
  ('ing_259', 'sop_redbean', '冷水', 'g',  '{"2盒":3200,"4盒":6500,"6盒":9800}', 1),
  ('ing_260', 'sop_redbean', '二砂', 'kg', '{"2盒":0.7,"4盒":1.4,"6盒":2.1}', 2),
  ('ing_261', 'sop_redbean', '冰塊', 'g',  '{"2盒":2655,"4盒":5300,"6盒":7965}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_075', 'sop_redbean', 1, '煮', '閥響，400w計時30分降閥', 0),
  ('stp_076', 'sop_redbean', 2, '燜', '燜30分鐘開蓋', 1),
  ('stp_077', 'sop_redbean', 3, '蜜糖', '蜜糖時間30分鐘，總時間1小時10分', 2);

-- 花豆（4種批次）
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_262', 'sop_kidney', '花豆', 'kg', '{"1盒":1.3,"2盒":2.5,"3盒":4,"4盒":5}', 0),
  ('ing_263', 'sop_kidney', '冷水', 'cc', '{"1盒":5000,"2盒":9500,"3盒":14200,"4盒":19200}', 1),
  ('ing_264', 'sop_kidney', '二砂', 'g',  '{"1盒":690,"2盒":1370,"3盒":2050,"4盒":2710}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_078', 'sop_kidney', 1, '煮', '閥響1分鐘，响35分鐘', 0),
  ('stp_079', 'sop_kidney', 2, '燜', '降閥燜1小時', 1),
  ('stp_080', 'sop_kidney', 3, '蜜糖', '蜜糖30分鐘', 2);

-- 花生（新壓力鍋）
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_265', 'sop_peanut_new', '花生',   'kg', '{"2盒":3.5,"3盒":5}', 0),
  ('ing_266', 'sop_peanut_new', '二砂',   'g',  '{"2盒":500,"3盒":720}', 1),
  ('ing_267', 'sop_peanut_new', '白砂',   'g',  '{"2盒":700,"3盒":960}', 2),
  ('ing_268', 'sop_peanut_new', '內鍋水', 'kg', '{"2盒":5,"3盒":7}', 3),
  ('ing_269', 'sop_peanut_new', '外鍋水', 'kg', '{"2盒":2,"3盒":2}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_081', 'sop_peanut_new', 1, '煮', '4200w閥響轉800w 1.5小時', 0),
  ('stp_082', 'sop_peanut_new', 2, '悶', '再悶1小時', 1),
  ('stp_083', 'sop_peanut_new', 3, '蜜糖', '開蓋下糖蜜30分鐘，冰鎮', 2);

-- 花生 15L
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_270', 'sop_peanut_15l', '花生', 'kg', '{"2盒":2,"4盒":3.9}', 0),
  ('ing_271', 'sop_peanut_15l', '二砂', 'g',  '{"2盒":300,"4盒":550}', 1),
  ('ing_272', 'sop_peanut_15l', '白砂', 'g',  '{"2盒":400,"4盒":720}', 2),
  ('ing_273', 'sop_peanut_15l', '熱水', 'cc', '{"2盒":5000,"4盒":9000}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_084', 'sop_peanut_15l', 1, '煮', '4200w閥響轉800w 1小時15分鐘，再悶1小時', 0),
  ('stp_085', 'sop_peanut_15l', 2, '蜜糖', '開蓋下糖蜜30分鐘，冰鎮。總時間2小時15分', 1);

-- 花生 35L
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_274', 'sop_peanut_35l', '花生', 'kg', '{"6盒":5.4,"8盒":7}', 0),
  ('ing_275', 'sop_peanut_35l', '二砂', 'g',  '{"6盒":720,"8盒":960}', 1),
  ('ing_276', 'sop_peanut_35l', '白砂', 'g',  '{"6盒":960,"8盒":1300}', 2),
  ('ing_277', 'sop_peanut_35l', '熱水', 'cc', '{"6盒":13000,"8盒":17000}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_086', 'sop_peanut_35l', 1, '煮', '4200w閥響轉800w 1小時15分鐘，再悶1小時', 0),
  ('stp_087', 'sop_peanut_35l', 2, '蜜糖', '開蓋下糖蜜30分鐘，冰鎮。總時間2小時15分', 1);

-- 紫米紅豆湯
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_278', 'sop_purple_soup', '紅豆',   'kg', '{"1份":1.6}', 0),
  ('ing_279', 'sop_purple_soup', '紫米',   'kg', '{"1份":0.6}', 1),
  ('ing_280', 'sop_purple_soup', '部落米', 'kg', '{"1份":0.1}', 2),
  ('ing_281', 'sop_purple_soup', '熱水',   'cc', '{"1份":12000}', 3),
  ('ing_282', 'sop_purple_soup', '二砂',   'g',  '{"1份":600}', 4),
  ('ing_283', 'sop_purple_soup', '白砂',   'g',  '{"1份":450}', 5),
  ('ing_284', 'sop_purple_soup', '黑糖',   'g',  '{"1份":100}', 6);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_088', 'sop_purple_soup', 1, '煮', '響閥 12分鐘 400w', 0);

-- 薏仁湯
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_285', 'sop_barley_soup', '薏仁片', 'g',  '{"1份":1000}', 0),
  ('ing_286', 'sop_barley_soup', '冰糖',   'g',  '{"1份":750}', 1),
  ('ing_287', 'sop_barley_soup', '熱水',   'cc', '{"1份":12000}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_089', 'sop_barley_soup', 1, '煮', '閥響煮40分鐘，自然洩閥', 0),
  ('stp_090', 'sop_barley_soup', 2, '調味', '糖最後下，裝桶後下涼水台', 1);

-- ── C區 ──

INSERT INTO sop_recipes (id, category_id, name, batch_sizes, notes, sort_order) VALUES
  ('sop_sugarcane',     'cat_zone_c', '甘蔗糖水',         '{"1份"}', '9壺', 0),
  ('sop_tapioca_syrup', 'cat_zone_c', '粉圓糖水',         '{"1壺","2壺","3壺"}', '1壺5000cc', 1),
  ('sop_silver_ear',    'cat_zone_c', '銀耳',             '{"1份","半桶"}', '', 2),
  ('sop_tender_grass',  'cat_zone_c', '嫩仙草 1桶（新）', '{"1份"}', '', 3),
  ('sop_burn_grass_c',  'cat_zone_c', '（新）燒仙草',     '{"1份"}', '', 4),
  ('sop_taro_paste',    'cat_zone_c', '芋泥漿',           '{"1份"}', '1桶漿17kg', 5),
  ('sop_almond_tea',    'cat_zone_c', '杏仁茶',           '{"1份"}', '5000要煮2份', 6);

-- 甘蔗糖水
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_300', 'sop_sugarcane', '甘蔗汁', '瓶', '{"1份":20}', 0),
  ('ing_301', 'sop_sugarcane', '二砂',   'kg', '{"1份":32}', 1),
  ('ing_302', 'sop_sugarcane', '水',     'kg', '{"1份":16}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_100', 'sop_sugarcane', 1, '煮水', '先下水16kg煮滾後再下二砂32kg（攪拌至無顆粒）', 0),
  ('stp_101', 'sop_sugarcane', 2, '煮糖', '煮滾後中火20分鐘，冷卻30分鐘', 1),
  ('stp_102', 'sop_sugarcane', 3, '加汁', '再加20瓶甘蔗汁攪拌一下即裝桶冰鎮', 2);

-- 粉圓糖水
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_303', 'sop_tapioca_syrup', '二砂', 'g',  '{"1壺":1150,"2壺":2300,"3壺":3450}', 0),
  ('ing_304', 'sop_tapioca_syrup', '黑糖', 'g',  '{"1壺":2025,"2壺":4050,"3壺":6075}', 1),
  ('ing_305', 'sop_tapioca_syrup', '熱水', 'cc', '{"1壺":3250,"2壺":6500,"3壺":9750}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_103', 'sop_tapioca_syrup', 1, '煮', '滾了再煮4~5分鐘', 0);

-- 銀耳
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_306', 'sop_silver_ear', '銀耳', 'g',  '{"1份":110,"半桶":75}', 0),
  ('ing_307', 'sop_silver_ear', '熱水', 'cc', '{"1份":12000,"半桶":8000}', 1),
  ('ing_308', 'sop_silver_ear', '冰糖', 'g',  '{"1份":800,"半桶":550}', 2),
  ('ing_309', 'sop_silver_ear', '枸杞', 'g',  '{"1份":55,"半桶":35}', 3),
  ('ing_310', 'sop_silver_ear', '紅棗', '顆', '{"1份":45,"半桶":25}', 4);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_104', 'sop_silver_ear', 1, '煮', '小火45分鐘', 0),
  ('stp_105', 'sop_silver_ear', 2, '洩閥', '自然洩閥1小時', 1);

-- 嫩仙草
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_311', 'sop_tender_grass', '熱水',         'cc', '{"1份":10000}', 0),
  ('ing_312', 'sop_tender_grass', '東城袋裝',     'cc', '{"1份":3000}', 1),
  ('ing_313', 'sop_tender_grass', '狀元',         'cc', '{"1份":2000}', 2),
  ('ing_314', 'sop_tender_grass', '粉粿粉',       'g',  '{"1份":150}', 3),
  ('ing_315', 'sop_tender_grass', '粉水',         'cc', '{"1份":500}', 4);

-- C區 燒仙草
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_316', 'sop_burn_grass_c', '東城仙草汁', 'cc', '{"1份":4000}', 0),
  ('ing_317', 'sop_burn_grass_c', '員林',       'g',  '{"1份":400}', 1),
  ('ing_318', 'sop_burn_grass_c', '熱水',       'cc', '{"1份":11000}', 2),
  ('ing_319', 'sop_burn_grass_c', '地瓜粉',     'g',  '{"1份":50}', 3),
  ('ing_320', 'sop_burn_grass_c', '玉米粉',     'g',  '{"1份":50}', 4),
  ('ing_321', 'sop_burn_grass_c', '粉水',       'cc', '{"1份":500}', 5);

-- 芋泥漿
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_322', 'sop_taro_paste', '芋頭',   'kg', '{"1份":8}', 0),
  ('ing_323', 'sop_taro_paste', '白砂糖', '',   '{"1份":0}', 1),
  ('ing_324', 'sop_taro_paste', '水',     'cc', '{"1份":10000}', 2);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_106', 'sop_taro_paste', 1, '計算', '白砂糖=總芋頭÷4', 0),
  ('stp_107', 'sop_taro_paste', 2, '打漿', '一桶漿17公斤', 1);

-- 杏仁茶
INSERT INTO sop_ingredients (id, recipe_id, name, unit, amounts, sort_order) VALUES
  ('ing_325', 'sop_almond_tea', '杏仁片（恒樂）', 'kg', '{"1份":0.7}', 0),
  ('ing_326', 'sop_almond_tea', '部落米',         'kg', '{"1份":0.2}', 1),
  ('ing_327', 'sop_almond_tea', '冰糖',           '',   '{"1份":0}', 2),
  ('ing_328', 'sop_almond_tea', '水',             'cc', '{"1份":10000}', 3);
INSERT INTO sop_steps (id, recipe_id, step_number, title, description, sort_order) VALUES
  ('stp_108', 'sop_almond_tea', 1, '打', '果汁機小台打4次，大台打2次', 0),
  ('stp_109', 'sop_almond_tea', 2, '泡洗', '冷水洗2遍後泡熱水30分鐘', 1),
  ('stp_110', 'sop_almond_tea', 3, '煮', '滾後小火煮20分鐘，5份大火煮40分鐘', 2),
  ('stp_111', 'sop_almond_tea', 4, '調味', '杏仁茶煮好，糖最後裝壺再下。1壺5000cc下冰糖200g', 3);
