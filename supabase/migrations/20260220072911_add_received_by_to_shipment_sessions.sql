-- 新增 received_by 欄位：記錄門店收貨確認人
alter table shipment_sessions
  add column received_by text;
