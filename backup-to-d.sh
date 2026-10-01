#!/bin/bash
# YBA 完整備份到 D:\YEN_project\Yba_order
# 用法：bash backup-to-d.sh
# 每天手動輸入的資料很重要，建議每天收工後跑一次。

set -e

VPS="root@5.104.87.209"
SSH_KEY="$HOME/.ssh/id_ed25519"
DEST="/d/YEN_project/Yba_order"
STAMP=$(date +%Y%m%d-%H%M)

echo "🗄️  YBA 備份開始 — $STAMP"
echo ""

mkdir -p "$DEST/db-backup" "$DEST/config" "$DEST/.claude-memory"

# ── 1. 即時 DB dump（不是用 VPS 02:00 的舊檔，抓此刻最新）──
echo "📊 產生即時 DB dump..."
ssh -i "$SSH_KEY" "$VPS" \
  "docker exec supabase-db pg_dump -U postgres -d postgres --clean --if-exists | gzip > /tmp/yba-$STAMP.sql.gz"
scp -i "$SSH_KEY" "$VPS:/tmp/yba-$STAMP.sql.gz" "$DEST/db-backup/"
ssh -i "$SSH_KEY" "$VPS" "rm -f /tmp/yba-$STAMP.sql.gz"

# ── 2. 驗證（沒驗證的備份不算備份）──
echo "🔍 驗證備份完整性..."
gzip -t "$DEST/db-backup/yba-$STAMP.sql.gz" || { echo "🔴 gzip 損毀！備份失敗"; exit 1; }
TABLES=$(zcat "$DEST/db-backup/yba-$STAMP.sql.gz" | grep -c '^CREATE TABLE')
if [ "$TABLES" -lt 150 ]; then
  echo "🔴 表數異常（$TABLES < 150），dump 可能不完整！"; exit 1
fi
echo "   ✅ gzip 完整，$TABLES 張表"

# ── 3. git bundle（完整版控歷史）──
echo "📦 建立 git bundle..."
git bundle create "$DEST/Yba_order-$STAMP.bundle" --all >/dev/null 2>&1
git bundle verify "$DEST/Yba_order-$STAMP.bundle" >/dev/null 2>&1 \
  && echo "   ✅ bundle 驗證通過" || { echo "🔴 bundle 驗證失敗"; exit 1; }

# ── 4. 設定檔 + migrations ──
echo "⚙️  備份設定檔..."
cp .env .env.staging deploy.sh deploy-staging.sh CLAUDE.md package.json "$DEST/config/" 2>/dev/null || true
rm -rf "$DEST/config/migrations"
cp -r supabase/migrations "$DEST/config/migrations"

# ── 5. Claude 記憶 ──
echo "🧠 備份 Claude 記憶..."
cp -r "$HOME/.claude/projects/C--Users-YEN-YEN-project-Yba-order/memory/"* "$DEST/.claude-memory/" 2>/dev/null || true

# ── 5b. VPS 基礎設施（不備這些，DB 救回來也架不起來）──
# nginx/data/logs 91M 純日誌，排除。
echo "🏗️  備份 VPS 基礎設施..."
mkdir -p "$DEST/vps-infra"
ssh -i "$SSH_KEY" "$VPS" "cd /root/vps-deploy && tar czf - \
  docker-compose.yml nginx/spa.conf nginx/stock-v2.conf scripts \
  --exclude='nginx/data/logs' nginx/data nginx/letsencrypt 2>/dev/null" \
  > "$DEST/vps-infra/vps-infra-$STAMP.tar.gz"
gzip -t "$DEST/vps-infra/vps-infra-$STAMP.tar.gz" || { echo "🔴 infra tar 損毀"; exit 1; }
ssh -i "$SSH_KEY" "$VPS" "crontab -l" > "$DEST/vps-infra/crontab-$STAMP.txt" 2>/dev/null || true
echo "   ✅ infra $(du -h "$DEST/vps-infra/vps-infra-$STAMP.tar.gz" | cut -f1)（含 NPM 設定 + SSL 憑證）"

# ── 5c. 機密檔加密（JWT_SECRET / SSH 金鑰 = VPS root 權限，明文放 D 槽等於裸奔）──
# AES-256，密碼存 $DEST/../yba-backup-pass.txt（放 D 槽根目錄外，或自行改成手動輸入）
echo "🔐 加密機密檔..."
PASSFILE="$HOME/.yba-backup-pass"
[ -f "$PASSFILE" ] || { echo "🔴 缺密碼檔 $PASSFILE — 請先建立（內容=備份密碼）"; exit 1; }
# openssl 是原生 Windows 版，吃不懂 Git Bash 的 /c/... 路徑，要轉成 C:/...
PASSARG=$(cygpath -m "$PASSFILE" 2>/dev/null || echo "$PASSFILE")
SECRET_TMP=$(mktemp -d)
cp "$SSH_KEY" "$SSH_KEY.pub" "$SECRET_TMP/" 2>/dev/null || true
ssh -i "$SSH_KEY" "$VPS" "cat /root/vps-deploy/.env" > "$SECRET_TMP/vps-deploy.env"
cp .env .env.staging "$SECRET_TMP/" 2>/dev/null || true
tar czf - -C "$SECRET_TMP" . | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 \
  -pass file:"$PASSARG" -out "$DEST/secrets-$STAMP.tar.gz.enc"
rm -rf "$SECRET_TMP"
# 驗證：解得開才算數
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass file:"$PASSARG" \
  -in "$DEST/secrets-$STAMP.tar.gz.enc" | tar tzf - >/dev/null \
  && echo "   ✅ 加密包驗證通過（解密可讀）" || { echo "🔴 加密包解不開！"; exit 1; }
# 舊的明文金鑰目錄清掉
rm -rf "$DEST/ssh-key" "$DEST/config/.env" "$DEST/config/.env.staging"

# ── 6. 只保留最近 7 份 DB dump / bundle / infra / secrets（避免 D 槽爆掉）──
ls -1t "$DEST/db-backup/"yba-*.sql.gz        2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST/"Yba_order-*.bundle            2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST/vps-infra/"vps-infra-*.tar.gz  2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST/vps-infra/"crontab-*.txt       2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST/"secrets-*.tar.gz.enc          2>/dev/null | tail -n +8 | xargs -r rm -f

echo ""
echo "✅ 備份完成 → $DEST"
echo "   DB dump : yba-$STAMP.sql.gz ($TABLES 張表)"
echo "   bundle  : Yba_order-$STAMP.bundle"
echo "   infra   : vps-infra/vps-infra-$STAMP.tar.gz + crontab-$STAMP.txt"
echo "   機密    : secrets-$STAMP.tar.gz.enc（AES-256 加密）"
echo "   記憶檔  : $(ls -1 "$DEST/.claude-memory/"*.md 2>/dev/null | wc -l) 個"
echo ""
echo "🔴 VPS 全毀重架 → 照 $DEST/RESTORE.md 的「災難復原」章節做"
