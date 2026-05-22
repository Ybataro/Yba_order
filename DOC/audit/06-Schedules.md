# 06 — 排班 + 請假主管簽核 Schedules.tsx 健康度報告

**檢查日期**：2026-05-22
**檢查者**：Claude Opus 4.7
**元件路徑**：
- Page A：`src/pages/store/Schedules.tsx`（643 行）— 門店排班 + 主管簽核
- Page B：`src/pages/kitchen/Schedules.tsx`（638 行）— 央廚排班 + 主管簽核（與 A 幾乎相同）
- Modal：`src/components/LeaveRequestModal.tsx`（375 行）— 員工送假
- Modal：`src/components/ShiftPickerModal.tsx`（304 行）— 排班編輯
- Card：`src/components/LeaveRequestCard.tsx`（232 行）— 請假卡片顯示
- Store：`src/stores/useLeaveStore.ts`（**經昨晚 1.3+1.4 大改 — 樂觀鎖 + 原子 RPC + 簡易回滾**）

**路由**：
- `/store/:storeId/schedule`（AuthGuard requiredRole="store"）
- `/kitchen/staff-schedule`（AuthGuard requiredRole="kitchen"）

**呼叫者**：`StoreHome.tsx` menu + `KitchenHome.tsx` menu + admin 越級進入

**最後 commit**：`02b3679`（昨晚樂觀鎖 + 簡易回滾 + 駁回原因 500 字）

---

## 📐 依賴鏈

```
┌──────────────────────────────────────────────────────────────────────┐
│  員工進入頁面                                                          │
│  /store/:storeId/schedule 或 /kitchen/staff-schedule                  │
│  PIN 已驗證 → session.staffId、session.role 已知                       │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Schedules.tsx 初始化（多個並行 effect）                                │
│  ├─ fetchShiftTypes / fetchPositions                                  │
│  ├─ 載月份 schedules（in staffIds + date range）                      │
│  ├─ fetchByStaff(session.staffId) → 我的請假紀錄 myLeaveRequests       │
│  ├─ 查主管層級：user_pins.leave_approver_order → approverOrder        │
│  ├─ 查 can_popup 員工清單（行事曆紅點顯示用）                         │
│  └─ loadManagerPending（若是主管）→ 待簽核清單                        │
└────────────────────────┬─────────────────────────────────────────────┘
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  UI 區塊                                                                │
│  ├─ MonthNav 上下切月                                                  │
│  ├─ ViewMode 切換：calendar / grid                                     │
│  ├─ 排班顯示：CalendarGrid 或 ScheduleGrid                            │
│  │   ↳ 有 canSchedule 權限 → 點 cell 開 ShiftPickerModal              │
│  ├─ 「我的請假」LeaveRequestCard × N                                   │
│  │   ↳ 駁回的可重送 → 開 LeaveRequestModal                            │
│  │   ↳ 病假未補診斷書 → 開補傳照片                                     │
│  ├─ 「待簽核」（若是主管）LeaveRequestCard × N                         │
│  │   ↳ 核准 / 駁回 → 開對應 modal                                      │
│  └─ 浮動「請假申請」按鈕 → 開 LeaveRequestModal                       │
└────────────────────────┬─────────────────────────────────────────────┘
                         │ 主管按核准 → handleApproveConfirm
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│  useLeaveStore 處理（昨晚 1.3+1.4 已改造）                            │
│  approver1Approve / approver2Approve / approver1Reject / approver2Reject │
│  ├─ 樂觀鎖：UPDATE WHERE status=expected → 失敗時防 race              │
│  ├─ 狀態升級：pending → approver1_approved → manager_approved         │
│  ├─ Telegram 通知（下一關主管 或 admin）                              │
│  └─ Audit log trigger（自動寫 audit_log）                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 狀態機（與 business-flow.md 一致）
```
pending → approver1_approved → manager_approved → approved
       ↘ rejected                                ↗
                  （駁回後員工可重送 → 回 pending）
```

---

## 🔍 7 維度檢查

### 1. UI 顯示 🟢

#### 視覺檢查清單
| 元素 | 預期 | 位置 |
|---|---|---|
| TopNav `{storeName} 排班` | ✅ | L部分 |
| MonthNav | ✅ 切月 | UI 區 |
| ViewMode 切換按鈕（calendar/grid）| ✅ | UI 區 |
| CalendarGrid / ScheduleGrid | ✅ 雙模式 | UI 區 |
| ShiftPickerModal（cell 點擊） | canSchedule 權限才開 | L7 import |
| 「我的請假」LeaveRequestCard | 顯示自己送的假，含狀態 chip | L19 import |
| 「待簽核」清單（若是主管）| 依 approverOrder 顯示對應 status | L116-126 |
| 駁回 toast 用「此單可能已被他人處理」| 昨晚 1.3 改的 | L147, 167 |
| LeaveRequestModal（送假 / 重送 / 補傳）| 含病假照片必填邏輯 | L18 import |
| 浮動「請假申請」按鈕 | 任何已登入員工可送 | UI 區 |

#### 色彩規則
- pending / approver1_approved → 黃
- manager_approved → 橘（等 admin 最終審）
- approved → 綠
- rejected → 紅

---

### 2. API endpoint 🟢

#### Supabase 操作清單
| 操作 | 表 | 位置 | 用途 |
|---|---|---|---|
| READ | `user_pins` | L37-41, L78-89 | 查 can_popup / 主管層級 |
| READ | `shift_types` / `positions` | via useScheduleStore | 班次定義 |
| READ | `schedules` | L206-211 | 月份排班 |
| READ | `leave_requests` | L119-123 + via fetchByStaff | 待簽核 + 我的 |
| WRITE | `schedules` UPSERT | via useScheduleStore.upsertSchedule | 排班儲存 |
| DELETE | `schedules` | via removeSchedule | 排班刪除 |
| WRITE | `leave_requests` 多操作 | via useLeaveStore | 送假/簽核/駁回 |

**WRITE 動作都走 useLeaveStore**（昨晚已加樂觀鎖 + 原子 RPC + 簡易回滾）

#### 防呆驗證
- ✅ supabase null check（L37, L76）
- ✅ canSchedule 權限檢查（L37, L117）
- ✅ approverOrder null 時不抓待簽核（L117）
- ✅ 樂觀鎖防 race（昨晚 1.3 加）
- ✅ 駁回原因 500 字（昨晚 3.9 加）
- ✅ 簡易回滾（昨晚 1.4 加）

---

### 3. 後端 lib 🟢（昨晚已大改造）

#### useLeaveStore 重要函數
| 函數 | 行為 | 樂觀鎖 | 原子操作 |
|---|---|---|---|
| `submit` | 員工送假 | — | INSERT |
| `resubmit` | 駁回重送（清舊簽核欄位回 pending）| — | UPDATE |
| `approver1Approve` | 第一主管核准 | ✅ WHERE status='pending' | UPDATE |
| `approver1Reject` | 第一主管駁回 | ✅ | UPDATE |
| `approver2Approve` | 第二主管核准 | ✅ WHERE status='approver1_approved' | UPDATE |
| `approver2Reject` | 第二主管駁回 | ✅ | UPDATE |
| `approve` | admin 最終核准 | ✅ WHERE status='manager_approved' | UPDATE + RPC `increment_leave_used` |
| `reject` | admin 最終駁回 | ✅ | UPDATE |
| `remove` | 刪除假單（含回滾排班/餘額）| — | DELETE + RPC `decrement_leave_used` |
| `submitPhoto` | 補傳診斷書 | — | UPDATE photo_submitted |

✅ Telegram 通知整合：每個簽核動作通知下一關主管/員工/admin

---

### 4. 資料來源 🟡（V2/V1 共存）

#### prod 真實規模（2026-05-22 SQL 實測）

**請假申請狀況**：
| status | count | 比例 |
|---|---|---|
| approved | 17 | **81%** ✅ 流程實際運作 |
| pending | 2 | 10% |
| rejected | 1 | 5% |
| manager_approved | 1 | 5% |
| total | **21** | 100% |

**簽核欄位使用率**：
| 欄位 | 有資料 | 解讀 |
|---|---|---|
| approver1_id | 6 | V2 走過第一主管 |
| approver2_id | **0** | **沒有任何單走過第二主管**！|
| reviewed_by | 17 | admin 最終審過 17 筆 |
| photo_submitted | 5 | 病假補傳 5 次 |
| manager_reviewed_by | 18 | **V1 legacy 簽核（多數歷史單）**|

**主管設定**：
| scope | order=1 | order=2 |
|---|---|---|
| kitchen | 1 人 | 1 人 |
| lehua | 1 人 | **0 人**（沒設第二主管）|
| xingnan | 1 人 | **0 人**（沒設第二主管）|

**leave_balances**（員工假別餘額池）：
| leave_type | 涵蓋員工數 | 總天數池 | 已用 |
|---|---|---|---|
| annual_leave | 20 | 143.0 | 2.0 |
| comp_leave | 19 | 110.0 | 5.0 |
| other_leave | 15 | 0.0 | 0.0 |
| personal_leave | 20 | 280.0 | 2.0 |
| sick_leave | 20 | 600.0 | 6.5 |
| public_holiday | **0** | — | — |
| marriage_leave | **0** | — | — |

⚠️ **見可疑點 S1** — 國定假日/婚假還未自動補建到任何員工
⚠️ **見可疑點 S2** — V1 legacy 18 筆 vs V2 6 筆，2 種制度並存
⚠️ **見可疑點 S3** — 樂華/興南沒設第二主管（功能未啟用）

---

### 5. 單位/時區 🟢

- ✅ 月份切換用 `getMonthDates(year, month)`（無時區問題）
- ✅ schedule date 直接存 YYYY-MM-DD
- ✅ 送假時間用 `new Date().toISOString()` UTC

---

### 6. 死碼 🟡

#### V1 legacy 路徑（已存在但 V2 上線後不再 trigger）
- `manager_reviewed_by` / `manager_reviewed_at` 欄位仍存在
- useLeaveStore.ts approver1Approve 線 494-497 **仍會寫**（向下相容）

```typescript
// 無第二主管時同步寫向後相容欄位
if (nextStatus === 'manager_approved') {
  updatePayload.manager_reviewed_by = approverId
  updatePayload.manager_reviewed_at = now
}
```

✅ 設計合理：V1 legacy 欄位「**保留作為兼容**」，新代碼仍寫入這 2 個欄位。
⚠️ 但長期未來 V1 制度確認廢除後可清

#### store/Schedules.tsx vs kitchen/Schedules.tsx
- 643 行 vs 638 行 — **99% 相同代碼**
- 差異：路由 + scope 取得方式（`storeId` vs `'kitchen'` 寫死）
- 可重構為共用元件（節省 600+ 行）→ 待 audit 完整完成後評估

---

### 7. 邊界 🟢

| 情境 | 處理 | 位置 |
|---|---|---|
| 未登入 / role 不符 | AuthGuard 攔下 | App.tsx |
| canSchedule = false | 不顯示主管功能 | L37, L117 |
| approverOrder = null（不是主管）| 不抓待簽核 | L117 |
| 主管簽核失敗（樂觀鎖 trigger）| toast「此單可能已被他人處理」+ 重抓 | L147, L167 |
| 駁回原因空白 | disabled 按鈕 | L155 |
| 駁回原因 >500 字 | 截斷 + 計數變紅 | 昨晚 3.9 加 |
| 補傳照片失敗 | toast | L186-188 |
| 重送 modal | 帶入舊資料，清舊簽核欄位 | L102-103 |
| Modal 開時切月 | 月份 effect 與 modal state 獨立 | — |

---

## 🔢 數學驗算

### 驗算 1：樂觀鎖防 race condition

**情境**：兩個主管同時開「珊珊病假」 modal，按下「核准」

```typescript
// 主管 A 先按
UPDATE leave_requests 
SET status='approver1_approved', approver1_id='主管A', ...
WHERE id='xxx' AND status='pending'   ← 樂觀鎖
→ 成功（DB 1 row affected）

// 主管 B 後按（300ms 之差）
UPDATE leave_requests 
SET status='approver1_approved', approver1_id='主管B', ...
WHERE id='xxx' AND status='pending'   ← 樂觀鎖
→ 失敗（status 已是 approver1_approved，0 row affected）
→ Schedules.tsx 收到 false → 顯示「此單可能已被他人處理」+ 重抓
```

✅ 防 race 完整，雙主管不會誤覆蓋

### 驗算 2：V2 簽核流程（單主管情境，樂華）

**樂華沒設第二主管**（只有 leave_approver_order=1）：
```
員工送假
  ↓ submit() INSERT status='pending'
第一主管核准
  ↓ approver1Approve()
  ↓ 內部呼叫 checkLeaveApproversReady(scope)
  ↓ 查 approver2 count = 0
  ↓ 直接跳 status='manager_approved'
  ↓ 同步寫 manager_reviewed_by/at (V1 相容)
admin 最終核准
  ↓ approve()
  ↓ 樂觀鎖 WHERE status='manager_approved'
  ↓ UPSERT schedules + RPC increment_leave_used
  ↓ status='approved'
```

✅ 設計合理，單主管情境會跳過 approver2_approved 中間態

### 驗算 3：假別餘額自動補建（首次打開觸發）

**情境**：員工小明本來沒有 leave_balances，今天首次進入請假頁

```typescript
// useLeaveBalance.ts L26-50
existing = []  // DB 沒紀錄
missing = TRACKED_LEAVE_TYPES.filter(t => !existing.find(b => b.leave_type === t.id))
       = [annual_leave, sick_leave, personal_leave, comp_leave, public_holiday, marriage_leave, other_leave]
// 7 種全部 missing

inserts = missing.map(t => ({
  staff_id: 'staff_xxx', leave_type: t.id, year: 2026,
  total_days: t.defaultDays, used_days: 0,
}))
// 共 7 筆 INSERT
```

→ 員工進頁後 leave_balances 多 7 筆（含國定假日 11 / 婚假 8）

**結合 prod 真實狀況**：
- 目前 leave_balances 涵蓋 20 員工（部分員工從沒打開過請假頁）
- 國定假日 / 婚假 count=0，因為沒人主動觸發「打開請假頁」（昨天才加）

---

## 📚 歷史關聯

| commit | 日期 | 變更 |
|---|---|---|
| `02b3679` | 2026-05-22 | M1 Settlement 防鎖死 + M2 diff 閾值（本頁無變動）|
| `d5f6406` | 2026-05-22 | S1+S2（本頁無變動）|
| `0cf6946` | 2026-05-21 | **第 2 批含 leave_requests audit_log trigger + atomic RPC**|
| `bbdb541` | 2026-05-21 | 1.3 樂觀鎖 + 1.4 簡易回滾 |
| `4231619` | 2026-05-21 | 3.9 駁回原因 500 字限制 |
| `cc3181c` | 2026-05-21 | 新增國定假日 + 婚假 |
| `a0a23ba` | 2026-04-14 | V2 請假系統大改 |

---

## 📊 程式碼指標

| 指標 | 數值 |
|---|---|
| store/Schedules.tsx | 643 |
| kitchen/Schedules.tsx | 638 |
| LeaveRequestModal | 375 |
| LeaveRequestCard | 232 |
| ShiftPickerModal | 304 |
| useLeaveStore | ~900（昨晚改造後）|
| TypeScript 編譯錯誤 | 0 |

---

## 📋 結論

| 維度 | 狀態 | 備註 |
|---|---|---|
| 1. UI 顯示 | 🟢 | 雙模式（calendar/grid）+ 雙身份（員工/主管）整合 |
| 2. API endpoint | 🟢 | 樂觀鎖 + 原子 RPC + 簡易回滾完整 |
| 3. 後端 lib | 🟢 | useLeaveStore 昨晚已重構 |
| 4. 資料來源 | 🟡 | V2/V1 並存、樂華興南無第二主管、新假別未觸發補建 |
| 5. 單位/時區 | 🟢 | 無問題 |
| 6. 死碼 | 🟡 | V1 legacy 兼容欄位仍寫入；store/kitchen 兩檔重複 |
| 7. 邊界 | 🟢 | 完整覆蓋（樂觀鎖、駁回原因限制、補傳照片）|

**整體：✅ 流程實際運作中（17/21 approved），昨晚改造後穩定**

---

## 🟡 可疑點

### S1 — 國定假日 / 婚假 leave_balances 未補建

**現況**（prod SQL 驗證）：
```
leave_type        staff_count
annual_leave      20
sick_leave        20
personal_leave    20
comp_leave        19
other_leave       15
public_holiday    0   ← ⚠️ 昨天新增的，沒人觸發補建
marriage_leave    0   ← 同上
```

**Root Cause**：`useLeaveBalance.ts:28-50` 是「**員工首次打開請假頁時自動補建**」邏輯，但：
- 昨天上線到現在沒人打開請假頁
- 因此這 20 個員工的 public_holiday / marriage_leave 都還沒建

**業務影響**：
- 當員工進請假頁、選「國定假日」或「婚假」時，會自動補建 1 筆 leave_balances（OK 沒事）
- 但**現在 admin 進「假別餘額」頁看，會看不到任何員工的這 2 個假別**

**修法選項**：
- A：等員工自然打開（系統正常運作）
- B：寫一次性 backfill SQL，把現有 20 員工都補建 2 個 balance
- C：在 admin「假別餘額」頁加「補建所有員工的所有假別」按鈕

**建議**：方案 B 一次性 SQL 最乾淨（5 分鐘）

### S2 — V1 legacy 簽核制度仍有 18 筆 vs V2 只有 6 筆

**現況**：21 個 leave_requests 中 18 個用 V1 simulated `manager_reviewed_by`（單主管直接到 admin），只有 6 個走過 V2 `approver1_id`

**Root Cause**：V2 上線（2026-04 commit a0a23ba）前的歷史單都是 V1 制度，無法回溯重簽

**業務影響**：
- 18 個 V1 單已 approved，不影響使用
- V2 上線後新單都走新流程（含 6 個 V1 兼容寫入）

**評估**：**正常的版本過渡狀況，非 bug**

**未來清理**：等所有 V1 單都過了「假別年度」（2027 年初）後，可考慮 archive 並清掉 V1 兼容寫入

### S3 — 樂華 / 興南未設第二主管

**現況**：
- 央廚有第一+第二主管
- 樂華只有第一主管
- 興南只有第一主管

**業務影響**：
- 樂華/興南員工送假 → 第一主管核准 → **直接跳到 admin 最終審核**
- 跳過 V2 雙主管的「**第二層複核**」設計

**待業務確認**：
- 是業務真的不需要第二主管？（小店單主管即可）
- 還是還沒設定（漏設）？

**修法**：若業務上需要，去 admin → PIN 碼管理頁加設

### S4 — store/Schedules.tsx vs kitchen/Schedules.tsx 99% 重複代碼

**現況**：643 + 638 = 1281 行**幾乎完全重複**

**Root Cause**：分開兩個檔案的原因可能是：
- 早期 prototype 各自演進
- store 有 `storeId` 從 URL 來、kitchen 寫死 `'kitchen'`
- 但實際邏輯（簽核流程、請假顯示、Modal）完全一樣

**修法**：抽共用元件 `<ScheduleAndLeavePage scope={scope} />`
- store 版：`<ScheduleAndLeavePage scope={storeId} />`
- kitchen 版：`<ScheduleAndLeavePage scope="kitchen" />`
- 共節省 600+ 行重複

**工時**：1.5-2h（純重構，含 staging 測試）
**風險**：中（需細心驗證兩端行為一致）

---

## 🛠️ 修改建議

### M1（✅ 已完成 2026-05-22）：S1 backfill 國定假日 / 婚假 leave_balances

**實施結果**：
- Migration `20260522180000_backfill_public_holiday_marriage_leave.sql`
- Prod INSERT 64 筆（32 員工 × 2 假別）
- 每員工取得 public_holiday=11 / marriage_leave=8（2026 年度）
- admin「假別餘額」頁現在可看到所有員工的這 2 個假別

**SQL**（一次性執行）：
```sql
INSERT INTO leave_balances (staff_id, leave_type, year, total_days, used_days)
SELECT s.id, lt.id, 2026, lt.days, 0
FROM staff s
CROSS JOIN (VALUES 
  ('public_holiday', 11),
  ('marriage_leave', 8)
) AS lt(id, days)
WHERE NOT EXISTS (
  SELECT 1 FROM leave_balances b 
  WHERE b.staff_id = s.id 
    AND b.leave_type = lt.id 
    AND b.year = 2026
);
```

**工時**：5 分鐘（staging 跑 → prod 跑）
**影響**：每個員工多 2 個 balance（共 ~40 筆 INSERT）

### M2（業務溝通）：S3 第二主管設定

非代碼問題，與你確認

### M3（中期重構，非緊急）：S4 共用元件

1.5-2h，等其他高優先 audit 做完再排

---

## ✅ 下一步

進入 **#07 StoreHome.tsx**（小頁面，30 分鐘）或 **#07 Kitchen 相關頁** 累積員工常用頁面 audit
