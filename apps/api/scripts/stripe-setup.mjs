#!/usr/bin/env node
// Sets YouAsked up in Stripe. Safe to run again: it only creates what's missing.
//
//   STRIPE_SECRET_KEY=sk_... node apps/api/scripts/stripe-setup.mjs <webhook-secret-file>
//
// Creates: one product per plan, 12 prices (3 plans x month/year x regular/founding) found later by
// lookup_key, the billing portal configuration, and the webhook endpoint. The webhook signing
// secret is written to <webhook-secret-file> (mode 600) and never printed. Stripe only reveals it
// when the endpoint is created, so keep that file and put its contents in the Worker as
// STRIPE_WEBHOOK_SECRET (`wrangler secret put STRIPE_WEBHOOK_SECRET < file`).
//
// Prices and plan names come from src/plans.ts, so there is one place to change them. That needs
// Node 22.18+ (it reads the TypeScript file directly).
//
// STRIPE_API_BASE points the script at stripe-mock (http://localhost:12111) for a dry run.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const key = process.env.STRIPE_SECRET_KEY;
const base = (process.env.STRIPE_API_BASE ?? "https://api.stripe.com").replace(/\/$/, "");
const secretFile = process.argv[2];
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "https://api.youasked.dev/v1/hooks/stripe";
const EVENTS = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];

if (!key) {
  console.error("Set STRIPE_SECRET_KEY in the environment.");
  process.exit(1);
}
if (!secretFile) {
  console.error("Usage: node stripe-setup.mjs <file to write the webhook signing secret to>");
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
let plans;
try {
  plans = await import(path.join(here, "../src/plans.ts"));
} catch (err) {
  console.error(`Couldn't load src/plans.ts (needs Node 22.18 or newer): ${err.message}`);
  process.exit(1);
}
const { PLANS, PRICES, lookupKey } = plans;

/** Form encoding with brackets for nesting, as Stripe expects. */
function encode(value, prefix = "", out = []) {
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => (item !== null && typeof item === "object" ? encode(item, `${name}[${i}]`, out) : out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(item)}`)));
    } else if (typeof v === "object") encode(v, name, out);
    else out.push(`${encodeURIComponent(name)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

async function api(method, route, params) {
  const query = method === "GET" && params ? `?${encode(params)}` : "";
  const res = await fetch(`${base}/v1${route}${query}`, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" && params ? encode(params) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${route} failed (${res.status}): ${data.error?.message ?? "no message"}`);
  return data;
}

const cents = (dollars) => Math.round(dollars * 100);
const log = (line) => console.log(line);

// ---------------------------------------------------------------- products and prices

const products = {}; // plan -> product id
const portalPrices = {}; // plan -> regular price ids (founding prices stay out of the portal)

const existingProducts = (await api("GET", "/products", { active: true, limit: 100 })).data;

for (const plan of Object.keys(PLANS)) {
  let product = existingProducts.find((p) => p.metadata?.youasked_plan === plan);
  if (!product) {
    product = await api("POST", "/products", {
      name: `YouAsked ${PLANS[plan].name}`,
      description: `YouAsked ${PLANS[plan].name} plan`,
      metadata: { youasked_plan: plan },
    });
    log(`created product ${PLANS[plan].name}`);
  } else log(`product ${PLANS[plan].name} exists`);
  products[plan] = product.id;
  portalPrices[plan] = [];

  for (const interval of ["month", "year"]) {
    for (const founding of [false, true]) {
      const lk = lookupKey(plan, interval, founding);
      const amount = cents(founding ? PRICES[plan].founding[interval] : PRICES[plan][interval]);
      const found = (await api("GET", "/prices", { lookup_keys: [lk], limit: 1 })).data[0];
      let price = found;
      if (found) {
        if (found.unit_amount !== amount || found.product !== product.id) {
          log(`WARNING ${lk}: Stripe has ${found.unit_amount} cents, plans.ts says ${amount}. Prices can't be edited; make a new price and move the lookup key by hand.`);
        } else log(`price ${lk} exists`);
      } else {
        price = await api("POST", "/prices", {
          product: product.id,
          currency: "usd",
          unit_amount: amount,
          recurring: { interval },
          lookup_key: lk,
          nickname: `${PLANS[plan].name} ${interval === "year" ? "yearly" : "monthly"}${founding ? " (founding)" : ""}`,
          metadata: { youasked_plan: plan, founding: founding ? "1" : "0" },
        });
        log(`created price ${lk} (${amount / 100} USD)`);
      }
      if (!founding) portalPrices[plan].push(price.id);
    }
  }
}

// ---------------------------------------------------------------- billing portal

const portalParams = {
  business_profile: { headline: "Manage your YouAsked plan" },
  metadata: { youasked: "1" },
  default_return_url: process.env.PORTAL_RETURN_URL ?? "https://app.youasked.dev/billing",
  features: {
    customer_update: { enabled: true, allowed_updates: ["email", "name"] },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: false } },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products: Object.keys(PLANS).map((plan) => ({ product: products[plan], prices: portalPrices[plan] })),
    },
  },
};
const configs = (await api("GET", "/billing_portal/configurations", { limit: 100 })).data;
const ours = configs.find((c) => c.metadata?.youasked === "1");
if (ours) {
  await api("POST", `/billing_portal/configurations/${ours.id}`, { ...portalParams, active: true });
  log("billing portal configuration updated");
} else {
  await api("POST", "/billing_portal/configurations", portalParams);
  log("billing portal configuration created");
}

// ---------------------------------------------------------------- webhook

const endpoints = (await api("GET", "/webhook_endpoints", { limit: 100 })).data;
const endpoint = endpoints.find((e) => e.url === WEBHOOK_URL);
if (endpoint) {
  await api("POST", `/webhook_endpoints/${endpoint.id}`, { enabled_events: EVENTS });
  log(`webhook endpoint exists (events refreshed). Its signing secret was shown only when it was created; roll it in the Stripe dashboard if you lost it.`);
} else {
  const made = await api("POST", "/webhook_endpoints", { url: WEBHOOK_URL, enabled_events: EVENTS, description: "YouAsked API" });
  fs.writeFileSync(secretFile, `${made.secret}\n`, { mode: 0o600 });
  fs.chmodSync(secretFile, 0o600);
  log(`created webhook endpoint ${WEBHOOK_URL}; signing secret written to ${secretFile}`);
}

log("done");
