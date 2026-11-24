// Signed webhooks to the app's own server (the "events" integration). YouAsked tells the app when
// one of its users should hear something: the team replied to them, or something they asked for or
// voted on shipped. The app then reaches them its own way (push, email, a chat message), so it
// never has to give YouAsked its users' emails or push tokens.
//
// One event per person. Each delivery is signed Stripe-style:
//   YouAsked-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the secret>
// A delivery that doesn't get a 2xx is retried with growing gaps for about two days (the cron sweeps
// due retries every 10 minutes), and every attempt is kept for the dashboard's delivery log.
import { ref } from "./actions";
import { newId } from "./lib";
import type { Env, RequestRow } from "./types";

export const EVENT_TYPES = ["reply.created", "request.shipped"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EventsConfig = { url: string; secret: string; events: EventType[] };

type Waiter = { env: Env; waitUntil: (p: Promise<unknown>) => void };

const MIN = 60_000;
/** Gap before each retry; after the last one the delivery is marked failed. */
const BACKOFF = [1 * MIN, 5 * MIN, 30 * MIN, 2 * 60 * MIN, 6 * 60 * MIN, 12 * 60 * MIN, 24 * 60 * MIN];
const TIMEOUT = 10_000;

const apiOrigin = (env: Env) => (env.API_URL ?? "https://api.youasked.dev").replace(/\/$/, "");

export const newSecret = () => `whsec_${newId("x", 32).slice(2)}`;

async function loadConfig(db: D1Database, appId: string): Promise<EventsConfig | null> {
  const row = await db.prepare("SELECT config FROM integrations WHERE app_id = ? AND kind = 'events'").bind(appId).first<{ config: string }>();
  return row ? (JSON.parse(row.config) as EventsConfig) : null;
}

/** The id the app signed for this person, or null for people the app never identified. */
const appUserId = (externalId: string | null) => (externalId?.startsWith("u:") ? externalId.slice(2) : null);

function requestData(r: RequestRow) {
  return { id: r.id, ref: ref(r), number: r.number, title: r.title, status: r.status, private: Boolean(r.private) };
}

export async function sign(secret: string, t: number, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

type DeliveryRow = {
  id: string;
  app_id: string;
  event_id: string;
  type: string;
  payload: string;
  attempts: number;
  status: "pending" | "delivered" | "failed";
  last_code: number | null;
  last_error: string | null;
  next_at: number | null;
  created_at: number;
  delivered_at: number | null;
};

/** Sends one delivery now and records the outcome (and the next retry, if any). */
async function attempt(env: Env, d: DeliveryRow, cfg?: EventsConfig | null, final = false): Promise<{ ok: boolean; code: number | null; error: string | null; ms: number }> {
  const config = cfg === undefined ? await loadConfig(env.DB, d.app_id) : cfg;
  const started = Date.now();
  let code: number | null = null;
  let error: string | null = null;
  if (!config) {
    error = "endpoint_removed";
  } else {
    const t = Math.floor(started / 1000);
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "YouAsked-Webhooks/1.0",
          "youasked-event": d.type,
          "youasked-delivery": d.id,
          "youasked-signature": `t=${t},v1=${await sign(config.secret, t, d.payload)}`,
        },
        body: d.payload,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT),
      });
      code = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
      await res.body?.cancel().catch(() => {});
    } catch (e) {
      error = e instanceof Error ? (e.name === "TimeoutError" ? "timed_out" : e.message) : String(e);
    }
  }
  const ms = Date.now() - started;
  const ok = error === null;
  const attempts = d.attempts + 1;
  const gap = BACKOFF[attempts - 1];
  const status = ok ? "delivered" : !config || final || gap === undefined ? "failed" : "pending";
  await env.DB.prepare(
    "UPDATE event_deliveries SET attempts = ?, status = ?, last_code = ?, last_error = ?, next_at = ?, delivered_at = ? WHERE id = ?",
  )
    .bind(attempts, status, code, error ? error.slice(0, 300) : null, status === "pending" ? Date.now() + gap! : null, ok ? Date.now() : null, d.id)
    .run();
  return { ok, code, error, ms };
}

/** Queues one event per person (deduplicated) and sends them straight away. */
async function emit(w: Waiter, appId: string, type: EventType, people: { userId: string; data: Record<string, unknown> }[]) {
  const cfg = await loadConfig(w.env.DB, appId);
  if (!cfg || !cfg.events.includes(type) || !people.length) return;
  const t = Date.now();
  const rows: DeliveryRow[] = people.map((p) => {
    const eventId = newId("evt", 20);
    const payload = JSON.stringify({ id: eventId, type, created: Math.floor(t / 1000), app: appId, data: { user: { id: p.userId }, ...p.data } });
    return { id: newId("dlv", 20), app_id: appId, event_id: eventId, type, payload, attempts: 0, status: "pending", last_code: null, last_error: null, next_at: t, created_at: t, delivered_at: null };
  });
  await w.env.DB.batch(
    rows.map((d) =>
      w.env.DB.prepare(
        "INSERT INTO event_deliveries (id, app_id, event_id, type, payload, attempts, status, next_at, created_at) VALUES (?, ?, ?, ?, ?, 0, 'pending', ?, ?)",
      ).bind(d.id, d.app_id, d.event_id, d.type, d.payload, d.next_at, d.created_at),
    ),
  );
  for (const d of rows) w.waitUntil(attempt(w.env, d, cfg));
}

/** The team replied on a conversation: tell the person who started it and anyone else who wrote in it. */
export async function emitReply(w: Waiter, r: RequestRow, comment: { id: string; body: string; images: string[] }) {
  const { results } = await w.env.DB.prepare(
    `SELECT DISTINCT u.external_id FROM users u
     WHERE u.id = ?1 OR u.id IN (SELECT user_id FROM comments WHERE request_id = ?2 AND is_team = 0 AND user_id IS NOT NULL)`,
  )
    .bind(r.author_id, r.id)
    .all<{ external_id: string | null }>();
  const reply = { id: comment.id, body: comment.body, images: comment.images.map((id) => `${apiOrigin(w.env)}/v1/uploads/${id}`) };
  const people = [...new Set(results.map((x) => appUserId(x.external_id)).filter((x): x is string => !!x))];
  await emit(w, r.app_id, "reply.created", people.map((userId) => ({ userId, data: { request: requestData(r), reply } })));
}

/**
 * A request shipped: tell whoever asked for it or voted on it, and the person behind each conversation
 * filed under it (with their own conversation as the request, so the app opens the thread they know).
 */
export async function emitShipped(w: Waiter, root: RequestRow) {
  const { results: linked } = await w.env.DB.prepare("SELECT * FROM requests WHERE linked_to = ? AND status = 'shipped'").bind(root.id).all<RequestRow>();
  const seen = new Set<string>();
  const people: { userId: string; data: Record<string, unknown> }[] = [];
  for (const r of [root, ...linked]) {
    const { results } = await w.env.DB.prepare(
      `SELECT DISTINCT u.external_id FROM users u WHERE u.id = ?1 OR u.id IN (SELECT user_id FROM votes WHERE request_id = ?2)`,
    )
      .bind(r.author_id, r.id)
      .all<{ external_id: string | null }>();
    for (const x of results) {
      const userId = appUserId(x.external_id);
      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      people.push({ userId, data: { request: requestData(r), shipNote: root.ship_note ?? null } });
    }
  }
  await emit(w, root.app_id, "request.shipped", people);
}

/** A sample event, sent now, for the dashboard's "Send test event". */
export async function sendTest(env: Env, appId: string) {
  const cfg = await loadConfig(env.DB, appId);
  if (!cfg) return null;
  const t = Date.now();
  const eventId = newId("evt", 20);
  const payload = JSON.stringify({
    id: eventId,
    type: "ping",
    created: Math.floor(t / 1000),
    app: appId,
    data: {
      user: { id: "test-user" },
      request: { id: "req_test", ref: "YA-0", number: 0, title: "This is a test event from YouAsked", status: "open", private: false },
      reply: { id: "cmt_test", body: "If you can read this, your endpoint works.", images: [] },
    },
  });
  const d: DeliveryRow = { id: newId("dlv", 20), app_id: appId, event_id: eventId, type: "ping", payload, attempts: 0, status: "pending", last_code: null, last_error: null, next_at: null, created_at: t, delivered_at: null };
  await env.DB.prepare(
    "INSERT INTO event_deliveries (id, app_id, event_id, type, payload, attempts, status, next_at, created_at) VALUES (?, ?, ?, ?, ?, 0, 'pending', NULL, ?)",
  )
    .bind(d.id, appId, eventId, "ping", payload, t)
    .run();
  // A test is sent once and never retried.
  const out = await attempt(env, d, cfg, true);
  return { id: d.id, ...out };
}

/** Sends a delivery again now (from the log), whatever state it ended in. A manual resend isn't retried. */
export async function resend(env: Env, appId: string, id: string) {
  const d = await env.DB.prepare("SELECT * FROM event_deliveries WHERE id = ? AND app_id = ?").bind(id, appId).first<DeliveryRow>();
  if (!d) return null;
  return attempt(env, d, undefined, true);
}

export async function listDeliveries(db: D1Database, appId: string, limit = 50) {
  const { results } = await db
    .prepare(
      "SELECT id, event_id, type, payload, attempts, status, last_code, last_error, next_at, created_at, delivered_at FROM event_deliveries WHERE app_id = ? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(appId, limit)
    .all<Omit<DeliveryRow, "app_id">>();
  return results.map(({ payload, ...d }) => ({ ...d, payload: JSON.parse(payload) as unknown }));
}

/** Cron: sends retries that are due, and drops log rows older than 30 days. */
export async function sweepDeliveries(env: Env, prune = false) {
  const { results } = await env.DB.prepare("SELECT * FROM event_deliveries WHERE status = 'pending' AND next_at <= ? ORDER BY next_at LIMIT 100")
    .bind(Date.now())
    .all<DeliveryRow>();
  const configs = new Map<string, EventsConfig | null>();
  for (const d of results) {
    if (!configs.has(d.app_id)) configs.set(d.app_id, await loadConfig(env.DB, d.app_id));
    await attempt(env, d, configs.get(d.app_id));
  }
  if (prune) await env.DB.prepare("DELETE FROM event_deliveries WHERE created_at < ?").bind(Date.now() - 30 * 24 * 60 * MIN).run();
}
