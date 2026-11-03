import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { addTeamComment, loadRequestById, mergeRequests, setStatus } from "./actions";
import { adminPage } from "./admin-page";
import hooks, { sendDigests } from "./hooks";
import { cleanText, decodeBase64Url, newId, similarity, verifySignature } from "./lib";
import { loadIntegrations, notifyTeam, tg } from "./notify";
import {
  STATUSES,
  type AppRow,
  type Env,
  type GithubConfig,
  type RequestRow,
  type Status,
  type TelegramConfig,
  type UserRow,
  type WebhookConfig,
} from "./types";

type Vars = { app: AppRow; user: UserRow | null };
type Ctx = Context<{ Bindings: Env; Variables: Vars }>;

const ACTIVE: Status[] = ["open", "planned", "in_progress"];

const now = () => Date.now();

function fail(status: 400 | 401 | 403 | 404 | 429 | 502, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

function publicRequest(r: RequestRow & { voted?: number }, me: UserRow | null) {
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
    createdAt: r.created_at,
    voted: Boolean(r.voted),
    mine: me ? r.author_id === me.id : false,
  };
}

async function upsertUser(
  db: D1Database,
  appId: string,
  externalId: string,
  isAnon: boolean,
  email: string | null,
  name: string | null,
): Promise<UserRow> {
  const existing = await db
    .prepare("SELECT * FROM users WHERE app_id = ? AND external_id = ?")
    .bind(appId, externalId)
    .first<UserRow>();
  const t = now();
  if (!existing) {
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
    if (sig) {
      if (!(await verifySignature(app.secret_key, id, sig))) fail(401, "bad_signature");
    } else if (app.require_signature) {
      fail(401, "signature_required");
    }
    const email = cleanText(parsed.email, 320) || null;
    const name = cleanText(parsed.name, 120) || null;
    return upsertUser(db, app.id, `u:${id}`, false, email, name);
  }
  const anon = headers.get("x-youasked-anon");
  if (anon && /^[A-Za-z0-9-]{8,64}$/.test(anon)) {
    return upsertUser(db, app.id, `a:${anon}`, true, null, null);
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
  return c.json({ error: "internal" }, 500);
});

app.get("/", (c) => c.text("youasked api"));
app.get("/admin", (c) => c.html(adminPage));
app.route("/v1/hooks", hooks);

// ---------------------------------------------------------------- bootstrap

app.post("/v1/apps", async (c) => {
  const token = c.req.header("authorization")?.replace(/^Bearer /, "");
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) fail(401, "unauthorized");
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
  });
});

admin.patch("/app", async (c) => {
  const body = await c.req.json<{ watermark?: boolean; requireSignature?: boolean; allowedOrigins?: string[] | null }>();
  const a = c.get("app");
  const origins =
    body.allowedOrigins === undefined
      ? a.allowed_origins
      : body.allowedOrigins === null
        ? null
        : JSON.stringify(body.allowedOrigins.filter((o) => typeof o === "string").slice(0, 20));
  await c.env.DB.prepare("UPDATE apps SET watermark = ?, require_signature = ?, allowed_origins = ? WHERE id = ?")
    .bind(
      body.watermark === undefined ? a.watermark : body.watermark ? 1 : 0,
      body.requireSignature === undefined ? a.require_signature : body.requireSignature ? 1 : 0,
      origins,
      a.id,
    )
    .run();
  return c.json({ ok: true });
});

admin.get("/requests", async (c) => {
  const status = c.req.query("status");
  const where = status && status !== "all" ? "AND r.status = ?" : "AND r.status != 'merged'";
  const stmt = c.env.DB.prepare(
    `SELECT r.*, u.email AS author_email, u.name AS author_name, u.is_anon AS author_anon
     FROM requests r LEFT JOIN users u ON u.id = r.author_id
     WHERE r.app_id = ? ${where}
     ORDER BY CASE r.status WHEN 'in_progress' THEN 0 WHEN 'planned' THEN 1 WHEN 'open' THEN 2 ELSE 3 END,
              r.vote_count DESC, r.created_at DESC
     LIMIT 500`,
  );
  const { results } = await (status && status !== "all"
    ? stmt.bind(c.get("app").id, status)
    : stmt.bind(c.get("app").id)
  ).all<RequestRow & { author_email: string | null; author_name: string | null; author_anon: number }>();
  return c.json({
    requests: results.map((r) => ({
      ...publicRequest(r, null),
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
  return c.json({ request: publicRequest(r, null), comments, voters });
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
  const { notified } = await setStatus(c.env.DB, r, status, shipNote);
  return c.json({ request: publicRequest(await loadRequest(c, r.id), null), notified: notified > 0, told: notified });
});

admin.post("/requests/:id/comments", async (c) => {
  const r = await loadRequest(c, c.req.param("id"));
  const body = cleanText((await c.req.json<{ body?: string }>()).body, 2000);
  if (!body) fail(400, "body_required");
  return c.json(await addTeamComment(c.env.DB, r, body));
});

admin.post("/requests/:id/merge", async (c) => {
  const from = await loadRequest(c, c.req.param("id"));
  const into = await loadRequest(c, (await c.req.json<{ into?: string }>()).into ?? "");
  if (from.id === into.id) fail(400, "same_request");
  await mergeRequests(c.env.DB, from, into);
  return c.json({ ok: true });
});

admin.delete("/requests/:id", async (c) => {
  const r = await loadRequest(c, c.req.param("id"));
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM votes WHERE request_id = ?").bind(r.id),
    c.env.DB.prepare("DELETE FROM comments WHERE request_id = ?").bind(r.id),
    c.env.DB.prepare("DELETE FROM notifications WHERE request_id = ?").bind(r.id),
    c.env.DB.prepare("DELETE FROM requests WHERE id = ?").bind(r.id),
  ]);
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
        chatTitle: cfg.chatTitle,
        botUsername: cfg.botUsername,
        link: cfg.linkCode ? `https://t.me/${cfg.botUsername}?start=${cfg.linkCode}` : null,
        groupLink: cfg.linkCode ? `https://t.me/${cfg.botUsername}?startgroup=${cfg.linkCode}` : null,
      };
    } else if (i.kind === "github") {
      out.github = { payloadUrl: `${origin}/v1/hooks/github/${i.id}`, secret: (i.config as GithubConfig).secret };
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

/** Connects a Telegram bot: points its webhook here and returns a link that ties a chat to this app. */
admin.put("/integrations/telegram", async (c) => {
  const { botToken } = await c.req.json<{ botToken?: string }>();
  if (!botToken || !/^\d+:[\w-]{30,}$/.test(botToken)) fail(400, "bad_bot_token");
  const me = await tg(c.env, botToken, "getMe", {});
  if (!me?.ok) fail(400, "bot_token_rejected");
  const appId = c.get("app").id;
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
  if (existing?.kind === "telegram") await tg(c.env, (existing.config as TelegramConfig).botToken, "deleteWebhook", {});
  await c.env.DB.prepare("DELETE FROM integrations WHERE app_id = ? AND kind = ?").bind(appId, kind).run();
  return c.json({ ok: true });
});

app.use("/v1/admin/*", cors({ origin: "*", allowHeaders: ["authorization", "content-type"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.route("/v1/admin", admin);

// ---------------------------------------------------------------- public (widget, publishable key)

const pub = new Hono<{ Bindings: Env; Variables: Vars }>();

pub.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowHeaders: ["content-type", "x-youasked-key", "x-youasked-user", "x-youasked-sig", "x-youasked-anon"],
    allowMethods: ["GET", "POST"],
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
  c.set("app", row);
  c.set("user", await resolveUser(c.env.DB, row, c.req.raw.headers));
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
  return c.json({ app: { name: a.name }, watermark: Boolean(a.watermark), identified: me ? !me.is_anon : false, unseen });
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
    `SELECT r.*, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
     WHERE r.app_id = ? AND r.status IN (${statuses.map(() => "?").join(",")})
     ORDER BY ${order} LIMIT 100`,
  )
    .bind(me?.id ?? "", a.id, ...statuses)
    .all<RequestRow & { voted: number }>();
  return c.json({ requests: results.map((r) => publicRequest(r, me)) });
});

async function findSimilar(db: D1Database, appId: string, q: string, meId: string, excludeId?: string) {
  const { results } = await db
    .prepare(
      `SELECT r.*, (v.user_id IS NOT NULL) AS voted FROM requests r
       LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
       WHERE r.app_id = ? AND r.status IN ('open','planned','in_progress','shipped')
       ORDER BY r.created_at DESC LIMIT 500`,
    )
    .bind(meId, appId)
    .all<RequestRow & { voted: number }>();
  return results
    .filter((r) => r.id !== excludeId)
    .map((r) => ({ r, score: Math.max(similarity(q, r.title), similarity(q, `${r.title} ${r.body}`) * 0.8) }))
    .filter((x) => x.score >= 0.34)
    .sort((x, y) => y.score - x.score || y.r.vote_count - x.r.vote_count);
}

pub.get("/requests/similar", async (c) => {
  const q = cleanText(c.req.query("q"), 200);
  if (q.length < 3) return c.json({ requests: [] });
  const me = c.get("user");
  const scored = await findSimilar(c.env.DB, c.get("app").id, q, me?.id ?? "");
  return c.json({ requests: scored.slice(0, 4).map((x) => publicRequest(x.r, me)) });
});

pub.get("/requests/:id", async (c) => {
  const me = c.get("user");
  const r = await c.env.DB.prepare(
    `SELECT r.*, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
     WHERE r.id = ? AND r.app_id = ?`,
  )
    .bind(me?.id ?? "", c.req.param("id"), c.get("app").id)
    .first<RequestRow & { voted: number }>();
  if (!r) fail(404, "not_found");
  if (r.status === "merged" && r.merged_into) return c.json({ redirect: r.merged_into });
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.is_team, c.created_at, c.user_id, u.name FROM comments c
     LEFT JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.created_at LIMIT 200`,
  )
    .bind(r.id)
    .all<{ id: string; body: string; is_team: number; created_at: number; user_id: string | null; name: string | null }>();
  return c.json({
    request: publicRequest(r, me),
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

pub.post("/requests", async (c) => {
  const me = requireUser(c);
  const a = c.get("app");
  const body = await c.req.json<{ title?: string; body?: string }>().catch(() => ({}) as { title?: string; body?: string });
  const title = cleanText(body.title, 120);
  const text = cleanText(body.body, 2000);
  if (title.length < 3) fail(400, "title_too_short");
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM requests WHERE author_id = ? AND created_at > ?")
    .bind(me.id, now() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 10) fail(429, "slow_down");
  const id = newId("req");
  const t = now();
  const insert = () =>
    c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO requests (id, app_id, author_id, number, title, body, status, vote_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, (SELECT COALESCE(MAX(number), 0) + 1 FROM requests WHERE app_id = ?2), ?4, ?5, 'open', 1, ?6, ?6)`,
      ).bind(id, a.id, me.id, title, text, t),
      c.env.DB.prepare("INSERT INTO votes (request_id, user_id, created_at) VALUES (?, ?, ?)").bind(id, me.id, t),
    ]);
  try {
    await insert();
  } catch {
    await insert(); // two requests raced for the same number; the retry takes the next one
  }
  const r = await loadRequest(c, id);
  c.executionCtx.waitUntil(
    (async () => {
      const similar = (await findSimilar(c.env.DB, a.id, title, "", r.id)).find((x) => x.score >= 0.5)?.r ?? null;
      await notifyTeam(c.env, a.id, { kind: "request", appName: a.name, request: r, author: me, similar });
    })(),
  );
  return c.json({ request: publicRequest({ ...r, voted: 1 }, me) }, 201);
});

pub.post("/requests/:id/vote", async (c) => {
  const me = requireUser(c);
  const r = await loadRequest(c, c.req.param("id"));
  if (r.status === "merged") fail(400, "merged");
  const existing = await c.env.DB.prepare("SELECT 1 AS x FROM votes WHERE request_id = ? AND user_id = ?").bind(r.id, me.id).first();
  const t = now();
  await c.env.DB.batch([
    existing
      ? c.env.DB.prepare("DELETE FROM votes WHERE request_id = ? AND user_id = ?").bind(r.id, me.id)
      : c.env.DB.prepare("INSERT OR IGNORE INTO votes (request_id, user_id, created_at) VALUES (?, ?, ?)").bind(r.id, me.id, t),
    c.env.DB.prepare("UPDATE requests SET vote_count = (SELECT COUNT(*) FROM votes WHERE request_id = ?1), updated_at = ?2 WHERE id = ?1").bind(
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
  const body = cleanText((await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string })).body, 1000);
  if (!body) fail(400, "body_required");
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM comments WHERE user_id = ? AND created_at > ?")
    .bind(me.id, now() - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 30) fail(429, "slow_down");
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

pub.get("/me/requests", async (c) => {
  const me = c.get("user");
  if (!me) return c.json({ requests: [] });
  const { results } = await c.env.DB.prepare(
    `SELECT r.*, (v.user_id IS NOT NULL) AS voted FROM requests r
     LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?1
     WHERE r.app_id = ?2 AND r.status != 'merged' AND (r.author_id = ?1 OR v.user_id IS NOT NULL)
     ORDER BY r.updated_at DESC LIMIT 100`,
  )
    .bind(me.id, c.get("app").id)
    .all<RequestRow & { voted: number }>();
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

app.route("/v1", pub);

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sendDigests(env));
  },
};
