#!/usr/bin/env bash
set -euo pipefail

HOST="${1:-xinbs@192.168.31.218}"
REMOTE_DIR="${2:-~/stock_analysis}"

cd "$(dirname "$0")/.."

rsync -az --delete \
  --exclude 'server/data' \
  --exclude 'etf-sector-extension/.git' \
  --exclude '.DS_Store' \
  etf-sector-extension server "$HOST:$REMOTE_DIR/"

ssh "$HOST" "cd $REMOTE_DIR/server && docker compose up -d --build"

echo "deployed: http://$HOST:8787"
