import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { addTeamComment, loadRequestById, mergeRequests, setStatus } from "./actions";
import { adminPage } from "./admin-page";
import { adminMovedPage } from "./admin-moved";
import agent from "./agent";
import auth, { dashboardBase } from "./auth";
import { stripeHook } from "./billing";
import { createDash } from "./dash";
import { createMcp } from "./mcp";
import { oauth } from "./mcp-oauth";
import { TEST_MODE_USERS, entitlements, isDevClient } from "./plans";
import { alert } from "./alert";
import build from "./build";
import listening, { runListening } from "./listening";
import { telegramConnect } from "./telegram-bot";
import signup from "./signup";
import hooks, { sendDigests } from "./hooks";
import { cleanText, decodeBase64Url, newId, safeEqual, similarity, verifySignature } from "./lib";
import type { Mail } from "./mail";
import quality, { findSimilar, purgeRequest, unsubscribe } from "./quality";
import { removeRequests, upsertRequests } from "./semantic";
import { guardContent, limitIp, overLimit, reject } from "./spam";
import publicBoards, { publicSettings, publicUrl, shareFields } from "./public";
import { loadIntegrations, notifyTeam, tg } from "./notify";
import {
  STATUSES,
  parseContext,
  type AppRow,
  type Env,
  type GithubConfig,
  type RequestRow,
  type RequestContext,
  type Status,
  type TelegramConfig,
  type UserRow,
  type WebhookConfig,
} from "./types";

type Vars = { app: AppRow; user: UserRow | null; mode: "test" | "live" };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

/** Must match the daily trigger in wrangler.jsonc. */
const DAILY_CRON = "30 2 * * *";

const ACTIVE: Status[] = ["open", "planned", "in_progress"];

const now = () => Date.now();

/** The occasional in-app prompt. Stored as JSON on apps.nudge; NULL means off. */
type Nudge = { everyDays: number; activeSeconds: number; skipVisits: number; message: string | null; position: "bottom" | "top" };
const NUDGE_DEFAULTS: Nudge = { everyDays: 7, activeSeconds: 30, skipVisits: 1, message: null, position: "bottom" };
const pick = <T,>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);

function readNudge(raw: string | null | undefined): Nudge | null {
  if (!raw) return null;
  try {
    return normaliseNudge(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normaliseNudge(v: unknown): Nudge {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const message = typeof o.message === "string" ? cleanText(o.message, 120) : "";
  return {
    everyDays: pick(o.everyDays, [1, 3, 7, 14, 30] as const, NUDGE_DEFAULTS.everyDays),
    activeSeconds: pick(o.activeSeconds, [10, 30, 60, 120] as const, NUDGE_DEFAULTS.activeSeconds),
    skipVisits: pick(o.skipVisits, [0, 1, 2, 4] as const, NUDGE_DEFAULTS.skipVisits),
    message: message || null,
    position: pick(o.position, ["bottom", "top"] as const, NUDGE_DEFAULTS.position),
  };
}

/** Lets actions.ts send "it shipped" and reply emails after the response. */
const mailOf = (c: Ctx): Mail => ({ env: c.env, waitUntil: (p) => c.executionCtx.waitUntil(p) });

/** What happens once a request is visible to the team: tell them, and hint at a similar one. */
async function announceNew(env: Env, ctx: Pick<ExecutionContext, "waitUntil">, a: AppRow, r: RequestRow, origin: string) {
  ctx.waitUntil(
    (async () => {
      const author = await env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(r.author_id).first<UserRow>();
      const similar = (await findSimilar(env, a.id, r.title, "", r.id)).find((x) => x.score >= 0.5)?.r ?? null;
      const attachments = (await attachmentsFor(env.DB, [r.id], origin)).get(r.id) ?? [];
      await notifyTeam(env, a.id, { kind: "request", appName: a.name, request: r, author, similar, attachments, origin });
    })(),
  );
}

function fail(status: 400 | 401 | 402 | 403 | 404 | 429 | 502, error: string, extra: Record<string, unknown> = {}): never {
  throw new HTTPException(status, { res: Response.json({ error, ...extra }, { status }) });
}

/** First name of an author who opted in to being thanked, once it has shipped. */
function creditName(r: RequestRow & { author_name?: string | null }): string | null {
  if (!r.credit || r.status !== "shipped" || !r.author_name) return null;
  return r.author_name.split(/\s+/)[0] || null;
}

function publicRequest(r: RequestRow & { voted?: number; author_name?: string | null }, me: UserRow | null) {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    body: r.body,
    status: r.status,
    votes: r.vote_count,
    comments: r.comment_count,
    shipNote: r.ship_note,
    shippedAt: r.shipped_at,
    context: parseContext(r.context),
    ...(r.source ? { source: r.source, sourceUrl: r.source_url } : {}),
    ...(r.elsewhere_count ? { elsewhere: r.elsewhere_count } : {}),
    creditName: creditName(r),
    createdAt: r.created_at,
    voted: Boolean(r.voted),
    mine: me ? r.author_id === me.id : false,
  };
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;

/** Checks the first bytes, so a file can't claim to be an image and be something else. */
function sniffImage(b: Uint8Array): string | null {
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

const uploadUrl = (origin: string, id: string) => `${origin}/v1/uploads/${id}`;

/** Where the request came from. The path never carries a query string or hash. */
function cleanContext(raw: unknown): RequestContext | null {
  if (!raw || typeof raw !== "object") return null;
  const { path, topic } = raw as { path?: unknown; topic?: unknown };
  const out: RequestContext = {};
  const p = cleanText(path, 200).split(/[?#]/)[0];
  if (p.startsWith("/")) out.path = p;
  const t = cleanText(topic, 60);
  if (t) out.topic = t;
  return out.path || out.topic ? out : null;
}

async function attachmentsFor(db: D1Database, requestIds: string[], origin: string): Promise<Map<string, { id: string; url: string }[]>> {
  const out = new Map<string, { id: string; url: string }[]>();
  if (!requestIds.length) return out;
  const { results } = await db
    .prepare(`SELECT id, request_id FROM uploads WHERE request_id IN (${requestIds.map(() => "?").join(",")}) ORDER BY created_at`)
    .bind(...requestIds)
    .all<{ id: string; request_id: string }>();
  for (const u of results) out.set(u.request_id, [...(out.get(u.request_id) ?? []), { id: u.id, url: uploadUrl(origin, u.id) }]);
  return out;
}

async function upsertUser(
  db: D1Database,
  appId: string,
  externalId: string,
  isAnon: boolean,
  email: string | null,
  name: string | null,
  limitKey?: string,
): Promise<UserRow> {
  const existing = await db
    .prepare("SELECT * FROM users WHERE app_id = ? AND external_id = ?")
    .bind(appId, externalId)
    .first<UserRow>();
  const t = now();
  if (!existing) {
    // Each new person is a row; cap how many one IP can mint per app per hour.
    if (limitKey && (await overLimit(db, limitKey, 60))) fail(429, "slow_down");
    await db
      .prepare(
        "INSERT INTO users (id, app_id, external_id, email, name, is_anon, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (app_id, external_id) DO NOTHING",
      )
      .bind(newId("usr"), appId, externalId, email, name, isAnon ? 1 : 0, t, t)
      .run();
    // A concurrent first request may have won the insert; read back whichever row exists.
    return (await db
      .prepare("SELECT * FROM users WHERE app_id = ? AND external_id = ?")
      .bind(appId, externalId)
      .first<UserRow>())!;
  }
  const changed = (email && email !== existing.email) || (name && name !== existing.name);
  if (changed || t - existing.last_seen_at > 60 * 60 * 1000) {
    await db
      .prepare("UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name), last_seen_at = ? WHERE id = ?")
      .bind(email, name, t, existing.id)
      .run();
  }
  return existing;
}

/**
 * Identity comes from headers:
 * - x-youasked-user: base64url JSON {id, email?, name?}, plus x-youasked-sig = hex HMAC-SHA256(secret key, id)
 * - x-youasked-anon: a random device id the widget keeps in localStorage
 */
async function resolveUser(db: D1Database, app: AppRow, headers: Headers): Promise<UserRow | null> {
  const rawUser = headers.get("x-youasked-user");
  if (rawUser) {
    let parsed: { id?: unknown; email?: unknown; name?: unknown };
    try {
      parsed = JSON.parse(decodeBase64Url(rawUser));
    } catch {
      fail(400, "bad_user_header");
    }
    const id = typeof parsed.id === "string" || typeof parsed.id === "number" ? String(parsed.id) : "";
    if (!id || id.length > 200) fail(400, "bad_user_id");
    const sig = headers.get("x-youasked-sig");
    const claimed = cleanText(parsed.email, 320) || null;
    // We only ever email an address the developer's server vouched for: the signature has to cover the
    // email as well as the id (signUser(secret, id, email)). A signature over the id alone still proves
    // who they are, but the email is dropped, so nobody can make us mail an address they typed in.
    let email: string | null = null;
    if (sig) {
      if (claimed && (await verifySignature(app.secret_key, id, sig, claimed))) email = claimed;
      else if (!(await verifySignature(app.secret_key, id, sig))) fail(401, "bad_signature");
    } else if (app.require_signature) {
      fail(401, "signature_required");
    }
    const name = cleanText(parsed.name, 120) || null;
    return upsertUser(db, app.id, `u:${id}`, false, email, name, `newuser:${app.id}:${headers.get("cf-connecting-ip") ?? "unknown"}`);
  }
  const anon = headers.get("x-youasked-anon");
  if (anon && /^[A-Za-z0-9-]{8,64}$/.test(anon)) {
    return upsertUser(db, app.id, `a:${anon}`, true, null, null, `newuser:${app.id}:${headers.get("cf-connecting-ip") ?? "unknown"}`);
  }
  return null;
}

function requireUser(c: Ctx): UserRow {
  const user = c.get("user");
  if (!user) fail(401, "identity_required");
  return user;
}

async function loadRequest(c: Ctx, id: string): Promise<RequestRow> {
  const row = await loadRequestById(c.env.DB, c.get("app").id, id);
  if (!row) fail(404, "not_found");
  return row;
}

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error(err);
  // The route pattern, not the raw path, so ids don't make every error its own alert.
  const route = `${c.req.method} ${c.req.routePath || new URL(c.req.url).pathname}`;
  const message = err instanceof Error ? err.message : String(err);
  c.executionCtx.waitUntil(alert(c.env, `error:${route}:${message.slice(0, 80)}`, `500 on ${route}\n${message.slice(0, 500)}`));
  return c.json({ error: "internal" }, 500);
});

app.get("/", (c) => c.text("youasked api"));
app.get("/admin", (c) => c.html(adminMovedPage(dashboardBase(c.env))));
app.get("/admin/legacy", (c) => c.html(adminPage));
app.route("/v1/hooks", hooks);
app.route("/v1/hooks", stripeHook);
app.route("/v1/auth", auth);
// Hosted MCP connector: OAuth server (metadata, registration, authorize, token) and the /mcp endpoint.
app.route("/", oauth);
app.route("/", createMcp((req, env, ctx) => app.fetch(req, env, ctx)));
app.route("/v1", signup);

// ---------------------------------------------------------------- bootstrap

app.post("/v1/apps", async (c) => {
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!safeEqual(token, c.env.ADMIN_TOKEN)) fail(401, "unauthorized");
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = cleanText(body.name, 80);
  if (!name) fail(400, "name_required");
  const row = {
    id: newId("app"),
    public_key: newId("ya_pub", 24),
    secret_key: newId("ya_sec", 32),
  };
  await c.env.DB.prepare(
    "INSERT INTO apps (id, name, public_key, secret_key, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(row.id, name, row.public_key, row.secret_key, now())
    .run();
  return c.json({ id: row.id, name, publicKey: row.public_key, secretKey: row.secret_key });
});

// ---------------------------------------------------------------- admin (secret key)

const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.use("*", async (c, next) => {
  const key = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!key?.startsWith("ya_sec_")) fail(401, "unauthorized");
  const row = await c.env.DB.prepare("SELECT * FROM apps WHERE secret_key = ?").bind(key).first<AppRow>();
  if (!row) fail(401, "unauthorized");
  c.set("app", row);
  c.set("user", null);
  await next();
});

admin.get("/app", (c) => {
  const a = c.get("app");
  return c.json({
    id: a.id,
    name: a.name,
    watermark: Boolean(a.watermark),
    requireSignature: Boolean(a.require_signature),
    allowedOrigins: a.allowed_origins ? JSON.parse(a.allowed_origins) : null,
    moderation: a.moderation ?? "off",
    slug: a.slug,
    publicBoard: Boolean(a.public_board),
    description: a.description,
    publicUrl: publicUrl(c.env, a),
    nudge: readNudge(a.nudge),
  });
});

admin.patch("/app", async (c) => {
  const body = await c.req.json<{
    name?: string;
    watermark?: boolean;
    requireSignature?: boolean;
    allowedOrigins?: string[] | null;
    moderation?: string;
    slug?: string | null;
    publicBoard?: boolean;
    description?: string | null;
    /** Settings for the occasional prompt, or null to turn it off. */
    nudge?: Partial<Nudge> | null;
  }>();
  if (body.moderation !== undefined && body.moderation !== "off" && body.moderation !== "approve") fail(400, "bad_moderation");
  const a = c.get("app");
  const name = body.name === undefined ? a.name : cleanText(String(body.name), 60);
  if (!name) fail(400, "name_required");
  // The "Feedback by YouAsked" line comes off on Pro and Studio only.
  if (body.watermark === false && a.watermark && !a.always_live) {
    const { limits } = await entitlements(c.env, a);
    if (!limits?.removeBranding) fail(402, "upgrade_required", { upgrade: true, message: "Removing the YouAsked line is on Pro and Studio." });
  }
  const pubSettings = await publicSettings(c.env, a, body);
  const origins =
    body.allowedOrigins === undefined
      ? a.allowed_origins
      : body.allowedOrigins === null
        ? null
        : JSON.stringify(body.allowedOrigins.filter((o) => typeof o === "string").slice(0, 20));
  await c.env.DB.prepare("UPDATE apps SET name = ?, watermark = ?, require_signature = ?, allowed_origins = ?, moderation = ? WHERE id = ?")
    .bind(
      name,
      body.watermark === undefined ? a.watermark : body.watermark ? 1 : 0,
      body.requireSignature === undefined ? a.require_signature : body.requireSignature ? 1 : 0,
      origins,
      body.moderation ?? a.moderation ?? "off",
      a.id,
    )
    .run();
  if (body.nudge !== undefined) {
    const nudge = body.nudge === null ? null : JSON.stringify(normaliseNudge({ ...readNudge(a.nudge), ...body.nudge }));
    await c.env.DB.prepare("UPDATE apps SET nudge = ? WHERE id = ?").bind(nudge, a.id).run();
  }
  if (pubSettings) {
    await c.env.DB.prepare("UPDATE apps SET slug = ?, public_board = ?, description = ? WHERE id = ?")
      .bind(pubSettings.slug, pubSettings.public_board, pubSettings.description, a.id)
      .run();
  }
  return c.json({ ok: true });
});

admin.get("/requests", async (c) => {
  const status = c.req.query("status");
  const where = status && status !== "all" ? "AND r.status = ?" : "AND r.status != 'merged'";
  const stmt = c.env.DB.prepare(
    `SELECT r.*, u.email AS author_email, u.name AS author_name, u.is_anon AS author_anon,
            (SELECT COUNT(*) FROM early_access e WHERE e.request_id = r.id) AS early_count
     FROM requests r LEFT JOIN users u ON u.id = r.author_id
     WHERE r.app_id = ? ${where}
     ORDER BY CASE r.status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 WHEN 'open' THEN 2 ELSE 3 END,
              r.vote_count DESC, r.created_at DESC
     LIMIT 500`,
  );
  const { results } = await (status && status !== "all"
    ? stmt.bind(c.get("app").id, status)
    : stmt.bind(c.get("app").id)
  ).all<RequestRow & { author_email: string | null; author_name: string | null; author_anon: number; early_count: number }>();
  const origin = new URL(c.req.url).origin;
  const files = await attachmentsFor(c.env.DB, results.map((r) => r.id), origin);
  return c.json({
    requests: results.map((r) => ({
      ...publicRequest(r, null),
      ...shareFields(c.env, c.get("app"), r),
      attachments: files.get(r.id) ?? [],
      earlyAccess: r.early_count,
      credit: Boolean(r.credit),
      author: { email: r.author_email, name: r.author_name, anonymous: Boolean(r.author_anon) },
      updatedAt: r.updated_at,
    })),
  });
});

admin.get("/requests/:id", async (c) => {
  const r = await loadRequest(c, c.req.param("id"));
  const { results: comments } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.is_team, c.created_at, u.name, u.email FROM comments c
     LEFT JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.created_at`,
  )
    .bind(r.id)
    .all();
  const { results: voters } = await c.env.DB.prepare(
    `SELECT u.email, u.name, u.is_anon FROM votes v JOIN users u ON u.id = v.user_id
     WHERE v.request_id = ? ORDER BY v.created_at LIMIT 200`,
  )
    .bind(r.id)
    .all();
  const { results: early } = await c.env.DB.prepare(
    `SELECT u.email, u.name, u.is_anon FROM early_access e JOIN users u ON u.id = e.user_id
     WHERE e.request_id = ? ORDER BY e.created_at LIMIT 200`,
  )
    .bind(r.id)
    .all();
  const files = await attachmentsFor(c.env.DB, [r.id], new URL(c.req.url).origin);
  return c.json({ request: { ...publicRequest(r, null), ...shareFields(c.env, c.get("app"), r) }, attachments: files.get(r.id) ?? [], comments, voters, earlyAccess: early });
});

admin.patch("/requests/:id", async (c) => {
  const r = await loadRequest(c, c.req.param("id"));
  const body = await c.req.json<{ status?: string; title?: string; body?: string; shipNote?: string | null }>();
  const status = (body.status ?? r.status) as Status;
  if (!(STATUSES as readonly string[]).includes(status) && status !== r.status) fail(400, "bad_status");
  if (body.title !== undefined || body.body !== undefined) {
    await c.env.DB.prepare("UPDATE requests SET title = ?, body = ?, updated_at = ? WHERE id = ?")
      .bind(
        body.title !== undefined ? cleanText(body.title, 120) || r.title : r.title,
        body.body !== undefined ? cleanText(body.body, 4000) : r.body,
        now(),
        r.id,
      )
      .run();
  }
  const shipNote = body.shipNote !== undefined ? cleanText(body.shipNote, 500) || null : undefined;
  const { notified } = await setStatus(c.env.DB, r, status, shipNote, mailOf(c));
  const after = await loadRequest(c, r.id);
  if (body.title !== undefined || body.body !== undefined) c.executionCtx.waitUntil(upsertRequests(c.env, [after]));
  return c.json({ request: { ...publicRequest(after, null), ...shareFields(c.env, c.get("app"), after) }, notified: notified > 0, told: notified });
});

admin.post("/requests/:id/comments", async (c) => {
  const r = await loadRequest(c, c.req.param("id"));
  const body = cleanText((await c.req.json<{ body?: string }>()).body, 2000);
  if (!body) fail(400, "body_required");
  return c.json(await addTeamComment(c.env.DB, r, body, mailOf(c)));
});

admin.post("/requests/:id/merge", async (c) => {
  const from = await loadRequest(c, c.req.param("id"));
  const into = await loadRequest(c, (await c.req.json<{ into?: string }>()).into ?? "");
  if (from.id === into.id) fail(400, "same_request");
  await mergeRequests(c.env.DB, from, into);
  c.executionCtx.waitUntil(removeRequests(c.env, [from.id]));
  return c.json({ ok: true });
});

admin.delete("/requests/:id", async (c) => {
  await purgeRequest(c.env, await loadRequest(c, c.req.param("id")));
  return c.json({ ok: true });
});

// ---- integrations

admin.get("/integrations", async (c) => {
  const origin = new URL(c.req.url).origin;
  const list = await loadIntegrations(c.env.DB, c.get("app").id);
  const out: Record<string, unknown> = {};
  for (const i of list) {
    if (i.kind === "telegram") {
      const cfg = i.config as TelegramConfig;
      out.telegram = {
        connected: Boolean(cfg.chatId),
        mode: cfg.shared ? "shared" : cfg.interactive === false ? "notify" : "interactive",
        chatTitle: cfg.chatTitle,
        botUsername: cfg.botUsername,
        link: cfg.linkCode ? `https://t.me/${cfg.botUsername}?start=${cfg.linkCode}` : null,
        groupLink: cfg.linkCode ? `https://t.me/${cfg.botUsername}?startgroup=${cfg.linkCode}` : null,
      };
    } else if (i.kind === "github") {
      const gc = i.config as GithubConfig;
      out.github = { payloadUrl: `${origin}/v1/hooks/github/${i.id}`, secret: gc.secret, repo: gc.repo ?? null, tokenConnected: Boolean(gc.tokenEnc) };
    } else if (i.kind === "webhook") {
      out.webhook = i.config;
    }
  }
  return c.json(out);
});

async function upsertIntegration(db: D1Database, appId: string, kind: string, config: unknown): Promise<string> {
  const existing = await db.prepare("SELECT id FROM integrations WHERE app_id = ? AND kind = ?").bind(appId, kind).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE integrations SET config = ? WHERE id = ?").bind(JSON.stringify(config), existing.id).run();
    return existing.id;
  }
  const id = newId("int");
  await db
    .prepare("INSERT INTO integrations (id, app_id, kind, config, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, appId, kind, JSON.stringify(config), now())
    .run();
  return id;
}

/**
 * Connects a Telegram bot: points its webhook here and returns a link that ties a chat to this app.
 * With mode "notify" and a chatId, it only posts to that chat and leaves the bot's updates alone,
 * for a bot that already runs something else.
 */
admin.put("/integrations/telegram", async (c) => {
  const { botToken, mode, chatId } = await c.req.json<{ botToken?: string; mode?: string; chatId?: string | number }>();
  if (!botToken || !/^\d+:[\w-]{30,}$/.test(botToken)) fail(400, "bad_bot_token");
  const me = await tg(c.env, botToken, "getMe", {});
  if (!me?.ok) fail(400, "bot_token_rejected");
  const appId = c.get("app").id;
  if (mode === "notify") {
    if (chatId === undefined) fail(400, "chat_id_required");
    const chat = await tg(c.env, botToken, "getChat", { chat_id: chatId });
    if (!chat?.ok) fail(400, "chat_not_found");
    const config: TelegramConfig = {
      botToken,
      botUsername: me.result.username,
      secret: "",
      linkCode: null,
      chatId: String(chat.result.id),
      chatTitle: chat.result.title ?? chat.result.first_name ?? null,
      interactive: false,
      dashboardUrl: `${new URL(c.req.url).origin}/admin`,
    };
    await upsertIntegration(c.env.DB, appId, "telegram", config);
    return c.json({ botUsername: config.botUsername, chatTitle: config.chatTitle, mode: "notify" });
  }
  const config: TelegramConfig = {
    botToken,
    botUsername: me.result.username,
    secret: newId("tgs", 32).replace("tgs_", ""),
    linkCode: newId("lnk", 12).replace("lnk_", ""),
    chatId: null,
    chatTitle: null,
  };
  const id = await upsertIntegration(c.env.DB, appId, "telegram", config);
  const hook = await tg(c.env, botToken, "setWebhook", {
    url: `${new URL(c.req.url).origin}/v1/hooks/telegram/${id}`,
    secret_token: config.secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  if (!hook?.ok) fail(502, "webhook_failed");
  return c.json({
    botUsername: config.botUsername,
    link: `https://t.me/${config.botUsername}?start=${config.linkCode}`,
    groupLink: `https://t.me/${config.botUsername}?startgroup=${config.linkCode}`,
  });
});

admin.put("/integrations/github", async (c) => {
  const appId = c.get("app").id;
  const existing = (await loadIntegrations(c.env.DB, appId)).find((i) => i.kind === "github");
  const config: GithubConfig = (existing?.config as GithubConfig) ?? { secret: newId("ghs", 32).replace("ghs_", "") };
  const id = await upsertIntegration(c.env.DB, appId, "github", config);
  return c.json({ payloadUrl: `${new URL(c.req.url).origin}/v1/hooks/github/${id}`, secret: config.secret, events: ["pull_request", "push"] });
});

admin.put("/integrations/webhook", async (c) => {
  const body = await c.req.json<{ url?: string; format?: string }>();
  let url: URL;
  try {
    url = new URL(body.url ?? "");
  } catch {
    fail(400, "bad_url");
  }
  if (url.protocol !== "https:") fail(400, "https_only");
  const format: WebhookConfig["format"] =
    body.format === "slack" || body.format === "discord" || body.format === "json"
      ? body.format
      : url.hostname.endsWith("slack.com")
        ? "slack"
        : url.hostname.includes("discord")
          ? "discord"
          : "json";
  await upsertIntegration(c.env.DB, c.get("app").id, "webhook", { url: url.toString(), format });
  return c.json({ ok: true, format });
});

admin.delete("/integrations/:kind", async (c) => {
  const appId = c.get("app").id;
  const kind = c.req.param("kind");
  const existing = (await loadIntegrations(c.env.DB, appId)).find((i) => i.kind === kind);
  if (existing?.kind === "telegram" && (existing.config as TelegramConfig).interactive !== false) {
    await tg(c.env, (existing.config as TelegramConfig).botToken, "deleteWebhook", {});
  }
  await c.env.DB.prepare("DELETE FROM integrations WHERE app_id = ? AND kind = ?").bind(appId, kind).run();
  return c.json({ ok: true });
});

app.use("/v1/admin/*", cors({ origin: "*", allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.route("/v1/admin", agent);
app.route("/v1/admin", quality({ announce: announceNew }));
app.route("/v1", unsubscribe);
app.route("/v1/admin", build);
app.route("/v1/admin", telegramConnect);
app.route("/v1/admin", listening);
app.route("/v1/admin", admin);

// The dashboard's door into the admin routes above, authenticated by session instead of secret key.
app.route("/v1/dash", createDash((req, env, ctx) => app.fetch(req, env, ctx)));

// ---------------------------------------------------------------- public (widget, publishable key)

// Screenshots are served without a key so a plain <img> works, in the widget, the dashboard and chat apps.
// The id is 24 random characters, so the link is the secret.
app.get("/v1/uploads/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^upl_[a-z0-9]{24}$/.test(id)) fail(404, "not_found");
  const object = await c.env.UPLOADS.get(id);
  if (!object) fail(404, "not_found");
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      etag: object.httpEtag,
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "cross-origin",
      "access-control-allow-origin": "*",
    },
  });
});

const pub = new Hono<{ Bindings: Env; Variables: Vars }>();

pub.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["content-type", "x-youasked-key", "x-youasked-user", "x-youasked-sig", "x-youasked-anon", "x-youasked-dev", "x-youasked-platform"],
    allowMethods: ["GET", "POST", "DELETE"],
    maxAge: 86400,
  }),
);

pub.use("*", async (c, next) => {
  const key = c.req.header("x-youasked-key");
  if (!key) fail(401, "missing_key");
  const row = await c.env.DB.prepare("SELECT * FROM apps WHERE public_key = ?").bind(key).first<AppRow>();
  if (!row) fail(401, "invalid_key");
  if (row.allowed_origins) {
    const origin = c.req.header("origin");
    if (origin && !(JSON.parse(row.allowed_origins) as string[]).includes(origin)) fail(403, "origin_not_allowed");
  }
  // Test mode: until the workspace is on a paid plan, the app only answers development clients
  // (localhost, React Native dev builds), and only for its first TEST_MODE_USERS people.
  const live = row.always_live ? true : (await entitlements(c.env, row)).live;
  const testModeMessage = `This app is in test mode. It works on localhost and in dev builds until it's on a paid plan: ${dashboardBase(c.env)}`;
  if (!live && !isDevClient(c.req.raw.headers)) fail(402, "test_mode", { message: testModeMessage });
  c.set("app", row);
  c.set("mode", live ? "live" : "test");
  const user = await resolveUser(c.env.DB, row, c.req.raw.headers);
  if (!live && user) {
    const earlier = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE app_id = ? AND created_at < ?")
      .bind(row.id, user.created_at)
      .first<{ n: number }>();
    if ((earlier?.n ?? 0) >= TEST_MODE_USERS) fail(402, "test_mode", { message: testModeMessage });
  }
  c.set("user", user);
  await next();
});

pub.get("/config", async (c) => {
  const a = c.get("app");
  const me = c.get("user");
  let unseen: unknown[] = [];
  if (me) {
    const { results } = await c.env.DB.prepare(
      `SELECT n.id, n.kind, r.id AS request_id, r.title, r.ship_note, cm.body AS reply
       FROM notifications n
       JOIN requests r ON r.id = n.request_id
       LEFT JOIN comments cm ON cm.id = n.comment_id
       WHERE n.user_id = ? AND n.seen_at IS NULL ORDER BY n.created_at DESC LIMIT 8`,
    )
      .bind(me.id)
      .all<{ id: string; kind: string; request_id: string; title: string; ship_note: string | null; reply: string | null }>();
    unseen = results.map((n) => ({
      id: n.id,
      kind: n.kind,
      requestId: n.request_id,
      title: n.title,
      shipNote: n.ship_note,
      reply: n.reply,
    }));
  }
  return c.json({
    app: { name: a.name },
    mode: c.get("mode"),
    nudge: readNudge(a.nudge),
    watermark: Boolean(a.watermark),
    identified: me ? !me.is_anon : false,
    canCredit: me ? !me.is_anon && Boolean(me.name) : false,
    unseen,
    whatsNew: me ? await whatsNewFor(c.env.DB, a.id, me) : null,
  });
});

/**
 * What shipped since this person was last shown the list. Their "last visit" is last_whats_new_at,
 * set when they dismiss the list (or open the panel with it showing), not users.last_seen_at, which
 * moves hourly on any request. With nothing recorded yet it starts at the user's first visit, so
 * nobody is greeted with a backlog of things that shipped before they arrived. Anonymous visitors
 * are tracked the same way by their device id.
 */
async function whatsNewFor(db: D1Database, appId: string, me: UserRow) {
  const since = Math.max(me.last_whats_new_at ?? 0, me.created_at);
  const { results } = await db
    .prepare(
      `SELECT r.id, r.title, r.ship_note, r.shipped_at, r.credit, au.name AS author_name,
              (r.author_id = ?1 OR v.user_id IS NOT NULL) AS mine
       FROM requests r
       LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?1
       LEFT JOIN users au ON au.id = r.author_id
       WHERE r.app_id = ?2 AND r.status = 'shipped' AND r.shipped_at > ?3
       ORDER BY mine DESC, r.shipped_at DESC LIMIT 5`,
    )
    .bind(me.id, appId, since)
    .all<{ id: string; title: string; ship_note: string | null; shipped_at: number; mine: number }>();
  if (!results.length) return null;
  const total = await db
    .prepare("SELECT COUNT(*) AS n FROM requests WHERE app_id = ? AND status = 'shipped' AND shipped_at > ?")
    .bind(appId, since)
    .first<{ n: number }>();
  return {
    since,
    total: total?.n ?? results.length,
    items: results.map((r) => ({ id: r.id, title: r.title, shipNote: r.ship_note, shippedAt: r.shipped_at, mine: Boolean(r.mine) })),
  };
}

pub.post("/whats-new/seen", async (c) => {
  const me = requireUser(c);
  await c.env.DB.prepare("UPDATE users SET last_whats_new_at = ? WHERE id = ?").bind(now(), me.id).run();
  return c.json({ ok: true });
});

pub.get("/requests", async (c) => {
  const a = c.get("app");
  const me = c.get("user");
  const sort = c.req.query("sort") === "new" ? "new" : "top";
  const filter = c.req.query("status") ?? "active";
  const statuses: string[] =
    filter === "active" ? ACTIVE : filter === "all" ? [...STATUSES] : (STATUSES as readonly string[]).includes(filter) ? [filter] : ACTIVE;
  const order =
    filter === "shipped" ? "r.shipped_at DESC" : sort === "new" ? "r.created_at DESC" : "r.vote_count DESC, r.created_at DESC";
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, au.name AS author_name, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
     LEFT JOIN users au ON au.id = r.author_id
     WHERE r.app_id = ? AND r.status IN (${statuses.map(() => "?").join(",")})
     ORDER BY ${order} LIMIT 100`,
  )
    .bind(me?.id ?? "", a.id, ...statuses)
    .all<RequestRow & { voted: number; author_name: string | null }>();
  return c.json({ requests: results.map((r) => publicRequest(r, me)) });
});

pub.get("/requests/similar", async (c) => {
  const q = cleanText(c.req.query("q"), 200);
  if (q.length < 3) return c.json({ requests: [] });
  // Each lookup can run an embedding; typing is debounced, so this is plenty for a person.
  await limitIp(c.env.DB, c.req.raw.headers, "similar", 300);
  const me = c.get("user");
  const scored = await findSimilar(c.env, c.get("app").id, q, me?.id ?? "", undefined, me?.id ?? c.req.header("cf-connecting-ip") ?? "anon");
  return c.json({ requests: scored.slice(0, 4).map((x) => publicRequest(x.r, me)) });
});

/**
 * Someone can take back a request they wrote while it's still only theirs: open or awaiting
 * approval, nobody else has voted, and the team hasn't replied. After that it belongs to everyone
 * who joined in, so it stays (the team can still remove it).
 */
async function canDeleteOwn(db: D1Database, r: RequestRow, me: UserRow | null): Promise<boolean> {
  if (!me || r.author_id !== me.id || (r.status !== "open" && r.status !== "pending")) return false;
  const others = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM votes WHERE request_id = ?1 AND user_id != ?2)
            + (SELECT COUNT(*) FROM comments WHERE request_id = ?1 AND (is_team = 1 OR user_id IS NULL OR user_id != ?2)) AS n`,
    )
    .bind(r.id, me.id)
    .first<{ n: number }>();
  return (others?.n ?? 0) === 0;
}

pub.get("/requests/:id", async (c) => {
  const me = c.get("user");
  const r = await c.env.DB.prepare(
    `SELECT r.*, au.name AS author_name, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
     LEFT JOIN users au ON au.id = r.author_id
     WHERE r.id = ? AND r.app_id = ?`,
  )
    .bind(me?.id ?? "", c.req.param("id"), c.get("app").id)
    .first<RequestRow & { voted: number; author_name: string | null }>();
  if (!r) fail(404, "not_found");
  // A request waiting for approval is only visible to the person who wrote it.
  if (r.status === "pending" && r.author_id !== me?.id) fail(404, "not_found");
  if (r.status === "merged" && r.merged_into) return c.json({ redirect: r.merged_into });
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.is_team, c.created_at, c.user_id, u.name FROM comments c
     LEFT JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.created_at LIMIT 200`,
  )
    .bind(r.id)
    .all<{ id: string; body: string; is_team: number; created_at: number; user_id: string | null; name: string | null }>();
  const files = await attachmentsFor(c.env.DB, [r.id], new URL(c.req.url).origin);
  const early = me
    ? await c.env.DB.prepare("SELECT 1 AS x FROM early_access WHERE request_id = ? AND user_id = ?").bind(r.id, me.id).first()
    : null;
  return c.json({
    request: publicRequest(r, me),
    attachments: files.get(r.id) ?? [],
    earlyAccess: Boolean(early),
    canDelete: await canDeleteOwn(c.env.DB, r, me),
    comments: results.map((cm) => ({
      id: cm.id,
      body: cm.body,
      team: Boolean(cm.is_team),
      author: cm.is_team ? null : cm.name,
      mine: me ? cm.user_id === me.id : false,
      createdAt: cm.created_at,
    })),
  });
});

pub.delete("/requests/:id", async (c) => {
  const me = requireUser(c);
  const r = await c.env.DB.prepare("SELECT * FROM requests WHERE id = ? AND app_id = ?").bind(c.req.param("id"), c.get("app").id).first<RequestRow>();
  if (!r) fail(404, "not_found");
  if (!(await canDeleteOwn(c.env.DB, r, me))) {
    fail(403, "cant_delete", { message: "Other people have joined in on this one, so it stays. The team can still remove it." });
  }
  await purgeRequest(c.env, r);
  return c.json({ ok: true });
});

pub.post("/requests", async (c) => {
  const me = requireUser(c);
  const a = c.get("app");
  const body = await c.req
    .json<{ title?: string; body?: string; attachments?: unknown; context?: unknown; credit?: unknown }>()
    .catch(() => ({}) as { title?: string; body?: string; attachments?: unknown; context?: unknown; credit?: unknown });
  const title = cleanText(body.title, 120);
  const context = cleanContext(body.context);
  const credit = body.credit === true && !me.is_anon && Boolean(me.name) ? 1 : 0;
  const uploadIds = (Array.isArray(body.attachments) ? body.attachments : [])
    .filter((x): x is string => typeof x === "string" && /^upl_[a-z0-9]{24}$/.test(x))
    .slice(0, MAX_ATTACHMENTS);
  const text = cleanText(body.body, 2000);
  if (title.length < 3) fail(400, "title_too_short");
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE author_id = ? AND created_at > ?")
    .bind(me.id, now() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) reject(429, "slow_down", "That's a lot of requests in an hour. Try again a bit later.");
  const verdict = await guardContent(c.env, c.req.raw.headers, a.id, "request", `${title}\n${text}`);
  // Moderation holds everything for approval; text that looks off is held even when moderation is off.
  const status = a.moderation === "approve" || verdict === "review" ? "pending" : "open";
  const id = newId("req");
  const t = now();
  const insert = () =>
    c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO requests (id, app_id, author_id, number, title, body, status, vote_count, context, credit, created_at, updated_at)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(number), 0) + 1 FROM requests WHERE app_id = ?2), ?4, ?5, ?9, 1, ?7, ?8, ?6, ?6)`,
      ).bind(id, a.id, me.id, title, text, t, context ? JSON.stringify(context) : null, credit, status),
      c.env.DB.prepare("INSERT INTO votes (request_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, me.id, t),
      // Only the author's own, not-yet-used uploads can be attached.
      ...uploadIds.map((u) =>
        c.env.DB.prepare("UPDATE uploads SET request_id = ? WHERE id = ? AND user_id = ? AND app_id = ? AND request_id IS NULL").bind(id, u, me.id, a.id),
      ),
    ]);
  try {
    await insert();
  } catch {
    await insert(); // two requests raced for the same number; the retry takes the next one
  }
  const r = await loadRequest(c, id);
  const origin = new URL(c.req.url).origin;
  c.executionCtx.waitUntil(upsertRequests(c.env, [r]));
  await announceNew(c.env, c.executionCtx, a, r, origin);
  const files = await attachmentsFor(c.env.DB, [r.id], origin);
  return c.json({ request: publicRequest({ ...r, voted: 1, author_name: me.name }, me), attachments: files.get(r.id) ?? [] }, 201);
});

pub.post("/requests/:id/vote", async (c) => {
  const me = requireUser(c);
  await limitIp(c.env.DB, c.req.raw.headers, `vote:${c.get("app").id}`, 120);
  const r = await loadRequest(c, c.req.param("id"));
  if (r.status === "merged") fail(400, "merged");
  if (r.status === "pending") fail(400, "pending");
  const existing = await c.env.DB.prepare("SELECT 1 AS x FROM votes WHERE request_id = ? AND user_id = ?").bind(r.id, me.id).first();
  const t = now();
  await c.env.DB.batch([
    existing
      ? c.env.DB.prepare("DELETE FROM votes WHERE request_id = ? AND user_id = ?").bind(r.id, me.id)
      : c.env.DB.prepare("INSERT OR IGNORE INTO votes (request_id, user_id, created_at) VALUES (?, ?, ?)").bind(r.id, me.id, t),
    c.env.DB.prepare("UPDATE requests SET vote_count = imported_votes + (SELECT COUNT(*) FROM votes WHERE request_id = ?1), updated_at = ?2 WHERE id = ?1").bind(
      r.id,
      t,
    ),
  ]);
  const after = await loadRequest(c, r.id);
  return c.json({ voted: !existing, votes: after.vote_count });
});

pub.post("/requests/:id/comments", async (c) => {
  const me = requireUser(c);
  const r = await loadRequest(c, c.req.param("id"));
  if (r.status === "pending" && r.author_id !== me.id) fail(404, "not_found");
  const body = cleanText((await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string })).body, 1000);
  if (!body) fail(400, "body_required");
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?")
    .bind(me.id, now() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 30) reject(429, "slow_down", "That's a lot of comments in an hour. Try again a bit later.");
  await guardContent(c.env, c.req.raw.headers, c.get("app").id, "comment", body);
  const id = newId("cmt");
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO comments (id, request_id, user_id, is_team, body, created_at) VALUES (?, ?, ?, 0, ?, ?)").bind(
      id,
      r.id,
      me.id,
      body,
      t,
    ),
    c.env.DB.prepare("UPDATE requests SET comment_count = comment_count + 1, updated_at = ? WHERE id = ?").bind(t, r.id),
  ]);
  c.executionCtx.waitUntil(notifyTeam(c.env, c.get("app").id, { kind: "comment", appName: c.get("app").name, request: r, author: me, body }));
  return c.json({ comment: { id, body, team: false, author: me.name, mine: true, createdAt: t } }, 201);
});

/** Takes the image as the raw request body (not multipart). Returns an id to pass as `attachments` when posting. */
pub.post("/uploads", async (c) => {
  const me = requireUser(c);
  const a = c.get("app");
  await limitIp(c.env.DB, c.req.raw.headers, "upload", 30);
  if (await overLimit(c.env.DB, `upload-app:${a.id}`, 300)) fail(429, "slow_down");
  if (Number(c.req.header("content-length") ?? 0) > MAX_UPLOAD) fail(400, "too_large");
  const declared = (c.req.header("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!IMAGE_TYPES.includes(declared)) fail(400, "bad_image");
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM uploads WHERE user_id = ? AND created_at > ?")
    .bind(me.id, now() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 12) fail(429, "slow_down");
  const bytes = await c.req.arrayBuffer();
  if (bytes.byteLength > MAX_UPLOAD) fail(400, "too_large");
  if (sniffImage(new Uint8Array(bytes)) !== declared) fail(400, "bad_image");
  const id = newId("upl", 24);
  await c.env.UPLOADS.put(id, bytes, { httpMetadata: { contentType: declared } });
  await c.env.DB.prepare("INSERT INTO uploads (id, app_id, user_id, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, a.id, me.id, declared, bytes.byteLength, now())
    .run();
  return c.json({ id, url: uploadUrl(new URL(c.req.url).origin, id) }, 201);
});

/** "Let me try it early": a toggle for people who voted on something planned or being built. */
pub.post("/requests/:id/early-access", async (c) => {
  const me = requireUser(c);
  const r = await loadRequest(c, c.req.param("id"));
  if (r.status !== "planned" && r.status !== "in_progress") fail(400, "not_in_the_works");
  const voted = await c.env.DB.prepare("SELECT 1 AS x FROM votes WHERE request_id = ? AND user_id = ?").bind(r.id, me.id).first();
  if (!voted) fail(403, "vote_first");
  const existing = await c.env.DB.prepare("SELECT 1 AS x FROM early_access WHERE request_id = ? AND user_id = ?").bind(r.id, me.id).first();
  await (existing
    ? c.env.DB.prepare("DELETE FROM early_access WHERE request_id = ? AND user_id = ?").bind(r.id, me.id)
    : c.env.DB.prepare("INSERT OR IGNORE INTO early_access (request_id, user_id, created_at) VALUES (?, ?, ?)").bind(r.id, me.id, now())
  ).run();
  return c.json({ earlyAccess: !existing });
});

pub.get("/me/requests", async (c) => {
  const me = c.get("user");
  if (!me) return c.json({ requests: [] });
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, au.name AS author_name, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?1
     LEFT JOIN users au ON au.id = r.author_id
     WHERE r.app_id = ?2 AND r.status != 'merged' AND (r.author_id = ?1 OR v.user_id IS NOT NULL)
     ORDER BY r.updated_at DESC LIMIT 100`,
  )
    .bind(me.id, c.get("app").id)
    .all<RequestRow & { voted: number; author_name: string | null }>();
  return c.json({ requests: results.map((r) => publicRequest(r, me)) });
});

pub.post("/notifications/seen", async (c) => {
  const me = requireUser(c);
  const { ids } = await c.req.json<{ ids?: string[] }>().catch(() => ({ ids: [] as string[] }));
  const list = (ids ?? []).filter((x) => typeof x === "string").slice(0, 50);
  if (list.length) {
    await c.env.DB.prepare(
      `UPDATE notifications SET seen_at = ? WHERE user_id = ? AND id IN (${list.map(() => "?").join(",")})`,
    )
      .bind(now(), me.id, ...list)
      .run();
  }
  return c.json({ ok: true });
});

// Before the widget routes below, which demand a key on everything under /v1.
app.route("/v1/public", publicBoards);
app.route("/v1", pub);

/** Screenshots uploaded but never attached to a request (the person gave up), older than a day. */
async function sweepUploads(env: Env): Promise<void> {
  const { results } = await env.DB.prepare("SELECT id FROM uploads WHERE request_id IS NULL AND created_at < ? LIMIT 500")
    .bind(now() - 24 * 60 * 60 * 1000)
    .all<{ id: string }>();
  if (!results.length) return;
  const ids = results.map((r) => r.id);
  await env.UPLOADS.delete(ids);
  await env.DB.batch(ids.map((id) => env.DB.prepare("DELETE FROM uploads WHERE id = ?").bind(id)));
}

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Two triggers (see wrangler.jsonc): the daily Heard elsewhere scan, and the weekly digest.
    ctx.waitUntil(
      (event.cron === DAILY_CRON ? Promise.all([runListening(env), sweepUploads(env)]) : sendDigests(env)).catch((err) =>
        alert(env, `cron:${event.cron}`, `Scheduled job ${event.cron} failed: ${err instanceof Error ? err.message : String(err)}`, 6 * 60 * 60_000),
      ),
    );
  },
};
