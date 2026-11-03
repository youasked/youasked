#!/usr/bin/env node
// Points @youasked_bot at the API and registers its commands. Run once after deploying, and again
// if the API host or the secret changes.
//
//   YOUASKED_BOT_TOKEN=… YOUASKED_BOT_SECRET=… node scripts/set-shared-bot-webhook.mjs
//
// Optional: API_URL (default https://api.youasked.dev), TELEGRAM_API (default https://api.telegram.org),
// and --dry-run to print what it would do without calling Telegram. The token is never printed.
const token = process.env.YOUASKED_BOT_TOKEN;
const secret = process.env.YOUASKED_BOT_SECRET;
const api = (process.env.API_URL || "https://api.youasked.dev").replace(/\/$/, "");
const telegram = process.env.TELEGRAM_API || "https://api.telegram.org";
const dry = process.argv.includes("--dry-run");

if (!dry && (!token || !secret)) {
  console.error("Set YOUASKED_BOT_TOKEN and YOUASKED_BOT_SECRET (the same values as the Worker secrets).");
  process.exit(1);
}
if (secret && !/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
  console.error("YOUASKED_BOT_SECRET must be 16-256 characters of A-Z, a-z, 0-9, _ or - (Telegram's rule for secret_token).");
  process.exit(1);
}

const url = `${api}/v1/hooks/telegram-shared`;
const commands = [
  { command: "help", description: "What this bot does" },
  { command: "apps", description: "Apps connected to this chat" },
];

async function call(method, body) {
  if (dry) {
    console.log(`[dry run] ${method}`, JSON.stringify(body));
    return { ok: true };
  }
  const res = await fetch(`${telegram}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    console.error(`${method} failed: ${data.description ?? res.status}`);
    process.exit(1);
  }
  return data;
}

await call("setWebhook", { url, secret_token: secret ?? "<secret>", allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
await call("setMyCommands", { commands });
console.log(`Webhook set to ${url}`);
