// Email for the people who asked: when their request ships, and when the team replies.
// Only people with a known email who aren't anonymous and haven't unsubscribed. Each person gets
// each event once (email_log), whichever of the dashboard, Telegram or GitHub triggered it.
import { sendEmail } from "./email";
import { requestEmail } from "./email-kit";
import { siteUrl } from "./public";
import { alert } from "./alert";
import { entitlements } from "./plans";
import { hmacHex } from "./lib";
import type { Env, RequestRow } from "./types";

/** What actions.ts needs to send mail after a change without blocking the response. */
export type Mail = { env: Env; waitUntil: (p: Promise<unknown>) => void };

type Person = { id: string; email: string; name: string | null };

const secretOf = (env: Env) => env.TOKEN_ENC_KEY ?? env.ADMIN_TOKEN;
const apiOrigin = (env: Env) => (env.API_URL ?? "https://api.youasked.dev").replace(/\/$/, "");

export async function unsubscribeToken(env: Env, userId: string): Promise<string> {
  return `${userId}.${(await hmacHex(secretOf(env), `unsubscribe:${userId}`)).slice(0, 32)}`;
}

export async function verifyUnsubscribeToken(env: Env, token: string): Promise<string | null> {
  const userId = token.slice(0, token.lastIndexOf("."));
  if (!userId || token !== (await unsubscribeToken(env, userId))) return null;
  return userId;
}

async function appNameOf(db: D1Database, appId: string): Promise<string> {
  return (await db.prepare("SELECT name FROM apps WHERE id = ?").bind(appId).first<{ name: string }>())?.name ?? "the app";
}

/** The request's public share page, when the app has a slug (shipped requests get one even on a private board). */
async function sharePageOf(env: Env, r: RequestRow): Promise<string | null> {
  const a = await env.DB.prepare("SELECT slug FROM apps WHERE id = ?").bind(r.app_id).first<{ slug: string | null }>();
  return a?.slug ? `${siteUrl(env)}/${a.slug}/shipped/${r.number}` : null;
}

/** Marks (request, person, kind) as sent. False when they were already emailed about it. */
async function claim(db: D1Database, requestId: string, userId: string, kind: string): Promise<boolean> {
  const res = await db
    .prepare("INSERT OR IGNORE INTO email_log (request_id, user_id, kind, created_at) VALUES (?, ?, ?, ?)")
    .bind(requestId, userId, kind, Date.now())
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Emails per app per day. Far above a real ship (people who asked), far below a spam run. */
const DAILY_CAP = 300;

/** Only apps on a plan (or ones we run) email their users, so a throwaway test-mode app can't send mail. */
async function canEmail(env: Env, appId: string): Promise<boolean> {
  const app = await env.DB.prepare("SELECT workspace_id, always_live FROM apps WHERE id = ?").bind(appId).first<{ workspace_id: string | null; always_live: number | null }>();
  if (!app) return false;
  if (app.always_live) return true;
  return (await entitlements(env, app)).live;
}

async function deliver(env: Env, people: Person[], r: RequestRow, kind: string, compose: (p: Person, unsubscribeUrl: string) => { subject: string; text: string; html: string }) {
  if (!people.length || !(await canEmail(env, r.app_id))) return;
  const day = Math.floor(Date.now() / 86_400_000);
  for (const p of people) {
    try {
      const sent = await env.DB.prepare("INSERT INTO rate_limits (key, bucket, n) VALUES (?1, ?2, 1) ON CONFLICT (key, bucket) DO UPDATE SET n = n + 1 RETURNING n")
        .bind(`mail:${r.app_id}`, day)
        .first<{ n: number }>();
      if ((sent?.n ?? 1) > DAILY_CAP) {
        await alert(env, `mail-cap:${r.app_id}`, `App ${r.app_id} hit the daily email cap (${DAILY_CAP}). Emails are held until tomorrow.`, 6 * 60 * 60_000);
        return;
      }
      if (!(await claim(env.DB, r.id, p.id, kind))) continue;
      const unsub = `${apiOrigin(env)}/v1/unsubscribe?token=${encodeURIComponent(await unsubscribeToken(env, p.id))}`;
      const { subject, text, html } = compose(p, unsub);
      const body = `${text}\n\n--\nDon't want these? Unsubscribe: ${unsub}`;
      await sendEmail(env, { to: p.email, subject, text: body, html });
    } catch (err) {
      console.error("[mail] failed", err);
    }
  }
}

const REACHABLE = "u.email IS NOT NULL AND u.email != '' AND u.is_anon = 0 AND u.email_optout = 0";

export async function emailShipped(env: Env, r: RequestRow): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT u.id, u.email, u.name FROM users u
     WHERE ${REACHABLE} AND (u.id = ?1 OR u.id IN (SELECT user_id FROM votes WHERE request_id = ?2))`,
  )
    .bind(r.author_id, r.id)
    .all<Person>();
  const people = results;
  if (!people.length) return;
  const app = await appNameOf(env.DB, r.app_id);
  const page = await sharePageOf(env, r);
  await deliver(env, people, r, "shipped", (p, unsubscribe) => {
    const first = p.name ? p.name.split(/\s+/)[0] : null;
    const asked = p.id === r.author_id;
    const text =
      `${first ? `Hi ${first},\n\n` : ""}` +
      `You ${asked ? "asked for" : "voted for"} "${r.title}". It's live in ${app}.` +
      (r.ship_note ? `\n\n${r.ship_note}` : "") +
      (page ? `\n\nSee the update: ${page}` : "") +
      `\n\nThanks for helping shape it.`;
    return {
      subject: `Live in ${app}: ${r.title}`,
      text,
      html: requestEmail({
        app,
        tag: "Just shipped",
        title: "You asked. It’s live.",
        preheader: `${r.title} is now live in ${app}.`,
        kicker: "Shipped",
        live: true,
        greeting: first ? `Hi ${first},` : null,
        intro: `You ${asked ? "asked for" : "voted for"} this in ${app}, and it’s now live.`,
        quote: { caption: asked ? "Your request" : "The request you voted for", text: r.title, big: true },
        note: r.ship_note ? { caption: `A note from the ${app} team`, text: r.ship_note } : null,
        closing: "Thanks for helping shape it.",
        cta: page ? { label: "See what shipped", href: page } : null,
        unsubscribe,
      }),
    };
  });
}

export async function emailReply(env: Env, r: RequestRow, body: string, commentId: string): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT u.id, u.email, u.name FROM users u
     WHERE ${REACHABLE} AND (u.id = ?1 OR u.id IN (SELECT user_id FROM comments WHERE request_id = ?2 AND is_team = 0 AND user_id IS NOT NULL))`,
  )
    .bind(r.author_id, r.id)
    .all<Person>();
  if (!results.length) return;
  const app = await appNameOf(env.DB, r.app_id);
  await deliver(env, results, r, `reply:${commentId}`, (p, unsubscribe) => {
    const first = p.name ? p.name.split(/\s+/)[0] : null;
    return {
      subject: `${app} replied to "${r.title}"`,
      text: `${first ? `Hi ${first},\n\n` : ""}The ${app} team replied to "${r.title}":\n\n${body}\n\nYou can answer from the feedback sheet in the app.`,
      html: requestEmail({
        app,
        tag: "New reply",
        title: `The ${app} team replied.`,
        preheader: body.replace(/\s+/g, " ").slice(0, 110),
        kicker: "A reply to your request",
        greeting: first ? `Hi ${first},` : null,
        intro: "They answered your request:",
        quote: { caption: "Your request", text: r.title },
        note: { caption: "Their reply", text: body },
        closing: "You can answer from the feedback sheet in the app.",
        unsubscribe,
      }),
    };
  });
}
