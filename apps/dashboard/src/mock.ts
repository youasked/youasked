// An in-memory fake of the YouAsked API, switched on with ?mock or VITE_MOCK=1. It implements every route
// the dashboard calls, so the whole app can be built and tested without the real API running.
//
// Scenarios (?mock=<name>, kept for the browser session): "" (a workspace on no plan), "pro" (a paying
// workspace), "empty" (signed in, no apps yet), "out" (signed out, to see the sign-in screen).
import { PLANS } from "../../api/src/plans";

const KEY = "ya_mock";
let scenario: string | null | undefined;

export function mockEnabled(): boolean {
  if (scenario !== undefined) return scenario !== null;
  let s: string | null = null;
  try {
    const q = new URLSearchParams(location.search);
    if (q.has("mock")) {
      s = q.get("mock") || "1";
      sessionStorage.setItem(KEY, s);
    } else {
      s = sessionStorage.getItem(KEY);
    }
  } catch {
    /* storage blocked */
  }
  if (!s && import.meta.env.VITE_MOCK === "1") s = "1";
  scenario = s;
  return s !== null;
}

const min = 60_000;
const hour = 60 * min;
const day = 24 * hour;
const ago = (ms: number) => Date.now() - ms;

type R = {
  id: string; number: number; title: string; body: string; status: string; votes: number; comments: number;
  shipNote: string | null; shippedAt: number | null; context: { topic?: string; page?: string } | null;
  creditName: string | null; createdAt: number; updatedAt: number; attachments: { id: string; url: string }[];
  earlyAccess: number; author: { email: string | null; name: string | null; anonymous: boolean };
  shareUrl?: string; shareImage?: string; mergedInto?: string;
};

function req(n: number, title: string, body: string, status: string, votes: number, ageMs: number, extra: Partial<R> = {}): R {
  return {
    id: `req_${n}`, number: n, title, body, status, votes, comments: 0, shipNote: null, shippedAt: null, context: null,
    creditName: null, createdAt: ago(ageMs), updatedAt: ago(ageMs / 2), attachments: [], earlyAccess: 0,
    author: { email: null, name: null, anonymous: true }, ...extra,
  };
}

const shot = (id: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400"><rect width="640" height="400" fill="#e9edfb"/><rect x="24" y="24" width="592" height="40" rx="10" fill="#fff"/><rect x="24" y="84" width="170" height="292" rx="10" fill="#fff"/><rect x="214" y="84" width="402" height="120" rx="10" fill="#fff"/><rect x="214" y="224" width="402" height="152" rx="10" fill="#2b4bee" opacity=".16"/><circle cx="560" cy="44" r="10" fill="#ffe066"/></svg>`;
  return { id, url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
};

function seed() {
  const requests: R[] = [
    req(1, "Dark mode", "My eyes hurt at night. A dark theme would be great, ideally following the system setting.", "planned", 48, 21 * day, {
      comments: 2, context: { topic: "Appearance", page: "/settings" }, earlyAccess: 4,
      author: { email: "maya@fieldnotes.co", name: "Maya Chen", anonymous: false },
    }),
    req(2, "Export to Excel", "I need to send the monthly numbers to my accountant. A download as .xlsx would save me an hour every month.", "open", 31, 14 * day, {
      comments: 1, context: { topic: "Reports", page: "/reports" }, author: { email: "tom@brightside.io", name: "Tom Reyes", anonymous: false },
    }),
    req(3, "Night theme", "Can you add a night theme? The white background is too bright.", "open", 6, 9 * day, {
      author: { email: null, name: "Priya", anonymous: false },
    }),
    req(4, "Download as spreadsheet", "Is there a way to get my data into a spreadsheet?", "open", 4, 6 * day, { author: { email: "lee@example.com", name: null, anonymous: false } }),
    req(5, "Sync with Google Calendar", "I'd love my due dates to show up in Google Calendar automatically.", "in_progress", 27, 30 * day, {
      comments: 3, context: { topic: "Integrations", page: "/integrations" }, earlyAccess: 9,
      author: { email: "sam@orchard.studio", name: "Sam Okafor", anonymous: false },
    }),
    req(6, "Faster loading on the reports page", "The reports page takes about 8 seconds to open with a year of data.", "open", 19, 12 * day, { comments: 1, context: { page: "/reports" } }),
    req(7, "Keyboard shortcuts", "Power users would love j/k to move around the list and / to search.", "open", 15, 18 * day, {
      author: { email: "dev@pixelwren.com", name: "Alex", anonymous: false },
    }),
    req(8, "Widget for iPad app", "Any plans for the iPad app? I use it all day on my iPad.", "planned", 12, 25 * day, { author: { email: "jo@harbor.fm", name: "Jo Park", anonymous: false } }),
    req(9, "Recurring tasks", "Let me repeat a task every week or month.", "shipped", 56, 60 * day, {
      shippedAt: ago(5 * day), shipNote: "Recurring tasks are live. Open any task and choose Repeat.", comments: 2, creditName: "Rina",
      author: { email: "rina@bakerstreet.shop", name: "Rina Patel", anonymous: false },
      shareUrl: "https://youasked.dev/acme/ya-9", shareImage: "https://api.youasked.dev/v1/public/share/ya-9.png",
    }),
    req(10, "Share a link to a project", "I want to send a read-only link to my client.", "shipped", 22, 50 * day, {
      shippedAt: ago(19 * day), shipNote: "Share links are live from the project menu.", shareUrl: "https://youasked.dev/acme/ya-10",
    }),
    req(11, "Pay in euros", "Prices only show in dollars. Can I pay in euros?", "declined", 3, 40 * day, { shipNote: "Out of scope for now: we only bill in dollars." }),
    req(12, "Attachments on comments", "Let me attach a file to a comment. Screenshots mostly.", "open", 8, 3 * day, {
      comments: 1, attachments: [shot("up_1")], context: { topic: "Comments", page: "/tasks/42" }, author: { email: "kim@lumen.app", name: "Kim Dao", anonymous: false },
    }),
    req(13, "Let me change the app's accent colour", "Our team uses the green one for everything. Can we pick our own colour?", "pending", 1, 2 * hour, {
      author: { email: null, name: null, anonymous: true },
    }),
  ];
  const comments: Record<string, { id: string; body: string; is_team: number; created_at: number; name: string | null; email: string | null }[]> = {
    req_1: [
      { id: "c1", body: "Same here, I use the app mostly at night.", is_team: 0, created_at: ago(20 * day), name: "Jordan", email: "jordan@example.com" },
      { id: "c2", body: "Planned for the next release. Following the system setting first.", is_team: 1, created_at: ago(18 * day), name: null, email: null },
    ],
    req_2: [{ id: "c3", body: "CSV would also work for me.", is_team: 0, created_at: ago(10 * day), name: "Tom Reyes", email: "tom@brightside.io" }],
    req_5: [
      { id: "c4", body: "Two-way sync would be amazing.", is_team: 0, created_at: ago(28 * day), name: "Sam Okafor", email: "sam@orchard.studio" },
      { id: "c5", body: "One-way first, then two-way. Starting this week.", is_team: 1, created_at: ago(26 * day), name: null, email: null },
      { id: "c6", body: "Perfect, thank you!", is_team: 0, created_at: ago(26 * day + 2 * hour), name: "Sam Okafor", email: "sam@orchard.studio" },
    ],
    req_6: [{ id: "c7", body: "Same on Safari.", is_team: 0, created_at: ago(8 * day), name: "Nia", email: null }],
    req_9: [
      { id: "c8", body: "Please make it work with weekdays only.", is_team: 0, created_at: ago(40 * day), name: "Rina Patel", email: "rina@bakerstreet.shop" },
      { id: "c9", body: "Done. You can pick any days.", is_team: 1, created_at: ago(6 * day), name: null, email: null },
    ],
    req_12: [{ id: "c10", body: "Even just images would help.", is_team: 0, created_at: ago(2 * day), name: "Kim Dao", email: "kim@lumen.app" }],
  };
  const items = [
    { id: "li_1", source: "reddit", url: "https://reddit.com/r/productivity/comments/1abc", text: "Tried Acme for a week. Love it but I really wish it had a dark mode, my eyes are fried by 10pm.", feature: "Dark mode", strength: 0.92, createdAt: ago(6 * hour), matchedRequest: { id: "req_1", ref: "YA-1", number: 1, title: "Dark mode", votes: 48 } },
    { id: "li_2", source: "appstore", url: "https://apps.apple.com/us/app/acme/id123?see-all=reviews", text: "Great app but no way to export. Would pay extra to get my tasks into Excel for my accountant.", feature: "Export to spreadsheet", strength: 0.87, createdAt: ago(1 * day), matchedRequest: { id: "req_2", ref: "YA-2", number: 2, title: "Export to Excel", votes: 31 } },
    { id: "li_3", source: "reddit", url: "https://reddit.com/r/SideProject/comments/1def", text: "Anyone know a task app with real Apple Watch support? Acme looks nice but the watch app is missing.", feature: "Apple Watch app", strength: 0.78, createdAt: ago(2 * day), matchedRequest: null },
    { id: "li_4", source: "playstore", url: "https://play.google.com/store/apps/details?id=com.rival.tasks&reviewId=abc", text: "Rival Tasks lets me set a task to repeat on the last Friday of the month. Nothing else does that.", feature: "Repeat on the last weekday of the month", strength: 0.64, createdAt: ago(3 * day), matchedRequest: null },
    { id: "li_5", source: "appstore", url: "https://apps.apple.com/us/app/rival/id456?see-all=reviews", text: "Wish I could scan paper to-do lists straight into the app.", feature: "Scan paper lists", strength: 0.51, createdAt: ago(5 * day), matchedRequest: null },
  ];
  return {
    requests,
    comments,
    items,
    dismissedPairs: new Set<string>(),
    listening: {
      keywords: ["task app", "to-do app", "acme tasks"],
      competitors: [{ name: "Rival Tasks", appStoreId: "456", playId: "com.rival.tasks" }, { name: "Doable", appStoreId: "789" }],
      subreddits: ["productivity", "SideProject"],
    },
    app: {
      id: "app_acme", name: "Acme", publicKey: "ya_pub_8fKq2mXc4vNd7sLw", secretKey: "ya_sec_p3R9tZb6YhJe1uQa5oVx", secretShown: false,
      watermark: true, requireSignature: false, allowedOrigins: ["https://acme.app"] as string[] | null, moderation: "off", slug: "acme", publicBoard: true, description: "What we're building next at Acme, and what just shipped.",
    },
    integrations: { telegram: null as null | { botUsername: string; shared: boolean; mode: string; chatTitle: string | null; pendingUntil?: number; code?: string }, github: null as null | { id: string; secret: string; repo?: string; hasToken?: boolean }, webhook: null as null | { url: string; format: string } },
    members: [
      { accountId: "acc_1", email: "you@acme.app", name: "Alex Rivera", role: "owner" },
      { accountId: "acc_2", email: "dana@acme.app", name: "Dana Kowalski", role: "admin" },
    ],
    invites: [{ id: "inv_1", email: "sofia@acme.app", role: "member" }],
    plan: scenario === "pro" ? "pro" : (null as string | null),
    interval: scenario === "pro" ? "month" : null,
    extraApps: [] as { id: string; name: string; publicKey: string; createdAt: number }[],
  };
}

type State = ReturnType<typeof seed>;
let S: State | null = null;
let signedIn = true;
let started = false;

function state(): State {
  if (!S) S = seed();
  if (!started) {
    started = true;
    signedIn = scenario !== "out";
    if (scenario === "empty") {
      S.requests = [];
      S.app = { ...S.app, id: "", name: "" };
    }
  }
  return S;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const err = (status: number, error: string, extra: object = {}) => json({ error, ...extra }, status);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WID = "ws_acme";

function workspaceDetail() {
  const s = state();
  const live = Boolean(s.plan);
  const limits = s.plan ? PLANS[s.plan as keyof typeof PLANS] : null;
  const apps = [
    ...(s.app.id ? [{ id: s.app.id, name: s.app.name, publicKey: s.app.publicKey, secretKeyHint: "ya_sec_…" + s.app.secretKey.slice(-4), live, createdAt: ago(60 * day) }] : []),
    ...s.extraApps.map((a) => ({ ...a, live })),
  ];
  return {
    workspace: { id: WID, name: "Acme", plan: s.plan, interval: s.interval, status: live ? "active" : null, live, founding: live, currentPeriodEnd: live ? Date.now() + 22 * day : null },
    limits: limits ? { plan: s.plan, ...limits, apps: Number.isFinite(limits.apps) ? limits.apps : null } : { plan: null, apps: 3, members: 1, listeningApps: 0, removeBranding: false, linear: false, customDomain: false },
    usage: { apps: apps.length, members: s.members.length },
    members: s.members,
    invites: s.invites,
    apps,
    foundingLeft: 63,
  };
}

const sum = (r: R) => ({ ...r, mergedInto: undefined });
const find = (id: string) => state().requests.find((r) => r.id === id);

function search(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return state()
    .requests.filter((r) => r.status !== "merged" && words.every((w) => `${r.title} ${r.body} ya-${r.number}`.toLowerCase().includes(w)))
    .slice(0, 8)
    .map((r) => ({ id: r.id, ref: `YA-${r.number}`, number: r.number, title: r.title, status: r.status, votes: r.votes, comments: r.comments, score: 0.9 }));
}

export async function mockFetch(method: string, path: string, body?: unknown): Promise<Response> {
  await wait(90 + Math.random() * 80);
  const s = state();
  const url = new URL(path, "http://x");
  const p = url.pathname;
  const q = url.searchParams;
  const b = (body ?? {}) as Record<string, any>;
  let m: RegExpMatchArray | null;

  // ---- auth
  if (p === "/v1/auth/providers") return json({ google: true, github: true, email: true });
  if (p === "/v1/auth/email" && method === "POST") return json({ ok: true });
  if (p === "/v1/auth/mock-login") {
    signedIn = true;
    return json({ ok: true });
  }
  if (p === "/v1/auth/logout") {
    signedIn = false;
    return json({ ok: true });
  }
  if (p === "/v1/dash/me") {
    if (!signedIn) return err(401, "unauthorized");
    return json({
      account: { id: "acc_1", email: "you@acme.app", name: "Alex Rivera", avatarUrl: null },
      workspaces: [{ id: WID, name: "Acme", role: "owner", plan: s.plan, live: Boolean(s.plan) }],
    });
  }
  if (!signedIn) return err(401, "unauthorized");

  // ---- workspaces
  if (p === "/v1/dash/workspaces" && method === "POST") return json({ workspace: { id: "ws_new", name: b.name } });
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)$/))) return json(workspaceDetail());
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/apps$/)) && method === "POST") {
    const detail = workspaceDetail();
    if (detail.limits.apps !== null && detail.usage.apps >= detail.limits.apps) return err(402, "app_limit", { upgrade: true });
    const name = String(b.name || "My app");
    if (!s.app.id) {
      s.app = { ...s.app, id: "app_new", name, publicKey: "ya_pub_Nw4tK9cE2hRz6bYa", secretKey: "ya_sec_q8Lm3VdX7wTn0cHs2eJp", secretShown: false, slug: null as any, publicBoard: false, description: "" };
      return json({ app: { id: s.app.id, name, publicKey: s.app.publicKey, secretKey: s.app.secretKey } });
    }
    const a = { id: `app_${s.extraApps.length + 2}`, name, publicKey: `ya_pub_x${s.extraApps.length}Qm4Vn8Tz2Kd9`, createdAt: Date.now() };
    s.extraApps.push(a);
    return json({ app: { ...a, secretKey: "ya_sec_extra_" + a.id } });
  }
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/invites$/)) && method === "POST") {
    if (!s.plan) return err(402, "plan_required", { upgrade: true, message: "Pick a plan to invite teammates." });
    const inv = { id: "inv_" + (s.invites.length + 2), email: String(b.email), role: String(b.role || "member") };
    s.invites.push(inv);
    return json({ invite: inv });
  }
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/members\/([^/]+)$/)) && method === "DELETE") {
    s.members = s.members.filter((x) => x.accountId !== m![2]);
    return json({ ok: true });
  }
  if ((m = p.match(/^\/v1\/dash\/invites\/([^/]+)$/)) && method === "GET") return json({ invite: { id: m[1], workspace: "Acme", role: "member", accepted: false, expired: false } });
  if ((m = p.match(/^\/v1\/dash\/invites\/([^/]+)\/accept$/)) && method === "POST") return json({ workspace: { id: WID } });
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/invites\/([^/]+)$/)) && method === "DELETE") {
    s.invites = s.invites.filter((x) => x.id !== m![2]);
    return json({ ok: true });
  }
  if ((m = p.match(/^\/v1\/dash\/invites\/([^/]+)$/)) && method === "DELETE") {
    s.invites = s.invites.filter((x) => x.id !== m![1]);
    return json({ ok: true });
  }
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/checkout$/)) && method === "POST") {
    // A real checkout leaves for Stripe and comes back with ?checkout=success. The fake does the same loop.
    s.plan = String(b.plan);
    s.interval = String(b.interval);
    return json({ url: `${location.origin}/billing?workspace=${WID}&checkout=success` });
  }
  if ((m = p.match(/^\/v1\/dash\/workspaces\/([^/]+)\/portal$/))) return json({ url: `${location.origin}/billing?portal=1` });
  if (p === "/v1/dash/claim" && method === "POST") {
    if (b.claimToken === "bad") return err(404, "not_found");
    if (!s.app.id) s.app = { ...s.app, id: "app_cli", name: "My CLI app", publicKey: "ya_pub_Cl1Aim3dTz8Kq5Nw", secretKey: "ya_sec_cli", secretShown: false, slug: null as any, publicBoard: false, description: "" };
    return json({ app: { id: s.app.id, name: s.app.name, publicKey: s.app.publicKey } });
  }
  if ((m = p.match(/^\/v1\/dash\/apps\/([^/]+)\/rotate-secret$/)) && method === "POST") {
    s.app.secretKey = "ya_sec_" + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    return json({ secretKey: s.app.secretKey });
  }
  if ((m = p.match(/^\/v1\/dash\/apps\/([^/]+)$/)) && method === "DELETE") {
    if (m[1] === s.app.id) s.app = { ...s.app, id: "", name: "" };
    else s.extraApps = s.extraApps.filter((a) => a.id !== m![1]);
    return json({ ok: true });
  }

  // ---- app routes
  const mm = p.match(/^\/v1\/dash\/apps\/([^/]+)(\/.*)$/);
  if (!mm) return err(404, "not_found");
  const r = mm[2];

  if (r === "/app" && method === "GET") {
    const { secretKey, secretShown, ...rest } = s.app;
    return json({ ...rest, publicUrl: rest.publicBoard && rest.slug ? `https://youasked.dev/${rest.slug}` : null });
  }
  if (r === "/app" && method === "PATCH") {
    for (const k of ["name", "watermark", "requireSignature", "allowedOrigins", "moderation", "slug", "publicBoard", "description"]) if (k in b) (s.app as any)[k] = b[k];
    return json({ ok: true });
  }

  if (r === "/requests" && method === "GET") {
    const st = q.get("status");
    let list = s.requests.filter((x) => (st && st !== "all" ? x.status === st : x.status !== "merged" && x.status !== "pending"));
    if (st === "all") list = s.requests.filter((x) => x.status !== "merged");
    return json({ requests: list.map(sum) });
  }
  if ((m = r.match(/^\/requests\/([^/]+)$/))) {
    const x = find(m[1]);
    if (!x) return err(404, "not_found");
    if (method === "GET") {
      const voters = Array.from({ length: Math.min(x.votes, 6) }, (_, i) => ({
        email: i % 3 === 2 ? null : `voter${i}@example.com`, name: ["Maya Chen", "Tom Reyes", null, "Priya N.", "Sam Okafor", null][i], is_anon: i % 3 === 2 ? 1 : 0,
      }));
      return json({ request: sum(x), attachments: x.attachments, comments: s.comments[x.id] ?? [], voters, earlyAccess: [] });
    }
    if (method === "PATCH") {
      if (b.status) {
        x.status = b.status;
        if (b.status === "shipped") {
          x.shippedAt = Date.now();
          x.shareUrl = `https://youasked.dev/${s.app.slug ?? "acme"}/ya-${x.number}`;
          x.shareImage = `https://api.youasked.dev/v1/public/share/ya-${x.number}.png`;
        }
      }
      if (b.shipNote !== undefined) x.shipNote = b.shipNote;
      if (b.title !== undefined) x.title = b.title;
      if (b.body !== undefined) x.body = b.body;
      x.updatedAt = Date.now();
      return json({ request: sum(x), notified: x.status === "shipped", told: x.status === "shipped" ? x.votes : 0 });
    }
    if (method === "DELETE") {
      s.requests = s.requests.filter((y) => y.id !== x.id);
      return json({ ok: true });
    }
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/comments$/)) && method === "POST") {
    const x = find(m[1]);
    if (!x) return err(404, "not_found");
    if (!String(b.body || "").trim()) return err(400, "body_required");
    const c = { id: "c_" + Math.random().toString(36).slice(2, 7), body: String(b.body), is_team: 1, created_at: Date.now(), name: null, email: null };
    (s.comments[x.id] ??= []).push(c);
    x.comments += 1;
    return json({ comment: c });
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/merge$/)) && method === "POST") {
    const from = find(m[1]);
    const into = find(String(b.into));
    if (!from || !into) return err(404, "not_found");
    if (from.id === into.id) return err(400, "same_request");
    from.status = "merged";
    from.mergedInto = into.id;
    into.votes += from.votes;
    return json({ ok: true });
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/approve$/)) && method === "POST") {
    const x = find(m[1]);
    if (x) x.status = "open";
    return json({ ok: true });
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/reject$/)) && method === "POST") {
    s.requests = s.requests.filter((y) => y.id !== m![1]);
    return json({ ok: true });
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/build$/)) && method === "POST") {
    const x = find(m[1]);
    if (!x) return err(404, "not_found");
    const prompt = `Build this feature request for ${s.app.name}.\n\nYA-${x.number}: ${x.title}\n\n${x.body}\n\nVotes: ${x.votes}. Asked by ${x.author.name ?? "a user"}.\n\nWhen you commit, include "closes YA-${x.number}" in the message so everyone who asked is told.`;
    const github = Boolean(s.integrations.github?.hasToken);
    return json({
      prompt,
      issueUrl: github ? `https://github.com/acme/app/issues/${100 + x.number}` : undefined,
      cursorUrl: `https://cursor.com/link/prompt?text=${encodeURIComponent(prompt)}`,
      github,
    });
  }
  if ((m = r.match(/^\/requests\/([^/]+)\/handoff$/)) && method === "POST") {
    const x = find(m[1]);
    if (!x) return err(404, "not_found");
    const agent = (body as { agent?: string } | undefined)?.agent;
    const issueUrl = `https://github.com/acme/app/issues/${100 + x.number}`;
    return json({ ok: true, agent, issueUrl, message: agent === "copilot" ? "Assigned to Copilot. It opens a pull request when it's done." : "Asked @claude on the issue. It replies there and opens a branch for a pull request." });
  }

  if (r === "/duplicates") {
    const pairs = [["req_1", "req_3"], ["req_2", "req_4"]].filter((p) => !s.dismissedPairs.has(p.join()));
    const scores = [0.91, 0.84];
    return json({
      pairs: pairs
        .map((p, i) => ({ a: find(p[0]), b: find(p[1]), score: scores[i] }))
        .filter((x) => x.a && x.b && x.a.status !== "merged" && x.b.status !== "merged")
        .map((x) => ({ a: sum(x.a!), b: sum(x.b!), score: x.score })),
    });
  }
  if (r === "/duplicates/dismiss" && method === "POST") {
    s.dismissedPairs.add([b.a, b.b].join());
    return json({ ok: true });
  }
  if (r === "/search") return json({ requests: search(q.get("q") ?? "") });

  if (r === "/import" && method === "POST") return json({ imported: 24, skipped: 2 });
  if (r === "/export") {
    const rows = s.requests.map((x) => `YA-${x.number},"${x.title}",${x.status},${x.votes}`).join("\n");
    return new Response(q.get("format") === "json" ? JSON.stringify(s.requests, null, 2) : "ref,title,status,votes\n" + rows, { status: 200 });
  }

  // ---- integrations
  if (r === "/integrations" && method === "GET") {
    const out: Record<string, unknown> = {};
    const t = s.integrations.telegram;
    if (t) {
      const connected = !t.pendingUntil || Date.now() > t.pendingUntil;
      out.telegram = { connected, mode: t.mode, chatTitle: connected ? t.chatTitle ?? "Acme team" : null, botUsername: t.botUsername, shared: t.shared, link: connected ? null : `https://t.me/${t.botUsername}?startgroup=${t.code}` };
    }
    if (s.integrations.github) out.github = { payloadUrl: `https://api.youasked.dev/v1/hooks/github/${s.integrations.github.id}`, secret: s.integrations.github.secret, repo: s.integrations.github.repo ?? null, hasToken: Boolean(s.integrations.github.hasToken) };
    if (s.integrations.webhook) out.webhook = s.integrations.webhook;
    return json(out);
  }
  if (r === "/integrations/telegram/connect" && method === "POST") {
    const code = "lnk" + Math.random().toString(36).slice(2, 10);
    s.integrations.telegram = { botUsername: "youasked_bot", shared: true, mode: "interactive", chatTitle: null, pendingUntil: Date.now() + 7000, code };
    return json({ link: `https://t.me/youasked_bot?startgroup=${code}`, code });
  }
  if (r === "/integrations/telegram" && method === "PUT") {
    if (!/^\d+:[\w-]{30,}$/.test(String(b.botToken || ""))) return err(400, "bad_bot_token");
    const notify = b.mode === "notify";
    s.integrations.telegram = { botUsername: "acme_alerts_bot", shared: false, mode: notify ? "notify" : "interactive", chatTitle: notify ? "Acme alerts" : null, pendingUntil: notify ? undefined : Date.now() + 7000, code: "own" + Math.random().toString(36).slice(2, 8) };
    return json({ botUsername: "acme_alerts_bot", link: `https://t.me/acme_alerts_bot?start=own123`, groupLink: `https://t.me/acme_alerts_bot?startgroup=own123` });
  }
  if (r === "/integrations/github" && method === "PUT") {
    s.integrations.github ??= { id: "int_gh1", secret: "ghs_" + Math.random().toString(36).slice(2, 18) };
    return json({ payloadUrl: `https://api.youasked.dev/v1/hooks/github/${s.integrations.github.id}`, secret: s.integrations.github.secret, events: ["pull_request", "push"] });
  }
  if (r === "/integrations/github-token" && method === "PUT") {
    s.integrations.github ??= { id: "int_gh1", secret: "ghs_" + Math.random().toString(36).slice(2, 18) };
    s.integrations.github.hasToken = true;
    s.integrations.github.repo = String(b.repo);
    return json({ ok: true });
  }
  if (r === "/integrations/webhook" && method === "PUT") {
    if (!String(b.url).startsWith("https://")) return err(400, "https_only");
    const format = String(b.url).includes("slack") ? "slack" : String(b.url).includes("discord") ? "discord" : "json";
    s.integrations.webhook = { url: String(b.url), format };
    return json({ ok: true, format });
  }
  if ((m = r.match(/^\/integrations\/([^/]+)$/)) && method === "DELETE") {
    (s.integrations as any)[m[1]] = null;
    return json({ ok: true });
  }

  // ---- listening
  if (r.startsWith("/listening") && !s.plan) return err(402, "upgrade_required", { upgrade: true });
  if (r === "/listening/config") {
    if (method === "PUT") s.listening = { keywords: b.keywords ?? [], competitors: b.competitors ?? [], subreddits: b.subreddits ?? [] };
    return json(s.listening);
  }
  if (r === "/listening/run" && method === "POST") return json({ ok: true });
  if (r === "/listening/inbox") return json({ items: s.items });
  if ((m = r.match(/^\/listening\/inbox\/([^/]+)\/(approve|dismiss|merge)$/)) && method === "POST") {
    const item = s.items.find((i) => i.id === m![1]);
    if (!item) return err(404, "not_found");
    if (m[2] === "approve") {
      const n = Math.max(0, ...s.requests.map((x) => x.number)) + 1;
      s.requests.push(req(n, item.feature, item.text, "open", 1, 1000));
    }
    if (m[2] === "merge") {
      const into = find(String(b.requestId ?? item.matchedRequest?.id));
      if (into) into.votes += 1;
    }
    s.items = s.items.filter((i) => i.id !== item.id);
    return json({ ok: true });
  }

  return err(404, "not_found");
}
