#!/bin/sh
# Hosted MCP connector end to end, all local: fresh local D1, seeded demo account, wrangler dev, the script.
# Run from apps/api: sh test/mcp-e2e.sh   (state lives in a temp dir that is removed afterwards)
set -e
cd "$(dirname "$0")/.."
STATE="$(mktemp -d "${TMPDIR:-/tmp}/ya-mcp-e2e.XXXXXX")"
PORT=18744
CFG=test/wrangler.test.jsonc
[ -f test/.dev.vars ] || cp test/dev.vars.example test/.dev.vars
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null; wait 2>/dev/null; rm -rf "$STATE"; }
trap cleanup EXIT
npx wrangler d1 migrations apply youasked --local --config $CFG --persist-to "$STATE" > /dev/null
node test/mcp-e2e.mjs seed > "$STATE/seed.sql"
npx wrangler d1 execute youasked --local --config $CFG --persist-to "$STATE" --file "$STATE/seed.sql" > /dev/null
npx wrangler dev --local --config $CFG --persist-to "$STATE" --port $PORT --inspector-port 19344 > "$STATE/dev.log" 2>&1 &
PID=$!
n=0; until curl -s localhost:$PORT/ > /dev/null; do sleep 1; n=$((n+1)); [ $n -gt 60 ] && { cat "$STATE/dev.log"; exit 1; }; done
API=http://localhost:$PORT node test/mcp-e2e.mjs run
