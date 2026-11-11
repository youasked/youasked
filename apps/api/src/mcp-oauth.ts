// OAuth 2.1 authorization server for the hosted MCP connector (https://api.youasked.dev/mcp).
// Authorization code + PKCE (S256 only), dynamic client registration, rotating refresh tokens.
// Codes and tokens are random values that exist in the database only as SHA-256 hashes.
//
// Sign-in and consent reuse the dashboard: /oauth/authorize parks the request in D1 and sends the
// browser to the dashboard's /connect page, which signs the person in (same session as everywhere
// else) and shows the consent screen. The dashboard then calls the /v1/dash/oauth routes below.
import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { apiBase, dashboardBase, fail, requireAccount, sha256Hex, type AuthVars } from "./auth";
import { cleanText, newId } from "./lib";
import { overLimit } from "./spam";
import type { Env } from "./types";

export const SCOPE = "mcp";
const ACCESS_MS = 60 * 60 * 1000;
const REFRESH_MS = 60 * 24 * 60 * 60 * 1000;
const CODE_MS = 5 * 60 * 1000;
const REQUEST_MS = 15 * 60 * 1000;
const REFRESH_GRACE_MS = 10 * 1000;

export const mcpResource = (c: Context<any>) => `${apiBase(c)}/mcp`;

function randomHex(bytes = 32): string {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- redirect URIs

const isLoopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
const BLOCKED_SCHEMES = ["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:"];

/** https anywhere, http only on loopback, or an app's own scheme (cursor://, vscode://). */
export function validRedirectUri(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 2000) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") return isLoopback(url.hostname);
  return !BLOCKED_SCHEMES.includes(url.protocol);
}

/** Exact match, except that a loopback address may use any port (RFC 8252). */
function redirectMatches(registered: string[], given: string): boolean {
  if (registered.includes(given)) return true;
  let g: URL;
  try {
    g = new URL(given);
  } catch {
    return false;
  }
  if (g.protocol !== "http:" || !isLoopback(g.hostname)) return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return u.protocol === g.protocol && u.hostname === g.hostname && u.pathname === g.pathname && u.search === g.search;
    } catch {
      return false;
    }
  });
}

type ClientRow = { id: string; name: string; redirect_uris: string; client_uri: string | null; created_at: number };
const clientRedirects = (c: ClientRow): string[] => {
  try {
    return JSON.parse(c.redirect_uris) as string[];
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------- public endpoints

export const oauth = new Hono<{ Bindings: Env }>();

// Metadata, registration, token and revoke carry no cookies, so any origin may call them
// (browser based clients such as MCP Inspector need this).
const open = cors({ origin: "*", allowHeaders: ["content-type", "authorization", "mcp-protocol-version"], allowMethods: ["GET", "POST", "OPTIONS"], maxAge: 86400 });
for (const p of ["/.well-known/*", "/oauth/register", "/oauth/token", "/oauth/revoke"]) oauth.use(p, open);

const noStore = (c: Context<any>) => {
  c.header("cache-control", "no-store");
  c.header("pragma", "no-cache");
};

function authServerMetadata(c: Context<any>) {
  const base = apiBase(c);
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [SCOPE],
    service_documentation: "https://youasked.dev/mcp",
  });
}

function resourceMetadata(c: Context<any>) {
  const base = apiBase(c);
  return c.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ["header"],
    scopes_supported: [SCOPE],
    resource_name: "YouAsked",
    resource_documentation: "https://youasked.dev/mcp",
  });
}

oauth.get("/.well-known/oauth-authorization-server", authServerMetadata);
oauth.get("/.well-known/oauth-authorization-server/mcp", authServerMetadata);
oauth.get("/.well-known/oauth-protected-resource", resourceMetadata);
oauth.get("/.well-known/oauth-protected-resource/mcp", resourceMetadata);

// ---- dynamic client registration (RFC 7591)

oauth.post("/oauth/register", async (c) => {
  noStore(c);
  const err = (error: string, description: string) => c.json({ error, error_description: description }, 400);
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (await overLimit(c.env.DB, `oauth-register:${ip}`, 60)) return c.json({ error: "slow_down", error_description: "Too many registrations. Try again later." }, 429);
  const body = await c.req.json<Record<string, unknown>>().catch(() => null);
  if (!body || typeof body !== "object") return err("invalid_client_metadata", "Send a JSON body.");
  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 10 || !uris.every(validRedirectUri)) {
    return err("invalid_redirect_uri", "redirect_uris must be 1 to 10 https URLs, localhost URLs or app scheme URLs, without fragments.");
  }
  const name = cleanText(body.client_name, 100).replace(/\n/g, " ") || "MCP client";
  const clientUri = typeof body.client_uri === "string" && /^https:\/\//.test(body.client_uri) ? body.client_uri.slice(0, 300) : null;
  const id = newId("mcpc", 24);
  const t = Date.now();
  await c.env.DB.prepare("INSERT INTO oauth_clients (id, name, redirect_uris, client_uri, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, name, JSON.stringify(uris), clientUri, t)
    .run();
  return c.json(
    {
      client_id: id,
      client_id_issued_at: Math.floor(t / 1000),
      client_name: name,
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: SCOPE,
    },
    201,
  );
});

// ---- authorization endpoint

const page = (title: string, message: string, status: 400 | 404 = 400) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1 style="font-size:1.3rem">${title}</h1><p>${message}</p></body>`,
    { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

oauth.get("/oauth/authorize", async (c) => {
  const q = (k: string) => c.req.query(k) ?? "";
  const client = await c.env.DB.prepare("SELECT * FROM oauth_clients WHERE id = ?").bind(q("client_id")).first<ClientRow>();
  // Until the client and redirect address are known, errors are shown here and never redirected.
  if (!client) return page("Unknown app", "This connection request names an app we don't know. Go back and start again from the app.");
  const redirectUri = q("redirect_uri");
  if (!redirectMatches(clientRedirects(client), redirectUri)) {
    return page("Wrong redirect address", "The address this app asked us to return to isn't one it registered. Go back and start again from the app.");
  }
  const state = c.req.query("state");
  const back = (error: string, description: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    if (state) u.searchParams.set("state", state);
    return c.redirect(u.toString(), 302);
  };
  if (q("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  const challenge = q("code_challenge");
  if (q("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) {
    return back("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const resource = mcpResource(c);
  const asked = c.req.query("resource");
  if (asked && asked.replace(/\/$/, "") !== resource && asked.replace(/\/$/, "") !== apiBase(c)) return back("invalid_target", `resource must be ${resource}.`);

  const t = Date.now();
  const id = newId("oar", 24);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM oauth_requests WHERE expires_at < ?").bind(t),
    c.env.DB.prepare("INSERT INTO oauth_requests (id, client_id, redirect_uri, state, code_challenge, resource, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(
      id,
      client.id,
      redirectUri,
      state ? state.slice(0, 2000) : null,
      challenge,
      resource,
      t,
      t + REQUEST_MS,
    ),
  ]);
  return c.redirect(`${dashboardBase(c.env)}/connect?req=${id}`, 302);
});

// ---- token endpoint

type TokenError = { error: string; description: string; status?: 400 | 401 };
const tokenFail = (e: TokenError): never => {
  throw new HTTPException(e.status ?? 400, {
    res: Response.json({ error: e.error, error_description: e.description }, { status: e.status ?? 400, headers: { "cache-control": "no-store", pragma: "no-cache" } }),
  });
};

async function readForm(c: Context<any>): Promise<Record<string, string>> {
  const type = c.req.header("content-type") ?? "";
  if (type.includes("application/json")) {
    const j = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    return Object.fromEntries(Object.entries(j).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  }
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  return Object.fromEntries(Object.entries(form).filter(([, v]) => typeof v === "string")) as Record<string, string>;
}

async function revokeGrant(db: D1Database, grantId: string) {
  await db.batch([
    db.prepare("DELETE FROM oauth_tokens WHERE grant_id = ?").bind(grantId),
    db.prepare("DELETE FROM oauth_codes WHERE grant_id = ?").bind(grantId),
    db.prepare("DELETE FROM oauth_grants WHERE id = ?").bind(grantId),
  ]);
}

async function issueTokens(db: D1Database, grantId: string, scope = SCOPE) {
  const t = Date.now();
  const access = `yamcp_at_${randomHex(32)}`;
  const refresh = `yamcp_rt_${randomHex(32)}`;
  await db.batch([
    db.prepare("INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at, created_at) VALUES (?, 'access', ?, ?, ?)").bind(await sha256Hex(access), grantId, t + ACCESS_MS, t),
    db.prepare("INSERT INTO oauth_tokens (token_hash, kind, grant_id, expires_at, created_at) VALUES (?, 'refresh', ?, ?, ?)").bind(await sha256Hex(refresh), grantId, t + REFRESH_MS, t),
    db.prepare("DELETE FROM oauth_tokens WHERE expires_at < ?").bind(t - 24 * 60 * 60 * 1000),
    db.prepare("DELETE FROM oauth_codes WHERE expires_at < ?").bind(t - 24 * 60 * 60 * 1000),
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_MS / 1000, refresh_token: refresh, scope };
}

const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

oauth.post("/oauth/token", async (c) => {
  noStore(c);
  const p = await readForm(c);
  const db = c.env.DB;
  if (p.grant_type === "authorization_code") {
    if (!p.code || !p.code_verifier || !p.client_id || !p.redirect_uri) tokenFail({ error: "invalid_request", description: "code, code_verifier, client_id and redirect_uri are required." });
    if (!/^[A-Za-z0-9._~-]{43,128}$/.test(p.code_verifier)) tokenFail({ error: "invalid_grant", description: "Bad code_verifier." });
    const row = await db
      .prepare("SELECT * FROM oauth_codes WHERE code_hash = ?")
      .bind(await sha256Hex(p.code))
      .first<{ code_hash: string; grant_id: string; client_id: string; redirect_uri: string; code_challenge: string; expires_at: number; used_at: number | null }>();
    if (!row) return tokenFail({ error: "invalid_grant", description: "That code is not valid." });
    if (row.used_at) {
      // A code coming back twice means it leaked. Everything it produced stops working.
      await revokeGrant(db, row.grant_id);
      return tokenFail({ error: "invalid_grant", description: "That code was already used." });
    }
    if (row.expires_at < Date.now()) return tokenFail({ error: "invalid_grant", description: "That code expired. Start the connection again." });
    if (row.client_id !== p.client_id || row.redirect_uri !== p.redirect_uri) return tokenFail({ error: "invalid_grant", description: "client_id or redirect_uri does not match." });
    if (p.resource && p.resource.replace(/\/$/, "") !== mcpResource(c) && p.resource.replace(/\/$/, "") !== apiBase(c)) return tokenFail({ error: "invalid_target", description: `resource must be ${mcpResource(c)}.` });
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p.code_verifier)));
    if (challenge !== row.code_challenge) return tokenFail({ error: "invalid_grant", description: "PKCE verification failed." });
    const claimed = await db.prepare("UPDATE oauth_codes SET used_at = ? WHERE code_hash = ? AND used_at IS NULL").bind(Date.now(), row.code_hash).run();
    if (!claimed.meta.changes) return tokenFail({ error: "invalid_grant", description: "That code was already used." });
    return c.json(await issueTokens(db, row.grant_id));
  }

  if (p.grant_type === "refresh_token") {
    if (!p.refresh_token) tokenFail({ error: "invalid_request", description: "refresh_token is required." });
    const hash = await sha256Hex(p.refresh_token);
    const row = await db
      .prepare(
        `SELECT t.token_hash, t.grant_id, t.expires_at, t.used_at, g.client_id FROM oauth_tokens t
         JOIN oauth_grants g ON g.id = t.grant_id WHERE t.token_hash = ? AND t.kind = 'refresh'`,
      )
      .bind(hash)
      .first<{ token_hash: string; grant_id: string; expires_at: number; used_at: number | null; client_id: string }>();
    if (!row) return tokenFail({ error: "invalid_grant", description: "That refresh token is not valid." });
    if (p.client_id && p.client_id !== row.client_id) return tokenFail({ error: "invalid_grant", description: "client_id does not match." });
    if (row.expires_at < Date.now()) return tokenFail({ error: "invalid_grant", description: "That refresh token expired. Connect again." });
    const t = Date.now();
    if (row.used_at) {
      // Rotated already. A retry within seconds is a flaky network; later is a stolen token.
      if (t - row.used_at > REFRESH_GRACE_MS) await revokeGrant(db, row.grant_id);
      return tokenFail({ error: "invalid_grant", description: "That refresh token was already used." });
    }
    const claimed = await db.prepare("UPDATE oauth_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL").bind(t, hash).run();
    if (!claimed.meta.changes) return tokenFail({ error: "invalid_grant", description: "That refresh token was already used." });
    return c.json(await issueTokens(db, row.grant_id));
  }

  return tokenFail({ error: "unsupported_grant_type", description: "Use authorization_code or refresh_token." });
});

// ---- revocation (RFC 7009): either kind of token ends the whole connection

oauth.post("/oauth/revoke", async (c) => {
  noStore(c);
  const { token } = await readForm(c);
  if (token) {
    const row = await c.env.DB.prepare("SELECT grant_id FROM oauth_tokens WHERE token_hash = ?").bind(await sha256Hex(token)).first<{ grant_id: string }>();
    if (row) await revokeGrant(c.env.DB, row.grant_id);
  }
  return c.body(null, 200);
});

// ---------------------------------------------------------------- used by /mcp

export type McpPrincipal = { grantId: string; accountId: string; clientId: string; clientName: string };

/** The connection behind an access token, or null. Checks expiry, revocation and the audience. */
export async function authenticateMcp(c: Context<any>, bearer: string | undefined): Promise<McpPrincipal | null> {
  if (!bearer || !/^yamcp_at_[0-9a-f]{64}$/.test(bearer)) return null;
  const t = Date.now();
  const row = await (c.env as Env).DB.prepare(
    `SELECT g.id AS grant_id, g.account_id, g.client_id, g.resource, g.last_used_at, cl.name AS client_name
     FROM oauth_tokens t JOIN oauth_grants g ON g.id = t.grant_id
     JOIN accounts a ON a.id = g.account_id
     LEFT JOIN oauth_clients cl ON cl.id = g.client_id
     WHERE t.token_hash = ? AND t.kind = 'access' AND t.expires_at > ?`,
  )
    .bind(await sha256Hex(bearer), t)
    .first<{ grant_id: string; account_id: string; client_id: string; resource: string; last_used_at: number | null; client_name: string | null }>();
  if (!row || row.resource !== mcpResource(c)) return null;
  if (!row.last_used_at || t - row.last_used_at > 60_000) {
    c.executionCtx.waitUntil((c.env as Env).DB.prepare("UPDATE oauth_grants SET last_used_at = ? WHERE id = ?").bind(t, row.grant_id).run().then(() => undefined));
  }
  return { grantId: row.grant_id, accountId: row.account_id, clientId: row.client_id, clientName: row.client_name ?? "An AI assistant" };
}

// ---------------------------------------------------------------- dashboard routes (/v1/dash)

type DashCtx = { Bindings: Env; Variables: AuthVars };

/** Mounted inside the dashboard router, which already requires a signed-in account and checks Origin on writes. */
export const connections = new Hono<DashCtx>();
connections.use("/oauth/*", requireAccount);
connections.use("/connections", requireAccount);
connections.use("/connections/*", requireAccount);

type PendingRow = { id: string; client_id: string; redirect_uri: string; state: string | null; code_challenge: string; resource: string; expires_at: number; client_name: string | null };

const loadPending = (db: D1Database, id: string) =>
  db
    .prepare(
      `SELECT r.*, c.name AS client_name FROM oauth_requests r LEFT JOIN oauth_clients c ON c.id = r.client_id WHERE r.id = ? AND r.expires_at > ?`,
    )
    .bind(id, Date.now())
    .first<PendingRow>();

connections.get("/oauth/requests/:id", async (c) => {
  const row = await loadPending(c.env.DB, c.req.param("id"));
  if (!row) fail(404, "not_found");
  const { results: apps } = await c.env.DB.prepare(
    `SELECT a.id, a.name FROM apps a JOIN members m ON m.workspace_id = a.workspace_id WHERE m.account_id = ? ORDER BY a.created_at`,
  )
    .bind(c.get("account").id)
    .all<{ id: string; name: string }>();
  let host = "";
  try {
    const u = new URL(row.redirect_uri);
    host = u.protocol === "https:" ? u.host : u.protocol === "http:" ? "this computer" : u.protocol.replace(":", "");
  } catch {
    /* shown without a host */
  }
  return c.json({ client: { name: row.client_name ?? "An AI assistant", returnsTo: host }, apps, account: { email: c.get("account").email } });
});

connections.post("/oauth/requests/:id/decision", async (c) => {
  const body = await c.req.json<{ allow?: boolean }>().catch(() => ({}) as { allow?: boolean });
  const id = c.req.param("id");
  const row = await loadPending(c.env.DB, id);
  if (!row) fail(404, "not_found");
  // Single use: only one decision can consume the request.
  const gone = await c.env.DB.prepare("DELETE FROM oauth_requests WHERE id = ?").bind(id).run();
  if (!gone.meta.changes) fail(404, "not_found");

  const u = new URL(row.redirect_uri);
  if (row.state) u.searchParams.set("state", row.state);
  if (body.allow !== true) {
    u.searchParams.set("error", "access_denied");
    u.searchParams.set("error_description", "The person chose not to connect.");
    return c.json({ redirect: u.toString() });
  }
  const db = c.env.DB;
  const accountId = c.get("account").id;
  const t = Date.now();
  // One connection per assistant per account: connecting again replaces the old one.
  const { results: old } = await db.prepare("SELECT id FROM oauth_grants WHERE account_id = ? AND client_id = ?").bind(accountId, row.client_id).all<{ id: string }>();
  for (const g of old) await revokeGrant(db, g.id);
  const grantId = newId("gr", 24);
  const code = randomHex(32);
  await db.batch([
    db.prepare("INSERT INTO oauth_grants (id, account_id, client_id, resource, created_at) VALUES (?, ?, ?, ?, ?)").bind(grantId, accountId, row.client_id, row.resource, t),
    db.prepare("INSERT INTO oauth_codes (code_hash, grant_id, client_id, redirect_uri, code_challenge, expires_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      await sha256Hex(code),
      grantId,
      row.client_id,
      row.redirect_uri,
      row.code_challenge,
      t + CODE_MS,
    ),
  ]);
  u.searchParams.set("code", code);
  return c.json({ redirect: u.toString() });
});

connections.get("/connections", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.created_at, g.last_used_at, cl.name AS client_name FROM oauth_grants g
     LEFT JOIN oauth_clients cl ON cl.id = g.client_id WHERE g.account_id = ? ORDER BY g.created_at DESC`,
  )
    .bind(c.get("account").id)
    .all<{ id: string; created_at: number; last_used_at: number | null; client_name: string | null }>();
  return c.json({ connections: results.map((g) => ({ id: g.id, name: g.client_name ?? "An AI assistant", connectedAt: g.created_at, lastUsedAt: g.last_used_at })) });
});

connections.delete("/connections/:id", async (c) => {
  const g = await c.env.DB.prepare("SELECT id FROM oauth_grants WHERE id = ? AND account_id = ?").bind(c.req.param("id"), c.get("account").id).first<{ id: string }>();
  if (!g) fail(404, "not_found");
  await revokeGrant(c.env.DB, g.id);
  return c.json({ ok: true });
});
