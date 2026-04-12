#!/bin/bash
set -e

VPS="root@5.104.87.209"
VPS_PATH="/root/vps-deploy/sites/yba-order"
SSH_KEY="~/.ssh/id_ed25519"

echo "🚀 開始部署 Yba_order (阿爸的芋圓)..."
echo ""

# 1. Git push
echo "📤 推送到 GitHub..."
git add -A && git commit -m "deploy: $(date +%Y-%m-%d_%H:%M)" 2>/dev/null || echo "(無新變更需 commit)"
git push origin main 2>/dev/null || echo "(已是最新)"
echo ""

# 2. Build
echo "📦 本地編譯中..."
npm run build
echo ""

# 3. 上傳 dist/ 到 VPS
echo "🚢 上傳到 VPS..."
# 清空舊檔後上傳（等同 rsync --delete），Windows Git Bash 不支援 rsync
ssh -i $SSH_KEY $VPS "rm -rf $VPS_PATH/assets $VPS_PATH/fonts $VPS_PATH/index.html $VPS_PATH/version.json $VPS_PATH/vite.svg"
scp -i $SSH_KEY -r dist/* $VPS:$VPS_PATH/
echo ""

# 4. Restart container
echo "🔄 重啟容器..."
ssh -i $SSH_KEY $VPS "docker restart site-yba-order"
echo ""

echo "✅ 部署完成！ → https://order.yen-design.com"
