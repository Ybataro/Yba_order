# YBA 生產管理 6 大功能 — 完整審查報告

> 審查日期：2026-05-21
> 6 個 sub-agent 平行勘查 + prod 真實 SQL 驗證
> 7 個檔案總計 2,676 行 — 找出約 55 個發現
> **prod 真實狀態驗證**：3 個「孤兒參考」P1 在 prod **目前不存在**（預防性問題）

---

## 🚨 與第一輪審查的差異

這輪 prompt 強調「驗證導向」+「不要把預防性風險寫 P0」，效果明顯：
- 6 個 agent **僅 1 個寫了 P0**（且我驗證後降級為 P1）
- 大部分發現都標 P1/P2，**比例更合理**
- agent 主動驗證糖種 hardcode bug（呼應你 2026-05-02 修的）已修

---

## 🎯 我驗證後的真實優先級分布

| 真實嚴重度 | 數量 | 說明 |
|---|---|---|
| **🔴 P1（真實會出問題、需要修）** | **5** | 即時庫存時序、SOP 圖片孤兒、批次大小改後 amounts 對不上 等 |
| 🟡 P2（可改善 UX 或可維護性）| ~25 | 大部分屬於此級 |
| 🟢 P3（純預防、無立即影響）| ~15 | 大多是「未來若...」的假設 |
| **❌ 驗證後不是問題** | **8** | 含 3 個孤兒參考 P1（prod 0 筆）|

---

## 🔴 真實要修的 P1（5 個）

### P1-1：SOP 圖片刪除留下孤兒檔案（Storage 浪費）
- **位置**：`SopManager.tsx:123-129` confirmDelete
- **真實狀況**：目前 storage 4 個 = categories 4 個（剛好對得上）。**只要刪除任一 SOP 分類就會產生孤兒**
- **影響**：長期累積會佔用 Supabase Storage 配額
- **修法**：delete category 前先 `supabase.storage.from('sop-images').remove([path])`
- **工時**：30 分鐘

### P1-2：SOP 編輯時舊圖片未清除
- **位置**：`SopManager.tsx:98` 編輯邏輯
- **影響**：每次換 SOP 圖片，舊圖片永遠留在 storage
- **修法**：上傳新圖前先刪除舊圖
- **工時**：20 分鐘

### P1-3：SopDetail 批次大小改變後原料 amounts 對應不上
- **位置**：`SopDetail.tsx:56-58` submitRecipe
- **症狀**：原配方 `batch_sizes = ['2盒', '4盒']`，編輯改成 `['3盒', '5盒']`，原料 amounts 仍含舊批次鍵 → 新批次顯示「—」
- **影響**：使用者改完發現原料對應消失
- **修法**：偵測 batch_sizes 改變時提示重新填寫，或自動 migrate amounts
- **工時**：1 小時

### P1-4：ProductionZoneManager FieldTab 狀態未同步
- **位置**：`ProductionZoneManager.tsx:235-237`
- **症狀**：首次進入 FieldTab 若 zones 還沒載入，selectedItem 永遠卡空字串 → 品項列表空白
- **修法**：加 useEffect 監聽 zoneItems 變化同步 selectedItem
- **工時**：15 分鐘

### P1-5：MenuItemManager sort_order 重複
- **位置**：`MenuItemManager.tsx:80`
- **症狀**：`sort_order: menuItems.length`，刪除中間項目後新增會產生重複 sort_order
- **影響**：DB 記錄混亂（前端排序看起來 OK）
- **修法**：`Math.max(...menuItems.map(m =&gt; m.sort_order), -1) + 1`
- **工時**：5 分鐘

---

## 🟡 P2 精選（值得排程做）

### MaterialManager
- **net_weight_g = 0 → 顯示 Infinity**（input 邏輯有保護但 modal 顯示沒）
- **快速連點排序按鈕可能 race**（加 debounce）

### RecipeManager
- **原料價格變動回溯歷史成本**（業務決策題：要追溯還是快照？）
- **配方分類刪除時遷移到「未分類」邏輯 OK 但無確認提示**

### MenuItemManager
- **單位克數混淆**（`amount_g` 究竟是「單杯」還是「總量」沒有 UI 明示）
- **編輯時配料引用不驗證**（保存後可能變孤兒）

### ProductionZoneManager
- **Zone/Item/Field 級聯刪除依賴 DB 外鍵**（待驗證 ON DELETE CASCADE 是否設）
- **重複代碼**（ItemTab + FieldTab 的 Zone Pills 一樣，可抽元件）

### KitchenRealtimeItems
- **deduction 時序問題**：定義 deduction 後，**之前的 shipment 歷史不會回溯計算**
  - 例：3/10 出貨豆花，3/11 才定義「豆花扣豆漿×4」→ 3/10 的庫存不會自動回扣
  - 修法工時大（要 migration + 改 useKitchenRealtimeStock），先當已知限制
- **sort order 用 index 而非 id 直接交換**（多人同時動會 race）
- **ratio = 0 被無聲轉成 1**

### SOP
- **getPublicUrl 硬編 URL 結構**（建議改用 Supabase SDK 的 getPublicUrl）
- **步驟刪除後不重新編號**（1, 2, 3 刪 2 → 變 1, 3）
- **parseAmounts 把 'abc' 解析成 0 不警告**

---

## ❌ 驗證後不是 P1 的（agent 報誤）

### 「孤兒參考」3 連發 — prod 全部 0 筆
我跑 SQL 驗證：
```sql
-- menu_item_ingredients 指向已刪除 recipe：0 筆
-- sop-images storage vs categories：4 = 4（剛好）
-- kitchen_realtime_items.shipment_deductions 孤兒：0 筆
```

**結論**：這 3 個 P1 都是「**未來如果有人刪除...就會...**」的預防性風險，**不是當前已發生的 bug**。降級為 P2（值得修但不急）。

### 浮點精度誇大
RecipeManager 報「多原料加總浮點累積誤差」P3 — 跟第一輪 1.5 同樣的預防性擔心。prod 實況：所有金額都是整數，**完全不會累積**。降級為 P3 或忽略。

### Storage 級聯刪除（SOP）
agent 報 P1「Recipe 刪除無 Cascade 驗證」，但實際看 DB schema 已有 `ON DELETE CASCADE`（從 KitchenRealtimeItems 報告可看到 FK 設定）。確認其他表類似即可。

---

## 📋 建議實施順序（純前端，不動 DB）

| 順序 | 任務 | 工時 | 累積 |
|---|---|---|---|
| 1 | P1-5 MenuItemManager sort_order 修正 | 5 分 | 5 分 |
| 2 | P1-4 ProductionZoneManager FieldTab useEffect | 15 分 | 20 分 |
| 3 | P1-2 SOP 編輯時刪除舊圖 | 20 分 | 40 分 |
| 4 | P1-1 SOP 刪除分類時清 storage | 30 分 | 1.2 小時 |
| 5 | P1-3 SopDetail 批次改變警告 | 1 小時 | 2.2 小時 |
| 6 | P2 精選 5-6 項（看情況選）| 2 小時 | 4 小時 |

**估計總工時 4 小時可解決 5 個 P1 + 6 個重要 P2。**

---

## 🚦 需要你的決策

### 業務問題（需釐清才能動手）

1. **RecipeManager**：原料價格漲了，舊配方的歷史成本要追溯重算還是保留當時快照？
2. **MenuItemManager amount_g**：你要「單杯克數」還是「整批克數」？UI 怎麼明示給員工？
3. **KitchenRealtimeItems deduction 時序**：你能接受「改 deduction 後歷史不回算」嗎？或要做歷史 migration？

### 動手策略

| 選項 | 內容 |
|---|---|
| A | 我直接做 5 個 P1（4 小時） |
| B | P1 + P2 精選一起做（4 小時） |
| C | 先休息，等業務決策再動 |
| D | 只挑 P1-1、P1-2、P1-5 三個高 CP 值的（1 小時收）|

---

## 完整檔案位置

| 頁面 | 檔案 |
|---|---|
| MaterialManager | `src/pages/admin/MaterialManager.tsx` 239 行 |
| RecipeManager | `src/pages/admin/RecipeManager.tsx` 472 行 |
| MenuItemManager | `src/pages/admin/MenuItemManager.tsx` 244 行 |
| ProductionZoneManager | `src/pages/admin/ProductionZoneManager.tsx` 567 行 |
| KitchenRealtimeItems | `src/pages/admin/KitchenRealtimeItems.tsx` 366 行 |
| SopManager | `src/pages/admin/SopManager.tsx` 268 行 |
| SopDetail | `src/pages/admin/SopDetail.tsx` 520 行 |
