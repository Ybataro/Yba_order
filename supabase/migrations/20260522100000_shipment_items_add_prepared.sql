-- ============================================================
-- shipment_items 新增 prepared 欄位（2026-05-22）
--
-- 背景：原 `received` 欄位被央廚（Shipment.tsx）和門店（Receive.tsx）兩端共用
--      但語意不同 — 央廚 = 「我準備好了」、門店 = 「我收到了」
--      造成 prod 109 個 session 標未收貨，但裡面 1663 個 items 卻 received=true
--
-- 修法：拆兩個欄位
--   - `prepared` 新增：央廚個別品項 ✓ 打勾用（央廚意思「我準備好了」）
--   - `received` 保留：門店收貨確認用（語意專注）
--
-- 資料遷移：把現存的 received 複製到 prepared，保留央廚 ✓ 紀錄
-- ============================================================

ALTER TABLE public.shipment_items
  ADD COLUMN IF NOT EXISTS prepared boolean NOT NULL DEFAULT false;

-- 把現存資料的 received 複製到 prepared
-- 因 prod 大部分 received=true 來自央廚 ✓，這樣遷移是對的
UPDATE public.shipment_items SET prepared = received WHERE prepared = false;

COMMENT ON COLUMN public.shipment_items.prepared IS '央廚個別品項打勾標示（央廚 Shipment.tsx 寫入）';
COMMENT ON COLUMN public.shipment_items.received IS '門店收貨確認（門店 Receive.tsx 寫入；2026-05-22 後業務廢用，但保留欄位供未來恢復）';
