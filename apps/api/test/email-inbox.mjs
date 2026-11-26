// Email inbox, against `wrangler dev --local` (see email-inbox.sh). Raw emails go to the email()
// handler through /cdn-cgi/handler/email, exactly as Cloudflare Email Routing would deliver them.
import { execSync } from "node:child_process";

const API = process.env.API ?? "http://localhost:18755";
let failures = 0;
const ok = (cond, label, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  email inbox: ${label}${!cond && extra ? "  -> " + extra : ""}`);
  if (!cond) failures++;
};
const j = async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const app = (await fetch(`${API}/v1/apps`, { method: "POST", headers: { authorization: "Bearer test-admin", "content-type": "application/json" }, body: JSON.stringify({ name: "Keep This Day" }) }).then(j)).body;
const admin = (method, path, body) =>
  fetch(`${API}/v1/admin${path}`, { method, headers: { authorization: `Bearer ${app.secretKey}`, ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(j);
const sql = (q) => execSync(`npx wrangler d1 execute youasked --local --config ${process.env.CFG} --persist-to "${process.env.STATE}" --json --command "${q.replace(/"/g, '\\"')}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString();

let seq = 0;
function raw({ from, fromName, to, subject, text, messageId, headers = {} }) {
  const id = messageId ?? `<m${Date.now()}.${++seq}@mail.example.com>`;
  const extra = Object.entries(headers).map(([k, v]) => `${k}: ${v}\r\n`).join("");
  return `From: ${fromName ? `${fromName} <${from}>` : from}\r\nTo: ${to}\r\nSubject: ${subject}\r\nMessage-ID: ${id}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n${extra}\r\n${text.replace(/\n/g, "\r\n")}\r\n`;
}
const deliver = async (to, mail, envelopeFrom = "forwarder@gmail.com") => {
  const res = await fetch(`${API}/cdn-cgi/handler/email?from=${encodeURIComponent(envelopeFrom)}&to=${encodeURIComponent(to)}`, { method: "POST", body: raw({ to, ...mail }) });
  await sleep(150);
  return res.status;
};
const requests = async () => (await admin("GET", "/requests?status=all")).body.requests ?? [];

// ── turning it on ────────────────────────────────────────────────────────────────────────────────
let info = (await admin("GET", "/app")).body;
ok(info.emailInbox?.enabled === false && info.emailInbox.address === null, "off by default, no address yet", JSON.stringify(info.emailInbox));
const locked = await admin("PATCH", "/app", { emailInbox: true });
ok(locked.status === 402 && locked.body.error === "plan_required", "free (test mode) apps can't turn it on", JSON.stringify(locked));

sql(`UPDATE apps SET always_live = 1 WHERE public_key = '${app.publicKey}'`);
const on = await admin("PATCH", "/app", { emailInbox: true });
const address = on.body.emailInbox?.address;
ok(on.status === 200 && /^keep-this-day-[a-z0-9]{8}@in\.youasked\.dev$/.test(address ?? ""), "a paid app gets a readable address", JSON.stringify(on.body));
const [local, domain] = address.split("@");
const thread = (n) => `${local}+r${n}@${domain}`;

// ── the forwarding confirmation ──────────────────────────────────────────────────────────────────
await deliver(address, {
  from: "forwarding-noreply@google.com",
  fromName: "Gmail Team",
  subject: "(#482913570) Gmail Forwarding Confirmation - Receive Mail from hello@keepthisday.com",
  text: "hello@keepthisday.com has requested to automatically forward mail to your email address.\nConfirmation code: 482913570\n\nTo allow, click the link below:\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ8%5D-abc123\n\nIf you click the link and it appears to be broken, please copy and paste it.",
});
info = (await admin("GET", "/app")).body;
ok(info.emailInbox?.setup?.code === "482913570", "the Gmail confirmation code is caught", JSON.stringify(info.emailInbox?.setup));
ok(/mail-settings\.google\.com\/mail\/vf-/.test(info.emailInbox?.setup?.link ?? ""), "and its confirmation link");
ok((await requests()).length === 0, "the confirmation never becomes a conversation");

// ── a customer email ─────────────────────────────────────────────────────────────────────────────
const firstId = `<first.${Date.now()}@mail.example.com>`;
await deliver(address, {
  from: "maya@example.com",
  fromName: "Maya Tan",
  subject: "Fwd: RSVP link not working",
  messageId: firstId,
  text: "Hi! Our guests say the RSVP link shows a blank page on iPhone.\nCan you help?\n\nThanks,\nMaya\n\n-- \nMaya Tan | Wedding planner\n\nOn Tue, 24 Nov 2026 at 10:00, Keep This Day <hello@keepthisday.com> wrote:\n> Your wedding website is live!",
});
let list = await requests();
const conv = list.find((r) => r.title === "RSVP link not working");
ok(Boolean(conv), "a new email becomes a conversation titled by its subject", JSON.stringify(list.map((r) => r.title)));
ok(conv?.private === true, "it's private");
ok(conv?.body?.includes("blank page on iPhone") && !conv.body.includes("wrote:") && !conv.body.includes("Wedding planner"), "quoted history and signature are stripped", JSON.stringify(conv?.body));
ok(conv?.context?.via === "email" && conv.context.from === "maya@example.com", "it's marked as email, from Maya", JSON.stringify(conv?.context));
ok((conv?.author?.email ?? conv?.authorEmail ?? conv?.author_email) === "maya@example.com" || JSON.stringify(conv).includes("maya@example.com"), "Maya is the author");

await deliver(address, { from: "maya@example.com", subject: "Fwd: RSVP link not working", messageId: firstId, text: "Hi! Our guests say the RSVP link shows a blank page on iPhone." });
ok((await requests()).length === 1, "the same Message-ID twice is one conversation");

await deliver(address, { from: "maya@example.com", subject: "Out of office", text: "I'm away until Monday.", headers: { "Auto-Submitted": "auto-replied" } });
await deliver(address, { from: "news@shop.example", subject: "50% off everything", text: "Big sale", headers: { "List-Id": "<deals.shop.example>", "List-Unsubscribe": "<https://shop.example/u>" } });
await deliver(address, { from: "mailer-daemon@mail.example.com", subject: "Undelivered Mail Returned to Sender", text: "Delivery failed" });
ok((await requests()).length === 1, "auto-replies, newsletters and bounces are dropped");

// ── replies thread back ──────────────────────────────────────────────────────────────────────────
const n = conv.number;
const team = await admin("POST", `/requests/${conv.id}/comments`, { body: "Thanks Maya! Could you tell us which iPhone model?" });
ok(team.status === 201 || team.status === 200, "the team replies from the dashboard", JSON.stringify(team));
await deliver(thread(n), { from: "maya@example.com", fromName: "Maya Tan", subject: "Re: RSVP link not working", text: "It's an iPhone 15 on iOS 26.\n\nOn Wed, Keep This Day via YouAsked wrote:\n> Thanks Maya! Could you tell us which iPhone model?" });
let detail = (await admin("GET", `/requests/${conv.id}`)).body;
const comments = detail.comments ?? [];
ok(comments.some((c) => !c.team && /iPhone 15/.test(c.body) && !/wrote:/.test(c.body)), "her email reply lands in the same conversation, quotes removed", JSON.stringify(comments.map((c) => c.body)));
ok((await requests()).length === 1, "no extra conversation for the reply");

await deliver(thread(n), { from: "stranger@evil.example", subject: "Re: RSVP link not working", text: "Click this link to win" });
detail = (await admin("GET", `/requests/${conv.id}`)).body;
ok(!(detail.comments ?? []).some((c) => /win/.test(c.body)), "someone else can't post into Maya's conversation via its address");

// ── someone the app already knows ────────────────────────────────────────────────────────────────
const crypto = await import("node:crypto");
const sign = (id, email) => crypto.createHmac("sha256", app.secretKey).update(`${id}\n${email}`).digest("hex");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const signed = await fetch(`${API}/v1/requests`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-youasked-key": app.publicKey, "x-youasked-user": b64({ id: "host-42", email: "dan@example.com" }), "x-youasked-sig": sign("host-42", "dan@example.com"), origin: "http://localhost:3000" },
  body: JSON.stringify({ title: "Can we add a second venue?", private: true, context: { via: "email", from: "fake@spoof.example", meta: { wedding: "dan-and-lee", source: "chatgpt" } } }),
}).then(j);
ok(signed.status === 201, "a signed couple writes from the app", JSON.stringify(signed));
ok(!signed.body.request?.context?.via && signed.body.request?.context?.meta?.wedding === "dan-and-lee", "apps can't fake 'via email', but meta labels are kept", JSON.stringify(signed.body.request?.context));
await deliver(address, { from: "dan@example.com", subject: "Payment question", text: "Is the photo day a one-time payment?" });
const people = JSON.parse(sql(`SELECT u.external_id AS x FROM requests r JOIN users u ON u.id = r.author_id WHERE r.title = 'Payment question'`))[0].results;
ok(people[0]?.x === "u:host-42", "an email from a signed-in couple joins their own history", JSON.stringify(people));

// ── turning it off, unknown addresses ────────────────────────────────────────────────────────────
await admin("PATCH", "/app", { emailInbox: false });
const before = (await requests()).length;
await deliver(address, { from: "maya@example.com", subject: "Another question", text: "Hello again" });
await deliver(`nobody-zzzzzzzz@${domain}`, { from: "maya@example.com", subject: "Lost", text: "Hello" });
ok((await requests()).length === before, "an inbox that's off, or an unknown address, creates nothing");
const again = await admin("PATCH", "/app", { emailInbox: true });
ok(again.body.emailInbox?.address === address, "turning it back on keeps the same address");

const logRows = JSON.parse(sql("SELECT status, COUNT(*) AS n FROM inbound_emails GROUP BY status"))[0].results;
console.log("inbound_emails:", JSON.stringify(logRows));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
