// What the pricing UI shows. The numbers and limits come straight from the API's plans.ts, so the
// site can never disagree with what billing charges.
import { FOUNDING_SLOTS, PLANS, PRICES, type Interval, type Plan } from "../../api/src/plans";

export { FOUNDING_SLOTS, PLANS, PRICES };
export type { Interval, Plan };

export const PLAN_ORDER: Plan[] = ["solo", "pro", "studio"];

export const GUARANTEE_DAYS = 14;

/** $9, $7.50. Whole dollars drop the cents. */
export const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

export const count = (n: number) => (Number.isFinite(n) ? String(n) : "Unlimited");

export function price(plan: Plan, interval: Interval, founding: boolean) {
  return founding ? PRICES[plan].founding[interval] : PRICES[plan][interval];
}

/** What a yearly price works out to per month. */
export const perMonth = (yearly: number) => yearly / 12;

/** Months saved on the yearly price (the plans give two months free). */
export function monthsFree(plan: Plan) {
  const p = PRICES[plan];
  return Math.round((p.month * 12 - p.year) / p.month);
}

/** Bullet points on a plan card. */
export function planFeatures(plan: Plan): string[] {
  const p = PLANS[plan];
  return [
    `${count(p.apps)} ${p.apps === 1 ? "app" : "apps"}`,
    `${p.members} team ${p.members === 1 ? "member" : "members"}`,
    "Unlimited end users and votes",
    "Every entry point, Telegram, Slack, Discord, GitHub and MCP",
    "Public board, roadmap and changelog",
    p.removeBranding ? "Remove the “Feedback by YouAsked” line" : "Small “Feedback by YouAsked” line in the sheet",
    ...(p.listeningApps ? [`Heard elsewhere on ${p.listeningApps} ${p.listeningApps === 1 ? "app" : "apps"}`] : []),
    ...(p.linear && p.customDomain ? ["Linear sync and custom domain (coming)"] : []),
  ];
}

export type Row = { label: string; note?: string; values: [string, string, string] };

/** The feature comparison table. Rows that depend on a plan read it from PLANS. */
export function comparisonRows(): Row[] {
  const each = <T,>(f: (p: (typeof PLANS)[Plan]) => T) => PLAN_ORDER.map((k) => f(PLANS[k])) as [T, T, T];
  const yes = (v: boolean, coming = false) => (v ? (coming ? "Coming soon" : "Yes") : "Not included");
  return [
    { label: "Apps", values: each((p) => count(p.apps)).map(String) as Row["values"] },
    { label: "Team members", values: each((p) => String(p.members)) },
    { label: "End users and votes", values: ["Unlimited", "Unlimited", "Unlimited"] },
    { label: "Every entry point (ask bar, cards, buttons, launcher, board)", values: ["Yes", "Yes", "Yes"] },
    { label: "Telegram, Slack and Discord", values: ["Yes", "Yes", "Yes"] },
    { label: "GitHub: “closes YA-12” ships it", values: ["Yes", "Yes", "Yes"] },
    { label: "MCP server and CLI", values: ["Yes", "Yes", "Yes"] },
    { label: "Public board, roadmap and changelog", values: ["Yes", "Yes", "Yes"] },
    { label: "“You asked, it's live” share cards", values: ["Yes", "Yes", "Yes"] },
    { label: "Email when it ships", values: ["Yes", "Yes", "Yes"] },
    { label: "AI duplicate matching and weekly digest", values: ["Yes", "Yes", "Yes"] },
    { label: "Import from Canny, Featurebase and CSV, export", values: ["Yes", "Yes", "Yes"] },
    { label: "“Feedback by YouAsked” line in the sheet", values: each((p) => (p.removeBranding ? "Removable" : "Shown")) },
    { label: "Heard elsewhere (App Store reviews, Reddit)", values: each((p) => (p.listeningApps ? `${p.listeningApps} ${p.listeningApps === 1 ? "app" : "apps"}` : "Not included")) },
    { label: "Linear sync", values: each((p) => yes(p.linear, true)) },
    { label: "Custom domain for your board", values: each((p) => yes(p.customDomain, true)) },
    { label: "Test mode on localhost", note: "Free, before you subscribe", values: ["Free", "Free", "Free"] },
    { label: "14-day money-back guarantee", values: ["Yes", "Yes", "Yes"] },
  ];
}
