# Yba_order V2.0 系統穩定性升級計畫

**版本**：V2.0
**日期**：2026-04-07
**目標**：解決提交鎖死、離線佇列卡住、到期日殘留、舊版快取四大核心問題

---

## 執行總覽

| Phase | 內容 | 優先級 | 工程量 |
|-------|------|--------|--------|
| **Phase 1** | 全域錯誤攔截 + Telegram 報錯（窮人版 Sentry） | 🔴 高 | 小 |
| **Phase 2** | 核心提交流程重構（解鎖死 + 離線佇列） | 🔴 高 | 中 |
| **Phase 3** | 資料一致性（RPC 原子操作 + 快取隔離） | 🟡 中 | 中 |
| **Phase 4** | 部署安全（Nginx no-cache + 版本檢查 + 收貨確認） | 🟡 中 | 小 |

---

## Phase 1：全域錯誤攔截 + Telegram 報錯

> 不用 Sentry，不裝套件。用現有 Telegram Bot 達到 80% 即時報錯價值。

### 1-1. 全域錯誤攔截器（main.tsx）

在 `main.tsx` 加上兩個全域監聽器，攔截所有未預期的錯誤：

```typescript
// window.onerror — 捕捉同步錯誤（變數 undefined、型別錯誤等）
window.addEventListener('error', (event) => {
  sendCrashReport({
    type: 'uncaught_error',
    message: event.message,
    source: event.filename,
    line: event.lineno,
    stack: event.error?.stack,
  });
});

// window.onunhandledrejection — 捕捉未處理的 Promise 錯誤
window.addEventListener('unhandledrejection', (event) => {
  sendCrashReport({
    type: 'unhandled_rejection',
    message: String(event.reason),
    stack: event.reason?.stack,
  });
});
```

### 1-2. sendCrashReport（串接 Telegram）

```typescript
function sendCrashReport(info: {
  type: string;
  message: string;
  source?: string;
  line?: number;
  stack?: string;
}) {
  // 過濾網路斷線雜訊（離線時不報）
  if (!navigator.onLine) return;
  const noise = ['Failed to fetch', 'Network Error', 'Load failed', 'timeout'];
  if (noise.some(n => info.message?.includes(n))) return;

  const page = window.location.pathname;
  const storeId = sessionStorage.getItem('storeId') || '未知';
  const staffName = sessionStorage.getItem('staffName') || '未知';

  const text = [
    `🚨 前端崩潰報告`,
    `📍 頁面：${page}`,
    `🏪 門店：${storeId}`,
    `👤 操作者：${staffName}`,
    `❌ 類型：${info.type}`,
    `💬 訊息：${info.message}`,
    info.source ? `📄 檔案：${info.source}:${info.line}` : '',
    info.stack ? `📋 Stack：${info.stack.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n');

  // 用現有的 sendTelegramNotification
  sendTelegramNotification(text).catch(() => {});

  // 5 分鐘內同一錯誤不重複報（防洪水攻擊）
  // 用 sessionStorage 簡易節流
}
```

### 1-3. React ErrorBoundary（渲染崩潰時的友善畫面）

現有 `ErrorBoundary.tsx` 升級：
- 渲染崩潰時顯示「系統發生異常，已通知管理員」
- 自動發送 Telegram 報錯（含 componentStack）
- 提供「重新載入」按鈕

**改動檔案**：`main.tsx`, `src/lib/crashReport.ts`(新建), `src/components/ErrorBoundary.tsx`

---

## Phase 2：核心提交流程重構

> 解決 submittingRef 鎖死 + IndexedDB 佇列卡住

### 2-1. handleSubmit 解鎖死（Inventory.tsx + Order.tsx）

**現狀問題**：`submittingRef.current = true` 後如果網路超時或異常，鎖永遠不會釋放。

**重構方案**：

```typescript
const handleSubmit = async () => {
  if (submittingRef.current) return;
  submittingRef.current = true;
  setSubmitting(true);

  try {
    // 15 秒超時保護
    const result = await Promise.race([
      doSubmit(),  // 實際提交邏輯
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('提交超時（15秒）')), 15000)
      ),
    ]);

    // 成功處理...

  } catch (error) {
    showToast(error instanceof Error ? error.message : '提交失敗，請重試', 'error');

    // 線上 + 非超時 → 報告 Telegram
    if (navigator.onLine && !(error instanceof Error && error.message.includes('超時'))) {
      sendCrashReport({
        type: 'submit_error',
        message: String(error),
        stack: (error as Error)?.stack,
      });
    }
  } finally {
    // 🔑 永遠解鎖
    submittingRef.current = false;
    setSubmitting(false);
  }
};
```

**改動檔案**：`Inventory.tsx`, `Order.tsx`, `ProductStock.tsx`（所有有 submittingRef 的頁面）

### 2-2. 離線佇列去重 + 序列化 + 失敗標記（offlineQueue.ts）

**現狀問題**：
- 同一 sessionId 可能產生多筆 pending，同步時全部送出 → 重複寫入
- 單筆失敗會卡死整個佇列

**重構方案**：

```typescript
// 1. 去重：同步前先整理，同 sessionId 只保留最新
async function deduplicateQueue(): Promise<PendingSubmission[]> {
  const all = await getPendingSubmissions();
  const map = new Map<string, PendingSubmission>();
  for (const item of all) {
    const existing = map.get(item.sessionId);
    if (!existing || item.createdAt > existing.createdAt) {
      map.set(item.sessionId, item);
    }
  }
  // 清除被丟棄的舊筆
  const kept = new Set([...map.values()].map(v => v.id));
  for (const item of all) {
    if (!kept.has(item.id)) await removePendingSubmission(item.id);
  }
  return [...map.values()];
}

// 2. 序列化同步（逐筆處理，失敗不阻擋）
async function syncAllPending(): Promise<{ success: number; failed: number }> {
  const items = await deduplicateQueue();
  let success = 0, failed = 0;

  for (const item of items) {
    try {
      await submitToSupabase(item);
      await removePendingSubmission(item.id);
      success++;
    } catch (err) {
      // 標記為失敗，不阻擋後續
      await markAsFailed(item.id, String(err));
      failed++;
      sendCrashReport({
        type: 'offline_sync_error',
        message: `離線同步失敗: ${item.sessionId} - ${err}`,
      });
    }
  }

  return { success, failed };
}
```

**新增欄位**：`PendingSubmission` 加 `status?: 'pending' | 'failed'` 和 `failReason?: string`

**改動檔案**：`offlineQueue.ts`, `OfflineBanner.tsx`（顯示失敗筆數）

---

## Phase 3：資料一致性

> 到期日原子操作 + 快取隔離

### 3-1. Supabase RPC 到期日原子操作

**現狀問題**：前端先讀舊值 → 計算 Diff → 刪除 → 寫入，弱網下極易殘留。

**SQL Function**（在 Supabase SQL Editor 執行）：

```sql
-- 盤點到期日批次原子同步
CREATE OR REPLACE FUNCTION sync_inventory_stock_entries(
  p_session_id TEXT,
  p_entries JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM inventory_stock_entries WHERE session_id = p_session_id;
  IF jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO inventory_stock_entries (session_id, product_id, expiry_date, quantity)
    SELECT
      p_session_id,
      (elem->>'product_id')::TEXT,
      (elem->>'expiry_date')::DATE,
      (elem->>'quantity')::NUMERIC
    FROM jsonb_array_elements(p_entries) AS elem;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 央廚成品到期日批次原子同步（同邏輯）
CREATE OR REPLACE FUNCTION sync_product_stock_entries(
  p_session_id TEXT,
  p_entries JSONB
) RETURNS void AS $$
BEGIN
  DELETE FROM product_stock_entries WHERE session_id = p_session_id;
  IF jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO product_stock_entries (session_id, product_id, expiry_date, quantity)
    SELECT
      p_session_id,
      (elem->>'product_id')::TEXT,
      (elem->>'expiry_date')::DATE,
      (elem->>'quantity')::NUMERIC
    FROM jsonb_array_elements(p_entries) AS elem;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**前端呼叫**（取代原本 40+ 行的讀取→比較→刪除→寫入）：

```typescript
const { error } = await supabase.rpc('sync_inventory_stock_entries', {
  p_session_id: sessionId,
  p_entries: newEntries,  // [{ product_id, expiry_date, quantity }, ...]
});
if (error) throw new Error(`到期日同步失敗: ${error.message}`);
```

**改動檔案**：`Inventory.tsx`（handleSubmit 到期日區段）, `ProductStock.tsx`（同步修改）

### 3-2. 建議量快取 key 加維度（suggestion.ts）

**現狀問題**：快取 key 是 module-level 變數，切換門店不會清除。

**修正**：

```typescript
// 原本
let cachedResult = null;
let cacheTime = 0;

// 改為
const suggestionCache = new Map<string, { result: any; time: number }>();

function getCacheKey(storeId: string, date: string) {
  return `suggestion_${storeId}_${date}`;
}

export function clearSuggestionCache(storeId?: string) {
  if (storeId) {
    for (const key of suggestionCache.keys()) {
      if (key.startsWith(`suggestion_${storeId}`)) suggestionCache.delete(key);
    }
  } else {
    suggestionCache.clear();
  }
}
```

**改動檔案**：`suggestion.ts`

---

## Phase 4：部署安全

### 4-1. Nginx no-cache for index.html

**VPS Nginx 設定**（`/root/vps-deploy/nginx/yba.conf` 或同等位置）：

```nginx
location = /index.html {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header Pragma "no-cache";
    expires 0;
}

# JS/CSS 有 hash 可以長快取
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

### 4-2. Version Check Hook（新建）

```typescript
// useVersionCheck.ts
// 每 5 分鐘 + 路由切換時檢查 /version.json
// 若版本不符 → Toast 提示「系統已更新，請重新整理」
// version.json 在 build 時自動生成（timestamp）
```

**改動檔案**：新建 `src/hooks/useVersionCheck.ts`, `public/version.json`（build script 產生）

### 4-3. 收貨二次確認 Dialog（Receive.tsx）

```typescript
// 按「確認收貨」→ 彈出 Dialog
// 「確認後將核銷全部品項，且無法撤銷。確定嗎？」
// [取消] [確認收貨]
```

**改動檔案**：`Receive.tsx`

---

## 改動檔案總覽

| Phase | 檔案 | 改動類型 |
|-------|------|---------|
| 1 | `main.tsx` | 加全域錯誤監聽 |
| 1 | `src/lib/crashReport.ts` | **新建** — Telegram 報錯 |
| 1 | `src/components/ErrorBoundary.tsx` | 升級 — 加 Telegram 報錯 |
| 2 | `src/pages/store/Inventory.tsx` | 重構 handleSubmit |
| 2 | `src/pages/store/Order.tsx` | 重構 handleSubmit |
| 2 | `src/pages/kitchen/ProductStock.tsx` | 重構 handleSubmit |
| 2 | `src/lib/offlineQueue.ts` | 去重 + 序列化 + 失敗標記 |
| 2 | `src/components/OfflineBanner.tsx` | 顯示失敗筆數 |
| 3 | Supabase SQL Editor | 建立 2 支 RPC Function |
| 3 | `src/pages/store/Inventory.tsx` | 到期日改用 RPC |
| 3 | `src/pages/kitchen/ProductStock.tsx` | 到期日改用 RPC |
| 3 | `src/lib/suggestion.ts` | 快取 key 加維度 |
| 4 | Nginx 設定 | index.html no-cache |
| 4 | `src/hooks/useVersionCheck.ts` | **新建** — 版本檢查 |
| 4 | `public/version.json` | **新建** — build 時產生 |
| 4 | `src/pages/store/Receive.tsx` | 加二次確認 Dialog |

---

## 風險評估

| 改動 | 風險 | 影響範圍 |
|------|------|---------|
| handleSubmit 重構 | 低 — 只加 try/finally 包裝 | 盤點/叫貨/央廚庫存 |
| 離線佇列去重 | 中 — 需確保去重不誤刪有效資料 | 所有離線提交 |
| RPC 原子操作 | 低 — DB Function 獨立，不影響現有表 | 到期日批次 |
| Nginx no-cache | 低 — 只影響 index.html | 全站 |
| Version Check | 低 — 純提示，不強制 | 全站 |
| 收貨確認 Dialog | 低 — 純 UI 增強 | 收貨頁 |
| 全域錯誤攔截 | 低 — 只做通知，不改業務邏輯 | 全站 |

---

## 不在此次範圍（未來再做）

- Sentry 正式導入（等門店擴展 5+ 間）
- 部分收貨功能（需 UI 重設計）
- 出貨量上限驗證
- 離線佇列自動同步（目前手動觸發，需 Service Worker）
