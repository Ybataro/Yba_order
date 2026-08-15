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

# ── 6. 只保留最近 7 份 DB dump 與 bundle（避免 D 槽爆掉）──
ls -1t "$DEST/db-backup/"yba-*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$DEST/"Yba_order-*.bundle    2>/dev/null | tail -n +8 | xargs -r rm -f

echo ""
echo "✅ 備份完成 → $DEST"
echo "   DB dump : yba-$STAMP.sql.gz ($TABLES 張表)"
echo "   bundle  : Yba_order-$STAMP.bundle"
echo "   記憶檔  : $(ls -1 "$DEST/.claude-memory/"*.md 2>/dev/null | wc -l) 個"
echo ""
echo "還原 DB 指令："
echo "  zcat $DEST/db-backup/yba-$STAMP.sql.gz | ssh -i ~/.ssh/id_ed25519 $VPS 'docker exec -i supabase-db psql -U postgres -d postgres'"
