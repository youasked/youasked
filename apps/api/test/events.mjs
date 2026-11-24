// Signed webhooks to the app's server, end to end against `wrangler dev --local` (port 18733).
// A tiny receiver on :18799 records what arrives; the test checks the events, people and signatures.
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { execSync } from "node:child_process";
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  events: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let got = [];
let failNext = 0;
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    got.push({ headers: req.headers, body });
    if (failNext > 0) {
      failNext--;
      res.writeHead(500).end("nope");
    } else res.writeHead(200).end("ok");
  });
});
await new Promise((r) => server.listen(18799, r));

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Hooky" }) }).then(j)).body;
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${app.secretKey}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const signed = (id) => (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: {
      "x-youasked-key": app.publicKey,
      "x-youasked-user": Buffer.from(JSON.stringify({ id })).toString("base64url"),
      "x-youasked-sig": createHmac("sha256", app.secretKey).update(id).digest("hex"),
      origin: "http://localhost:3000",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(j);
const anon = (method, path, body) =>
  fetch(`${API}/v1${path}`, { method, headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": `anon-${Date.now()}`, origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const verify = (secret, h, body) => {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(h["youasked-signature"] ?? "");
  return !!m && createHmac("sha256", secret).update(`${m[1]}.${body}`).digest("hex") === m[2];
};
const waitFor = async (n, ms = 5000) => {
  const end = Date.now() + ms;
  while (got.length < n && Date.now() < end) await sleep(100);
};

ok((await admin("PUT", "/integrations/events", { url: "http://example.com/hook" })).status === 400, "plain http is refused outside localhost");
let res = await admin("PUT", "/integrations/events", { url: "http://localhost:18799/hook" });
ok(res.status === 200 && /^whsec_[a-z0-9]{32}$/.test(res.body.secret) && res.body.events.length === 2, "endpoint saved with a secret and both events", JSON.stringify(res.body));
const secret = res.body.secret;
ok((await admin("PUT", "/integrations/events", { url: "http://localhost:18799/hook" })).body.secret === secret, "saving again keeps the secret");
ok((await admin("GET", "/integrations")).body.events?.url === "http://localhost:18799/hook", "GET /integrations shows the endpoint");

// Test event
res = await admin("POST", "/integrations/events/test");
ok(res.status === 200 && res.body.ok === true && res.body.code === 200, "test event delivered", JSON.stringify(res.body));
ok(got.length === 1 && JSON.parse(got[0].body).type === "ping" && verify(secret, got[0].headers, got[0].body), "test event is a signed ping");
got = [];

// A signed person asks, an anonymous one votes, the team replies.
const maya = signed("user-maya");
const tom = signed("user-tom");
const reqst = (await maya("POST", "/requests", { title: "Dark mode", body: "" })).body.request;
await anon("POST", `/requests/${reqst.id}/vote`);
await tom("POST", `/requests/${reqst.id}/vote`);
await tom("POST", `/requests/${reqst.id}/comments`, { body: "Yes please" });
res = await admin("POST", `/requests/${reqst.id}/comments`, { body: "On it!" });
ok(res.status === 200, "team reply posted", JSON.stringify(res.body));
await waitFor(2);
const replies = got.map((g) => ({ ...g, json: JSON.parse(g.body) })).filter((g) => g.json.type === "reply.created");
ok(replies.length === 2, "reply.created goes to the asker and the commenter, not the anonymous voter", JSON.stringify(got.map((g) => g.body)));
ok(new Set(replies.map((r) => r.json.data.user.id)).size === 2 && replies.every((r) => ["user-maya", "user-tom"].includes(r.json.data.user.id)), "user ids are the ones the app signed");
ok(replies.every((r) => verify(secret, r.headers, r.body) && r.headers["youasked-event"] === "reply.created" && r.headers["youasked-delivery"]?.startsWith("dlv_")), "each reply event is signed with event and delivery headers");
ok(replies[0]?.json.data.reply.body === "On it!" && replies[0]?.json.data.request.ref === `YA-${reqst.number}`, "payload carries the reply and the request");
ok(!verify("whsec_wrong", replies[0].headers, replies[0].body), "a wrong secret doesn't verify");
got = [];

// Shipped: asker + signed voter (Tom); the anonymous voter has no app id.
res = await admin("PATCH", `/requests/${reqst.id}`, { status: "shipped", shipNote: "In settings" });
await waitFor(2);
const shipped = got.map((g) => JSON.parse(g.body)).filter((g) => g.type === "request.shipped");
ok(shipped.length === 2 && shipped.every((e) => e.data.shipNote === "In settings"), "request.shipped goes to the asker and signed voter with the ship note", JSON.stringify(shipped));
got = [];

// Only the events the app picked.
await admin("PUT", "/integrations/events", { url: "http://localhost:18799/hook", events: ["request.shipped"] });
await admin("POST", `/requests/${reqst.id}/comments`, { body: "Second reply" });
await sleep(1500);
ok(got.length === 0, "unsubscribed event types aren't sent");
await admin("PUT", "/integrations/events", { url: "http://localhost:18799/hook" });

// A failing endpoint goes on the retry schedule and shows in the log; the cron retries it when due.
failNext = 1;
await admin("POST", `/requests/${reqst.id}/comments`, { body: "Third reply" });
await waitFor(1);
await sleep(500);
let log = (await admin("GET", "/integrations/events/deliveries")).body.deliveries;
const third = log.filter((d) => d.payload?.data?.reply?.body === "Third reply");
const failed = third.find((d) => d.status !== "delivered");
ok(third.length === 2 && third.some((d) => d.status === "delivered"), "the other person's copy still arrived", JSON.stringify(third.map((d) => d.status)));
ok(failed?.status === "pending" && failed.attempts === 1 && failed.last_code === 500 && failed.next_at > Date.now(), "a 500 is kept pending with a next retry", JSON.stringify(failed));
// The cron tick sends retries that are due.
const sql = (q) => execSync(`npx wrangler d1 execute youasked --local --persist-to /tmp/ya-state --config test/wrangler.test.jsonc --command "${q.replace(/"/g, '\\"')}"`, { cwd: new URL("..", import.meta.url).pathname, stdio: "pipe" }).toString();
failNext = 1;
sql(`UPDATE event_deliveries SET next_at = 0 WHERE id = '${failed.id}'`);
got = [];
await fetch(`${API}/cdn-cgi/handler/scheduled?cron=${encodeURIComponent("*/10 * * * *")}&time=${Date.now()}`);
await waitFor(1);
log = (await admin("GET", "/integrations/events/deliveries")).body.deliveries;
const retried = log.find((d) => d.id === failed.id);
ok(got.length === 1 && retried?.attempts === 2 && retried.status === "pending" && retried.next_at > Date.now() + 4 * 60_000, "the cron retries a due delivery and backs off further when it fails again", JSON.stringify(retried));
res = await admin("POST", `/integrations/events/deliveries/${failed.id}/resend`);
ok(res.body.ok === true, "resend from the log delivers it");
log = (await admin("GET", "/integrations/events/deliveries")).body.deliveries;
ok(log.find((d) => d.id === failed.id)?.status === "delivered", "the log shows it delivered");

// Rotating the secret signs with the new one.
const rotated = (await admin("POST", "/integrations/events/rotate")).body.secret;
got = [];
await admin("POST", "/integrations/events/test");
ok(rotated !== secret && verify(rotated, got[0].headers, got[0].body), "rotated secret signs new deliveries");

// Removing the endpoint stops events.
await admin("DELETE", "/integrations/events");
got = [];
await admin("POST", `/requests/${reqst.id}/comments`, { body: "Fourth reply" });
await sleep(1500);
ok(got.length === 0, "no events after the endpoint is removed");

server.close();
console.log(failures ? `\n${failures} events check(s) failed` : "\nevents: all passed");
process.exit(failures ? 1 : 0);
