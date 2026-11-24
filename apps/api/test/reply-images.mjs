// Images on team replies, against `wrangler dev --local`. Pass image files as arguments to use them
// (the owner's example screenshots); a 1x1 PNG is used otherwise.
import { readFileSync } from "node:fs";
const API = "http://localhost:18733";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  reply images: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const tiny = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const files = process.argv.slice(2).map((f) => new Uint8Array(readFileSync(f)));
const imgs = files.length ? files : [tiny, tiny];
const SEED = process.env.SEED === "1";

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Orbit" }) }).then(j)).body;
const auth = { authorization: `Bearer ${app.secretKey}` };
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { ...auth, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const device = `maya-ri-${Date.now()}`;
const person = (method, path, body) =>
  fetch(`${API}/v1${path}`, {
    method,
    headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": device, origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).then(j);
const upload = (bytes, type = "image/png", headers = auth) => fetch(`${API}/v1/admin/uploads`, { method: "POST", headers: { ...headers, "content-type": type }, body: bytes }).then(j);

const req = (await person("POST", "/requests", { title: "Automation is confusing", body: "I can't tell what it did" })).body.request;

// Upload then reference
const ups = [];
for (const b of imgs) ups.push(await upload(b));
ok(ups.every((u) => u.status === 201 && /\/v1\/uploads\/upl_[a-z0-9]{24}$/.test(u.body.url ?? "")), "the team can upload images", JSON.stringify(ups.map((u) => u.status)));
ok((await upload(tiny, "image/png", { authorization: `Bearer ${app.publicKey}` })).status >= 400, "the publishable key can't upload");
ok((await upload(new TextEncoder().encode("not an image at all, just text"))).status === 400, "something that isn't an image is refused");
ok((await upload(tiny, "image/gif")).status === 400, "a gif is refused (same types as request uploads)");
ok((await upload(new Uint8Array(2 * 1024 * 1024 + 10).fill(1), "image/png")).status === 400, "over 2 MB is refused");

const reply = await admin("POST", `/requests/${req.id}/comments`, { body: "Could you send me screenshots like these?", attachments: ups.map((u) => u.body.id) });
ok(reply.status === 200 && reply.body.attachments?.length === ups.length, "a reply carries its images", JSON.stringify(reply.body).slice(0, 200));
const reuse = await admin("POST", `/requests/${req.id}/comments`, { body: "again", attachments: [ups[0].body.id] });
ok(reuse.status === 400, "an image already used on a reply can't be used again", JSON.stringify(reuse.body));
ok((await admin("POST", `/requests/${req.id}/comments`, { body: "x", attachments: ["upl_" + "a".repeat(24)] })).status === 400, "an unknown upload id is refused");
const five = [];
for (let i = 0; i < 5; i++) five.push((await upload(tiny)).body.id);
ok((await admin("POST", `/requests/${req.id}/comments`, { body: "too many", attachments: five })).status === 400, "more than 4 images is refused");
const solo = await upload(tiny);
const imgOnly = await admin("POST", `/requests/${req.id}/comments`, { body: "", attachments: [solo.body.id] });
ok(imgOnly.status === 200 && imgOnly.body.attachments.length === 1, "an image with no text is fine");
ok((await admin("POST", `/requests/${req.id}/comments`, { body: "" })).status === 400, "no text and no image is not");

// What the person sees
const thread = (await person("GET", `/requests/${req.id}`)).body;
const team = thread.comments.filter((c) => c.team);
ok(team[0]?.attachments?.length === ups.length && team[0].attachments.every((a) => /^http.*\/v1\/uploads\/upl_/.test(a.url)), "the person's thread lists each reply's images with URLs", JSON.stringify(team[0]));
ok(thread.attachments.length === 0, "and they don't show up as the request's own screenshots");
const served = await fetch(team[0].attachments[0].url);
ok(served.status === 200 && served.headers.get("content-type") === "image/png", "the image is served");
const cfg = (await person("GET", "/config")).body;
const unseen = cfg.unseen?.find((n) => n.requestId === req.id);
ok(unseen?.replyAttachments?.length >= 1, "the notification the widget shows carries the images", JSON.stringify(cfg.unseen).slice(0, 200));

// The team's view
const detail = (await admin("GET", `/requests/${req.id}`)).body;
ok(detail.comments.find((c) => c.id === reply.body.id)?.attachments?.length === ups.length, "the dashboard's detail includes them");
ok(detail.attachments.length === 0, "and keeps them out of the request's screenshots");

// Multipart
const form = new FormData();
form.set("body", "From curl");
form.append("images", new Blob([tiny], { type: "image/png" }), "a.png");
form.append("images", new Blob([tiny], { type: "image/png" }), "b.png");
const mp = await fetch(`${API}/v1/admin/requests/${req.id}/comments`, { method: "POST", headers: auth, body: form }).then(j);
ok(mp.status === 200 && mp.body.attachments?.length === 2, "multipart works too", JSON.stringify(mp.body));
const badForm = new FormData();
badForm.set("body", "bad");
badForm.append("images", new Blob(["nope nope nope nope nope"], { type: "image/png" }), "a.png");
ok((await fetch(`${API}/v1/admin/requests/${req.id}/comments`, { method: "POST", headers: auth, body: badForm }).then(j)).status === 400, "multipart checks the bytes");

// Deleting the conversation deletes its images
const del = await person("POST", "/requests", { title: "Delete me", body: "" });
const up2 = await upload(tiny);
await admin("POST", `/requests/${del.body.request.id}/comments`, { body: "with image", attachments: [up2.body.id] });
ok((await fetch(up2.body.url)).status === 200, "(image exists)");
await admin("DELETE", `/requests/${del.body.request.id}`);
ok((await fetch(up2.body.url)).status === 404, "deleting a request deletes its reply images from storage");

// "Everyone": each linked conversation gets its own copy of the image
const other = (method, path, body) =>
  fetch(`${API}/v1${path}`, { method, headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": `tom-ri-${Date.now()}`, origin: "http://localhost:3000", ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const rootReq = (await person("POST", "/requests", { title: "Root question", body: "", private: true })).body.request;
const tomReq = (await other("POST", "/requests", { title: "Same question", body: "", private: true })).body.request;
await admin("POST", `/requests/${tomReq.id}/link`, { into: rootReq.id });
const shared = await upload(tiny);
const every = await admin("POST", `/requests/${rootReq.id}/comments`, { body: "to both", everyone: true, attachments: [shared.body.id] });
ok(every.status === 200 && every.body.conversations === 2, "a reply to everyone reaches both conversations", JSON.stringify(every.body));
const tomUrl = (await admin("GET", `/requests/${tomReq.id}`)).body.comments.find((c) => c.is_team)?.attachments?.[0]?.url;
ok(tomUrl && tomUrl !== shared.body.url && (await fetch(tomUrl)).status === 200, "the other conversation has its own copy of the image", String(tomUrl));
await admin("DELETE", `/requests/${rootReq.id}`);
ok((await fetch(tomUrl)).status === 200, "deleting one conversation leaves the other's image");

// The person replying with images
const userUp = () => fetch(`${API}/v1/uploads`, { method: "POST", headers: { "x-youasked-key": app.publicKey, "x-youasked-anon": device, origin: "http://localhost:3000", "content-type": "image/png" }, body: imgs[0] }).then(j);
const mine = [await userUp(), await userUp()];
const sent = await person("POST", `/requests/${req.id}/comments`, { body: "Here you go", attachments: mine.map((u) => u.body.id) });
ok(sent.status === 201 && sent.body.comment.attachments.length === 2, "a person can reply with images", JSON.stringify(sent.body).slice(0, 200));
const justImg = await person("POST", `/requests/${req.id}/comments`, { body: "", attachments: [(await userUp()).body.id] });
ok(justImg.status === 201, "or with just an image");
ok((await person("POST", `/requests/${req.id}/comments`, { body: "", attachments: [] })).status === 400, "but not with nothing");
ok((await person("POST", `/requests/${req.id}/comments`, { body: "steal", attachments: [shared.body.id, ups[0].body.id] })).body.comment?.attachments.length === 0, "and can't attach the team's or someone else's uploads");
const t2 = (await person("GET", `/requests/${req.id}`)).body;
ok(t2.comments.find((c) => c.id === sent.body.comment.id)?.attachments?.length === 2 && t2.attachments.length === 0, "their images show in the thread, not as request screenshots");
ok((await admin("GET", `/requests/${req.id}`)).body.comments.find((c) => c.id === sent.body.comment.id)?.attachments?.length === 2, "and in the dashboard");

// Fixing a sent reply: new text everywhere, line breaks kept, team replies only.
const fixed = await admin("PATCH", `/requests/${req.id}/comments/${reply.body.id}`, { body: "Could you send me screenshots?\n\nOne of each screen." });
ok(fixed.status === 200 && fixed.body.body === "Could you send me screenshots?\n\nOne of each screen.", "a team reply can be edited, line breaks kept", JSON.stringify(fixed.body));
const t3 = (await person("GET", `/requests/${req.id}`)).body;
ok(t3.comments.find((c) => c.id === reply.body.id)?.body.startsWith("Could you send me screenshots?\n\n"), "the person sees the new text");
ok((await admin("PATCH", `/requests/${req.id}/comments/${sent.body.comment.id}`, { body: "hijack" })).status === 404, "someone else's comment can't be edited");
ok((await admin("PATCH", `/requests/${req.id}/comments/${reply.body.id}`, { body: "  " })).status === 200, "a reply with images may lose its text");
const textOnly = await admin("POST", `/requests/${req.id}/comments`, { body: "Thanks!" });
ok((await admin("PATCH", `/requests/${req.id}/comments/${textOnly.body.id}`, { body: "" })).status === 400, "a text-only reply can't be emptied");

if (SEED) console.log(`SEED ${JSON.stringify({ publicKey: app.publicKey, secretKey: app.secretKey, device, requestId: req.id })}`);
console.log(failures ? `\n${failures} reply-image check(s) failed` : "\nAll reply-image checks passed");
process.exit(failures ? 1 : 0);
