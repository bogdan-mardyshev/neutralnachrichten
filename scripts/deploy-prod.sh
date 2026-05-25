#!/usr/bin/env bash
# deploy-prod.sh — PRODUCTION deploy: dev → main
# Правило: staging протестирован, все тесты зелёные, явное подтверждение.
set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}${BOLD}  🚨  PRODUCTION DEPLOY  🚨${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Цель: ${BOLD}neutralenachrichten.com${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Шаг 1: прогоняем все тесты ────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Запускаю тесты...${NC}"
if ! npm test; then
  echo ""
  echo -e "${RED}❌  Тесты не прошли. Деплой отменён.${NC}"
  echo -e "    Запусти ${BOLD}npm test${NC} чтобы увидеть что сломано."
  exit 1
fi
echo -e "${GREEN}✅  Все тесты зелёные${NC}"
echo ""

# ── Шаг 2: убеждаемся что мы на dev ───────────────────────────────────────────
echo -e "${YELLOW}[2/4] Проверяю ветку...${NC}"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "dev" ]; then
  echo -e "${YELLOW}⚠️   Ты на '$BRANCH', переключаюсь на dev...${NC}"
  git checkout dev
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${YELLOW}📦  Есть незакоммиченные изменения — коммичу...${NC}"
  git add -A
  git commit -m "chore: pre-prod cleanup $(date '+%Y-%m-%d %H:%M')"
  git push origin dev
fi
echo -e "${GREEN}✅  Ветка dev чистая${NC}"
echo ""

# ── Шаг 3: чеклист ────────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Чеклист перед деплоем:${NC}"
echo ""
echo -e "  Проверь каждый пункт перед тем как ответить [y]:"
echo ""
echo -e "  ${BOLD}[ ]${NC} Staging протестирован руками (основные сценарии)"
echo -e "  ${BOLD}[ ]${NC} Новые фичи проверены на мобиле"
echo -e "  ${BOLD}[ ]${NC} Нет сломанных API-вызовов в staging логах"
echo -e "  ${BOLD}[ ]${NC} Нет регрессий на существующих функциях"
echo ""

COMMIT=$(git log --oneline -1)
echo -e "  Последний коммит: ${BOLD}${COMMIT}${NC}"
echo ""

read -p "  Всё проверено? Деплоить на PRODUCTION? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}❌  Отменено. Работай дальше в staging.${NC}"
  exit 1
fi

# ── Шаг 4: мёрджим и деплоим ──────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/4] Мёрджу dev → main и пушу...${NC}"
git checkout main
git merge dev --no-edit
git push origin main

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ✅  ЗАДЕПЛОЕНО НА PRODUCTION${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  🌐  https://www.neutralenachrichten.com"
echo -e "  📋  Логи: npm run logs:prod"
echo ""

git checkout dev
echo -e "  ↩️   Вернулся на dev"
echo ""
