# 明日繼續開發指南

## 專案名稱
阿爸的芋圓 — 門店盤點叫貨 & 中央廚房生產出貨庫存管理系統

## 專案路徑
`C:\Users\YEN\YEN_project\Yba_order`

## 備份路徑
- Day 1：`Yba_order_backup_20260217`
- Day 2 早：`Yba_order_backup_20260218`
- Day 2 晚：`Yba_order_backup_20260218_v2`
- Day 3：`Yba_order_backup_20260219`

---

## 目前完成進度

### ✅ Phase 1 前端 UI — 全部完成
1. ✅ PRD 需求文檔 (`docs/PRD.md`)
2. ✅ 設計規範文檔 (`docs/DESIGN_SPEC.md`)
3. ✅ 專案初始化 (Vite + React + TypeScript)
4. ✅ 設計 Token (Tailwind 品牌色、字體、圓角)
5. ✅ 6 個核心元件
6. ✅ 5 個資料定義檔 (storeProducts、rawMaterials、stores、settlementFields、staff)
7. ✅ 6 個門店端頁面 (首頁、盤點、結帳、用量、叫貨、收貨確認)
8. ✅ 6 個央廚端頁面 (首頁、叫貨總表、出貨表、原物料庫存、成品庫存、原物料叫貨)
9. ✅ 手機區網測試環境
10. ✅ UI 佈局優化（盤點/庫存水平排列、間距壓縮、對齊修正）
11. ✅ 輸入框樣式優化（底色加深、文字加深、結帳框加寬）
12. ✅ 天氣預報叫貨建議 + 天氣係數
13. ✅ 出貨異動流程（央廚→門店收貨同步顯示）
14. ✅ A4 列印功能（叫貨總表）
15. ✅ 人員確認功能（央廚4頁+門店首頁）
16. ✅ 叫貨備註（固定項目+自由備註+央廚同步顯示）
17. ✅ 建議量四捨五入規則（各品類不同單位）
18. ✅ 品項資料完整調整（Day 3 大幅更新，共 38 項）
19. ✅ Netlify 部署完成（https://yba-order.netlify.app）

### ⏳ Phase 2 進行中 — 後台管理 + Supabase 串接
1. ⏳ 後台管理系統（品項管理、人員管理）
2. ❌ Supabase 資料庫建立（資料表、RLS 規則）
3. ❌ Supabase Auth 使用者認證
4. ❌ 替換模擬資料為 Supabase CRUD
5. ❌ QR Code 產生（各角色入口）
6. ❌ 天氣 API 串接（中央氣象署開放資料）
7. ❌ 門店當班人員傳遞到子頁面提交

### ❌ Phase 3 進階功能
8. ❌ 老闆報表（日報、週報、月報）
9. ❌ 天氣記錄與用量分析
10. ❌ 數據匯出（Excel / PDF）
11. ❌ 推播通知（庫存不足、叫貨提醒）

---

## 啟動方式

```bash
cd C:\Users\YEN\YEN_project\Yba_order
npm run dev
```

電腦瀏覽器：
- 樂華店：http://localhost:5173/store/lehua
- 興南店：http://localhost:5173/store/xingnan
- 中央廚房：http://localhost:5173/kitchen

線上版：https://yba-order.netlify.app

手機測試（同 Wi-Fi）：
- 終端機顯示 `Network: http://192.168.x.x:5173/`
- 需開放防火牆：`netsh advfirewall firewall add rule name="Vite Dev" dir=in action=allow protocol=TCP localport=5173-5180`

---

## 品項清單（最新 38 項）

| 分類 | 品項 |
|------|------|
| 配料類（盒裝）| 紅豆、綠豆、花生、小薏仁 |
| 加工品類 | 芋泥球、芋泥漿、芝麻糊、嫩仙草、豆花(冷)、豆花(熱)、紫米紅豆料(0.5桶)、紫米紅豆料(1桶)、紫米紅豆湯、芋頭湯材料(0.5桶)、芋頭湯材料(1桶)、銀耳湯、薏仁湯、芋頭湯(冷)、芋頭湯(熱) |
| 主食類（袋裝）| 芋圓、白玉、粉圓 |
| 液體類 | 粉圓糖水、炒糖糖水、微糖豆漿、無糖豆漿、杏仁茶 |
| 冰品類 | 花生冰淇淋(盒)、芝麻冰淇淋(盒)、花生冰淇淋(杯)、芝麻冰淇淋(杯)、草莓冰淇淋(杯)、蔗片冰 |
| 其他 | 芝麻湯圓、鮮奶、冷凍薑汁 |

---

## 人員名單

| 位置 | 人員 |
|------|------|
| 央廚 | 關堉勝、陳宣辰、陳佑欣、胡廷瑜、張馨予 |
| 樂華店 | 顏伊偲、蔡博達 |
| 興南店 | 陳宣佑、郭峻豪 |

---

## 技術棧
| 項目 | 版本 |
|------|------|
| React | 19.x |
| TypeScript | 5.9.x |
| Vite | 7.x |
| Tailwind CSS | 3.x |
| React Router | 7.x |
| Lucide React | icons |
| Zustand | (已安裝，待使用) |
| React Hook Form | (已安裝，待使用) |
| Zod | (已安裝，待使用) |

---

## 提示指令
- `/產品` → 召喚產品經理修改 PRD
- `/設計` → 召喚設計師修改設計規範
- `/開發` → 召喚開發工程師繼續編碼
