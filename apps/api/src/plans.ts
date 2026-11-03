// Plans, prices and what each plan allows. Prices are in US dollars; the Stripe price IDs live in
// Stripe under the lookup keys from `lookupKey()` (created by scripts/stripe-setup.mjs).
import type { AppRow, Env } from "./types";

export type Plan = "solo" | "pro" | "studio";
export type Interval = "month" | "year";

export const PLANS: Record<Plan, {
  name: string;
  apps: number;
  members: number;
  /** Apps that can use Heard elsewhere (social listening). */
  listeningApps: number;
  /** Can turn off the "Feedback by YouAsked" line. */
  removeBranding: boolean;
  linear: boolean;
  customDomain: boolean;
}> = {
  solo: { name: "Solo", apps: 1, members: 1, listeningApps: 0, removeBranding: false, linear: false, customDomain: false },
  pro: { name: "Pro", apps: 5, members: 5, listeningApps: 1, removeBranding: true, linear: true, customDomain: true },
  studio: { name: "Studio", apps: Infinity, members: 15, listeningApps: 5, removeBranding: true, linear: true, customDomain: true },
};

export const PRICES: Record<Plan, Record<Interval, number> & { founding: Record<Interval, number> }> = {
  solo: { month: 15, year: 150, founding: { month: 9, year: 90 } },
  pro: { month: 39, year: 390, founding: { month: 24, year: 240 } },
  studio: { month: 79, year: 790, founding: { month: 49, year: 490 } },
};

/** The first this-many paying workspaces keep the founding price for as long as they stay subscribed. */
export const FOUNDING_SLOTS = 100;

export const lookupKey = (plan: Plan, interval: Interval, founding: boolean) =>
  `youasked_${plan}_${interval}${founding ? "_founding" : ""}`;

/** Apps a workspace can hold before it has paid (they only answer on localhost). */
export const TEST_MODE_APPS = 3;

/** Test mode is for trying it out: the first this-many people of an unpaid app can use it. */
export const TEST_MODE_USERS = 25;

/**
 * A client in development: a page on a local origin, or a React Native dev build (native fetch sends
 * no Origin, so the SDK sends x-youasked-dev: 1 when __DEV__). The header can be faked, which is why
 * test mode also caps the number of people (TEST_MODE_USERS).
 */
export function isDevClient(headers: { get(name: string): string | null }): boolean {
  const origin = headers.get("origin");
  if (origin) return isLocalOrigin(origin);
  return headers.get("x-youasked-dev") === "1";
}

/** Subscription states that keep an app live. past_due keeps working while Stripe retries the card. */
const LIVE_STATUSES = ["active", "trialing", "past_due"];

export type WorkspaceRow = {
  id: string;
  name: string;
  plan: Plan | null;
  billing_interval: Interval | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  founding: number;
  current_period_end: number | null;
  created_at: number;
};

export function isLive(ws: Pick<WorkspaceRow, "plan" | "subscription_status"> | null): boolean {
  return Boolean(ws?.plan && ws.subscription_status && LIVE_STATUSES.includes(ws.subscription_status));
}

/** Test mode: unpaid apps only answer requests from these origins. */
export function isLocalOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost") || host.endsWith(".local");
  } catch {
    return false;
  }
}

/** The workspace an app belongs to (null when unclaimed) and what it may do. */
export async function entitlements(env: Env, app: Pick<AppRow, "workspace_id">) {
  const ws = app.workspace_id
    ? await env.DB.prepare("SELECT * FROM workspaces WHERE id = ?").bind(app.workspace_id).first<WorkspaceRow>()
    : null;
  const live = isLive(ws);
  return { workspace: ws, live, plan: live ? ws!.plan : null, limits: live ? PLANS[ws!.plan!] : null };
}
