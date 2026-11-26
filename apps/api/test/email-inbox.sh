#!/bin/sh
# Email inbox end to end, all local: fresh D1, wrangler dev, raw emails into the email() handler.
# Run from apps/api: sh test/email-inbox.sh
set -e
cd "$(dirname "$0")/.."
STATE="$(mktemp -d "${TMPDIR:-/tmp}/ya-inbox.XXXXXX")"
PORT=18755
CFG=test/wrangler.test.jsonc
[ -f test/.dev.vars ] || cp test/dev.vars.example test/.dev.vars
cleanup() { [ -n "$PID" ] && kill "$PID" 2>/dev/null; wait 2>/dev/null; rm -rf "$STATE"; }
trap cleanup EXIT
npx wrangler d1 migrations apply youasked --local --config $CFG --persist-to "$STATE" > /dev/null
npx wrangler dev --local --config $CFG --persist-to "$STATE" --port $PORT --inspector-port 19355 > "$STATE/dev.log" 2>&1 &
PID=$!
n=0; until curl -s localhost:$PORT/ > /dev/null; do sleep 1; n=$((n+1)); [ $n -gt 60 ] && { cat "$STATE/dev.log"; exit 1; }; done
API=http://localhost:$PORT STATE="$STATE" CFG=$CFG node test/email-inbox.mjs || { tail -40 "$STATE/dev.log"; exit 1; }
