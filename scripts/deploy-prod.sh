#!/usr/bin/env bash
# deploy-prod.sh — продвигает dev → main → production
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 Deploy to PRODUCTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  Это задеплоит на neutralenachrichten.com"
echo ""
read -p "Staging протестирован? Продолжить? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Отменено"
  exit 1
fi

# Убедимся что dev чистый
if [ "$BRANCH" != "dev" ]; then
  git checkout dev
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "📦 Есть незакоммиченные изменения — коммичу..."
  git add -A
  git commit -m "chore: pre-prod cleanup $(date '+%Y-%m-%d %H:%M')"
  git push origin dev
fi

echo ""
echo "🔀 Merge dev → main..."
git checkout main
git merge dev --no-edit
git push origin main

echo ""
echo "✅ Задеплоено на PRODUCTION"
echo "📋 Логи: npm run logs:prod"
echo "🌐 https://www.neutralenachrichten.com"

# Возвращаемся на dev для дальнейшей работы
git checkout dev
echo ""
echo "↩️  Переключился обратно на dev"
