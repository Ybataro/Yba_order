# YBA Admin 後台 5 大常用功能 — 完整審查報告

> 審查日期：2026-05-21
> 採 5 個獨立 sub-agent 平行審查，避免單一視角偏誤
> 5 個檔案總計 2,162 行 — 找出 **77 個問題**

---

## 🚨 統計總覽

| 嚴重度 | 數量 | 說明 |
|---|---|---|
| **🔴 P0** | **11** | 安全漏洞 / 金融計算錯誤 / 整頁崩潰 — **必須優先處理** |
| 🟠 P1 | 23 | 影響業務正確性 / 使用者體驗 |
| 🟡 P2 | 28 | 可排程的優化 |
| 🟢 P3 | 15 | 微小改善 |
| **總計** | **77** | |

**每頁 P0 分布：**
```
LeaveManagement    ████ 4  ← 請假管理（V2 才剛改完，最多 race condition）
SettlementHistory  ███  3  ← 結帳歷史（金融計算+RLS 過鬆）
ExpenseManagement  ██   2  ← 雜支管理（RLS+audit log）
BossDashboard      ██   2  ← 老闆儀表板（時區+整頁 crash）
OrderHistory       ─    0  ← 歷史叫貨（無 P0，但 4 個 P1 統計錯誤）
```

---

## 🔴 P0 — 必須優先處理（11 個）

### 🛡️ 安全類（4 個 P0，全來自不同頁面 — 但問題相同）

#### P0-1：**Supabase RLS 完全開放**（重大資料安全漏洞）
- **位置**：所有 4 個資料表 — `settlement_sessions / settlement_values / daily_expenses / leave_requests`
- **症狀**：RLS policy 是 `USING (true)`，**任何匿名用戶**都能讀寫所有資料
- **影響**：
  - 任何人能竄改結帳金額（$52,445 → $0）
  - 任何人能新增/刪除雜支
  - 任何人能核准/刪除任何假單
- **修法**：基於 `auth.role()` + `store_id` 加 RLS 條件
- **來源**：SettlementHistory#2、ExpenseManagement#6、LeaveManagement（隱含）

#### P0-2：**權限檢查完全缺失**（前端層）
- **位置**：LeaveManagement.tsx（全頁無 `session.role` 檢查）+ 其他頁也類似
- **症狀**：任何登入者都能進入 admin 頁面，包含核准請假
- **修法**：頁面頂部加 `if (session?.role !== 'admin') redirect`

### 💰 金融計算類（2 個 P0）

#### P0-3：**金額用 `parseFloat` 累積浮點誤差**
- **位置**：`settlement.ts:6-32` getVal/computeSession
- **症狀**：每次取值 `parseFloat(v || '') || 0`，多次加減後出現 `1234.5678900001` 這種誤差
- **影響**：對帳差 0.01 元 = P0（你 CLAUDE.md 明文規定）
- **修法**：用整數（以分為單位）或 `decimal.js`

#### P0-4：**金額欄位存成 `text` 而非 `numeric`**
- **位置**：`settlement_values.value` 是 text 型別
- **症狀**：每次都 parseFloat 轉換，沒有 DB 層約束，"1,234.5" 這種輸入會被當 0
- **修法**：DB migration 改成 `numeric(10, 2)`

### 💥 整頁崩潰類（2 個 P0）

#### P0-5：**Promise.all 無 `.catch()`** — 任一查詢失敗整頁白屏
- **位置**：BossDashboard.tsx:94-135
- **症狀**：Supabase 任一查詢失敗 → 整個 Promise.all 拋錯 → `setLoading(false)` 不執行 → 永遠卡載入中
- **修法**：改 `Promise.allSettled()` + `.catch()` + error state

#### P0-6：**`getDateNDaysAgo()` 時區嚴重錯誤**
- **位置**：BossDashboard.tsx:61-65 + `suggestion.ts:182-186`
- **症狀**：
  ```js
  new Date('2026-05-21T00:00:00')  // 視為本地時間
    .setDate(d.getDate() - 7)
    .toISOString()                  // 轉 UTC，會偏移 8 小時
  ```
  結果：本地 5/21 → UTC 5/20 → 查到的「7 天前」實際上是錯的日期
- **影響**：**老闆儀表板的 7 天趨勢圖數據可能全錯**
- **修法**：用 `toLocaleDateString('en-CA')` 或 `addDays()`

### 🏃 並發類（3 個 P0，全在 LeaveManagement）

#### P0-7：**Race Condition — 同一張假單被多人同時核准**
- **位置**：useLeaveStore.ts:724-741
- **症狀**：兩個 admin 同時點核准 → 狀態被覆蓋、假別餘額重複扣
- **修法**：update 時加 `.eq('status', 'manager_approved')` 樂觀鎖

#### P0-8：**錯誤處理不一致 — 寫排班失敗但假單還是核准**
- **位置**：useLeaveStore.ts:773
- **症狀**：寫 `schedules` 失敗只 `console.error` 然後繼續，**假單被標記核准但排班沒寫入** → 員工排班混亂
- **修法**：統一 try-catch + transaction-like 邏輯

#### P0-9：**審計日誌缺失（雜支 + 請假）**
- **位置**：daily_expenses、leave_requests 都無 audit log
- **症狀**：誰把 $6,523 改成 $523？無法追溯。誰刪了珊珊的請假？無法追溯
- **影響**：**勞基法 + 財務合規硬性要求**
- **修法**：建 audit_log 表 + DB trigger

---

## 🟠 P1 — 23 個（按頁面分組）

### BossDashboard（4 個）
| # | 問題 | 影響 |
|---|---|---|
| B1 | 趨勢圖資料順序混亂（配合 P0-6 修） | 趨勢圖錯位 |
| B2 | 庫存警示遺漏「庫存=0 且日均=0」情況 | 漏警停售品 |
| B3 | 庫存警示顯示無單位（杏仁茶 7200 是 ml 還是杯？） | 老闆誤判 |
| B4 | 庫存警示全部紅色，沒有分級 | 語意混亂 |
| B5 | 多 zone 庫存計算死角（沒指定 zone_code） | 多區域店資料不全 |
| B6 | stores/products 未初始化（用靜態預設） | 後端更新不會反映 |
| B7 | 缺資料驗證（直接 `as SettlementSession[]`） | 異常資料難除錯 |

### OrderHistory（4 個 P1，無 P0）
| # | 問題 | 影響 |
|---|---|---|
| O1 | useMemo 依賴漏 lookup 函數 | category 變化不重算 |
| O2 | count 邏輯瑕疵（同日多次叫貨會多算） | 統計準確性 |
| O3 | 日期邊界時區不一致（getTodayTW vs UTC） | 邊界遺漏/多查 |
| O4 | session.id 可能重複（store_id + date）→ React key 衝突 | UI 渲染錯亂 |
| O5 | 缺少權限檢查（門店員工能看其他店） | 安全 |

### SettlementHistory（4 個）
| # | 問題 | 影響 |
|---|---|---|
| S1 | 差額閾值 ±10 元硬編碼，無業務依據 | 過度警示 / 漏警 |
| S2 | 月報統計 `days` 命名誤導（實際是 session 筆數） | 日均算錯 |
| S3 | 客單價未考慮退單 | 經營分析失真 |
| S4 | 缺少異常檢測機制（超 1000 元差額不自動標記） | 漏掉重大異常 |

### ExpenseManagement（3 個）
| # | 問題 | 影響 |
|---|---|---|
| E1 | Promise 無 error 處理 → 卡載入中 | UX 卡死 |
| E2 | 無分頁 → 大月份 1000+ 筆全載入 | 卡頓 |
| E3 | 無新增/編輯/刪除功能（純查詢） | 功能不完整或文件缺失 |

### LeaveManagement（4 個）
| # | 問題 | 影響 |
|---|---|---|
| L1 | 假別餘額扣除無原子驗證（讀→改→寫 race） | 員工超扣假日 |
| L2 | 刪除假單三步操作非事務 | 鬼排班 / 餘額不一致 |
| L3 | Telegram 通知失敗無重試 | 主管收不到通知 |

---

## 🟡 P2 — 28 個（精選列出）

涵蓋：N+1 lookup、useMemo 依賴漏寫、無虛擬滾動、UI 顏色語意、單位格式化、可維護性重構、scope 跨部門檢查、V1 legacy 清理...

**完整 P2 清單見原始 5 份報告，這裡不重複列**。

---

## 🎯 我建議的修復優先順序與分批

### 第 1 批：安全 + 整頁崩潰（一週內必修，**生產環境風險**）

| 步驟 | 工作 | 預估 |
|---|---|---|
| 1.1 | **Supabase RLS 重寫**（4 個表）| 半天 |
| 1.2 | 前端 admin 頁面加 `role !== 'admin'` 守門 | 1 小時 |
| 1.3 | BossDashboard `Promise.all` 改 `allSettled` + error state | 2 小時 |
| 1.4 | `getDateNDaysAgo` 時區 bug（全專案搜尋同模式） | 半天 |
| 1.5 | LeaveManagement race condition（樂觀鎖） | 半天 |

**驗收方式**：在 staging 跑、用 SQL 驗證 RLS 拒絕 anon 寫入

### 第 2 批：財務正確性（兩週內，**金融誤差零容忍**）

| 步驟 | 工作 | 預估 |
|---|---|---|
| 2.1 | `settlement_values.value` 從 text → numeric（DB migration）| 半天 |
| 2.2 | `getVal` 改回整數運算（以分為單位）| 半天 |
| 2.3 | 差額閾值改可配置（app_settings.diff_threshold）| 2 小時 |
| 2.4 | 月報統計 days 改 uniqueDays | 1 小時 |
| 2.5 | 客單價公式釐清（含/不含退單）| 看業務需求 |
| 2.6 | 雜支與請假 audit log 建表 + trigger | 半天 |

### 第 3 批：UI/UX + 效能（一個月內）

| 步驟 | 工作 | 預估 |
|---|---|---|
| 3.1 | 庫存警示加單位 + 紅黃綠分級 | 2 小時 |
| 3.2 | OrderHistory 加 zone 分組 | 半天 |
| 3.3 | 全頁 productMap memoize（消 N+1 lookup） | 2 小時 |
| 3.4 | 大區間查詢分頁 / 虛擬滾動 | 1 天 |
| 3.5 | 各頁 loading/empty/error 三態完整化 | 半天 |

### 第 4 批：技術債清理（持續）
- V1 legacy 代碼（telegram.ts 的 LEAVE_NOTIFY_MAP）
- Type 定義集中化（src/types/database.ts）
- 增加單元測試（settlement.computeSession 等關鍵函數）

---

## 📊 報告檔案位置

完整 5 份子報告我沒存檔（在我 context 內），如需重新產出某一頁的詳細版，告訴我頁名我重撈。

本份整合報告：`C:\Users\YEN\Desktop\YBA_ADMIN_AUDIT_REPORT.md`
