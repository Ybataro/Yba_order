# YBA Staging 環境實作計畫書

> 版本：v1.0 / 撰寫日：2026-05-21
> 採用方案：**A + C 混合流**（顏小弟建議）
> 目標：建立完全隔離的 Staging，安全地檢查與重構累積技術債

---

## 📐 一、最終架構圖

```
┌────────────────────────────────────────────────────────────────┐
│  VPS 5.104.87.209  (Hetzner CX22 - 7.8G RAM / 72G Disk)        │
│                                                                  │
│  Nginx Proxy Manager (對外 80/443)                              │
│   ├─ order.yen-design.com   → site-yba-order  (prod)            │
│   └─ staging.yen-design.com → site-yba-order-staging (NEW)      │
│                                                                  │
│  PROD 區（完全不動）                                             │
│   ├─ supabase-db        :5432  ← 真實營運 DB (85MB)             │
│   ├─ supabase-kong      :8000  ← API Gateway                    │
│   ├─ supabase-rest             ← PostgREST                       │
│   └─ site-yba-order            ← Nginx 靜態檔                   │
│                                                                  │
│  STAGING 區（新增）                                              │
│   ├─ supabase-db-staging :5433  ← 獨立 DB（NEW）                │
│   ├─ supabase-rest-staging      ← 獨立 PostgREST（NEW）          │
│   ├─ supabase-kong-staging :8010 ← 獨立 Kong（NEW）             │
│   └─ site-yba-order-staging     ← Nginx 靜態檔（NEW）           │
│                                                                  │
│  自動化                                                          │
│   ├─ db-backup (既有)           ← 每天備份 prod DB              │
│   └─ sync-prod-to-staging.sh    ← 每日 03:00 灌 staging (NEW)   │
└────────────────────────────────────────────────────────────────┘

域名分配：
  order.yen-design.com    → PROD 前端
  api.yen-design.com      → PROD Supabase Kong
  staging.yen-design.com  → STAGING 前端           (NEW)
  api-staging.yen-design.com → STAGING Supabase Kong (NEW)
```

---

## 🎯 二、設計原則（不可妥協）

| # | 原則 | 理由 |
|---|---|---|
| 1 | **Staging DB 完全獨立**（不同容器、不同 volume、不同 port） | 防止測試誤寫 prod |
| 2 | **Staging 走獨立 Kong + PostgREST** | 避免 PostgREST schema cache 互相污染 |
| 3 | **Staging 環境變數 build 時固化** | `VITE_SUPABASE_URL` 在 build 時編入 JS bundle，不可運行時切換 |
| 4 | **Telegram 同步後立刻清空 token** | 防止 staging 用真實 bot 騷擾老闆娘 |
| 5 | **同步腳本走離峰**（凌晨 03:00） | 不影響營運（央廚通常 06:00 才開始） |
| 6 | **Staging 域名加 HTTP Basic Auth** | 防止意外被搜尋引擎或顧客找到 |
| 7 | **絕不在 prod 端執行任何破壞性操作** | sync 腳本只 `pg_dump` 不 `psql` 寫 prod |

---

## 📦 三、實施階段（4 個 Phase，約 1-2 天工作量）

### Phase 1：Staging DB 容器（30 分鐘）

**目標**：在 VPS 上開一個獨立的 Postgres 容器

```bash
# 1. SSH 進 VPS
ssh -i ~/.ssh/id_ed25519 root@5.104.87.209

# 2. 建立 staging 資料夾
mkdir -p /root/vps-deploy/supabase-staging/volumes/db/data
mkdir -p /root/vps-deploy/supabase-staging/volumes/db/init

# 3. 加入 docker-compose.yml（新區塊，不動現有）
# （見附錄 A）

# 4. 啟動
cd /root/vps-deploy
docker compose up -d supabase-db-staging
```

**驗證**：
```bash
docker exec supabase-db-staging psql -U postgres -d postgres -c "SELECT version();"
```

**回滾**：`docker compose down supabase-db-staging && rm -rf /root/vps-deploy/supabase-staging`

---

### Phase 2：Staging Kong + PostgREST（30 分鐘）

**目標**：staging DB 要能被前端透過 API 連線

```bash
# 複製 prod kong.yml 為 staging 版本，修改 host
cp /root/vps-deploy/supabase/kong.yml /root/vps-deploy/supabase-staging/kong.yml

# 加入 compose（見附錄 A）
docker compose up -d supabase-rest-staging supabase-kong-staging
```

**驗證**：
```bash
# 在 VPS 本機測試
curl http://localhost:8010/rest/v1/  -H "apikey: $ANON_KEY"
```

---

### Phase 3：同步腳本（1 小時）

**檔案**：`/root/vps-deploy/scripts/sync-prod-to-staging.sh`

```bash
#!/bin/bash
set -e

LOG=/var/log/yba-staging-sync.log
echo "[$(date)] === 開始同步 prod → staging ===" >> $LOG

# 1. 從 db-backup 容器拿最新 prod 備份（已每日自動產生）
LATEST=$(ls -t /root/vps-deploy/backups/daily/*.sql.gz | head -1)
echo "[$(date)] 使用備份：$LATEST" >> $LOG

# 2. 清空 staging DB（drop + recreate）
docker exec supabase-db-staging psql -U postgres -d postgres -c "
  DROP DATABASE IF EXISTS postgres_new;
  CREATE DATABASE postgres_new;
" >> $LOG 2>&1

# 3. 灌入備份
gunzip -c $LATEST | docker exec -i supabase-db-staging psql -U postgres -d postgres_new >> $LOG 2>&1

# 4. swap 資料庫（瞬間切換，staging 中斷 < 1 秒）
docker exec supabase-db-staging psql -U postgres -d postgres -c "
  ALTER DATABASE postgres RENAME TO postgres_old;
  ALTER DATABASE postgres_new RENAME TO postgres;
  DROP DATABASE postgres_old;
" >> $LOG 2>&1

# 5. 🔴 關鍵安全步驟：清空 staging DB 的 Telegram token
docker exec supabase-db-staging psql -U postgres -d postgres -c "
  UPDATE app_settings SET value = '' WHERE key LIKE 'telegram%';
  UPDATE staff SET telegram_id = NULL;
" >> $LOG 2>&1

# 6. 重啟 PostgREST 讓 schema cache 更新
docker restart supabase-rest-staging >> $LOG 2>&1

echo "[$(date)] === 同步完成 ===" >> $LOG
```

**Cron 設定**（VPS root crontab）：
```cron
0 3 * * * /root/vps-deploy/scripts/sync-prod-to-staging.sh
```

**第一次手動執行驗證**：
```bash
bash /root/vps-deploy/scripts/sync-prod-to-staging.sh
docker exec supabase-db-staging psql -U postgres -d postgres -c "SELECT count(*) FROM store_products;"
# 應該回傳與 prod 一樣的數量
```

---

### Phase 4：Staging 前端與部署腳本（1 小時）

#### 4.1 本地建立 `.env.staging`

```bash
# C:\Users\YEN\YEN_project\Yba_order\.env.staging
VITE_SUPABASE_URL=https://api-staging.yen-design.com
VITE_SUPABASE_ANON_KEY=<staging 用 ANON_KEY，建議與 prod 不同 JWT_SECRET 簽發>
VITE_CWA_API_KEY=CWA-EAAD8090-1787-462E-8BC1-73478DD637B3
```

**注意**：Staging 可以共用同一個 ANON_KEY（因為 JWT_SECRET 同源），但**建議簽一支新的**避免日後混淆。

#### 4.2 修改 `vite.config.ts`（支援多 mode）

vite 內建 mode 機制：`vite build --mode staging` 會自動讀 `.env.staging`，**不需改 vite.config.ts**。

#### 4.3 建立 `deploy-staging.sh`

```bash
#!/bin/bash
set -e

VPS="root@5.104.87.209"
VPS_PATH="/root/vps-deploy/sites/yba-order-staging"
SSH_KEY="~/.ssh/id_ed25519"

echo "🧪 部署到 STAGING..."

# Build（用 .env.staging）
npm run build -- --mode staging

# 上傳
ssh -i $SSH_KEY $VPS "mkdir -p $VPS_PATH && rm -rf $VPS_PATH/assets $VPS_PATH/fonts $VPS_PATH/index.html"
scp -i $SSH_KEY -r dist/* $VPS:$VPS_PATH/
ssh -i $SSH_KEY $VPS "docker restart site-yba-order-staging"

echo "✅ Staging 已更新 → https://staging.yen-design.com"
```

#### 4.4 VPS 加 staging nginx 容器

加入 docker-compose.yml（見附錄 A），啟動：
```bash
docker compose up -d site-yba-order-staging
```

#### 4.5 Nginx Proxy Manager 加 staging.yen-design.com
- 進 NPM UI（http://5.104.87.209:81）
- Proxy Hosts → Add → Domain: `staging.yen-design.com` → Forward to `site-yba-order-staging:80`
- SSL → Let's Encrypt 自動申請
- **Access List → 加 HTTP Basic Auth**（帳號密碼自訂，防止外人誤入）

#### 4.6 Cloudflare 加 DNS A record
- `staging.yen-design.com` → `5.104.87.209`
- `api-staging.yen-design.com` → `5.104.87.209`

---

## 🧪 四、驗收標準（必須全綠才算完成）

| # | 驗收項目 | 指令 / 操作 |
|---|---|---|
| 1 | Staging DB 容器健康 | `docker ps \| grep supabase-db-staging` 顯示 healthy |
| 2 | Staging DB 有完整資料 | `SELECT count(*) FROM store_products` 與 prod 一致 |
| 3 | Staging Telegram token 為空 | `SELECT value FROM app_settings WHERE key='telegram_bot_token'` 回傳空字串 |
| 4 | Staging staff 無 telegram_id | `SELECT count(*) FROM staff WHERE telegram_id IS NOT NULL` 回傳 0 |
| 5 | staging.yen-design.com 可訪問 | 瀏覽器開啟需輸入 Basic Auth，登入後正常顯示 |
| 6 | Staging 前端確實連 staging API | DevTools Network 看到請求都打 `api-staging.yen-design.com` |
| 7 | 在 staging 測試送出叫貨單 | prod DB 不會增加記錄、群組不會收到 Telegram |
| 8 | 同步腳本 cron 已生效 | `crontab -l` 看到該行 |
| 9 | Prod 完全沒被影響 | order.yen-design.com 正常、容器無重啟 |

---

## ⚠️ 五、風險矩陣

| 風險 | 機率 | 影響 | 緩解 |
|---|---|---|---|
| 同步腳本誤指向 prod 寫入 | 低 | 致命 | 腳本內所有寫操作都 hardcode `supabase-db-staging` 容器名 |
| Staging 用 prod Telegram token 發訊息 | 中 | 高 | 同步後立即 UPDATE 清空（Phase 3 第 5 步）|
| pg_dump 影響 prod 效能 | 極低 | 中 | 用 db-backup 既有備份檔，不對 prod 加負載 |
| Staging 容器吃光記憶體 | 低 | 中 | Postgres 設 `shared_buffers=128MB`，nginx 5MB，總增約 250MB |
| 顧客誤訪 staging | 中 | 低 | HTTP Basic Auth + robots.txt disallow |
| Schema migration 在 staging 跑成功但 prod 失敗 | 中 | 高 | 上 prod 前必須在 staging 用「當天剛同步的 DB」再跑一次 |
| 同步腳本失敗無人發現 | 中 | 中 | Phase 5 加 Telegram 通知（給 Yen 個人，非群組）|

---

## 🔐 六、機密資訊處理

| 資訊 | Staging 處理 |
|---|---|
| `POSTGRES_PASSWORD` | 用獨立密碼（不要與 prod 共用） |
| `JWT_SECRET` | 可共用（不影響資料安全） |
| `ANON_KEY` | 可共用，但建議新簽一支 |
| `SERVICE_ROLE_KEY` | **絕對不可暴露給前端**，staging 也一樣 |
| Telegram bot token | 同步後清空 |
| 員工 telegram_id | 同步後 NULL |
| Cloudflare API key | 不用動 |
| CWA 氣象 API key | 可共用 |

---

## 📅 七、實施排程建議

| 階段 | 預估時間 | 風險 | 建議執行時段 |
|---|---|---|---|
| Phase 1 (DB 容器) | 30 分 | 低 | 任何時段 |
| Phase 2 (Kong+REST) | 30 分 | 低 | 任何時段 |
| Phase 3 (同步腳本) | 1 小時 | 低 | 任何時段 |
| Phase 4 (前端+域名) | 1 小時 | 低 | 任何時段（DNS 生效需等 5 分） |
| 整體驗收 | 1 小時 | - | 央廚收工後（22:00 後）|

**總計**：4-5 小時可全部完成。

---

## 🚀 八、Staging 啟用後的日常工作流程

### 場景 A：前端 bug fix
```
1. 本地寫 code → npm run dev 開發
2. bash deploy-staging.sh → 上 staging 測試
3. 在 staging 玩 1-2 天，確認沒問題
4. bash deploy.sh → 上 prod
5. 出問題：git revert + bash deploy.sh（不到 5 分鐘）
```

### 場景 B：DB Schema migration
```
1. 寫 migration SQL
2. 在 staging DB 跑 → 用今天剛同步的真實資料驗證
3. 重跑一次同步腳本 → 確認 migration 與 prod 結構相容
4. 在 staging 跑前端，所有功能走一遍
5. 上 prod：先跑 migration，再 deploy.sh 上前端
6. 出問題：DB 用 db-backup 還原（這部分要事先演練！）
```

### 場景 C：大型重構（你最想要的）
```
1. 開新 branch refactor/xxx
2. 持續 deploy-staging.sh，staging 一直保持最新
3. 連續數天用真實資料驗證
4. 最終決定上 prod 前：當天再灌一次 staging，跑完整驗收清單
5. 排在央廚收工後上 prod
```

---

## 📎 附錄 A：docker-compose.yml 新增區塊（給你核對用）

> ⚠️ 此區塊**新增**在 `/root/vps-deploy/docker-compose.yml` 結尾，不動既有服務

```yaml
  # ============================================================
  # STAGING 環境（與 prod 完全隔離）
  # ============================================================

  supabase-db-staging:
    image: supabase/postgres:15.6.1.143
    container_name: supabase-db-staging
    restart: unless-stopped
    ports:
      - "127.0.0.1:5433:5432"
    environment:
      POSTGRES_PASSWORD: ${STAGING_POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - ./supabase-staging/volumes/db/data:/var/lib/postgresql/data
    networks:
      - supabase-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    mem_limit: 512m

  supabase-rest-staging:
    image: postgrest/postgrest:v12.2.3
    container_name: supabase-rest-staging
    restart: unless-stopped
    depends_on:
      supabase-db-staging:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:${STAGING_POSTGRES_PASSWORD}@supabase-db-staging:5432/postgres
      PGRST_DB_SCHEMAS: public,storage,graphql_public
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
    networks:
      - supabase-net
    mem_limit: 128m

  supabase-kong-staging:
    image: kong:2.8.1
    container_name: supabase-kong-staging
    restart: unless-stopped
    depends_on:
      supabase-rest-staging:
        condition: service_started
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl,basic-auth
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}
    volumes:
      - ./supabase-staging/kong.yml:/var/lib/kong/kong.yml:ro
    ports:
      - "127.0.0.1:8010:8000"
    networks:
      - supabase-net
      - proxy-net
    mem_limit: 256m

  site-yba-order-staging:
    image: nginx:alpine
    container_name: site-yba-order-staging
    restart: unless-stopped
    volumes:
      - ./sites/yba-order-staging:/usr/share/nginx/html:ro
      - ./nginx/spa.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - proxy-net
    mem_limit: 64m
```

`.env` 需新增一行：
```
STAGING_POSTGRES_PASSWORD=<獨立的安全密碼>
```

---

## 📎 附錄 B：資源預估

| 容器 | 額外記憶體 | 額外磁碟 |
|---|---|---|
| supabase-db-staging | ~200MB | ~150MB（DB 85MB + WAL）|
| supabase-rest-staging | ~50MB | 0 |
| supabase-kong-staging | ~150MB | 0 |
| site-yba-order-staging | ~5MB | ~10MB（dist）|
| **總計** | **~400MB** | **~160MB** |

VPS 現況：可用 4.5G RAM、55G 磁碟 → **完全 OK，零壓力**

---

## 🚩 九、需要你決策的事項

實施前需確認：

1. **STAGING_POSTGRES_PASSWORD**：要用什麼？建議我隨機產生一個
2. **HTTP Basic Auth 帳密**：staging 域名的保護帳密
3. **新 ANON_KEY**：要新簽還是共用 prod 的（共用較快但混淆風險）
4. **同步失敗通知**：要不要加 Telegram 通知（給你個人）
5. **DNS 操作**：你自己加 Cloudflare DNS 還是我用 API（需 API token）
6. **NPM 操作**：你自己進 UI 設定還是我寫 CLI 腳本

---

## ✅ 十、計畫書核對清單

請逐項確認，有疑問就提出來：

- [ ] 架構圖看得懂
- [ ] 同意 staging 走完全獨立的 DB+Kong+REST
- [ ] 同意 Telegram token 在同步後清空
- [ ] 同意用 HTTP Basic Auth 保護 staging 域名
- [ ] 同意每日 03:00 同步（或想改時間）
- [ ] 同意實施排程（4-5 小時，央廚收工後驗收）
- [ ] 同意風險矩陣的緩解策略
- [ ] 知道日常工作流程會如何變化

---

**核對完畢、給我綠燈後，我會從 Phase 1 開始實作，每完成一個 Phase 都會停下來讓你驗證後再進下一步。**
