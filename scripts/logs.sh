#!/usr/bin/env bash
# logs.sh — просмотр логов Railway
RAILWAY="$HOME/.railway/bin/railway"
ENV=${1:-production}

echo "📋 Railway logs — environment: $ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$RAILWAY logs --environment "$ENV" --tail
