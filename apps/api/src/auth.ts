// Developer sign-in: Google, GitHub and email links. Sessions are a random token in an HttpOnly
// cookie; only its SHA-256 is stored. Routes live under /v1/auth.
import { alert } from "./alert";
import { overLimit } from "./spam";
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { inviteEmail, sendEmail, signInEmail } from "./email";
import { cleanText, newId } from "./lib";
import { isLocalOrigin } from "./plans";
import type { Env } from "./types";

export type AccountRow = { id: string; email: string; name: string | null; avatar_url: string | null; created_at: number };
export type AuthVars = { account: AccountRow };
export type AuthCtx = Context<{ Bindings: Env; Variables: AuthVars }>;

export const SESSION_COOKIE = "ya_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const LOGIN_TOKEN_MS = 15 * 60 * 1000;
const OAUTH_COOKIE_SECONDS = 10 * 60;

export function fail(status: 400 | 401 | 402 | 403 | 404 | 409 | 429 | 502 | 503, error: string, extra: Record<string, unknown> = {}): never {
  throw new HTTPException(status, { res: Response.json({ error, ...extra }, { status }) });
}

// ---------------------------------------------------------------- small helpers

const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 32): string {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const dashboardBase = (env: Env) => (env.DASHBOARD_URL ?? "https://app.youasked.dev").replace(/\/$/, "");
export const apiBase = (c: Context<any>) => (c.env.API_URL ?? new URL(c.req.url).origin).replace(/\/$/, "");

/** A relative path on the dashboard, or "/". Blocks `//host`, backslashes and control characters. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 300) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f]/.test(next)) return "/";
  return next;
}

const isLocalHost = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/** The dashboard, plus localhost when this API itself is running locally. */
export function allowedOrigin(env: Env, origin: string | undefined, requestHost: string): string | null {
  if (!origin) return null;
  if (origin === new URL(dashboardBase(env)).origin) return origin;
  if (isLocalHost(requestHost) && isLocalOrigin(origin)) return origin;
  return null;
}

/** Cross-origin browsers only reach the signed-in routes from the dashboard. */
export function dashCors() {
  return [
    cors({
      origin: (origin, c) => allowedOrigin(c.env, origin, new URL(c.req.url).hostname),
      credentials: true,
      allowHeaders: ["content-type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 86400,
    }),
    // Cookies are SameSite=Lax, but sibling subdomains are same-site, so also check Origin on writes.
    async (c: Context<any>, next: () => Promise<void>) => {
      const origin = c.req.header("origin");
      if (origin && !["GET", "HEAD", "OPTIONS"].includes(c.req.method) && !allowedOrigin(c.env, origin, new URL(c.req.url).hostname)) {
        fail(403, "bad_origin");
      }
      await next();
    },
  ];
}

/** Where the session cookie lives follows the dashboard's host. wrangler dev rewrites the request
 * URL to the production route's host, so the request host can't tell local from production. */
function cookieScope(c: Context<any>) {
  const host = new URL(dashboardBase(c.env)).hostname;
  return { local: isLocalHost(host), shared: host.endsWith("youasked.dev") };
}

function cookieOptions(c: Context<any>) {
  const { local, shared } = cookieScope(c);
  return {
    httpOnly: true,
    secure: !local,
    sameSite: "Lax" as const,
    path: "/",
    ...(shared ? { domain: ".youasked.dev" } : {}),
  };
}

// ---------------------------------------------------------------- sessions

export async function startSession(c: Context<any>, accountId: string): Promise<void> {
  const token = randomToken(32);
  const t = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO sessions (id, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(
      await sha256Hex(token),
      accountId,
      t,
      t + SESSION_MS,
    ),
    // Tidy up while we're here.
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(t),
    c.env.DB.prepare("DELETE FROM login_tokens WHERE expires_at < ?").bind(t - 24 * 60 * 60 * 1000),
  ]);
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions(c), maxAge: SESSION_MS / 1000 });
}

export async function accountFromCookie(c: Context<any>): Promise<AccountRow | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  return (c.env as Env).DB.prepare(
    "SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ? AND s.expires_at > ?",
  )
    .bind(await sha256Hex(token), Date.now())
    .first<AccountRow>();
}

/** Middleware: 401 unless a valid session cookie is present. */
export async function requireAccount(c: AuthCtx, next: () => Promise<void>) {
  const account = await accountFromCookie(c);
  if (!account) fail(401, "unauthorized");
  c.set("account", account);
  await next();
}

// ---------------------------------------------------------------- accounts

type Identity = { provider: "google" | "github" | "email"; subject: string; email: string; name?: string | null; avatarUrl?: string | null };

/**
 * Finds or creates the account for a verified identity. Identities with the same verified email
 * land on one account. A brand-new account gets a workspace named after them. Pending invites
 * for the email are accepted.
 */
export async function signInIdentity(env: Env, id: Identity): Promise<string> {
  const email = id.email.trim().toLowerCase();
  const t = Date.now();
  const db = env.DB;

  let accountId = (
    await db.prepare("SELECT account_id FROM account_identities WHERE provider = ? AND subject = ?").bind(id.provider, id.subject).first<{ account_id: string }>()
  )?.account_id;

  if (!accountId) {
    accountId = (await db.prepare("SELECT id FROM accounts WHERE email = ?").bind(email).first<{ id: string }>())?.id;
  }

  if (!accountId) {
    accountId = newId("acc");
    const name = cleanText(id.name, 120) || null;
    const raw = (name ?? email.split("@")[0]).split(/\s+/)[0];
    const first = raw.charAt(0).toUpperCase() + raw.slice(1);
    try {
      await db.batch([
        db.prepare("INSERT INTO accounts (id, email, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?)").bind(accountId, email, name, id.avatarUrl ?? null, t),
        db.prepare("INSERT INTO account_identities (provider, subject, account_id, created_at) VALUES (?, ?, ?, ?)").bind(id.provider, id.subject, accountId, t),
        ...workspaceStatements(db, accountId, `${first}'s workspace`, t).statements,
      ]);
      await alert(env, `account:${email}`, `New account: ${email} (signed in with ${id.provider}).`, 60_000);
    } catch (err) {
      // A parallel first sign-in with the same email won the insert; use that account.
      const existing = await db.prepare("SELECT id FROM accounts WHERE email = ?").bind(email).first<{ id: string }>();
      if (!existing) throw err;
      accountId = existing.id;
    }
  }

  await db
    .prepare("INSERT INTO account_identities (provider, subject, account_id, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (provider, subject) DO NOTHING")
    .bind(id.provider, id.subject, accountId, t)
    .run();
  // Fill in a missing name or picture, never overwrite what's there.
  await db
    .prepare("UPDATE accounts SET name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?")
    .bind(cleanText(id.name, 120) || null, id.avatarUrl ?? null, accountId)
    .run();

  await acceptPendingInvites(db, accountId, email);
  return accountId;
}

/** The statements that create a workspace with the account as its owner. */
export function workspaceStatements(db: D1Database, accountId: string, name: string, t: number) {
  const id = newId("ws");
  return {
    id,
    statements: [
      db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").bind(id, cleanText(name, 80) || "My workspace", t),
      db.prepare("INSERT INTO members (workspace_id, account_id, role, created_at) VALUES (?, ?, 'owner', ?)").bind(id, accountId, t),
    ],
  };
}

export async function acceptPendingInvites(db: D1Database, accountId: string, email: string): Promise<void> {
  const t = Date.now();
  const { results } = await db
    .prepare("SELECT id, workspace_id, role FROM invites WHERE lower(email) = ? AND accepted_at IS NULL AND expires_at > ?")
    .bind(email.toLowerCase(), t)
    .all<{ id: string; workspace_id: string; role: string }>();
  if (!results.length) return;
  await db.batch(
    results.flatMap((inv) => [
      db.prepare("INSERT INTO members (workspace_id, account_id, role, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (workspace_id, account_id) DO NOTHING").bind(inv.workspace_id, accountId, inv.role, t),
      db.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").bind(t, inv.id),
    ]),
  );
}

/** Used by the dashboard routes to send an invite email. */
export async function sendInvite(env: Env, to: string, o: { workspace: string; inviter: string; inviteId: string }) {
  return sendEmail(env, inviteEmail(to, { workspace: o.workspace, inviter: o.inviter, url: `${dashboardBase(env)}/invite?id=${o.inviteId}` }));
}

// ---------------------------------------------------------------- routes

const auth = new Hono<{ Bindings: Env; Variables: AuthVars }>();
auth.use("*", ...dashCors());

const hasGoogle = (env: Env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
const hasGithub = (env: Env) => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);

// Email links are offered only once the domain can actually send (EMAIL_SIGN_IN is "off" until then).
auth.get("/providers", (c) => c.json({ google: hasGoogle(c.env), github: hasGithub(c.env), email: c.env.EMAIL_SIGN_IN !== "off" }));

const loginError = (c: Context<any>, error: string) => c.redirect(`${dashboardBase(c.env)}/login?error=${error}`, 302);

async function finish(c: Context<any>, identity: Identity, next: string) {
  const accountId = await signInIdentity(c.env, identity);
  await startSession(c, accountId);
  return c.redirect(`${dashboardBase(c.env)}${next}`, 302);
}

// ---- OAuth (shared shape)

type Provider = "google" | "github";

function oauthStart(provider: Provider) {
  return (c: Context<any>) => {
    const ready = provider === "google" ? hasGoogle(c.env) : hasGithub(c.env);
    if (!ready) return loginError(c, "provider_unavailable");
    const state = randomToken(16);
    const next = safeNext(c.req.query("next"));
    setCookie(c, `ya_oauth_${provider}`, `${state}.${encodeURIComponent(next)}`, {
      httpOnly: true,
      secure: !isLocalHost(new URL(c.req.url).hostname),
      sameSite: "Lax",
      path: "/v1/auth",
      maxAge: OAUTH_COOKIE_SECONDS,
    });
    const redirectUri = `${apiBase(c)}/v1/auth/${provider}/callback`;
    const params =
      provider === "google"
        ? new URLSearchParams({
            client_id: c.env.GOOGLE_CLIENT_ID!,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state,
            prompt: "select_account",
          })
        : new URLSearchParams({ client_id: c.env.GITHUB_CLIENT_ID!, redirect_uri: redirectUri, scope: "read:user user:email", state });
    const base = provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize";
    return c.redirect(`${base}?${params}`, 302);
  };
}

/** Checks `state` against the cookie. Returns the `next` path, or null if it doesn't match. */
function checkState(c: Context<any>, provider: Provider): string | null {
  const cookie = getCookie(c, `ya_oauth_${provider}`);
  deleteCookie(c, `ya_oauth_${provider}`, { path: "/v1/auth" });
  const state = c.req.query("state");
  if (!cookie || !state) return null;
  const dot = cookie.indexOf(".");
  const expected = dot < 0 ? cookie : cookie.slice(0, dot);
  const next = dot < 0 ? "" : cookie.slice(dot + 1);
  if (!expected || expected.length !== state.length || expected !== state) return null;
  try {
    return safeNext(decodeURIComponent(next));
  } catch {
    return "/";
  }
}

auth.get("/google/start", oauthStart("google"));
auth.get("/github/start", oauthStart("github"));

auth.get("/google/callback", async (c) => {
  if (!hasGoogle(c.env)) return loginError(c, "provider_unavailable");
  const next = checkState(c, "google");
  if (next === null) return loginError(c, "bad_state");
  const code = c.req.query("code");
  if (c.req.query("error") || !code) return loginError(c, "denied");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID!,
      client_secret: c.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${apiBase(c)}/v1/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  }).catch(() => null);
  const tokens = (await tokenRes?.json().catch(() => null)) as { id_token?: string } | null;
  if (!tokenRes?.ok || !tokens?.id_token) return loginError(c, "provider_error");
  // The ID token came straight from Google's token endpoint over TLS, so its claims can be trusted.
  let claims: { sub?: string; email?: string; email_verified?: boolean | string; name?: string; picture?: string };
  try {
    const payload = tokens.id_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4)), (ch) => ch.charCodeAt(0))));
  } catch {
    return loginError(c, "provider_error");
  }
  if (!claims.sub || !claims.email) return loginError(c, "provider_error");
  if (claims.email_verified !== true && claims.email_verified !== "true") return loginError(c, "email_unverified");
  return finish(c, { provider: "google", subject: claims.sub, email: claims.email, name: claims.name, avatarUrl: claims.picture }, next);
});

auth.get("/github/callback", async (c) => {
  if (!hasGithub(c.env)) return loginError(c, "provider_unavailable");
  const next = checkState(c, "github");
  if (next === null) return loginError(c, "bad_state");
  const code = c.req.query("code");
  if (c.req.query("error") || !code) return loginError(c, "denied");
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID!,
      client_secret: c.env.GITHUB_CLIENT_SECRET!,
      code,
      redirect_uri: `${apiBase(c)}/v1/auth/github/callback`,
    }),
  }).catch(() => null);
  const token = ((await tokenRes?.json().catch(() => null)) as { access_token?: string } | null)?.access_token;
  if (!tokenRes?.ok || !token) return loginError(c, "provider_error");
  const headers = { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "youasked" };
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }).catch(() => null),
    fetch("https://api.github.com/user/emails", { headers }).catch(() => null),
  ]);
  const user = (await userRes?.json().catch(() => null)) as { id?: number; login?: string; name?: string; avatar_url?: string } | null;
  const emails = ((await emailsRes?.json().catch(() => null)) ?? []) as { email: string; primary: boolean; verified: boolean }[];
  if (!userRes?.ok || !user?.id) return loginError(c, "provider_error");
  const best = Array.isArray(emails) ? (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified)) : undefined;
  if (!best) return loginError(c, "email_unverified");
  return finish(c, { provider: "github", subject: String(user.id), email: best.email, name: user.name || user.login, avatarUrl: user.avatar_url }, next);
});

// ---- email links

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

auth.post("/email", async (c) => {
  const body = await c.req.json<{ email?: string; next?: string }>().catch(() => ({}) as { email?: string; next?: string });
  const email = cleanText(body.email, 320).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, "bad_email");
  const t = Date.now();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created_at > ?")
    .bind(email, t - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 5) fail(429, "too_many_links");
  // Per IP and overall, so nobody can use the sign-in form to mail strangers from our domain.
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if ((await overLimit(c.env.DB, `signin-mail:${ip}`, 10)) || (await overLimit(c.env.DB, "signin-mail:all", 400))) {
    await alert(c.env, "signin-mail-limit", "The email sign-in limit was hit (per IP or overall). Could be a spike of real sign-ups, or someone hammering the form.", 60 * 60_000);
    fail(429, "too_many_links");
  }
  const token = randomToken(32);
  await c.env.DB.prepare("INSERT INTO login_tokens (id, email, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), email, t, t + LOGIN_TOKEN_MS)
    .run();
  const url = `${apiBase(c)}/v1/auth/email/verify?token=${token}&next=${encodeURIComponent(safeNext(body.next))}`;
  await sendEmail(c.env, signInEmail(email, url));
  // Same answer whether or not the address has an account, and whether or not mail went out.
  return c.json({ ok: true });
});

auth.get("/email/verify", async (c) => {
  const token = c.req.query("token") ?? "";
  if (!/^[0-9a-f]{64}$/.test(token)) return loginError(c, "link_invalid");
  const id = await sha256Hex(token);
  const row = await c.env.DB.prepare("SELECT email FROM login_tokens WHERE id = ? AND used_at IS NULL AND expires_at > ?")
    .bind(id, Date.now())
    .first<{ email: string }>();
  if (!row) return loginError(c, "link_expired");
  // Single use: only one request can flip used_at.
  const claimed = await c.env.DB.prepare("UPDATE login_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL").bind(Date.now(), id).run();
  if (!claimed.meta.changes) return loginError(c, "link_expired");
  return finish(c, { provider: "email", subject: row.email, email: row.email }, safeNext(c.req.query("next")));
});

auth.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(token)).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/", ...(cookieScope(c).shared ? { domain: ".youasked.dev" } : {}) });
  return c.json({ ok: true });
});

export default auth;
