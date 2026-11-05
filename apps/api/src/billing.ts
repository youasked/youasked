// Stripe billing through plain fetch (the SDK isn't needed on Workers). Prices are found by their
// lookup_key (see plans.ts and scripts/stripe-setup.mjs), never by hard-coded IDs.
import { alert } from "./alert";
import { Hono } from "hono";
import { dashboardBase, fail, type AuthVars } from "./auth";
import { FOUNDING_SLOTS, PLANS, isLive, lookupKey, type Interval, type Plan, type WorkspaceRow } from "./plans";
import type { Env } from "./types";

const STRIPE = "https://api.stripe.com/v1";

/** Stripe wants form encoding with brackets for nesting: a[b][0]=c. */
export function encodeForm(value: Record<string, unknown>, prefix = "", out: string[] = []): string {
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encodeForm(item as Record<string, unknown>, `${name}[${i}]`, out) : out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`)));
    else if (typeof v === "object") encodeForm(v as Record<string, unknown>, name, out);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

async function stripe<T>(env: Env, method: "GET" | "POST", path: string, form?: Record<string, unknown>): Promise<T> {
  if (!env.STRIPE_SECRET_KEY) fail(503, "billing_unavailable");
  const query = method === "GET" && form ? `?${encodeForm(form)}` : "";
  const res = await fetch(`${STRIPE}${path}${query}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" && form ? encodeForm(form) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error(`[stripe] ${method} ${path} -> ${res.status} ${data.error?.message ?? ""}`);
    fail(502, "stripe_error");
  }
  return data;
}

// ---------------------------------------------------------------- dashboard routes

type Ctx = { Bindings: Env; Variables: AuthVars };
export const billing = new Hono<Ctx>();

async function ownerWorkspace(c: import("hono").Context<Ctx>) {
  const wid = c.req.param("wid") ?? "";
  const row = await c.env.DB.prepare(
    "SELECT w.*, m.role AS role FROM workspaces w JOIN members m ON m.workspace_id = w.id WHERE w.id = ? AND m.account_id = ?",
  )
    .bind(wid, c.get("account").id)
    .first<WorkspaceRow & { role: string }>();
  if (!row) fail(404, "not_found");
  if (row.role !== "owner" && row.role !== "admin") fail(403, "forbidden");
  return row;
}

billing.post("/workspaces/:wid/checkout", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) fail(503, "billing_unavailable");
  const ws = await ownerWorkspace(c);
  const body = await c.req.json<{ plan?: string; interval?: string }>().catch(() => ({}) as { plan?: string; interval?: string });
  if (!body.plan || !(Object.hasOwn(PLANS, body.plan))) fail(400, "bad_plan");
  if (body.interval !== "month" && body.interval !== "year") fail(400, "bad_interval");
  const plan = body.plan as Plan;
  const interval: Interval = body.interval;
  // Changing plans while subscribed happens in the billing portal.
  if (isLive(ws) && ws.stripe_subscription_id) fail(409, "already_subscribed");

  const founding = await foundingAvailable(c.env.DB, ws);
  let price = await priceByLookup(c.env, lookupKey(plan, interval, founding));
  if (!price && founding) {
    // Founding prices not created in Stripe yet: fall back to the regular price rather than failing.
    price = await priceByLookup(c.env, lookupKey(plan, interval, false));
  }
  if (!price) fail(503, "prices_not_set_up");

  let customer = ws.stripe_customer_id;
  if (!customer) {
    const made = await stripe<{ id: string }>(c.env, "POST", "/customers", {
      email: c.get("account").email,
      name: ws.name,
      metadata: { workspace_id: ws.id },
    });
    customer = made.id;
    await c.env.DB.prepare("UPDATE workspaces SET stripe_customer_id = ? WHERE id = ?").bind(customer, ws.id).run();
  }

  const back = `${dashboardBase(c.env)}/billing?workspace=${encodeURIComponent(ws.id)}`;
  const session = await stripe<{ url: string }>(c.env, "POST", "/checkout/sessions", {
    mode: "subscription",
    customer,
    client_reference_id: ws.id,
    line_items: [{ price: price.id, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${back}&checkout=success`,
    cancel_url: `${back}&checkout=canceled`,
    subscription_data: { metadata: { workspace_id: ws.id, founding: price.founding ? "1" : "0" } },
  });
  return c.json({ url: session.url });
});

billing.post("/workspaces/:wid/portal", async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) fail(503, "billing_unavailable");
  const ws = await ownerWorkspace(c);
  if (!ws.stripe_customer_id) fail(409, "no_billing_yet");
  const session = await stripe<{ url: string }>(c.env, "POST", "/billing_portal/sessions", {
    customer: ws.stripe_customer_id,
    return_url: `${dashboardBase(c.env)}/billing?workspace=${encodeURIComponent(ws.id)}`,
  });
  return c.json({ url: session.url });
});

/** Founding if this workspace already is, or while founding slots remain. */
export async function foundingAvailable(db: D1Database, ws: Pick<WorkspaceRow, "founding">): Promise<boolean> {
  if (ws.founding) return true;
  return (await foundingLeft(db)) > 0;
}

export async function foundingLeft(db: D1Database): Promise<number> {
  const n = await db.prepare("SELECT COUNT(*) AS n FROM workspaces WHERE founding = 1").first<{ n: number }>();
  return Math.max(0, FOUNDING_SLOTS - (n?.n ?? 0));
}

async function priceByLookup(env: Env, key: string): Promise<{ id: string; founding: boolean } | null> {
  const list = await stripe<{ data: { id: string; lookup_key: string }[] }>(env, "GET", "/prices", { lookup_keys: [key], active: true });
  const hit = list.data[0];
  return hit ? { id: hit.id, founding: hit.lookup_key.endsWith("_founding") } : null;
}

// ---------------------------------------------------------------- webhook

export const stripeHook = new Hono<{ Bindings: Env }>();

/** Stripe-Signature: t=timestamp,v1=hex(HMAC-SHA256(secret, `${t}.${body}`)). Five minutes of slack. */
export async function verifyStripeSignature(secret: string, header: string | undefined, body: string, nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !signatures.length || Math.abs(nowSeconds - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return signatures.some((sig) => {
    if (!/^[0-9a-f]{64}$/.test(sig)) return false;
    const given = Uint8Array.from(sig.match(/../g)!, (h) => parseInt(h, 16));
    return crypto.subtle.timingSafeEqual(expected, given);
  });
}

type StripeSub = {
  id: string;
  customer: string;
  status: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data: { current_period_end?: number; price?: { lookup_key?: string | null; recurring?: { interval?: string } } }[] };
};

const KEY_RE = /^youasked_(solo|pro|studio)_(month|year)(_founding)?$/;

/** Copies a subscription's state onto its workspace. Safe to run twice, and in any order. */
async function applySubscription(env: Env, sub: StripeSub, deleted: boolean): Promise<void> {
  const db = env.DB;
  const ws =
    (sub.metadata?.workspace_id
      ? await db.prepare("SELECT * FROM workspaces WHERE id = ?").bind(sub.metadata.workspace_id).first<WorkspaceRow>()
      : null) ??
    (await db.prepare("SELECT * FROM workspaces WHERE stripe_customer_id = ?").bind(sub.customer).first<WorkspaceRow>());
  if (!ws) {
    console.warn(`[stripe] subscription ${sub.id} matches no workspace`);
    return;
  }
  // A late "deleted" for an old subscription must not wipe out the current one.
  if (deleted && ws.stripe_subscription_id && ws.stripe_subscription_id !== sub.id) return;

  const item = sub.items?.data[0];
  const match = KEY_RE.exec(item?.price?.lookup_key ?? "");
  const plan = match?.[1] ?? ws.plan;
  const interval = match?.[2] ?? (item?.price?.recurring?.interval === "year" ? "year" : item?.price?.recurring?.interval === "month" ? "month" : ws.billing_interval);
  const foundingNow = Boolean(match?.[3]) || sub.metadata?.founding === "1";
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const status = deleted ? "canceled" : sub.status;

  await db
    .prepare(
      `UPDATE workspaces SET plan = ?, billing_interval = ?, subscription_status = ?, stripe_customer_id = COALESCE(stripe_customer_id, ?),
         stripe_subscription_id = ?, current_period_end = COALESCE(?, current_period_end),
         founding = CASE WHEN founding = 1 OR ? = 1 THEN 1 ELSE 0 END
       WHERE id = ?`,
    )
    .bind(plan, interval, status, sub.customer, sub.id, periodEnd ? periodEnd * 1000 : null, foundingNow ? 1 : 0, ws.id)
    .run();

  // Tell the developer about money moving. Compared with what was stored, so the duplicate events
  // Stripe sends (checkout completed, subscription created) only produce one message.
  const paying = (st: string | null | undefined) => st === "active" || st === "trialing";
  const what = `${plan ?? "?"} ${interval === "year" ? "yearly" : "monthly"}${foundingNow ? " (founding)" : ""}`;
  const who = `"${ws.name ?? ws.id}"`;
  const wasPaying = paying(ws.subscription_status) && ws.stripe_subscription_id === sub.id;
  const cancelling = Boolean((sub as { cancel_at_period_end?: boolean }).cancel_at_period_end);
  let note: string | null = null;
  if (paying(status) && !wasPaying) note = `New subscription: ${what} for ${who}.`;
  else if (paying(status) && (ws.plan !== plan || ws.billing_interval !== interval)) note = `${who} changed plan to ${what}.`;
  else if ((status === "past_due" || status === "unpaid") && ws.subscription_status !== status) note = `Payment failed for ${who} (${what}). Stripe will retry.`;
  else if (status === "canceled" && ws.subscription_status !== "canceled") note = `${who} cancelled (${what}).`;
  if (cancelling && status !== "canceled") note = note ?? `${who} will cancel at the end of the period (${what}).`;
  if (note) await alert(env, `sub:${sub.id}:${status}:${plan}:${interval}:${cancelling}`, note, 60_000);
}

stripeHook.post("/stripe", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) fail(503, "billing_unavailable");
  const raw = await c.req.text();
  if (!(await verifyStripeSignature(c.env.STRIPE_WEBHOOK_SECRET, c.req.header("stripe-signature"), raw))) {
    c.executionCtx.waitUntil(alert(c.env, "stripe:signature", "A Stripe webhook failed its signature check. If this keeps happening, the webhook secret on the Worker doesn't match Stripe's.", 60 * 60_000));
    fail(400, "bad_signature");
  }

  const event = JSON.parse(raw) as { type: string; livemode?: boolean; data: { object: Record<string, unknown> } };
  const obj = event.data.object;
  // A live API only acts on live events, so a test-mode payment can never turn on a real plan.
  if (c.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") && event.livemode === false) return c.json({ received: true, ignored: "test_event" });

  if (event.type === "checkout.session.completed") {
    const wid = obj.client_reference_id as string | null;
    const customer = obj.customer as string | null;
    if (wid && customer) {
      await c.env.DB.prepare("UPDATE workspaces SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?").bind(customer, wid).run();
    }
    // The subscription events carry the details; fetching here covers the case where they arrive late.
    if (c.env.STRIPE_SECRET_KEY && typeof obj.subscription === "string") {
      const sub = await stripe<StripeSub>(c.env, "GET", `/subscriptions/${obj.subscription}`);
      if (wid) sub.metadata = { ...sub.metadata, workspace_id: wid };
      await applySubscription(c.env, sub, false);
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    // Events can arrive late or out of order, so read the subscription as it is now rather than
    // trusting the event's copy. A cancelled one still reads back, with status "canceled".
    const sub = c.env.STRIPE_SECRET_KEY && typeof obj.id === "string" ? await stripe<StripeSub>(c.env, "GET", `/subscriptions/${obj.id}`).catch(() => null) : null;
    const current = sub ?? (obj as unknown as StripeSub);
    await applySubscription(c.env, current, current.status === "canceled" || (!sub && event.type === "customer.subscription.deleted"));
  }
  return c.json({ received: true });
});
