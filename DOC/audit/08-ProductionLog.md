# 08 — 央廚生產記錄 ProductionLog.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page：`src/pages/kitchen/ProductionLog.tsx`（399 行）
- Form：`src/components/ProductionZoneForm.tsx`（114 行）
- 欄位輸入：`src/components/ProductionFieldInput.tsx`（74 行）
- 糖種輸入：`src/components/SugarSelectInput.tsx`（128 行，**今天剛動 g→kg**）
- Store：`src/stores/useProductionZoneStore.ts`（342 行）
- 靜態 fallback：`src/data/productionZones.ts`（21 處 g→kg 今天改完）

**路由**：`/kitchen/production-log`（AuthGuard requiredRole="kitchen"）
**呼叫者**：`KitchenHome.tsx`
**最後 commit**：`caf9372 deploy: 2026-05-22_21:49`（**今天 g→kg 改造**）

**業務角色**：央廚每天生產時填的「生產日誌」 — 含 6 個區域、20 個品項、118 個欄位、5 個糖種

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  央廚員工進入 /kitchen/production-log                                  │
│  selectedDate 預設 today                                              │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  ProductionLog.tsx 初始化                                              │
│  ├─ useProductionZoneStore 載入 6 zones / 20 items / 118 fields / 5 sugars │
│  │   ├─ DB 有資料：toFormZone() 轉換                                   │
│  │   └─ DB 空：fallback PRODUCTION_ZONES（21 處靜態定義）             │
│  ├─ Reset zoneStates（每 zone 一個 ZoneFormState）                    │
│  └─ Load all sessions for selectedDate                                │
│      ├─ production_log_sessions WHERE date=selectedDate                │
│      ├─ production_log_items IN sessionIds                            │
│      └─ 組 itemMap → zoneStates                                        │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 結構                                                                │
│  ├─ TopNav + DateNav                                                   │
│  ├─ 已編輯 banner（如有紀錄）                                          │
│  ├─ Zone Tab Bar（橫向 6 個 tab，已填 ✓）                              │
│  └─ ProductionZoneForm（當前 zone 的所有 items × fields）              │
│      └─ 每個 field：ProductionFieldInput → numeric / select / sugar_select │
│      └─ 試吃記事 / 簽名人員 / 主管簽核                                  │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 央廚員工填好 → 按「儲存{zoneName}」
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  doSubmit() — 一次只送一個 zone（per-zone 提交）                       │
│  ├─ 驗證：必填簽名人員                                                 │
│  ├─ submittingRef 防雙擊                                               │
│  ├─ UPSERT production_log_sessions（id = `prodlog_{zone}_{date}`）    │
│  ├─ DELETE production_log_items WHERE session_id=...                  │
│  ├─ INSERT 新的 items（item_key + field_key + field_value）           │
│  ├─ 失敗時 crashReport                                                 │
│  └─ Telegram 通知（含填寫人、欄位數）                                  │
└──────────────────────────────────────────────────────────────────────┘
            ↓ Trigger audit_log（之前 2.5+2.6 加的）
       audit_log 自動寫入（每次 INSERT/UPDATE/DELETE）
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺檢查清單
| 元素 | 預期 | 位置 |
|---|---|---|
| TopNav 「每日生產紀錄」 | ✅ | L310 |
| DateNav 切日 | ✅ | L311 |
| 已編輯 banner | RefreshCw + 日期 | L313-318 |
| Zone Tab Bar 橫滾 | 6 個 zone（漿/球/料/製冰/糖水 + 1）含 ✓ 標 | L321-343 |
| Zone Tab `isFilled` ✓ | 該 zone 已存 | L325, L338 |
| ProductionZoneForm | 當前 zone 所有 items / fields | L349-361 |
| BottomAction 儲存按鈕 | `儲存{zoneName}` / `更新{zoneName}` | L363-368 |
| 歷史日二次確認 | 修改歷史資料 dialog | L373-396 |

#### 色彩規則
- isFilled ✓ → 綠色 status-success
- 當前 active tab → border-brand-mocha
- 已編輯 banner → status-info（藍）
- 歷史修改確認 → status-warning（橙）

---

### 2. API endpoint 🟢

#### Supabase 操作清單
| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `production_log_sessions` | L108-111 | 載入該日所有 zone sessions |
| READ | `production_log_items` | L120-123 | 載入明細 |
| UPSERT | `production_log_sessions` | L210-220 | 主表（per-zone）|
| DELETE | `production_log_items` | L230-233 | 先清舊 |
| INSERT | `production_log_items` | L250-252 | 寫新明細 |

#### 防呆驗證
- ✅ supabase null check（L96, L199）
- ✅ submittingRef 防雙擊（L74, L187-188）
- ✅ try/catch/finally 完整（L208-285）
- ✅ formZones 變化時自動切到第一個（L78-82）
- ✅ crashReport（L279-280）
- ✅ 歷史日提交需二次確認（L288-294）
- ⚠️ **delete-then-insert 非原子**（L230-252）— 若 INSERT 失敗，舊資料已被刪 → 資料丟失

---

### 3. 後端 lib 🟢

#### Zone 切換邏輯（L78-82）
當 DB zones 載入完成且當前 activeZone 不存在 → 自動切到第一個。**避免 race condition：DB 未載入時用 PRODUCTION_ZONES（21 處 g 靜態 fallback），載入後切到 DB 版本**。

#### sessionId 規則
```typescript
productionLogSessionId(zoneKey, date) = `prodlog_${zoneKey}_${date}`
// 例：'prodlog_paste_2026-05-22'
```
✅ UNIQUE 由邏輯保證（per-zone 一筆/天）

#### 三層資料結構
```
production_zone_defs       6 個 zone（漿區、球區、料區、製冰區、糖水區、餃子區）
  ↓
production_item_defs       20 個 item（豆花、芋圓、紅豆湯等）
  ↓
production_field_defs      118 個 field（糖、水、甜度、稠度、桶數等）
  + sugar_types            5 種糖種（二砂、白砂、紅糖、冰糖、甘蔗原汁）
```

---

### 4. 資料來源 🟢

#### prod 真實規模（2026-05-22 SQL 實測）
| 表 | 筆數 |
|---|---|
| `production_log_sessions` | 314 |
| `production_log_items` | 3478 |
| `production_zone_defs` (active) | 6 |
| `production_item_defs` (active) | 20 |
| `production_field_defs` (active) | 118 |
| `sugar_types` (active) | 5 |

**5/22 真實填寫狀況**：6 個 zone 全部填了（漿 12 / 球 21 / 料 20 / 製冰 4 / 糖水 6 / 餃子 6 共 69 items）→ **流程實際運作中**

#### 今天剛做的 g→kg 改造（caf9372）
- `production_log_items.field_value` 1450 筆 ×0.001 + trim_scale
- `production_log_items.field_value` JSON 內 507 筆 ×0.001
- `production_field_defs.unit` 42 個欄位（34 g + 8 Kg → 全 kg）
- `sugar_types.unit` 4 個糖種 g → kg

---

### 5. 單位/時區 🟢（今天剛全面修）

#### 單位流轉表（修正後）
| 階段 | 變數 | 單位 |
|---|---|---|
| 員工輸入 | `field_value` string | DB unit（多數 kg / ml / 桶等）|
| sugar_select 輸入 | JSON `{"白砂":0.6}` | kg |
| DB 儲存 | `production_log_items.field_value` text | 透傳 |
| UI 顯示 | NumericInput unit = field.unit / st.unit | 對齊 DB unit |
| 統計（ProductionStats）| 比例計算（simpleAvg/min/max/unitAvg/weightedAvg）| 統一 kg |

✅ **g hardcode 全清乾淨**（今天剛完成）

#### 時區
- ✅ `getTodayTW()` + `productionLogSessionId(zone, date)`
- ✅ `new Date().toISOString()` UTC 自動轉 DB

---

### 6. 死碼 🟢

無發現（DB 與靜態 fallback 並存是設計如此）

---

### 7. 邊界 🟡

| 情境 | 處理 | 位置 |
|---|---|---|
| supabase 缺 | early return | L96, L199 |
| store 未 initialized | fallback PRODUCTION_ZONES | L62-66 |
| DB zone 變化 | useEffect 自動切 activeZone | L78-82 |
| 切日 | reset zoneStates + 重載 | L100-103 |
| 該日無 session | sessions=[] → return | L113 |
| 同 zone 多次提交 | UPSERT id 衝突即覆蓋 | L220 |
| 簽名人員未選 | toast error + return | L192-197 |
| **delete-then-insert race** | ❌ 非原子，INSERT 失敗 → 資料丟失 | L229-260 |
| 提交歷史日 | 二次確認 dialog | L288-294 |
| 雙擊提交 | submittingRef 防 | L74, L187 |
| 提交失敗 | toast + crashReport | L276-280 |
| 永遠解鎖 | finally 區塊 | L281-285 |

⚠️ **見可疑點 S1** — delete-then-insert 非原子，理論上有資料丟失風險

---

## 🔢 數學驗算

### 驗算 1：今天 g→kg 改造對統計的影響（與 audit 07 SugarSelect 同分析）

**情境**：歷史數據庫存芋圓糖類用量
```
舊 DB: 紅豆湯糖 600g  →  ×0.001 後  →  0.6kg
舊 DB: 銀耳湯糖 800g  →  ×0.001 後  →  0.8kg
舊 DB: 杏仁茶糖 1200g →  ×0.001 後  →  1.2kg
```

**ProductionStats.tsx 統計**：
- `simpleAvg(0.6, 0.8, 1.2) = 0.867 kg` ← 與 g 時 867 g 是 ×0.001 等價
- `simpleMin = 0.6 kg`、`simpleMax = 1.2 kg` ← 都對
- `weightedAvg = totalVal / totalQty` ← totalVal 變小 1000 倍、totalQty 不變 → 結果 ÷1000 ← 對

✅ **統計數學等價**（昨天動工前已驗證）

### 驗算 2：sugar_select JSON 轉換流程

**5/22 球區芋泥球真實值**（migration 前）：
```json
{"精製特砂(白砂)": 600}
```

**Migration 後**：
```json
{"精製特砂(白砂)": 0.6}
```

**SugarSelectInput 行為**：
```typescript
parseValue('{"精製特砂(白砂)":0.6}') = { '精製特砂(白砂)': '0.6' }
total = 0.6
displayUnit = sugarTypes[0]?.unit = 'kg'

UI 顯示：「精製特砂(白砂) 0.6 kg」
合計：「合計: 0.6 kg」  ← 動態 unit
```

✅ 完整對應

### 驗算 3：per-zone 提交策略的隔離性

**情境**：5/22 央廚員工 A 在「漿區」填完按儲存；員工 B 同時在「球區」填寫

```
A: doSubmit('paste')
  ├─ UPSERT sessions id='prodlog_paste_5/22'
  ├─ DELETE items WHERE session_id='prodlog_paste_5/22'
  └─ INSERT items 12 筆

B: doSubmit('ball')  ← 不同 session_id
  ├─ UPSERT sessions id='prodlog_ball_5/22'
  ├─ DELETE items WHERE session_id='prodlog_ball_5/22'  ← 與 A 不衝突
  └─ INSERT items 21 筆
```

✅ per-zone 隔離良好（不同 session_id 不會互相干擾）

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `caf9372` | 2026-05-22 | **今天 g→kg 全面遷移**（本頁直接受益）|
| `02b3679` | 2026-05-22 | M1+M2 Settlement（本頁無變動）|
| `498258c` | 2026-05-04 | PIN 碼補上 production-log 頁面權限（kitchen role）|
| `a23f7e3` | 2026-05-02 | 糖種單位 hardcode g 修復 + sugarTypes store 統一 |
| `b94bdfa` | 2026-04-28 | V2.0 try/catch/finally + submittingRef + crashReport |

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| ProductionLog.tsx | 399 |
| ProductionZoneForm | 114 |
| ProductionFieldInput | 74 |
| SugarSelectInput | 128 |
| useProductionZoneStore | 342 |
| useEffect 數量 | 2 |
| useState 數量 | 6 |
| useRef 數量 | 1（submittingRef）|
| Supabase 操作 | 2 READ + 3 WRITE/DELETE |
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | Zone Tab Bar + per-zone 提交設計清楚 |
| 2. API endpoint | 🟡 | delete-then-insert 非原子（S1）|
| 3. 後端 lib | 🟢 | DB/靜態雙軌切換邏輯穩 |
| 4. 資料來源 | 🟢 | 6 zone 都活躍 + 今天 g→kg 修完 |
| 5. 單位/時區 | 🟢 | **今天剛全面修完 g→kg** |
| 6. 死碼 | 🟢 | 無 |
| 7. 邊界 | 🟡 | delete-then-insert 風險 |

**整體：✅ 健康度高，1 個小改善建議**

---

## 🟡 可疑點

### S1 — delete-then-insert 非原子（理論上有資料丟失風險）

**位置**：`ProductionLog.tsx:230-260`

**現況**：
```typescript
// Step 1: 刪除舊 items
await supabase.from('production_log_items').delete().eq('session_id', sessionId)

// Step 2: insert 新 items
if (insertItems.length > 0) {
  await supabase.from('production_log_items').insert(insertItems)
  if (itemErr) { ...  return } // ← 此時舊資料已被刪，新資料未進
}
```

**風險場景**：
- 員工填好按儲存 → DELETE 成功 → INSERT 失敗（網路斷、Supabase 503 等）
- DB 結果：該 session 沒有任何 items（資料丟失）
- 員工頁面看到 toast「提交失敗」可重試，但 DB 已是空狀態

**業務影響評估**：
- ✅ 員工可重試（按鈕還在）
- ❌ 但若員工沒注意 toast 就關頁 → DB 永久空白
- ⚠️ session 已 UPSERT 成功（簽名人員等 meta 在）但 items 為 0 → 看起來像「提交成功但無資料」

**修法**（與 inventory 用的 RPC 同 pattern）：
- 方案 A：寫 RPC function `sync_production_log_items(session_id, items[])` 在 DB 端原子化
- 方案 B：先 INSERT 再 DELETE（次序顛倒 + 用唯一鍵衝突）— 但這個比較複雜

**工時**：A 方案 30-45 分鐘（DB migration + RPC + 改 client）
**優先級**：中（罕見 race，但既然 inventory 已有 RPC 範例，順手做更乾淨）

### S2 — Telegram 通知時機（無重大影響）

**位置**：`ProductionLog.tsx:273-275`

**現況**：每次提交 zone 都發 Telegram。
- 6 個 zone × 一日多次修改 = 可能一天發 6+ 次通知
- 群組可能被刷屏

**評估**：**非 bug**，是 UX 觀察。員工可能修改多次（漏填補回），每次都通知會讓老闆覺得「央廚一直改」

**建議**（待你確認）：
- 方案 A：保持現狀
- 方案 B：每日該 zone 第一次提交才通知，後續修改靜默
- 方案 C：所有 zone 都填完才一次整合通知

---

## 🛠️ 修改建議

### M1（中優先）：S1 delete-then-insert 改 RPC 原子化

仿 inventory 的 `sync_inventory_stock_entries` RPC 寫一個 `sync_production_log_items`：
```sql
CREATE OR REPLACE FUNCTION sync_production_log_items(
  p_session_id text,
  p_items jsonb  -- [{ item_key, field_key, field_value }, ...]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM production_log_items WHERE session_id = p_session_id;
  INSERT INTO production_log_items (session_id, item_key, field_key, field_value)
  SELECT p_session_id, e->>'item_key', e->>'field_key', e->>'field_value'
  FROM jsonb_array_elements(p_items) e;
END $$;
```

前端改用 `supabase.rpc('sync_production_log_items', { p_session_id, p_items })`

**工時**：30-45 分鐘（staging 跑 → 驗證 → prod）

### M2（業務溝通）：S2 Telegram 通知策略

待你決定 A/B/C

---

## ✅ 下一步

進入 **#09 MaterialStock.tsx**（央廚原料庫存）或 **#09 ProductStock.tsx**（央廚成品庫存）audit。

或者：
- 順手做 M1（原子化 RPC，30-45 分）
- 業務確認 M2 通知策略
