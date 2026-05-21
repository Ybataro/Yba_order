#!/bin/bash
set -e

VPS="root@5.104.87.209"
VPS_PATH="/root/vps-deploy/sites/yba-order-staging"
SSH_KEY="~/.ssh/id_ed25519"

echo "🧪 部署到 STAGING（測試環境，不影響 prod）..."
echo ""

# 1. Build with staging env
echo "📦 用 .env.staging 編譯..."
node scripts/gen-version.js
npx tsc -b
npx vite build --mode staging
echo ""

# 2. Upload dist/
echo "🚢 上傳到 VPS staging..."
ssh -i $SSH_KEY $VPS "mkdir -p $VPS_PATH && rm -rf $VPS_PATH/assets $VPS_PATH/fonts $VPS_PATH/index.html $VPS_PATH/version.json $VPS_PATH/vite.svg 2>/dev/null || true"
scp -i $SSH_KEY -r dist/* $VPS:$VPS_PATH/
echo ""

# 3. Restart staging container
echo "🔄 重啟 staging 容器..."
ssh -i $SSH_KEY $VPS "docker restart site-yba-order-staging"
echo ""

echo "✅ Staging 已更新 → https://staging.yen-design.com"
echo "   （Basic Auth: yen / yba_staging_2026）"
