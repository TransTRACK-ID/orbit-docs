#!/usr/bin/env sh
# Run on the Docker host where orbit-docs is deployed.
# Usage: ./scripts/diagnose-container-health.sh [container_name]
set -eu

CONTAINER="${1:-orbit-docs-application-1}"

echo "== Container status =="
docker ps -a --filter "name=${CONTAINER}" --format 'table {{.Names}}\t{{.Status}}'

echo ""
echo "== Health probe (uses NUXT_APP_BASE_URL inside container) =="
docker exec "${CONTAINER}" sh -c \
  'curl -sS -m 12 -w "\nHTTP %{http_code}\n" "http://127.0.0.1:3000${NUXT_APP_BASE_URL%/}/api/health"; echo' \
  || echo "exec failed — is the container running?"

echo ""
echo "== DATABASE_URL host (password redacted) =="
docker exec "${CONTAINER}" sh -c \
  'u="${DATABASE_URL:-${POSTGRES_URL:-}}"; echo "${u%%@*}@***${u#*@}"' \
  2>/dev/null || true

echo ""
echo "== Recent DB-related logs =="
docker logs "${CONTAINER}" --since 2h 2>&1 \
  | rg -i '\[db\]|\[sync-cron\].*cause:|db-init|timeout|ECONNREFUSED|does not exist' \
  | tail -40 \
  || echo "(no matches or rg not installed)"

echo ""
echo "== Autoheal (last 2h) =="
docker logs autoheal --since 2h 2>&1 | tail -30 2>/dev/null || echo "(autoheal container not found)"