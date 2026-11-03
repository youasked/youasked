// Heard elsewhere: finds feature asks about the app (and its competitors) on Reddit and in App Store
// reviews, and puts the relevant ones in an inbox the team approves, merges or dismisses.
import { Hono } from "hono";
import { loadRequestById, ref } from "./actions";
import { aiJson } from "./ai";
import { fail, requireApp, type AppEnv } from "./app-auth";
import { cleanText, newId, similarity } from "./lib";
import { notifyTeam } from "./notify";
import { entitlements } from "./plans";
import type { AppRow, Env, RequestRow, UserRow } from "./types";

type Competitor = { name: string; appStoreId?: string; playId?: string };
type ConfigRow = {
  app_id: string;
  keywords: string;
  competitors: string;
  subreddits: string;
  countries: string;
  about: string;
  app_store_id: string | null;
  enabled: number;
  last_run_at: number | null;
};
type Config = {
  keywords: string[];
  competitors: Competitor[];
  subreddits: string[];
  countries: string[];
  about: string;
  appStoreId: string | null;
  enabled: boolean;
};

const json = <T>(s: string, fallback: T): T => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

const toConfig = (row: ConfigRow | null): Config => ({
  keywords: json(row?.keywords ?? "[]", []),
  competitors: json(row?.competitors ?? "[]", []),
  subreddits: json(row?.subreddits ?? "[]", []),
  countries: json(row?.countries ?? '["us"]', ["us"]),
  about: row?.about ?? "",
  appStoreId: row?.app_store_id ?? null,
  enabled: row ? Boolean(row.enabled) : false,
});

const strings = (v: unknown, max: number, len: number, pattern?: RegExp) =>
  (Array.isArray(v) ? v : [])
    .map((x) => (typeof x === "string" ? cleanText(x, len) : ""))
    .filter((x) => x && (!pattern || pattern.test(x)))
    .slice(0, max);

// ---------------------------------------------------------------- plan gate

/** 402 unless the plan includes Heard elsewhere and, when turning it on, a slot is free in the workspace. */
async function gate(env: Env, app: AppRow, turningOn = false) {
  const ent = await entitlements(env, app);
  const limit = ent.limits?.listeningApps ?? 0;
  if (limit <= 0) fail(402, "plan_required", { upgrade: true });
  if (turningOn) {
    const used = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM listening_config l JOIN apps a ON a.id = l.app_id
       WHERE a.workspace_id = ? AND l.enabled = 1 AND l.app_id != ?`,
    )
      .bind(app.workspace_id, app.id)
      .first<{ n: number }>();
    if ((used?.n ?? 0) >= limit) fail(402, "listening_limit", { upgrade: true, limit });
  }
}

// ---------------------------------------------------------------- routes

const listening = new Hono<AppEnv>();
listening.use("/listening/*", requireApp);

listening.get("/listening/config", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const row = await c.env.DB.prepare("SELECT * FROM listening_config WHERE app_id = ?").bind(app.id).first<ConfigRow>();
  return c.json({ ...toConfig(row), lastRunAt: row?.last_run_at ?? null });
});

listening.put("/listening/config", async (c) => {
  const app = c.get("app");
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const old = toConfig(await c.env.DB.prepare("SELECT * FROM listening_config WHERE app_id = ?").bind(app.id).first<ConfigRow>());
  const enabled = body.enabled === undefined ? true : body.enabled === true;
  await gate(c.env, app, enabled);
  const competitors: Competitor[] = (Array.isArray(body.competitors) ? body.competitors : [])
    .map((x: any) => ({
      name: cleanText(x?.name, 60),
      ...(/^\d{5,15}$/.test(String(x?.appStoreId ?? "")) ? { appStoreId: String(x.appStoreId) } : {}),
      ...(typeof x?.playId === "string" && /^[\w.]{3,100}$/.test(x.playId) ? { playId: x.playId } : {}),
    }))
    .filter((x: Competitor) => x.name)
    .slice(0, 8);
  const next: Config = {
    keywords: body.keywords === undefined ? old.keywords : strings(body.keywords, 10, 60),
    competitors: body.competitors === undefined ? old.competitors : competitors,
    subreddits: body.subreddits === undefined ? old.subreddits : strings(body.subreddits, 10, 21, /^[A-Za-z0-9_]{2,21}$/),
    countries: body.countries === undefined ? old.countries : strings(body.countries, 5, 2, /^[a-z]{2}$/i).map((x) => x.toLowerCase()),
    about: body.about === undefined ? old.about : cleanText(body.about, 400),
    appStoreId: body.appStoreId === undefined ? old.appStoreId : /^\d{5,15}$/.test(String(body.appStoreId)) ? String(body.appStoreId) : null,
    enabled,
  };
  if (!next.countries.length) next.countries = ["us"];
  await c.env.DB.prepare(
    `INSERT INTO listening_config (app_id, keywords, competitors, subreddits, countries, about, app_store_id, enabled, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (app_id) DO UPDATE SET keywords = excluded.keywords, competitors = excluded.competitors, subreddits = excluded.subreddits,
       countries = excluded.countries, about = excluded.about, app_store_id = excluded.app_store_id, enabled = excluded.enabled, updated_at = excluded.updated_at`,
  )
    .bind(
      app.id,
      JSON.stringify(next.keywords),
      JSON.stringify(next.competitors),
      JSON.stringify(next.subreddits),
      JSON.stringify(next.countries),
      next.about,
      next.appStoreId,
      next.enabled ? 1 : 0,
      Date.now(),
    )
    .run();
  return c.json(next);
});

/** Runs the scan for this app now (at most every 10 minutes). The daily cron does the same for every app. */
listening.post("/listening/run", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const row = await c.env.DB.prepare("SELECT * FROM listening_config WHERE app_id = ?").bind(app.id).first<ConfigRow>();
  if (!row) fail(400, "not_configured");
  if (row.last_run_at && Date.now() - row.last_run_at < 10 * 60 * 1000) fail(409, "ran_recently");
  return c.json(await listenForApp(c.env, app, row));
});

type ItemRow = {
  id: string;
  source: string;
  url: string;
  text: string;
  feature: string | null;
  strength: number;
  created_at: number;
  matched_request_id: string | null;
  status: string;
  request_id: string | null;
};

listening.get("/listening/inbox", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM listening_items WHERE app_id = ? AND status = 'new' ORDER BY strength DESC, created_at DESC LIMIT 100",
  )
    .bind(app.id)
    .all<ItemRow>();
  const matches = new Map<string, RequestRow>();
  for (const id of new Set(results.map((r) => r.matched_request_id).filter(Boolean) as string[])) {
    const r = await loadRequestById(c.env.DB, app.id, id);
    if (r && r.status !== "merged") matches.set(id, r);
  }
  return c.json({
    items: results.map((i) => {
      const m = i.matched_request_id ? matches.get(i.matched_request_id) : undefined;
      return {
        id: i.id,
        source: i.source,
        url: i.url,
        text: i.text,
        feature: i.feature,
        strength: i.strength,
        createdAt: i.created_at,
        ...(m ? { matchedRequest: { id: m.id, ref: ref(m), title: m.title, votes: m.vote_count } } : {}),
      };
    }),
  });
});

async function loadItem(c: { env: Env; req: { param(n: string): string } }, app: AppRow): Promise<ItemRow> {
  const item = await c.env.DB.prepare("SELECT * FROM listening_items WHERE id = ? AND app_id = ?").bind(c.req.param("id"), app.id).first<ItemRow>();
  if (!item) fail(404, "not_found");
  if (item.status !== "new") fail(409, `already_${item.status}`);
  return item;
}

const SOURCE_NAME: Record<string, string> = { reddit: "Heard on Reddit", appstore: "App Store review" };

/** The stand-in author for requests that did not come through the widget. */
async function systemUser(db: D1Database, appId: string, source: string): Promise<UserRow> {
  const t = Date.now();
  const externalId = `sys:${source}`;
  await db
    .prepare("INSERT INTO users (id, app_id, external_id, email, name, is_anon, created_at, last_seen_at) VALUES (?, ?, ?, NULL, ?, 0, ?, ?) ON CONFLICT (app_id, external_id) DO NOTHING")
    .bind(newId("usr"), appId, externalId, SOURCE_NAME[source] ?? "Heard elsewhere", t, t)
    .run();
  return (await db.prepare("SELECT * FROM users WHERE app_id = ? AND external_id = ?").bind(appId, externalId).first<UserRow>())!;
}

listening.post("/listening/inbox/:id/approve", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const item = await loadItem(c, app);
  const body = await c.req.json<{ title?: string }>().catch(() => ({}) as { title?: string });
  const title = cleanText(body.title, 120) || cleanText(item.feature, 120) || cleanText(item.text, 80);
  if (title.length < 3) fail(400, "title_too_short");
  const user = await systemUser(c.env.DB, app.id, item.source);
  const id = newId("req");
  const t = Date.now();
  const insert = () =>
    c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO requests (id, app_id, author_id, number, title, body, status, vote_count, elsewhere_count, source, source_url, created_at, updated_at)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(number), 0) + 1 FROM requests WHERE app_id = ?2), ?4, ?5, 'open', 0, 1, ?6, ?7, ?8, ?8)`,
      ).bind(id, app.id, user.id, title, cleanText(item.text, 2000), item.source, item.url, t),
      c.env.DB.prepare("UPDATE listening_items SET status = 'approved', request_id = ? WHERE id = ?").bind(id, item.id),
    ]);
  try {
    await insert();
  } catch {
    await insert(); // raced another request for the same number
  }
  const r = (await loadRequestById(c.env.DB, app.id, id))!;
  c.executionCtx.waitUntil(notifyTeam(c.env, app.id, { kind: "request", appName: app.name, request: r, author: user, origin: new URL(c.req.url).origin }));
  return c.json({ request: { id: r.id, ref: ref(r), number: r.number, title: r.title, source: r.source, sourceUrl: r.source_url } }, 201);
});

listening.post("/listening/inbox/:id/dismiss", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const item = await loadItem(c, app);
  await c.env.DB.prepare("UPDATE listening_items SET status = 'dismissed' WHERE id = ?").bind(item.id).run();
  return c.json({ ok: true });
});

listening.post("/listening/inbox/:id/merge", async (c) => {
  const app = c.get("app");
  await gate(c.env, app);
  const item = await loadItem(c, app);
  const body = await c.req.json<{ requestId?: string }>().catch(() => ({}) as { requestId?: string });
  const target = await loadRequestById(c.env.DB, app.id, body.requestId ?? item.matched_request_id ?? "");
  if (!target || target.status === "merged") fail(404, "request_not_found");
  const user = await systemUser(c.env.DB, app.id, item.source);
  const t = Date.now();
  // Counted like a quiet vote, plus a comment so people can follow the link. No notifications: nobody in the app wrote it.
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE requests SET elsewhere_count = elsewhere_count + 1, comment_count = comment_count + 1, updated_at = ? WHERE id = ?").bind(t, target.id),
    c.env.DB.prepare("INSERT INTO comments (id, request_id, user_id, is_team, body, created_at) VALUES (?, ?, ?, 0, ?, ?)").bind(
      newId("cmt"),
      target.id,
      user.id,
      `Also asked ${item.source === "reddit" ? "on Reddit" : "in an App Store review"}: ${item.url}`,
      t,
    ),
    c.env.DB.prepare("UPDATE listening_items SET status = 'merged', request_id = ? WHERE id = ?").bind(target.id, item.id),
  ]);
  return c.json({ ok: true, requestId: target.id, ref: ref(target) });
});

export default listening;

// ---------------------------------------------------------------- sources

const DAY = 24 * 60 * 60 * 1000;
/** Most outside calls one app may cost per daily run. */
const REDDIT_CALL_BUDGET = 14;
const MAX_REVIEWS_PER_APP = 40;
const MAX_NEW_ITEMS_CLASSIFIED = 60;

type Raw = { source: "reddit" | "appstore"; url: string; text: string; author: string | null; context: string };

const itunesBase = (env: Env) => (env.LISTENING_FIXTURES ? `${env.LISTENING_FIXTURES}/itunes` : "https://itunes.apple.com");
const scBase = (env: Env) => (env.LISTENING_FIXTURES ? `${env.LISTENING_FIXTURES}/sc` : "https://api.scrapecreators.com");

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "youasked-listening", ...headers } });
    if (!res.ok) {
      console.error("listening fetch", res.status, new URL(url).pathname);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("listening fetch", err instanceof Error ? err.message : err);
    return null;
  }
}

async function appStoreReviews(env: Env, id: string, country: string, label: string): Promise<Raw[]> {
  const data = await getJson<any>(`${itunesBase(env)}/${country}/rss/customerreviews/id=${id}/sortby=mostrecent/json`);
  const entries: any[] = Array.isArray(data?.feed?.entry) ? data.feed.entry : data?.feed?.entry ? [data.feed.entry] : [];
  const since = Date.now() - 14 * DAY;
  const out: Raw[] = [];
  for (const e of entries) {
    const body = e?.content?.label;
    const rid = e?.id?.label;
    if (!body || !rid || !e["im:rating"]) continue; // the first entry is sometimes the app itself
    const when = Date.parse(e.updated?.label ?? "");
    if (Number.isFinite(when) && when < since) continue;
    out.push({
      source: "appstore",
      url: `https://apps.apple.com/${country}/app/id${id}?review=${encodeURIComponent(rid)}`,
      text: cleanText(`${e.title?.label ?? ""}\n\n${body}`, 1200),
      author: e.author?.name?.label ?? null,
      context: `${e["im:rating"].label}-star review of ${label}`,
    });
    if (out.length >= MAX_REVIEWS_PER_APP) break;
  }
  return out;
}

async function redditPosts(env: Env, app: AppRow, cfg: Config): Promise<Raw[]> {
  const key = env.SCRAPECREATORS_API_KEY || (env.LISTENING_FIXTURES ? "fixture" : "");
  if (!key) return [];
  const headers = { "x-api-key": key };
  let budget = REDDIT_CALL_BUDGET;
  const posts = new Map<string, any>();
  const search = async (path: string, params: Record<string, string>) => {
    if (budget-- <= 0) return;
    const qs = new URLSearchParams({ ...params, timeframe: "week" });
    const data = await getJson<{ posts?: any[] }>(`${scBase(env)}${path}?${qs}`, headers);
    for (const p of data?.posts ?? []) if (p?.url && !posts.has(p.url)) posts.set(p.url, p);
  };
  const terms = cfg.keywords.length ? cfg.keywords : [app.name];
  for (const q of terms.slice(0, 4)) await search("/v1/reddit/search", { query: q });
  for (const sub of cfg.subreddits.slice(0, 3)) for (const q of terms.slice(0, 2)) await search("/v1/reddit/subreddit/search", { subreddit: sub, query: q });

  const out: Raw[] = [];
  for (const p of posts.values()) {
    const text = cleanText(`${p.title ?? ""}\n\n${p.selftext ?? ""}`, 1500);
    if (text.length > 20) out.push({ source: "reddit", url: p.url, text, author: p.author ?? null, context: `r/${p.subreddit ?? "?"} post` });
  }
  // The busiest threads hold the asks that never get their own post.
  const busiest = [...posts.values()].sort((a, b) => (b.num_comments ?? 0) - (a.num_comments ?? 0)).filter((p) => (p.num_comments ?? 0) >= 3).slice(0, 3);
  for (const p of busiest) {
    if (budget-- <= 0) break;
    const data = await getJson<{ comments?: any[] }>(`${scBase(env)}/v1/reddit/post/comments?${new URLSearchParams({ url: p.url })}`, headers);
    for (const cm of (data?.comments ?? []).slice(0, 40)) {
      const text = cleanText(cm?.body, 1200);
      if (cm?.url && text.length >= 40) out.push({ source: "reddit", url: cm.url, text, author: cm.author ?? null, context: `comment in r/${p.subreddit ?? "?"}: "${cleanText(p.title, 100)}"` });
    }
  }
  return out;
}

// ---------------------------------------------------------------- classify and match

type Verdict = { isRequest: boolean; relevantToApp: boolean; feature: string; strength: number };

async function classify(env: Env, app: AppRow, cfg: Config, item: Raw): Promise<Verdict | null> {
  const system =
    `You triage public posts and reviews for the product "${app.name}"${cfg.about ? `: ${cfg.about}` : ""}. ` +
    `Topics: ${cfg.keywords.join(", ") || "n/a"}. Competitors: ${cfg.competitors.map((c) => c.name).join(", ") || "n/a"}.\n` +
    `Decide: isRequest = the author asks for, or complains about the lack of, a specific product feature or fix. ` +
    `relevantToApp = that feature would make sense in "${app.name}" or the same kind of product. Be strict: ` +
    `if the post is about something unrelated (weather, stocks, brokerages, politics, a different kind of product), relevantToApp is false. ` +
    `Praise, questions, news and chatter are not requests. feature = the ask as a short title, max 8 words, sentence case, no quotes. ` +
    `strength: 1 = a passing mention, 2 = a clear ask, 3 = a strong ask (frustrated, switching, or says they would pay).`;
  const out = await aiJson<Verdict>(env, system, `Source: ${item.context}\n\n${item.text}`, {
    type: "object",
    properties: {
      isRequest: { type: "boolean" },
      relevantToApp: { type: "boolean" },
      feature: { type: "string" },
      strength: { type: "integer" },
    },
    required: ["isRequest", "relevantToApp", "feature", "strength"],
  });
  if (!out) return null;
  return { isRequest: Boolean(out.isRequest), relevantToApp: Boolean(out.relevantToApp), feature: cleanText(out.feature, 100), strength: Math.min(3, Math.max(1, Math.round(Number(out.strength) || 1))) };
}

/**
 * The existing request this most looks like, if any. Plain word overlap for now.
 * Hook: the embeddings work can swap this for a Vectorize lookup without touching callers.
 */
export async function matchExisting(env: Env, appId: string, feature: string, text: string): Promise<string | null> {
  const { results } = await env.DB.prepare("SELECT id, title, body FROM requests WHERE app_id = ? AND status != 'merged' ORDER BY created_at DESC LIMIT 500")
    .bind(appId)
    .all<{ id: string; title: string; body: string }>();
  let best: { id: string; score: number } | null = null;
  for (const r of results) {
    const score = Math.max(similarity(feature, r.title), similarity(feature, `${r.title} ${r.body}`) * 0.8, similarity(text, r.title) * 0.6);
    if (score >= 0.5 && (!best || score > best.score)) best = { id: r.id, score };
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------- the run

export type ListenResult = { fetched: number; fresh: number; inbox: number; skipped?: string };

export async function listenForApp(env: Env, app: AppRow, row: ConfigRow): Promise<ListenResult> {
  // No AI means no way to judge relevance; better to show nothing than noise.
  if (!env.AI) return { fetched: 0, fresh: 0, inbox: 0, skipped: "no_ai" };
  const cfg = toConfig(row);
  const raws: Raw[] = [];
  const appIds = [
    ...(cfg.appStoreId ? [{ id: cfg.appStoreId, label: app.name }] : []),
    ...cfg.competitors.filter((c) => c.appStoreId).map((c) => ({ id: c.appStoreId!, label: c.name })),
  ];
  for (const a of appIds) for (const cc of cfg.countries.slice(0, 3)) raws.push(...(await appStoreReviews(env, a.id, cc, a.label)));
  raws.push(...(await redditPosts(env, app, cfg)));

  await env.DB.prepare("UPDATE listening_config SET last_run_at = ? WHERE app_id = ?").bind(Date.now(), app.id).run();

  const seen = new Set((await env.DB.prepare("SELECT url FROM listening_items WHERE app_id = ?").bind(app.id).all<{ url: string }>()).results.map((r) => r.url));
  const fresh = [...new Map(raws.filter((r) => !seen.has(r.url)).map((r) => [r.url, r])).values()].slice(0, MAX_NEW_ITEMS_CLASSIFIED);

  let inbox = 0;
  for (const item of fresh) {
    const v = await classify(env, app, cfg, item);
    if (!v) continue; // the model failed; try again tomorrow rather than remember it as noise
    const keep = v.isRequest && v.relevantToApp && v.feature.length >= 3;
    const match = keep ? await matchExisting(env, app.id, v.feature, item.text) : null;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO listening_items (id, app_id, source, url, text, author, feature, strength, matched_request_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("hrd"), app.id, item.source, item.url, item.text, item.author, keep ? v.feature : null, v.strength, match, keep ? "new" : "ignored", Date.now())
      .run();
    if (keep) inbox++;
  }
  return { fetched: raws.length, fresh: fresh.length, inbox };
}

/** The daily cron: every enabled app whose plan still covers it. */
export async function runListening(env: Env) {
  if (!env.AI) return;
  const { results } = await env.DB.prepare(
    `SELECT l.*, a.id AS a_id FROM listening_config l JOIN apps a ON a.id = l.app_id WHERE l.enabled = 1 ORDER BY l.updated_at`,
  ).all<ConfigRow & { a_id: string }>();
  const used = new Map<string, number>();
  for (const row of results) {
    try {
      const app = await env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(row.a_id).first<AppRow>();
      if (!app) continue;
      const ent = await entitlements(env, app);
      const limit = ent.limits?.listeningApps ?? 0;
      const n = used.get(app.workspace_id ?? "") ?? 0;
      if (limit <= 0 || n >= limit) continue;
      used.set(app.workspace_id ?? "", n + 1);
      await listenForApp(env, app, row);
    } catch (err) {
      console.error("listening run", row.a_id, err instanceof Error ? err.message : err);
    }
  }
}
