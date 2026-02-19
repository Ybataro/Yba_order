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

### ✅ Phase 2 後台管理 + Supabase + 部署 — 全部完成
1. ✅ 後台管理系統（5 個管理頁面：品項/原物料/人員/門店/結帳欄位）
2. ✅ Zustand 狀態管理（5 個 stores + 分類管理）
3. ✅ QR Code 管理頁面（動態門店 QR、央廚、後台、列印功能）
4. ✅ Supabase 資料庫（6 張表 + RLS + seed data）
5. ✅ Supabase 串接（5 個 stores 全部改接雲端，樂觀更新）
6. ✅ Netlify 部署 + GitHub 自動部署
7. ✅ SPA fallback (_redirects)

### ✅ Phase 2.5 營運資料表 + 樓層功能（Day 4 完成）
1. ✅ 營運資料表（10 張新表：盤點/叫貨/結帳/出貨/收貨/原物料庫存/原物料叫貨/成品庫存）
2. ✅ 全部操作頁面接上 Supabase（盤點/叫貨/結帳/出貨/收貨等 upsert 邏輯）
3. ✅ 盤點分樓層功能（zone 概念、QR Code 樓層篩選、合併檢視）
4. ✅ 後台樓層品項管理（ZoneManager）
5. ✅ 歷史叫貨查詢及統計（OrderHistory 明細+統計雙模式）
6. ✅ 盤點「全部」合併檢視（唯讀）
7. ✅ 央廚成品庫存盤點接 Supabase
8. ✅ 物料盤點編輯模式已修改品項標記
9. ✅ 後台子頁面返回鍵統一導向 /admin

### ✅ Phase 2.6 報表功能（Day 5 完成）
1. ✅ 結帳歷史查詢（/admin/settlement-history）— 明細+月報統計雙模式
2. ✅ 叫貨價格統計（/admin/order-pricing）— 品項×日期矩陣+成本摘要
3. ✅ 品項價格欄位（our_cost / franchise_price）— SQL + type + store + Modal

### ✅ Phase 3 進階功能（Day 6 完成）
1. ✅ 門店當班人員傳遞（?staff= URL params → submitted_by）
2. ✅ 叫貨建議量計算（近 7 日 Supabase 日均 × 天氣係數）
3. ✅ 天氣 API 串接（中央氣象署 F-C0032-001，新北市明日預報）
4. ✅ 數據匯出 Excel（xlsx 套件，三個報表頁面）
5. ✅ 全專案 mock 資料清除（所有頁面改用 Supabase 真實資料）

### ❌ Phase 4 待開發
1. ❌ 天氣記錄與用量分析
2. ❌ 推播通知（庫存不足、叫貨提醒）
3. ❌ PDF 匯出
4. ❌ 權限/登入系統
5. ❌ 離線暫存與同步

---

## 線上服務

| 服務 | 網址 |
|------|------|
| 線上版 | https://yba-order.netlify.app |
| GitHub | https://github.com/Ybataro/Yba_order |
| Supabase | https://qshfgheqsnsghwqaqehi.supabase.co |

### 環境變數
```
VITE_SUPABASE_URL=https://qshfgheqsnsghwqaqehi.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN
VITE_CWA_API_KEY=CWA-EAAD8090-1787-462E-8BC1-73478DD637B3
```
> Netlify 也需設定這三個環境變數（已完成）

### Supabase 資料表（18 張）

**基礎資料（6 張，migration.sql）：**
| 表名 | 說明 |
|------|------|
| stores | 門店（樂華店、興南店） |
| store_products | 門店品項（38 項，含 our_cost / franchise_price） |
| raw_materials | 央廚原物料（29 項） |
| staff | 人員（央廚 5 人 + 門店 4 人） |
| settlement_fields | 結帳欄位（32 欄） |
| categories | 分類（product/material/settlement） |

**樓層功能（2 張）：**
| 表名 | 說明 |
|------|------|
| store_zones | 門店樓層（樂華 1F+2F、興南 1F） |
| zone_products | 樓層品項對應 |

**營運資料（10 張）：**
| 表名 | 說明 |
|------|------|
| inventory_sessions / inventory_items | 門店物料盤點 |
| order_sessions / order_items | 門店叫貨 |
| settlement_sessions / settlement_values | 門店每日結帳 |
| shipment_sessions / shipment_items | 央廚出貨 + 門店收貨 |
| material_stock_sessions / material_stock_items | 央廚原物料庫存盤點 |
| material_order_sessions / material_order_items | 央廚原物料叫貨 |
| product_stock_sessions / product_stock_items | 央廚成品庫存盤點 |

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
- 後台管理：http://localhost:5173/admin
- QR Code：http://localhost:5173/admin/qrcode

線上版：https://yba-order.netlify.app

手機測試（同 Wi-Fi）：
- 終端機顯示 `Network: http://192.168.x.x:5173/`
- 需開放防火牆：`netsh advfirewall firewall add rule name="Vite Dev" dir=in action=allow protocol=TCP localport=5173-5180`

---

## 部署流程

修改程式碼後：
```bash
git add . && git commit -m "描述" && git push
```
Netlify 會自動偵測 GitHub push 並重新部署（約 1-2 分鐘）。

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
| Zustand | 5.x（狀態管理，已接 Supabase） |
| React Hook Form | 7.x |
| Zod | 4.x |
| Supabase | 2.x（雲端資料庫） |
| qrcode.react | 4.x（QR Code 產生） |
| xlsx | 0.18.x（Excel 匯出） |

---

## 提示指令
- `/產品` → 召喚產品經理修改 PRD
- `/設計` → 召喚設計師修改設計規範
- `/開發` → 召喚開發工程師繼續編碼
