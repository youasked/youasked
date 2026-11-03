#!/bin/sh
# Fresh local database, mock servers, worker, then the scenario. Run from apps/api: sh test/run.sh
set -e
# Uses fake secrets from test/dev.vars.example (copied to the ignored test/.dev.vars on first run).
cd "$(dirname "$0")/.."
pkill -f "wrangler dev --local --config test/wrangler.test.jsonc" 2>/dev/null || true
pkill -f "test/mock.mjs" 2>/dev/null || true
[ -f test/.dev.vars ] || cp test/dev.vars.example test/.dev.vars
rm -rf /tmp/ya-state
npx wrangler d1 migrations apply youasked --local --config test/wrangler.test.jsonc --persist-to /tmp/ya-state > /dev/null
MOCK_PORT=19711 node test/mock.mjs > /tmp/ya-mock.log 2>&1 &
npx wrangler dev --local --config test/wrangler.test.jsonc --persist-to /tmp/ya-state --port 18733 --inspector-port 19333 --test-scheduled > /tmp/ya-dev.log 2>&1 &
until curl -s localhost:18733/ > /dev/null; do sleep 1; done
node test/scenario.mjs
