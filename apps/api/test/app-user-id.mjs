// The app's own user id on requests, against `wrangler dev --local` (port 18733). Run by test/run.sh.
// The team sees it (admin list, detail, lookup for the MCP tools); end users never do.
import { createHmac } from "node:crypto";
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  app-user-id: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})), text: "" });

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Ledger" }) }).then(j)).body;
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${app.secretKey}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const as = (headers) => (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: { "x-youasked-key": app.publicKey, origin: "http://localhost:3000", ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, text: await res.text() }));

const ID = `acct-${Date.now()}-7f3a`;
// Signed the way the app's server does it (new apps require it): hex HMAC-SHA256(secret key, id).
const signedIn = as({ "x-youasked-user": Buffer.from(JSON.stringify({ id: ID })).toString("base64url"), "x-youasked-sig": createHmac("sha256", app.secretKey).update(ID).digest("hex") });
const visitor = as({ "x-youasked-anon": `device-${Date.now()}` });

const mine = JSON.parse((await signedIn("POST", "/requests", { title: "Export to CSV", body: "" })).text).request;
const theirs = JSON.parse((await visitor("POST", "/requests", { title: "Dark mode", body: "" })).text).request;
ok(mine?.id && theirs?.id, "a signed-in person and a visitor each post a request");

const list = (await admin("GET", "/requests?status=all")).body.requests;
ok(list.find((r) => r.id === mine.id)?.author?.appUserId === ID, "admin list carries the app's own id", JSON.stringify(list.find((r) => r.id === mine.id)?.author));
ok(list.find((r) => r.id === theirs.id)?.author?.appUserId === null, "a visitor who isn't signed in has none");

const detail = (await admin("GET", `/requests/${mine.id}`)).body;
ok(detail.author?.appUserId === ID, "admin detail carries it", JSON.stringify(detail.author));

const lookup = (await admin("GET", `/lookup?ref=${mine.id}`)).body;
ok(lookup.author?.appUserId === ID && lookup.author.anonymous === false, "lookup (MCP get_request) carries it", JSON.stringify(lookup.author));

// Nobody outside the team can read it, including the person themselves.
const seen = [
  await visitor("GET", "/requests?status=all"),
  await visitor("GET", `/requests/${mine.id}`),
  await signedIn("GET", `/requests/${mine.id}`),
  await signedIn("GET", "/me/requests"),
];
ok(seen.every((r) => r.status === 200), "public endpoints answer", seen.map((r) => r.status).join(","));
ok(seen.every((r) => !r.text.includes(ID)), "no public endpoint returns the app's id");

console.log(failures ? `\n${failures} app-user-id check(s) FAILED` : "\nAll app-user-id checks passed");
process.exit(failures ? 1 : 0);
