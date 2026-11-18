// "Your message": the persona (name, role, photo, welcome note) and the corner message's words, against `wrangler dev --local`.
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  persona: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Orbit" }) }).then(j)).body;
const auth = { authorization: `Bearer ${app.secretKey}` };
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { ...auth, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const config = () =>
  fetch(`${API}/v1/config`, { headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": `p-${Date.now()}`, origin: "http://localhost:3000" } }).then(j);

ok((await config()).body.persona === null, "nothing set: the widget gets null and uses the app's icon and name");

await admin("PATCH", "/app", { persona: { name: "  Aden  ", role: "Made Orbit", intro: "I read every message myself.", avatar: "javascript:alert(1)" } });
let p = (await config()).body.persona;
ok(p?.name === "Aden" && p.role === "Made Orbit" && p.intro === "I read every message myself.", "name, role and welcome note reach the widget, trimmed", JSON.stringify(p));
ok(p?.avatar === null, "a photo URL that isn't https is dropped");
ok((await admin("GET", "/app")).body.persona?.name === "Aden", "the dashboard reads it back");

await admin("PATCH", "/app", { persona: { role: null } });
p = (await config()).body.persona;
ok(p?.name === "Aden" && p.role === null && p.intro, "changing one field keeps the others");

await admin("PATCH", "/app", { nudge: { message: "Hey! I saw you've been planning your trip. Anything I can help with? I read every message and reply within a few hours, as long as I'm awake." } });
const nudge = (await config()).body.nudge;
ok(nudge?.message?.startsWith("Hey! I saw") && nudge.message.length > 120, "the corner message can be longer than the old 120 characters", String(nudge?.message?.length));

// A 1x1 PNG
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const up = await fetch(`${API}/v1/admin/app/avatar`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: png }).then(j);
ok(up.status === 201 && /\/v1\/uploads\/upl_[a-z0-9]{24}$/.test(up.body.url ?? ""), "a photo uploads and gets a URL", JSON.stringify(up.body));
p = (await config()).body.persona;
ok(p?.avatar === up.body.url && p.name === "Aden", "the photo is saved onto the persona straight away");
const img = await fetch(up.body.url);
ok(img.status === 200 && img.headers.get("content-type") === "image/png", "and the photo is served");
const fake = await fetch(`${API}/v1/admin/app/avatar`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: new TextEncoder().encode("not a png at all, just text") }).then(j);
ok(fake.status === 400, "something that isn't an image is refused");

const second = await fetch(`${API}/v1/admin/app/avatar`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: png }).then(j);
ok(second.status === 201 && second.body.url !== up.body.url, "a new photo replaces the old one");
await new Promise((r) => setTimeout(r, 300));
ok((await fetch(up.body.url)).status === 404, "and the old file is deleted");

await admin("PATCH", "/app", { persona: { avatar: null } });
ok((await config()).body.persona?.avatar === null, "removing the photo clears it");
await new Promise((r) => setTimeout(r, 300));
ok((await fetch(second.body.url)).status === 404, "and deletes the file");

await admin("PATCH", "/app", { persona: { name: null, intro: null } });
ok((await config()).body.persona === null, "clearing every field turns it off");

const pub = await fetch(`${API}/v1/admin/app/avatar`, { method: "POST", headers: { authorization: `Bearer ${app.publicKey}`, "content-type": "image/png" }, body: png });
ok(pub.status === 401 || pub.status === 403, "the publishable key can't set the photo", String(pub.status));

console.log(failures ? `\n${failures} persona check(s) failed` : "\nAll persona checks passed");
process.exit(failures ? 1 : 0);
