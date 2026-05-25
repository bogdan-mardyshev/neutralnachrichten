#!/usr/bin/env bash
# deploy-staging.sh — пушим dev → Railway staging для тестирования
# На staging можно деплоить свободно. На prod — только через deploy-prod.sh.
set -e

RAILWAY="$HOME/.railway/bin/railway"
BOLD='\033[1m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  🚀  STAGING DEPLOY"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Тесты ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/3] Запускаю тесты...${NC}"
if ! npm test; then
  echo ""
  echo -e "${RED}❌  Тесты не прошли. Исправь перед деплоем на staging.${NC}"
  exit 1
fi
echo -e "${GREEN}✅  Тесты зелёные${NC}"
echo ""

# ── Ветка ─────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/3] Проверяю ветку...${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "dev" ]; then
  echo -e "${YELLOW}⚠️   Ты на '$BRANCH', переключаюсь на dev...${NC}"
  git checkout dev
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${YELLOW}📦  Коммичу незакоммиченные изменения...${NC}"
  git add -A
  git commit -m "chore: staging deploy $(date '+%Y-%m-%d %H:%M')"
fi

# ── Push ───────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/3] Пушу на dev...${NC}"
git push origin dev

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ✅  НА STAGING (Railway деплоит автоматически)${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  📋  Логи: npm run logs:staging"
echo -e "  🌐  URL: Railway Dashboard → staging environment"
echo ""
echo -e "  ${YELLOW}⚠️   Это STAGING — не production.${NC}"
echo -e "  Проверь всё руками, потом: ${BOLD}npm run deploy:prod${NC}"
echo ""
