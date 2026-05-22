#!/usr/bin/env bash
# deploy-staging.sh — push текущих изменений на staging (dev ветка)
set -e

RAILWAY="$HOME/.railway/bin/railway"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🚀 Deploy to STAGING"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Убедимся что мы на dev ветке
if [ "$BRANCH" != "dev" ]; then
  echo "⚠️  Ты на ветке '$BRANCH', переключаюсь на dev..."
  git checkout dev
fi

# Коммитим незакоммиченное если есть
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "📦 Есть незакоммиченные изменения — коммичу..."
  git add -A
  git commit -m "chore: staging deploy $(date '+%Y-%m-%d %H:%M')"
fi

git push origin dev
echo ""
echo "✅ Запушено на dev → Railway staging деплоит автоматически"
echo "📋 Логи: npm run logs:staging"
echo "🌐 URL: проверь в Railway Dashboard → staging environment"
