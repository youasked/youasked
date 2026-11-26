// Email inbox: a developer forwards their support address (hello@theirapp.com) to
// <name>-<token>@in.youasked.dev with one rule in Gmail, Workspace, Outlook or Cloudflare. Cloudflare
// Email Routing hands every message for in.youasked.dev to this Worker's email() handler, and each
// email becomes a private conversation (or a reply in one), through the same public API the widget
// uses, so spam checks, rate limits, private mode and team alerts behave exactly the same.
//
// Replies from the team go back by email with Reply-To <address>+r<number>@in.youasked.dev, so the
// customer's next email threads into the same conversation.
import PostalMime, { type Email as Parsed } from "postal-mime";
import { hmacHex, newId } from "./lib";
import { entitlements } from "./plans";
import { notifyInboxSetup } from "./notify";
import type { AppRow, Env } from "./types";

export const inboxDomain = (env: Env) => (env.INBOX_DOMAIN ?? "in.youasked.dev").toLowerCase();

/** The app's forwarding address, e.g. keep-this-day-8f3k2m9q@in.youasked.dev. */
export function inboxAddress(env: Env, a: Pick<AppRow, "name"> & { email_token?: string | null }): string | null {
  if (!a.email_token) return null;
  const name = a.name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "") || "app";
  return `${name}-${a.email_token}@${inboxDomain(env)}`;
}

/** Where a reply to conversation #n should be sent so it threads back. */
export function replyAddress(env: Env, a: Pick<AppRow, "name"> & { email_token?: string | null }, n: number): string | null {
  const base = inboxAddress(env, a);
  if (!base) return null;
  const [local, domain] = base.split("@");
  return `${local}+r${n}@${domain}`;
}

export function newInboxToken(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

/** Proves to our own API that a request comes from this handler, so it may set via/from/subject. */
export const inboundProof = (env: Env) => hmacHex(env.TOKEN_ENC_KEY ?? env.ADMIN_TOKEN, "inbound-email");

// ── reading an email ─────────────────────────────────────────────────────────────────────────────

export type SetupMessage = { from: string; subject: string; code: string | null; link: string | null; at: number };

const SETUP_SENDERS = /(forwarding-noreply@google\.com|@accounts\.google\.com|@notify\.cloudflare\.com|@cloudflare\.com|@microsoft\.com|@outlook\.com|@accountprotection\.microsoft\.com|@fastmail\.com|@zoho\.com|@protonmail\.com|@proton\.me)$/i;
const SETUP_SUBJECT = /(forwarding confirmation|confirm (your )?(forwarding|email|address)|verify (your )?(email|address|destination)|email routing.*verif|destination address)/i;

/** A "confirm this forwarding address" message from Gmail, Outlook, Cloudflare and so on. */
export function readSetupMessage(from: string, subject: string, text: string, html: string): SetupMessage | null {
  if (!SETUP_SENDERS.test(from) && !SETUP_SUBJECT.test(subject)) return null;
  if (!SETUP_SUBJECT.test(subject) && !/confirm|verif/i.test(text.slice(0, 600))) return null;
  const code = subject.match(/\(#(\d{6,12})\)/)?.[1] ?? text.match(/(?:confirmation|verification)\s+code[^0-9]{0,40}(\d{6,12})/i)?.[1] ?? null;
  const links = [...`${text}\n${html}`.matchAll(/https:\/\/[^\s"'<>)]+/g)].map((m) => m[0].replace(/&amp;/g, "&"));
  const link = links.find((u) => /(verify|confirm|mail-settings|vf-|forward|email-routing|destination)/i.test(u) && !/unsubscribe|support|help|policies|privacy/i.test(u)) ?? null;
  return { from, subject: subject.slice(0, 200), code, link, at: Date.now() };
}

/** Bounces, auto-replies, newsletters and our own mail: never a conversation. */
export function isAutomated(parsed: Parsed, from: string, env: Env): string | null {
  const h = new Map(parsed.headers.map((x) => [x.key.toLowerCase(), x.value.toLowerCase()]));
  if (/^(mailer-daemon|postmaster|bounce|bounces)@/i.test(from)) return "bounce";
  if (from.endsWith("@youasked.dev") || from.endsWith(`@${inboxDomain(env)}`)) return "loop";
  const auto = h.get("auto-submitted");
  if (auto && auto !== "no") return "auto-reply";
  if (h.has("x-autoreply") || h.has("x-autorespond") || /^(auto|automatic) ?(reply|response)|out of (the )?office/i.test(parsed.subject ?? "")) return "auto-reply";
  if (/\b(bulk|list|junk)\b/.test(h.get("precedence") ?? "")) return "bulk";
  if (h.has("list-unsubscribe") && h.has("list-id")) return "newsletter";
  return null;
}

/** The new text of an email: quoted history, forwarded headers and signatures removed. */
export function newText(parsed: Parsed): string {
  const raw = (parsed.text ?? htmlToText(parsed.html ?? "")).replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(--|__)\s*$/.test(l)) break; // signature delimiter
    if (/^On .{4,200}wrote:\s*$/i.test(l) || /^On .{4,200}$/i.test(l) && /wrote:\s*$/i.test(lines[i + 1] ?? "")) break;
    if (/^-{2,}\s*(Original Message|Forwarded message)\s*-{2,}/i.test(l)) break;
    if (/^From: .+/i.test(l) && /^(Sent|Date): .+/i.test(lines[i + 1] ?? "")) break;
    if (/^Sent from my (iPhone|iPad|Android|Galaxy|mobile)/i.test(l.trim())) break;
    if (/^>/.test(l)) continue;
    out.push(l);
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text || raw.trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export const cleanSubject = (s: string) => s.replace(/^\s*((re|fwd?|aw|sv|antw)\s*(\[\d+\])?\s*:\s*)+/i, "").replace(/\s*\[YA-\d+\]\s*/gi, " ").replace(/\s+/g, " ").trim();

/** Which part of the address is the app, and which conversation (from +r<n>), if any. */
export function parseRecipient(to: string, env: Env): { token: string; thread: number | null } | null {
  const [local, domain] = to.toLowerCase().trim().split("@");
  if (!local || domain !== inboxDomain(env)) return null;
  const [name, tag] = local.split("+");
  const token = name.split("-").pop() ?? "";
  if (!/^[a-z0-9]{8}$/.test(token)) return null;
  const n = tag?.match(/^r(\d{1,7})$/)?.[1];
  return { token, thread: n ? Number(n) : null };
}

// ── the handler ──────────────────────────────────────────────────────────────────────────────────

type Dispatch = (req: Request) => Promise<Response>;

async function log(env: Env, appId: string, row: { requestId?: string | null; messageId?: string | null; from?: string | null; subject?: string | null; status: string; reason?: string | null }) {
  await env.DB.prepare(
    "INSERT INTO inbound_emails (id, app_id, request_id, message_id, from_email, subject, status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(newId("ibx"), appId, row.requestId ?? null, row.messageId ?? null, row.from ?? null, (row.subject ?? "").slice(0, 200) || null, row.status, row.reason ?? null, Date.now())
    .run();
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function handleEmail(message: ForwardableEmailMessage, env: Env, dispatch: Dispatch): Promise<void> {
  const rcpt = parseRecipient(message.to, env);
  if (!rcpt) return message.setReject("Unknown address");
  const a = await env.DB.prepare("SELECT * FROM apps WHERE email_token = ?").bind(rcpt.token).first<AppRow & { email_inbox: number; email_token: string }>();
  if (!a) return message.setReject("Unknown address");
  if (message.rawSize > 12 * 1024 * 1024) {
    await log(env, a.id, { status: "rejected", reason: "too-large" });
    return message.setReject("Message too large");
  }

  const parsed = await PostalMime.parse(await new Response(message.raw).arrayBuffer());
  const from = (parsed.from?.address ?? message.from ?? "").trim().toLowerCase();
  const name = (parsed.from?.name ?? "").trim().slice(0, 120) || null;
  const subject = (parsed.subject ?? "").trim();
  const messageId = (parsed.messageId ?? "").slice(0, 300) || null;
  const t = Date.now();

  // Setup mail first: the forwarding confirmation has to get through even before the inbox is on.
  const setup = readSetupMessage(from, subject, parsed.text ?? "", parsed.html ?? "");
  if (setup) {
    await env.DB.prepare("UPDATE apps SET email_setup = ?, email_last_at = ? WHERE id = ?").bind(JSON.stringify(setup), t, a.id).run();
    await log(env, a.id, { messageId, from, subject, status: "setup" });
    await notifyInboxSetup(env, a.id, a.name, setup).catch(() => {});
    return;
  }

  if (!a.email_inbox) {
    await log(env, a.id, { messageId, from, subject, status: "rejected", reason: "inbox-off" });
    return message.setReject("This inbox is turned off");
  }
  const live = a.always_live ? true : (await entitlements(env, a)).live;
  if (!live) {
    await log(env, a.id, { messageId, from, subject, status: "rejected", reason: "plan" });
    return message.setReject("This inbox needs a paid YouAsked plan");
  }
  if (!from || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) {
    await log(env, a.id, { messageId, subject, status: "dropped", reason: "no-sender" });
    return;
  }
  const automated = isAutomated(parsed, from, env);
  if (automated) {
    await log(env, a.id, { messageId, from, subject, status: "dropped", reason: automated });
    return;
  }
  if (messageId) {
    const seen = await env.DB.prepare("SELECT 1 FROM inbound_emails WHERE app_id = ? AND message_id = ? AND status IN ('conversation','reply')").bind(a.id, messageId).first();
    if (seen) return;
  }
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM inbound_emails WHERE app_id = ? AND from_email = ? AND created_at > ?")
    .bind(a.id, from, t - 60 * 60 * 1000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 12) {
    await log(env, a.id, { messageId, from, subject, status: "dropped", reason: "rate" });
    return;
  }

  // Who it is: someone the app already signed in with this email joins their own history;
  // otherwise an email-only person (marked not verified in the dashboard).
  const known = await env.DB.prepare(
    "SELECT external_id FROM users WHERE app_id = ? AND lower(email) = ? AND is_anon = 0 AND external_id LIKE 'u:%' ORDER BY (external_id LIKE 'u:email:%'), created_at LIMIT 1",
  )
    .bind(a.id, from)
    .first<{ external_id: string }>();
  const userId = known ? known.external_id.slice(2) : `email:${from}`;
  const sig = await hmacHex(a.secret_key, `${userId}\n${from}`);
  const headers = {
    "content-type": "application/json",
    "x-youasked-key": a.public_key,
    "x-youasked-user": b64url(JSON.stringify({ id: userId, email: from, ...(name ? { name } : {}) })),
    "x-youasked-sig": sig,
    "x-youasked-platform": "email",
    "x-youasked-inbound": await inboundProof(env),
  };
  const call = (path: string, body: unknown) => dispatch(new Request(`https://api.youasked.dev/v1${path}`, { method: "POST", headers, body: JSON.stringify(body) }));

  const text = newText(parsed);
  const files = (parsed.attachments ?? []).filter((f) => f.disposition !== "inline" || !f.contentId);
  const note = files.length ? `\n\n📎 ${files.length === 1 ? "1 attachment" : `${files.length} attachments`} in the original email: ${files.map((f) => f.filename || f.mimeType).slice(0, 5).join(", ")}` : "";

  // A reply to one of our emails (+r<n>), or a subject with [YA-n], from the same person: same thread.
  const n = rcpt.thread ?? (Number(subject.match(/\[YA-(\d{1,7})\]/i)?.[1] ?? 0) || null);
  if (n) {
    const r = await env.DB.prepare(
      "SELECT r.id FROM requests r JOIN users u ON u.id = r.author_id WHERE r.app_id = ? AND r.number = ? AND u.external_id = ?",
    )
      .bind(a.id, n, `u:${userId}`)
      .first<{ id: string }>();
    if (r) {
      const res = await call(`/requests/${r.id}/comments`, { body: (text + note).slice(0, 1000) });
      await log(env, a.id, { requestId: r.id, messageId, from, subject, status: res.ok ? "reply" : "rejected", reason: res.ok ? null : `api-${res.status}` });
      if (res.ok) await env.DB.prepare("UPDATE apps SET email_last_at = ? WHERE id = ?").bind(t, a.id).run();
      return;
    }
  }

  const title = (cleanSubject(subject) || text.split("\n").find((l) => l.trim())?.trim() || "Email").slice(0, 120);
  const res = await call("/requests", {
    title: title.length >= 3 ? title : `Email: ${title}`,
    body: (text + note).slice(0, 2000),
    private: true,
    context: { via: "email", from, subject: subject.slice(0, 200) },
  });
  const j = (await res.json().catch(() => ({}))) as { request?: { id?: string } };
  await log(env, a.id, { requestId: j.request?.id ?? null, messageId, from, subject, status: res.ok ? "conversation" : "rejected", reason: res.ok ? null : `api-${res.status}` });
  if (res.ok) await env.DB.prepare("UPDATE apps SET email_last_at = ? WHERE id = ?").bind(t, a.id).run();
}
