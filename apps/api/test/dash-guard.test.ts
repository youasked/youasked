// Run with: npx tsx apps/api/test/dash-guard.test.ts
// The dashboard session proxy must apply the owner/admin-only rule to the same path the admin router routes on.
// A member once got past it with percent-encoding ("/%69ntegrations" routed to "/integrations"); every way of
// disguising an admin-only path must now be refused, and ordinary member calls must still work.
import assert from "node:assert/strict";
import { Hono } from "hono";
import { adminOnly, forwardPath, proxiedPath } from "../src/dash-guard";

// A stand-in for the real proxy (dash.ts) and admin router (index.ts), wired exactly the same way.
const admin = new Hono();
const hit = (name: string) => (c: { text: (s: string) => Response }) => c.text(`reached ${name}`);
admin.get("/v1/admin/integrations", hit("integrations"));
admin.patch("/v1/admin/app", hit("app settings"));
admin.get("/v1/admin/export", hit("export"));
admin.post("/v1/admin/requests/:id/handoff", hit("handoff"));
admin.post("/v1/admin/requests/:id/reply", hit("reply"));
admin.get("/v1/admin/requests", hit("requests"));

const APP = "app_123";
const proxy = (role: "owner" | "admin" | "member") => {
  const dash = new Hono();
  dash.all("/v1/dash/apps/:appId/*", async (c) => {
    const url = new URL(c.req.url);
    const full = proxiedPath(url.pathname);
    const prefix = `/v1/dash/apps/${APP}`;
    if (full === null || !(full === prefix || full.startsWith(`${prefix}/`))) return c.json({ error: "bad_path" }, 400);
    const rest = full.slice(prefix.length);
    if (role === "member" && adminOnly(rest, c.req.method)) return c.json({ error: "forbidden" }, 403);
    return admin.fetch(new Request(`${url.origin}/v1/admin${forwardPath(rest)}${url.search}`, { method: c.req.method }));
  });
  return dash;
};
const call = async (role: "owner" | "admin" | "member", method: string, path: string) => {
  const res = await proxy(role).fetch(new Request(`https://api.test/v1/dash/apps/${APP}${path}`, { method }));
  return { status: res.status, body: await res.text() };
};

const tests: [string, () => Promise<void>][] = [
  ["a member cannot reach admin-only routes, however the path is written", async () => {
    const disguised: [string, string][] = [
      ["GET", "/integrations"],
      ["GET", "/%69ntegrations"], // the reported one
      ["GET", "/%49ntegrations"], // capital I, never routes anyway; must not reach either
      ["GET", "/integration%73"],
      ["PATCH", "/%61pp"],
      ["GET", "/%65xport"],
      ["POST", "/requests/r1/%68andoff"],
      ["POST", "/requests/r1/handof%66"],
      ["GET", "/%2569ntegrations"], // double-encoded
      ["GET", "/requests/../integrations"],
      ["GET", "/requests/%2e%2e/integrations"],
      ["GET", "/requests%2f..%2fintegrations"],
      ["GET", "/%5cintegrations"],
      ["GET", "/%E0%A4%A"], // malformed
    ];
    for (const [m, p] of disguised) {
      const r = await call("member", m, p);
      assert.ok(!r.body.startsWith("reached"), `${m} ${p} reached a route as a member: ${r.status} ${r.body}`);
      assert.ok(r.status === 403 || r.status === 400 || r.status === 404, `${m} ${p} gave ${r.status}`);
    }
  }],
  ["the reported paths now answer 403 for a member", async () => {
    assert.equal((await call("member", "GET", "/%69ntegrations")).status, 403);
    assert.equal((await call("member", "PATCH", "/%61pp")).status, 403);
    assert.equal((await call("member", "GET", "/%65xport")).status, 403);
    assert.equal((await call("member", "POST", "/requests/r1/%68andoff")).status, 403);
  }],
  ["a member can still triage", async () => {
    assert.equal((await call("member", "GET", "/requests")).body, "reached requests");
    assert.equal((await call("member", "POST", "/requests/r1/reply")).body, "reached reply");
    assert.equal((await call("member", "POST", "/requests/r%31/reply")).body, "reached reply"); // harmless escape still works
  }],
  ["owners and admins still reach everything", async () => {
    for (const role of ["owner", "admin"] as const) {
      assert.equal((await call(role, "GET", "/integrations")).body, "reached integrations");
      assert.equal((await call(role, "PATCH", "/app")).body, "reached app settings");
      assert.equal((await call(role, "POST", "/requests/r1/handoff")).body, "reached handoff");
    }
  }],
  ["proxiedPath decodes once and refuses what could change meaning later", async () => {
    assert.equal(proxiedPath("/%69ntegrations"), "/integrations");
    assert.equal(proxiedPath("/requests/r1/reply"), "/requests/r1/reply");
    assert.equal(proxiedPath("/%2569ntegrations"), null);
    assert.equal(proxiedPath("/a/../b"), null);
    assert.equal(proxiedPath("/a/%2e/b"), null);
    assert.equal(proxiedPath("/a%5cb"), null);
    assert.equal(proxiedPath("/%E0%A4%A"), null);
    assert.equal(proxiedPath("/a%00b"), null);
    assert.equal(adminOnly("/integrations", "get"), true);
    assert.equal(adminOnly("/requests/r1/reply", "POST"), false);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (e) {
    failed++;
    console.log(`not ok - ${name}\n  ${(e as Error).message}`);
  }
}
console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
if (failed) process.exit(1);
