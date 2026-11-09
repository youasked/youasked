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

/** Months saved on the yearly price, against paying the regular monthly price all year. */
export function monthsFree(plan: Plan) {
  const p = PRICES[plan];
  return Math.round((p.month * 12 - p.year) / p.month);
}

/**
 * How a plan card shows its price. Monthly: the price a month with the regular one struck through.
 * Yearly: what it works out to a month, the regular monthly price struck through, the amount
 * actually billed each year, and what that saves against paying monthly at the regular price.
 */
export function priceView(plan: Plan, interval: Interval, founding = true) {
  const now = price(plan, interval, founding);
  const list = PRICES[plan].month;
  if (interval === "month") {
    return { perMonth: now, was: founding && now < list ? list : null, billed: null as number | null, saves: 0 };
  }
  return { perMonth: now / 12, was: list, billed: now, saves: list * 12 - now };
}

/** The yearly toggle's tag, e.g. "4 months free". */
export const yearlyTag = () => `${monthsFree("solo")} months free`;

export type Feature = { label: string; sub: string; soon?: boolean };

/** Bullet points on a plan card: what it is, then one plain line on what it does for you. */
export function planFeatures(plan: Plan): Feature[] {
  const p = PLANS[plan];
  const apps = count(p.apps);
  return [
    {
      label: `${apps} ${p.apps === 1 ? "app" : "apps"}`,
      sub: p.apps === 1 ? "One app of yours, with its own board and requests." : "Each app of yours gets its own board, requests and widget keys.",
    },
    {
      label: `${p.members} team ${p.members === 1 ? "member" : "members"}`,
      sub: p.members === 1 ? "Just you can sign in to the dashboard." : "People who can sign in to the dashboard to read, reply and ship requests.",
    },
    { label: "Unlimited users and votes", sub: "You never pay more because more people use your app or vote." },
    { label: "Every way to ask in your app", sub: "An ask bar, feature cards, buttons, a floating launcher or a full board page. Mix them as you like." },
    { label: "Alerts in Telegram, Slack or Discord", sub: "Each new request lands in the chat you already use. Telegram has buttons to set a status, reply, merge or ship." },
    { label: "Ship with a commit", sub: "Write “closes YA-12” in a GitHub commit or pull request and everyone who asked is told. Your coding agent can do it over MCP." },
    { label: "Public board, roadmap and changelog", sub: "A page your users can visit to vote and see what is planned and what shipped." },
    p.removeBranding
      ? { label: "Hide the “Feedback by YouAsked” line", sub: "It is the small credit at the bottom of the feedback sheet your users see. Turn it off in Settings." }
      : { label: "Shows a small “Feedback by YouAsked” line", sub: "It is a small credit at the bottom of the feedback sheet your users see. Pro and Studio can hide it." },
    ...(p.listeningApps
      ? [
          {
            label: `Finds requests outside your app, on ${p.listeningApps} ${p.listeningApps === 1 ? "app" : "apps"}`,
            sub: "Heard elsewhere reads Reddit posts and App Store reviews every day and puts the feature asks in an inbox. You approve, merge or dismiss each one.",
          },
        ]
      : []),
    ...(p.linear ? [{ label: "Linear sync", sub: "Turn requests into Linear issues. Not available yet.", soon: true }] : []),
    ...(p.customDomain ? [{ label: "Your own domain for the board", sub: "Serve your public board from an address like feedback.yourapp.com. Not available yet.", soon: true }] : []),
  ];
}

export type Row = { label: string; note?: string; values: [string, string, string] };

/** The feature comparison table. Rows that depend on a plan read it from PLANS. */
export function comparisonRows(): Row[] {
  const each = <T,>(f: (p: (typeof PLANS)[Plan]) => T) => PLAN_ORDER.map((k) => f(PLANS[k])) as [T, T, T];
  const yes = (v: boolean, coming = false) => (v ? (coming ? "Coming soon" : "Yes") : "Not included");
  return [
    { label: "Apps", note: "How many of your own apps you can connect.", values: each((p) => count(p.apps)).map(String) as Row["values"] },
    { label: "Team members", note: "People who can sign in to the dashboard.", values: each((p) => String(p.members)) },
    { label: "End users and votes", note: "The people using your app. You are never billed for them.", values: ["Unlimited", "Unlimited", "Unlimited"] },
    { label: "Every way to ask", note: "Ask bar, feature cards, buttons, floating launcher and a full board page.", values: ["Yes", "Yes", "Yes"] },
    { label: "Alerts in Telegram, Slack and Discord", note: "New requests reach the chat you already use.", values: ["Yes", "Yes", "Yes"] },
    { label: "Ship with a commit", note: "“closes YA-12” in a GitHub commit or pull request marks it shipped.", values: ["Yes", "Yes", "Yes"] },
    { label: "MCP server and setup command", note: "Let your coding agent list, reply to and ship requests, and set YouAsked up in one command.", values: ["Yes", "Yes", "Yes"] },
    { label: "Public board, roadmap and changelog", note: "A page your users can open to vote and follow progress.", values: ["Yes", "Yes", "Yes"] },
    { label: "“You asked, it's live” share cards", note: "A picture you can post when something ships.", values: ["Yes", "Yes", "Yes"] },
    { label: "Email when it ships", note: "People who left an email are told when their request ships.", values: ["Yes", "Yes", "Yes"] },
    { label: "Duplicate matching and weekly digest", note: "AI spots requests that mean the same thing so votes add up. A weekly summary arrives in Telegram.", values: ["Yes", "Yes", "Yes"] },
    { label: "Import and export", note: "Bring requests over from Canny, Featurebase or a CSV file, and take them with you.", values: ["Yes", "Yes", "Yes"] },
    { label: "“Feedback by YouAsked” credit", note: "A small line at the bottom of the feedback sheet your users see.", values: each((p) => (p.removeBranding ? "Removable" : "Shown")) },
    { label: "Heard elsewhere", note: "Finds feature asks in Reddit posts and App Store reviews every day, into an inbox you approve. Number of apps it covers.", values: each((p) => (p.listeningApps ? `${p.listeningApps} ${p.listeningApps === 1 ? "app" : "apps"}` : "Not included")) },
    { label: "Linear sync", note: "Turn requests into Linear issues.", values: each((p) => yes(p.linear, true)) },
    { label: "Custom domain for your board", note: "Serve the public board from your own address.", values: each((p) => yes(p.customDomain, true)) },
    { label: "Test mode on localhost", note: "Free, before you subscribe", values: ["Free", "Free", "Free"] },
    { label: "14-day money-back guarantee", note: "Tell us within 14 days of paying and we refund you.", values: ["Yes", "Yes", "Yes"] },
  ];
}
