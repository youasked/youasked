// Signed-in dashboard routes (/v1/dash/*): who I am, workspaces, apps, team, claiming, billing, and
// the session proxy that lets the dashboard call every admin route for an app it belongs to.
import { Hono } from "hono";
import {
  acceptPendingInvites,
  dashCors,
  fail,
  requireAccount,
  sendInvite,
  workspaceStatements,
  type AuthVars,
} from "./auth";
import { billing, foundingLeft } from "./billing";
import { cleanText, newId } from "./lib";
import { connections } from "./mcp-oauth";
import { PLANS, TEST_MODE_APPS, isLive, type WorkspaceRow } from "./plans";
import type { AppRow, Env } from "./types";

type Ctx = { Bindings: Env; Variables: AuthVars & { app: AppRow } };
type C = import("hono").Context<Ctx>;

const DAY = 24 * 60 * 60 * 1000;
const MAX_OWNED_WORKSPACES = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = "owner" | "admin" | "member";
const canManage = (role: Role) => role === "owner" || role === "admin";

/** The signed-in account's role in a workspace. 404 (not 403) for strangers, so ids don't leak. */
async function membership(c: C, wid: string): Promise<{ ws: WorkspaceRow; role: Role }> {
  const row = await c.env.DB.prepare(
    "SELECT w.*, m.role AS role FROM workspaces w JOIN members m ON m.workspace_id = w.id WHERE w.id = ? AND m.account_id = ?",
  )
    .bind(wid, c.get("account").id)
    .first<WorkspaceRow & { role: Role }>();
  if (!row) fail(404, "not_found");
  const { role, ...ws } = row;
  return { ws, role };
}

/** What a workspace may hold right now. null means unlimited. Unpaid workspaces are in test mode. */
function limitsFor(ws: WorkspaceRow) {
  if (isLive(ws)) {
    const p = PLANS[ws.plan!];
    return {
      plan: ws.plan,
      apps: Number.isFinite(p.apps) ? p.apps : null,
      members: p.members,
      listeningApps: p.listeningApps,
      removeBranding: p.removeBranding,
      linear: p.linear,
      customDomain: p.customDomain,
    };
  }
  return { plan: null, apps: TEST_MODE_APPS, members: 1, listeningApps: 0, removeBranding: false, linear: false, customDomain: false };
}

const maskSecret = (key: string) => `ya_sec_…${key.slice(-4)}`;

const appView = (a: Pick<AppRow, "id" | "name" | "public_key" | "always_live"> & { created_at?: number }, live: boolean) => ({
  id: a.id,
  name: a.name,
  publicKey: a.public_key,
  live: live || Boolean(a.always_live),
  createdAt: a.created_at,
});

async function usage(db: D1Database, wid: string) {
  const [apps, members, invites] = await db.batch<{ n: number }>([
    db.prepare("SELECT COUNT(*) AS n FROM apps WHERE workspace_id = ?").bind(wid),
    db.prepare("SELECT COUNT(*) AS n FROM members WHERE workspace_id = ?").bind(wid),
    db.prepare("SELECT COUNT(*) AS n FROM invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ?").bind(wid, Date.now()),
  ]);
  return { apps: apps.results[0].n, members: members.results[0].n, pendingInvites: invites.results[0].n };
}

const upgrade = (message: string): never => fail(402, message, { upgrade: true });

/** Room for one more app? Paid plans use their limit, unpaid workspaces the test-mode allowance. */
async function checkAppRoom(db: D1Database, ws: WorkspaceRow) {
  const limit = limitsFor(ws).apps;
  if (limit === null) return;
  const { apps } = await usage(db, ws.id);
  if (apps >= limit) upgrade(isLive(ws) ? "app_limit_reached" : "app_limit_reached_test_mode");
}

// ---------------------------------------------------------------- the router

/**
 * `dispatch` runs a request through the whole Worker (so the admin router, and any routes other
 * streams add to it, answer exactly as they do for a secret key). It's injected to avoid importing index.ts.
 */
export function createDash(dispatch: (req: Request, env: Env, ctx: any) => Response | Promise<Response>) {
  const dash = new Hono<Ctx>();
  dash.use("*", ...dashCors());
  dash.use("*", requireAccount);

  dash.get("/me", async (c) => {
    const a = c.get("account");
    const { results } = await c.env.DB.prepare(
      "SELECT w.id, w.name, w.plan, w.subscription_status, m.role FROM workspaces w JOIN members m ON m.workspace_id = w.id WHERE m.account_id = ? ORDER BY m.created_at",
    )
      .bind(a.id)
      .all<{ id: string; name: string; plan: WorkspaceRow["plan"]; subscription_status: string | null; role: Role }>();
    return c.json({
      account: { id: a.id, email: a.email, name: a.name, avatarUrl: a.avatar_url },
      workspaces: results.map((w) => ({ id: w.id, name: w.name, role: w.role, plan: w.plan, live: isLive(w) })),
    });
  });

  dash.post("/workspaces", async (c) => {
    const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
    const name = cleanText(body.name, 80).replace(/\n/g, " ");
    if (name.length < 2) fail(400, "name_too_short");
    const owned = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE account_id = ? AND role = 'owner'").bind(c.get("account").id).first<{ n: number }>();
    if ((owned?.n ?? 0) >= MAX_OWNED_WORKSPACES) fail(429, "too_many_workspaces");
    const made = workspaceStatements(c.env.DB, c.get("account").id, name, Date.now());
    await c.env.DB.batch(made.statements);
    return c.json({ workspace: { id: made.id, name, role: "owner", plan: null, live: false } }, 201);
  });

  dash.get("/workspaces/:wid", async (c) => {
    const { ws } = await membership(c, c.req.param("wid"));
    const live = isLive(ws);
    const [members, invites, apps, used, left] = await Promise.all([
      c.env.DB.prepare(
        "SELECT a.id, a.email, a.name, m.role FROM members m JOIN accounts a ON a.id = m.account_id WHERE m.workspace_id = ? ORDER BY m.created_at",
      )
        .bind(ws.id)
        .all<{ id: string; email: string; name: string | null; role: Role }>(),
      c.env.DB.prepare("SELECT id, email, role, created_at, expires_at FROM invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ? ORDER BY created_at")
        .bind(ws.id, Date.now())
        .all<{ id: string; email: string; role: Role; created_at: number; expires_at: number }>(),
      c.env.DB.prepare("SELECT id, name, public_key, secret_key, always_live, created_at FROM apps WHERE workspace_id = ? ORDER BY created_at")
        .bind(ws.id)
        .all<AppRow & { created_at: number }>(),
      usage(c.env.DB, ws.id),
      foundingLeft(c.env.DB),
    ]);
    return c.json({
      workspace: {
        id: ws.id,
        name: ws.name,
        plan: ws.plan,
        interval: ws.billing_interval,
        status: ws.subscription_status,
        live,
        founding: Boolean(ws.founding),
        currentPeriodEnd: ws.current_period_end,
      },
      limits: limitsFor(ws),
      usage: { apps: used.apps, members: used.members },
      members: members.results.map((m) => ({ accountId: m.id, email: m.email, name: m.name, role: m.role })),
      invites: invites.results.map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at, expiresAt: i.expires_at })),
      apps: apps.results.map((a) => ({ ...appView(a, live), secretKeyHint: maskSecret(a.secret_key) })),
      foundingLeft: left,
    });
  });

  dash.patch("/workspaces/:wid", async (c) => {
    const { ws, role } = await membership(c, c.req.param("wid"));
    if (!canManage(role)) fail(403, "forbidden");
    const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
    const name = cleanText(body.name, 80).replace(/\n/g, " ");
    if (name.length < 2) fail(400, "name_too_short");
    await c.env.DB.prepare("UPDATE workspaces SET name = ? WHERE id = ?").bind(name, ws.id).run();
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------ apps

  dash.post("/workspaces/:wid/apps", async (c) => {
    const { ws, role } = await membership(c, c.req.param("wid"));
    if (!canManage(role)) fail(403, "forbidden");
    const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
    const name = cleanText(body.name, 80).replace(/\n/g, " ");
    if (name.length < 2 || !/[\p{L}\p{N}]/u.test(name)) fail(400, "name_too_short");
    if (/https?:\/\//i.test(name)) fail(400, "bad_name");
    await checkAppRoom(c.env.DB, ws);
    const app = { id: newId("app"), publicKey: newId("ya_pub", 24), secretKey: newId("ya_sec", 32) };
    await c.env.DB.prepare("INSERT INTO apps (id, name, public_key, secret_key, workspace_id, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(app.id, name, app.publicKey, app.secretKey, ws.id, Date.now())
      .run();
    // The only time the full secret key is returned.
    return c.json({ app: { id: app.id, name, publicKey: app.publicKey, secretKey: app.secretKey, live: isLive(ws) } }, 201);
  });

  /** The app, if the signed-in account belongs to its workspace. */
  async function appFor(c: C, appId: string) {
    const app = await c.env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(appId).first<AppRow>();
    if (!app?.workspace_id) fail(404, "not_found");
    const { role } = await membership(c, app.workspace_id);
    return { app, role };
  }

  dash.post("/apps/:appId/rotate-secret", async (c) => {
    const { app, role } = await appFor(c, c.req.param("appId"));
    if (!canManage(role)) fail(403, "forbidden");
    const secretKey = newId("ya_sec", 32);
    await c.env.DB.prepare("UPDATE apps SET secret_key = ? WHERE id = ?").bind(secretKey, app.id).run();
    return c.json({ secretKey });
  });

  dash.post("/claim", async (c) => {
    const body = await c.req.json<{ claimToken?: string; secretKey?: string; workspaceId?: string }>().catch(() => ({}) as Record<string, string>);
    if (!body.workspaceId || (!body.claimToken && !body.secretKey)) fail(400, "bad_request");
    const { ws, role } = await membership(c, body.workspaceId);
    if (!canManage(role)) fail(403, "forbidden");
    const app = body.claimToken
      ? await c.env.DB.prepare("SELECT * FROM apps WHERE claim_token = ?").bind(String(body.claimToken)).first<AppRow>()
      : await c.env.DB.prepare("SELECT * FROM apps WHERE secret_key = ?").bind(String(body.secretKey)).first<AppRow>();
    if (!app) fail(404, "not_found");
    if (app.workspace_id) fail(409, "already_claimed");
    await checkAppRoom(c.env.DB, ws);
    // The WHERE guard makes a double claim (two tabs) a no-op for the second one.
    const moved = await c.env.DB.prepare("UPDATE apps SET workspace_id = ?, claim_token = NULL WHERE id = ? AND workspace_id IS NULL").bind(ws.id, app.id).run();
    if (!moved.meta.changes) fail(409, "already_claimed");
    return c.json({ app: appView(app, isLive(ws)) });
  });

  // ------------------------------------------------------------ team

  dash.post("/workspaces/:wid/invites", async (c) => {
    const { ws, role } = await membership(c, c.req.param("wid"));
    if (!canManage(role)) fail(403, "forbidden");
    const body = await c.req.json<{ email?: string; role?: string }>().catch(() => ({}) as { email?: string; role?: string });
    const email = cleanText(body.email, 320).toLowerCase();
    if (!EMAIL_RE.test(email)) fail(400, "bad_email");
    const inviteRole = body.role === "admin" ? "admin" : "member";

    const already = await c.env.DB.prepare("SELECT 1 AS x FROM members m JOIN accounts a ON a.id = m.account_id WHERE m.workspace_id = ? AND a.email = ?").bind(ws.id, email).first();
    if (already) fail(409, "already_member");
    const used = await usage(c.env.DB, ws.id);
    const limit = limitsFor(ws).members;
    if (used.members + used.pendingInvites >= limit) upgrade(isLive(ws) ? "member_limit_reached" : "member_limit_reached_test_mode");

    const t = Date.now();
    const id = newId("inv");
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM invites WHERE workspace_id = ? AND lower(email) = ? AND accepted_at IS NULL").bind(ws.id, email),
      c.env.DB.prepare("INSERT INTO invites (id, workspace_id, email, role, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
        id,
        ws.id,
        email,
        inviteRole,
        c.get("account").id,
        t,
        t + 14 * DAY,
      ),
    ]);
    const me = c.get("account");
    await sendInvite(c.env, email, { workspace: ws.name, inviter: me.name ?? me.email, inviteId: id });
    return c.json({ invite: { id, email, role: inviteRole, expiresAt: t + 14 * DAY } }, 201);
  });

  dash.delete("/workspaces/:wid/invites/:id", async (c) => {
    const { ws, role } = await membership(c, c.req.param("wid"));
    if (!canManage(role)) fail(403, "forbidden");
    await c.env.DB.prepare("DELETE FROM invites WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL").bind(c.req.param("id"), ws.id).run();
    return c.json({ ok: true });
  });

  /** What an invite is for, so the page can say "Join Acme". Only the invited address can see it. */
  dash.get("/invites/:id", async (c) => {
    const inv = await c.env.DB.prepare(
      "SELECT i.id, i.email, i.role, i.accepted_at, i.expires_at, w.name AS workspace FROM invites i JOIN workspaces w ON w.id = i.workspace_id WHERE i.id = ?",
    )
      .bind(c.req.param("id"))
      .first<{ id: string; email: string; role: Role; accepted_at: number | null; expires_at: number; workspace: string }>();
    if (!inv || inv.email.toLowerCase() !== c.get("account").email.toLowerCase()) fail(404, "not_found");
    return c.json({ invite: { id: inv.id, workspace: inv.workspace, role: inv.role, accepted: Boolean(inv.accepted_at), expired: inv.expires_at < Date.now() } });
  });

  dash.post("/invites/:id/accept", async (c) => {
    const me = c.get("account");
    const inv = await c.env.DB.prepare("SELECT * FROM invites WHERE id = ? AND accepted_at IS NULL AND expires_at > ?")
      .bind(c.req.param("id"), Date.now())
      .first<{ id: string; workspace_id: string; email: string; role: Role }>();
    if (!inv || inv.email.toLowerCase() !== me.email.toLowerCase()) fail(404, "not_found");
    await acceptPendingInvites(c.env.DB, me.id, me.email);
    return c.json({ workspaceId: inv.workspace_id });
  });

  dash.delete("/workspaces/:wid/members/:accountId", async (c) => {
    const { ws, role } = await membership(c, c.req.param("wid"));
    const target = c.req.param("accountId");
    const leaving = target === c.get("account").id;
    if (!leaving && !canManage(role)) fail(403, "forbidden");
    const row = await c.env.DB.prepare("SELECT role FROM members WHERE workspace_id = ? AND account_id = ?").bind(ws.id, target).first<{ role: Role }>();
    if (!row) fail(404, "not_found");
    if (row.role === "owner") {
      // Owners can only be removed by themselves, and the last one can't leave.
      if (!leaving) fail(403, "forbidden");
      const owners = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE workspace_id = ? AND role = 'owner'").bind(ws.id).first<{ n: number }>();
      if ((owners?.n ?? 0) < 2) fail(409, "last_owner");
    }
    await c.env.DB.prepare("DELETE FROM members WHERE workspace_id = ? AND account_id = ?").bind(ws.id, target).run();
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------ billing
  dash.route("/", billing);

  // ------------------------------------------------------------ AI assistant connections (MCP)
  dash.route("/", connections);

  // ------------------------------------------------------------ session proxy

  // Registered last, so the app-level routes above (rotate-secret) win. Everything else under
  // /apps/:appId/ is handed to the admin router with the app's own secret key, which is never
  // sent to the browser. Feature streams add admin routes and they appear here with no extra work.
  // Members triage (reply, set status, merge, approve, build). Settings, integrations (which hold
  // tokens and webhook secrets), imports, exports and deleting requests are for owners and admins.
  const ADMIN_ONLY: [RegExp, string[]][] = [
    [/^\/app\/?$/, ["PATCH", "PUT", "POST", "DELETE"]],
    [/^\/integrations(\/|$)/, ["GET", "PUT", "POST", "PATCH", "DELETE"]],
    [/^\/(import|export|embeddings)(\/|$)/, ["GET", "POST", "PUT"]],
    [/^\/requests\/[^/]+\/?$/, ["DELETE"]],
    // Handing off starts a paid agent run in the owner's repo.
    [/^\/requests\/[^/]+\/handoff$/, ["POST"]],
  ];

  dash.all("/apps/:appId/*", async (c) => {
    const { app, role } = await appFor(c, c.req.param("appId"));
    c.set("app", app);
    const url = new URL(c.req.url);
    const rest = url.pathname.slice(`/v1/dash/apps/${app.id}`.length);
    if (!canManage(role) && ADMIN_ONLY.some(([re, methods]) => re.test(rest) && methods.includes(c.req.method))) fail(403, "forbidden");
    const headers = new Headers(c.req.raw.headers);
    for (const h of ["cookie", "origin", "referer", "authorization"]) headers.delete(h);
    headers.set("authorization", `Bearer ${app.secret_key}`);
    const hasBody = !["GET", "HEAD"].includes(c.req.method);
    const forwarded = new Request(`${url.origin}/v1/admin${rest}${url.search}`, {
      method: c.req.method,
      headers,
      body: hasBody ? c.req.raw.body : undefined,
    });
    const res = await dispatch(forwarded, c.env, c.executionCtx);
    // Fresh headers: the admin router's own CORS ("*") must not leak into this credentialed response.
    const out = new Response(res.body, res);
    for (const h of [...out.headers.keys()]) if (h.startsWith("access-control-")) out.headers.delete(h);
    return out;
  });

  return dash;
}
