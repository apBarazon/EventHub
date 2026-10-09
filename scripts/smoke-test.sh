#!/bin/sh
# Runs inside Jenkins after deploy. Everything goes through the proxy container (the real entry point).
set -e
check() {
  for i in $(seq 1 12); do
    if docker compose exec -T proxy wget -qO- "http://localhost$1" >/dev/null 2>&1; then echo "OK   $1"; return 0; fi
    echo "wait $1 ($i/12)"; sleep 5
  done
  echo "FAIL $1"; return 1
}
check /
check /admin/
check /api/health
check /api/reports/health
check /api/events
echo "Smoke test passed"
