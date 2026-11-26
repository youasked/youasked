// App version and device on requests, against `wrangler dev --local` (port 18733). Run by test/run.sh.
// The team sees it (admin list, detail, lookup); nobody else does, including the person themselves.
import { createHmac } from "node:crypto";
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  client-info: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Pocket" }) }).then(j)).body;
const admin = (path) => fetch(`${API}/v1/admin${path}`, { headers: { authorization: `Bearer ${app.secretKey}` } }).then(j);
const as = (headers) => (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: { "x-youasked-key": app.publicKey, origin: "http://localhost:3000", ...headers, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => ({ status: res.status, text: await res.text() }));

const ID = `acct-${Date.now()}`;
const phone = as({
  "x-youasked-user": Buffer.from(JSON.stringify({ id: ID })).toString("base64url"),
  "x-youasked-sig": createHmac("sha256", app.secretKey).update(ID).digest("hex"),
  "x-youasked-platform": "react-native",
  "user-agent": "okhttp/4.12.0",
  "x-youasked-client": "platform=android&app=1.5.3&build=109&os=Android%2015&device=Google%20Pixel%208&sdk=react-native%2F0.4.0",
});
const browser = as({
  "x-youasked-anon": `device-${Date.now()}`,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "x-youasked-client": "platform=web&sdk=react%2F0.12.0&app=2.3.1",
});
const sneaky = as({ "x-youasked-anon": `device-x-${Date.now()}` });

const a = JSON.parse((await phone("POST", "/requests", { title: "Widgets on the home screen", body: "" })).text).request;
const b = JSON.parse((await browser("POST", "/requests", { title: "Export to PDF please", body: "" })).text).request;
// A client can't write the device into the body to fake it; only the header counts.
const c = JSON.parse((await sneaky("POST", "/requests", { title: "Bigger fonts", body: "", context: { client: { app: "9.9.9" }, path: "/home" } })).text).request;
ok(a?.id && b?.id && c?.id, "three requests posted");

const da = (await admin(`/requests/${a.id}`)).body.request?.context?.client;
ok(da?.platform === "android" && da.app === "1.5.3" && da.build === "109" && da.os === "Android 15" && da.device === "Google Pixel 8" && da.sdk === "react-native/0.4.0", "native app: version, OS and device kept", JSON.stringify(da));
const db = (await admin(`/requests/${b.id}`)).body.request?.context?.client;
ok(db?.platform === "web" && db.app === "2.3.1" && db.browser === "Chrome 131" && db.os === "Windows", "browser: version from the SDK, browser and OS from the User-Agent", JSON.stringify(db));
const dc = (await admin(`/requests/${c.id}`)).body.request?.context;
ok(dc?.path === "/home" && dc.client?.app !== "9.9.9", "a client field in the body is ignored", JSON.stringify(dc));

const list = (await admin("/requests?status=all")).body.requests;
ok(list.find((r) => r.id === a.id)?.context?.client?.device === "Google Pixel 8", "admin list carries it");
const look = (await admin(`/lookup?ref=${a.id}`)).body;
ok(look.using === "Android app 1.5.3 (109) · Android 15 · Google Pixel 8", "lookup sums it up in one line", look.using);
const lookB = (await admin(`/lookup?ref=${b.id}`)).body;
ok(lookB.using === "Web 2.3.1 · Chrome 131 on Windows", "web line", lookB.using);

const seen = [
  await sneaky("GET", "/requests?status=all"),
  await sneaky("GET", `/requests/${a.id}`),
  await phone("GET", `/requests/${a.id}`),
  await phone("GET", "/me/requests"),
];
ok(seen.every((r) => r.status === 200), "public endpoints answer", seen.map((r) => r.status).join(","));
ok(seen.every((r) => !r.text.includes("Pixel") && !r.text.includes("Chrome 131") && !r.text.includes('"client"')), "no public endpoint returns the device or version");
ok(JSON.parse(seen[1].text).request?.context === null || JSON.parse(seen[1].text).request?.context?.client === undefined, "public context keeps only where it was asked");

console.log(failures ? `\n${failures} client-info check(s) FAILED` : "\nAll client-info checks passed");
process.exit(failures ? 1 : 0);
