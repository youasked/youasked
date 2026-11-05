// Operator alerts: things the developer should hear about straight away (errors, failed webhooks,
// failed email, new and lost subscriptions), sent to a Telegram chat. Throttled per key, so a burst of
// the same error sends one message and a count instead of a hundred.
import type { Env } from "./types";

const MIN = 60_000;

export async function alert(env: Env, key: string, text: string, throttleMs = 15 * MIN): Promise<void> {
  if (!env.ALERT_TELEGRAM_TOKEN || !env.ALERT_CHAT_ID) return;
  const now = Date.now();
  let held = 0;
  try {
    const row = await env.DB.prepare("SELECT last_at, held FROM alert_log WHERE key = ?").bind(key).first<{ last_at: number; held: number }>();
    if (row && now - row.last_at < throttleMs) {
      await env.DB.prepare("UPDATE alert_log SET held = held + 1 WHERE key = ?").bind(key).run();
      return;
    }
    held = row?.held ?? 0;
    await env.DB.prepare("INSERT INTO alert_log (key, last_at, held) VALUES (?, ?, 0) ON CONFLICT(key) DO UPDATE SET last_at = excluded.last_at, held = 0")
      .bind(key, now)
      .run();
  } catch {
    // Without the table (or with D1 itself failing) still send: an alert matters more than the throttle.
  }
  const more = held > 0 ? `\n(${held} more like this since the last alert)` : "";
  await fetch(`https://api.telegram.org/bot${env.ALERT_TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.ALERT_CHAT_ID, text: `YouAsked: ${text}${more}`.slice(0, 3900), disable_web_page_preview: true }),
  }).catch(() => {});
}
