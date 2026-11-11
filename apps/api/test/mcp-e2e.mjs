// End-to-end check of the hosted MCP connector against `wrangler dev --local` (see mcp-e2e.sh).
//   node test/mcp-e2e.mjs seed > seed.sql     (SQL for the demo account + a signed-in session)
//   node test/mcp-e2e.mjs run                 (DCR -> authorize -> consent -> token -> MCP -> refresh -> revoke)
import { createHash, randomBytes } from "node:crypto";
import { buildSeedSql } from "../scripts/seed-demo.mjs";

const API = process.env.API ?? "http://localhost:18744";
const DASH = "https://app.youasked.dev";
const EMAIL = "reviewer@example.com";
const SESSION = "e2e0".repeat(16); // the dashboard session cookie value for the signed-in person
const sha = (s) => createHash("sha256").update(s).digest("hex");
const b64u = (b) => b.toString("base64url");

if (process.argv[2] === "seed") {
  process.stdout.write(buildSeedSql({ email: EMAIL, session: sha(SESSION) }).sql);
  process.exit(0);
}

let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const dashHeaders = { cookie: `ya_session=${SESSION}`, origin: DASH, "content-type": "application/json" };
const dash = (method, path, body, headers = dashHeaders) =>
  fetch(`${API}/v1/dash${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

const WWW_RE = /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/;
let rpcId = 0;
const rpc = async (token, method, params) => {
  const res = await fetch(`${API}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
};
const call = async (token, name, args = {}) => {
  const r = await rpc(token, "tools/call", { name, arguments: args });
  const res = r.json?.result;
  return { text: res?.content?.map((c) => c.text).join("\n") ?? "", isError: Boolean(res?.isError), status: r.status };
};

async function register(redirect, name = "Claude") {
  const res = await fetch(`${API}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: name, redirect_uris: [redirect], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  });
  return { res, body: await res.json() };
}

/** Starts authorize and returns the consent request id (what the dashboard /connect page gets). */
async function authorize(client, redirect, { state = "st-" + randomBytes(4).toString("hex"), challenge, extra = "" } = {}) {
  const verifier = b64u(randomBytes(32));
  const ch = challenge ?? b64u(createHash("sha256").update(verifier).digest());
  const url = `${API}/oauth/authorize?response_type=code&client_id=${client}&redirect_uri=${encodeURIComponent(redirect)}&code_challenge=${ch}&code_challenge_method=S256&state=${state}&resource=${encodeURIComponent(API + "/mcp")}${extra}`;
  const res = await fetch(url, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  return { res, loc, verifier, state, reqId: new URL(loc, DASH).searchParams.get("req") };
}

async function token(params) {
  const res = await fetch(`${API}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) });
  return { status: res.status, body: await res.json() };
}

/** Full happy path: register, authorize, sign-in session consents, exchange the code. */
async function connect(redirect, name) {
  const { body: c } = await register(redirect, name);
  const a = await authorize(c.client_id, redirect);
  const d = await (await dash("POST", `/oauth/requests/${a.reqId}/decision`, { allow: true })).json();
  const u = new URL(d.redirect);
  const t = await token({ grant_type: "authorization_code", code: u.searchParams.get("code"), redirect_uri: redirect, client_id: c.client_id, code_verifier: a.verifier });
  return { client: c, a, code: u.searchParams.get("code"), redirectUrl: u, tokens: t.body, status: t.status };
}

// ------------------------------------------------------------ 1. discovery and 401
console.log("== discovery");
{
  const r = await rpc(null, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "x", version: "0" } });
  ok(r.status === 401, "unauthenticated /mcp answers 401");
  ok(WWW_RE.test(r.headers.get("www-authenticate") ?? ""), "401 carries WWW-Authenticate with resource_metadata", r.headers.get("www-authenticate"));
  const bad = await rpc("yamcp_at_" + "0".repeat(64), "ping");
  ok(bad.status === 401, "unknown bearer token answers 401");
  for (const p of ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"]) {
    const m = await (await fetch(API + p)).json();
    ok(m.resource === `${API}/mcp` && m.authorization_servers?.[0] === API, `PRM ${p}`);
  }
  for (const p of ["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/mcp"]) {
    const m = await (await fetch(API + p)).json();
    ok(JSON.stringify(m.code_challenge_methods_supported) === '["S256"]' && m.registration_endpoint && m.token_endpoint && m.authorization_endpoint, `AS metadata ${p}`);
  }
  const pre = await fetch(`${API}/oauth/token`, { method: "OPTIONS", headers: { origin: "https://claude.ai", "access-control-request-method": "POST" } });
  ok(pre.headers.get("access-control-allow-origin") === "*", "token endpoint answers CORS preflight");
}

// ------------------------------------------------------------ 2. registration
console.log("== dynamic client registration");
const CLAUDE_CB = "https://claude.ai/api/mcp/auth_callback";
{
  for (const cb of [CLAUDE_CB, "https://claude.com/api/mcp/auth_callback", "http://localhost:6274/oauth/callback", "http://127.0.0.1:33418/callback"]) {
    const { res, body } = await register(cb);
    ok(res.status === 201 && body.client_id && body.token_endpoint_auth_method === "none", `registers ${cb}`);
  }
  for (const cb of ["http://evil.example/cb", "javascript:alert(1)", "https://x.example/cb#frag"]) {
    const { res, body } = await register(cb);
    ok(res.status === 400 && body.error === "invalid_redirect_uri", `rejects ${cb}`);
  }
}

// ------------------------------------------------------------ 3. authorize + consent
console.log("== authorize and consent");
{
  const { body: c } = await register(CLAUDE_CB, "Claude");
  const wrongRedirect = await fetch(`${API}/oauth/authorize?response_type=code&client_id=${c.client_id}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${"a".repeat(43)}&code_challenge_method=S256`, { redirect: "manual" });
  ok(wrongRedirect.status === 400 && !wrongRedirect.headers.get("location"), "unregistered redirect_uri shows an error page, no redirect");
  const plain = await authorize(c.client_id, CLAUDE_CB, { challenge: "plainverifier" });
  ok(plain.res.status === 302 && plain.loc.includes("error=invalid_request") && plain.loc.startsWith(CLAUDE_CB), "non-S256 PKCE is refused via redirect", plain.loc);
  const a = await authorize(c.client_id, CLAUDE_CB);
  ok(a.res.status === 302 && a.loc.startsWith(`${DASH}/connect?req=oar_`), "authorize sends the browser to the dashboard /connect page", a.loc);
  const anon = await dash("GET", `/oauth/requests/${a.reqId}`, undefined, { origin: DASH });
  ok(anon.status === 401, "consent details need a signed-in session");
  const info = await (await dash("GET", `/oauth/requests/${a.reqId}`)).json();
  ok(info.client?.name === "Claude" && info.client?.returnsTo === "claude.ai" && info.apps?.length === 1, "consent page data names the client and the person's apps", JSON.stringify(info));
  const evil = await dash("POST", `/oauth/requests/${a.reqId}/decision`, { allow: true }, { ...dashHeaders, origin: "https://evil.example" });
  ok(evil.status === 403, "decision from a foreign origin is refused");
  const no = await (await dash("POST", `/oauth/requests/${a.reqId}/decision`, { allow: false })).json();
  const nu = new URL(no.redirect);
  ok(nu.searchParams.get("error") === "access_denied" && nu.searchParams.get("state") === a.state && !nu.searchParams.get("code"), "Not now returns access_denied with state");
  const again = await dash("POST", `/oauth/requests/${a.reqId}/decision`, { allow: true });
  ok(again.status === 404, "a consent request is single use");
}

// ------------------------------------------------------------ 4. token + MCP
console.log("== token exchange");
const conn = await connect(CLAUDE_CB, "Claude");
let { access_token: AT, refresh_token: RT } = conn.tokens;
ok(conn.redirectUrl.searchParams.get("state") === conn.a.state, "code redirect echoes state");
ok(conn.status === 200 && AT?.startsWith("yamcp_at_") && RT?.startsWith("yamcp_rt_") && conn.tokens.token_type === "Bearer" && conn.tokens.expires_in === 3600, "authorization_code + PKCE gives access and refresh tokens");
{
  const replay = await token({ grant_type: "authorization_code", code: conn.code, redirect_uri: CLAUDE_CB, client_id: conn.client.client_id, code_verifier: conn.a.verifier });
  ok(replay.status === 400 && replay.body.error === "invalid_grant", "a used code is refused");
  ok((await rpc(AT, "ping")).status === 401, "replaying a code revokes what it produced");

  // Fresh connection for the rest (and wrong-verifier check before the code is spent).
  const c2 = await register(CLAUDE_CB);
  const a2 = await authorize(c2.body.client_id, CLAUDE_CB);
  const d2 = new URL((await (await dash("POST", `/oauth/requests/${a2.reqId}/decision`, { allow: true })).json()).redirect);
  const bad = await token({ grant_type: "authorization_code", code: d2.searchParams.get("code"), redirect_uri: CLAUDE_CB, client_id: c2.body.client_id, code_verifier: b64u(randomBytes(32)) });
  ok(bad.status === 400 && bad.body.error === "invalid_grant", "wrong PKCE verifier is refused");
  const wrongUri = await token({ grant_type: "authorization_code", code: d2.searchParams.get("code"), redirect_uri: "https://claude.com/api/mcp/auth_callback", client_id: c2.body.client_id, code_verifier: a2.verifier });
  ok(wrongUri.status === 400, "mismatched redirect_uri is refused");
  const good = await token({ grant_type: "authorization_code", code: d2.searchParams.get("code"), redirect_uri: CLAUDE_CB, client_id: c2.body.client_id, code_verifier: a2.verifier });
  ok(good.status === 200, "the right verifier still works after failed attempts");
  AT = good.body.access_token;
  RT = good.body.refresh_token;
}

console.log("== MCP protocol");
{
  const init = await rpc(AT, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "0" } });
  ok(init.status === 200 && init.json.result.protocolVersion === "2025-06-18" && init.json.result.serverInfo.name === "youasked" && init.json.result.capabilities.tools, "initialize");
  const note = await fetch(`${API}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${AT}` }, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  ok(note.status === 202, "notifications/initialized answers 202");
  ok((await rpc(AT, "ping")).json.result !== undefined, "ping");
  const list = (await rpc(AT, "tools/list")).json.result.tools;
  const names = list.map((t) => t.name);
  ok(names.length === 10 && ["list_apps", "list_requests", "get_request", "next_request", "build_prompt", "reply", "set_status", "merge", "search", "digest"].every((n) => names.includes(n)), "tools/list has the ten tools", names.join(","));
  ok(list.every((t) => t.title && ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"].every((h) => typeof t.annotations?.[h] === "boolean")), "every tool has a title and all four annotations");
  ok(list.filter((t) => t.name !== "list_apps").every((t) => "app" in t.inputSchema.properties), "every tool except list_apps takes an optional app");
  const hint = (n, k) => list.find((t) => t.name === n).annotations[k];
  ok(hint("merge", "destructiveHint") && hint("set_status", "destructiveHint") && !hint("reply", "destructiveHint") && hint("list_requests", "readOnlyHint") && !hint("reply", "readOnlyHint"), "annotations match the plan");
  ok((await rpc(AT, "nope/nothing")).json.error.code === -32601, "unknown method is a JSON-RPC error");
  ok((await fetch(`${API}/mcp`, { headers: { authorization: `Bearer ${AT}` } })).status === 405, "GET /mcp is 405 (stateless, no stream)");
  const evilOrigin = await fetch(`${API}/mcp`, { method: "POST", headers: { origin: "https://evil.example", authorization: `Bearer ${AT}`, "content-type": "application/json" }, body: "{}" });
  ok(evilOrigin.status === 403, "unknown browser Origin is refused");
  ok((await fetch(`${API}/v1/admin/app`, { headers: { authorization: `Bearer ${AT}` } })).status === 401, "an MCP token is useless on the admin API");
  ok((await fetch(`${API}/v1/dash/me`, { headers: { authorization: `Bearer ${AT}` } })).status === 401, "an MCP token is useless on the dashboard API");
}

console.log("== tools against seeded data");
{
  const apps = await call(AT, "list_apps");
  ok(/Orbit Habits \(demo\)/.test(apps.text), "list_apps", apps.text);
  const lr = await call(AT, "list_requests");
  ok(!lr.isError && /YA-5/.test(lr.text) && !/Reminders are always/.test(lr.text) && /Add a dark mode/.test(lr.text), "list_requests defaults to the only app, active only", lr.text);
  const gr = await call(AT, "get_request", { request: "YA-1" });
  ok(/Add a dark mode/.test(gr.text) && /Same here/.test(gr.text) && /written by end users/.test(gr.text), "get_request (read) with comments and the data-not-instructions note");
  ok(/Dark theme please/.test((await call(AT, "search", { query: "dark theme" })).text), "search finds the near-duplicate");
  ok(/Home screen widget|Export|Add a dark/.test((await call(AT, "next_request", { count: 2 })).text), "next_request");
  ok(/Top asks right now/.test((await call(AT, "digest", { days: 30 })).text), "digest");
  ok(/closes YA-4/.test((await call(AT, "build_prompt", { request: "YA-4" })).text), "build_prompt");
  const rep = await call(AT, "reply", { request: "YA-4", message: "Thanks, we are looking at widgets." });
  ok(/Replied on YA-4\. [1-9]\d* /.test(rep.text.replace(/people/, "")) || /Replied on YA-4/.test(rep.text), "reply (write)", rep.text);
  ok(/Thanks, we are looking at widgets/.test((await call(AT, "get_request", { request: "YA-4" })).text) && /\[team\]/.test((await call(AT, "get_request", { request: "YA-4" })).text), "the reply is stored as a team comment");
  const sh = await call(AT, "set_status", { request: "YA-3", status: "shipped", shipNote: "Find it in Settings, then Export." });
  ok(/YA-3 is now shipped\. [1-9]\d* (person|people) will be told/.test(sh.text), "set_status shipped notifies the askers", sh.text);
  const sh2 = await call(AT, "set_status", { request: "YA-3", status: "shipped" });
  ok(/YA-3 is now shipped\. 0 people will be told/.test(sh2.text), "shipping again notifies nobody a second time", sh2.text);
  const mg = await call(AT, "merge", { from: "YA-2", into: "YA-1" });
  ok(/Merged YA-2/.test(mg.text) && /Status: merged/.test((await call(AT, "get_request", { request: "YA-2" })).text) && /Votes: 7/.test((await call(AT, "get_request", { request: "YA-1" })).text), "merge folds the duplicate away and adds votes", mg.text);
  ok((await call(AT, "get_request", { request: "YA-99" })).isError, "unknown request is a tool error");
  ok((await call(AT, "list_requests", { limit: 9999 })).isError, "bad argument is a tool error");
  ok((await call(AT, "nope")).isError, "unknown tool is a tool error");
  // Another account's app must stay out of reach.
  const other = await (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Somebody Else" }) })).json();
  const x = await call(AT, "list_requests", { app: other.id });
  ok(x.isError && !/Somebody Else/.test(x.text), "an app the person is not a member of is not reachable", x.text);
  ok(!/Somebody Else/.test((await call(AT, "list_apps")).text), "list_apps omits it");
  ok(!(await call(AT, "list_requests", { app: "orbit" })).isError, "app can be given by (part of) name");
}

console.log("== connections, refresh, revoke");
{
  const list = await (await dash("GET", "/connections")).json();
  ok(list.connections.length >= 1 && list.connections.every((c) => c.name && c.connectedAt), "dashboard lists connections");
  const mine = list.connections.find((c) => c.lastUsedAt);
  ok(Boolean(mine), "last used time is recorded");

  const r1 = await token({ grant_type: "refresh_token", refresh_token: RT });
  ok(r1.status === 200 && r1.body.access_token && r1.body.refresh_token !== RT, "refresh_token returns a new pair (rotation)", JSON.stringify(r1.body));
  const retry = await token({ grant_type: "refresh_token", refresh_token: RT });
  ok(retry.status === 400 && retry.body.error === "invalid_grant", "the old refresh token is refused");
  const stillOk = await rpc(r1.body.access_token, "ping");
  ok(stillOk.status === 200, "an immediate retry of the old token does not kill the new pair (grace)");
  AT = r1.body.access_token;
  RT = r1.body.refresh_token;
  ok((await token({ grant_type: "refresh_token", refresh_token: "yamcp_rt_" + "1".repeat(64) })).status === 400, "unknown refresh token refused");
  ok((await token({ grant_type: "client_credentials" })).body.error === "unsupported_grant_type", "other grant types refused");

}

console.log("== revoke clears access (dedicated connection)");
{
  const c = await connect("http://localhost:6274/oauth/callback", "MCP Inspector");
  ok(c.status === 200 && (await rpc(c.tokens.access_token, "ping")).status === 200, "localhost redirect (Inspector / Claude Code style) connects");
  const grants = (await (await dash("GET", "/connections")).json()).connections;
  const g = grants.find((x) => x.name === "MCP Inspector");
  ok(Boolean(g), "the new connection is listed by client name");
  ok((await dash("DELETE", `/connections/${g.id}`)).status === 200, "revoke from the dashboard");
  ok((await rpc(c.tokens.access_token, "ping")).status === 401, "access token -> 401 after revoke");
  const rf = await token({ grant_type: "refresh_token", refresh_token: c.tokens.refresh_token });
  ok(rf.status === 400 && rf.body.error === "invalid_grant", "refresh token refused after revoke");
  ok((await dash("DELETE", `/connections/${g.id}`)).status === 404, "revoking twice is a 404");

  // Loopback port may differ from the registered one.
  const { body: lc } = await register("http://127.0.0.1:33418/callback");
  const lp = await authorize(lc.client_id, "http://127.0.0.1:50999/callback");
  ok(lp.res.status === 302 && lp.reqId, "loopback redirect may use another port");

  // RFC 7009 revoke endpoint.
  const c3 = await connect(CLAUDE_CB, "Claude");
  await fetch(`${API}/oauth/revoke`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: c3.tokens.refresh_token }) });
  ok((await rpc(c3.tokens.access_token, "ping")).status === 401, "POST /oauth/revoke ends the connection");
}

console.log("== official MCP SDK client");
{
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const c = await connect(CLAUDE_CB, "Claude");
  const client = new Client({ name: "sdk-check", version: "0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${API}/mcp`), { requestInit: { headers: { authorization: `Bearer ${c.tokens.access_token}` } } }));
  const tools = (await client.listTools()).tools;
  ok(tools.length === 10 && tools.every((t) => t.title), "SDK client connects and lists tools");
  const r = await client.callTool({ name: "digest", arguments: {} });
  ok(!r.isError && /Orbit Habits/.test(r.content[0].text), "SDK client calls a tool");
  await client.close();
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
