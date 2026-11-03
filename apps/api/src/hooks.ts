// Incoming webhooks: Telegram (buttons and replies from the team's chat) and GitHub (PRs and
// commits that mention YA-12), plus the weekly digest.
import { Hono } from "hono";
import { loadRequestById, loadRequestByNumber, ref, setStatus } from "./actions";
import { aiText } from "./ai";
import { hmacHex } from "./lib";
import { botTokenFor, esc, loadIntegrations, notifyTeam, tg } from "./notify";
import { handleBotUpdate, handleSharedUpdate, resolveOwn, type TgUpdate } from "./telegram-bot";
import type { AppRow, Env, GithubConfig, Integration, RequestRow, TelegramConfig } from "./types";

const hooks = new Hono<{ Bindings: Env }>();

async function loadIntegration<C>(db: D1Database, id: string) {
  const row = await db
    .prepare("SELECT i.id, i.app_id, i.kind, i.config, a.name AS app_name FROM integrations i JOIN apps a ON a.id = i.app_id WHERE i.id = ?")
    .bind(id)
    .first<{ id: string; app_id: string; kind: Integration["kind"]; config: string; app_name: string }>();
  return row ? { ...row, config: JSON.parse(row.config) as C } : null;
}

async function saveConfig(db: D1Database, id: string, config: unknown) {
  await db.prepare("UPDATE integrations SET config = ? WHERE id = ?").bind(JSON.stringify(config), id).run();
}

// ---------------------------------------------------------------- Telegram

// An app's own bot: its webhook points here with the integration id.
hooks.post("/telegram/:id", async (c) => {
  const integ = await loadIntegration<TelegramConfig>(c.env.DB, c.req.param("id"));
  if (!integ || integ.kind !== "telegram") return c.text("unknown", 404);
  const cfg = integ.config;
  // Notify-only bots never point their webhook here, so nothing here should be accepted for them.
  // Shared chats are served by /telegram-shared.
  if (cfg.interactive === false || cfg.shared || !cfg.secret) return c.text("unknown", 404);
  if (c.req.header("x-telegram-bot-api-secret-token") !== cfg.secret) return c.text("forbidden", 403);
  const update = await c.req.json<TgUpdate>();
  const env = c.env;

  // Linking: /start <code> from the deep link connects that chat.
  const msg = update.message;
  if (msg?.text?.startsWith("/start")) {
    const say = (text: string) =>
      tg(env, cfg.botToken, "sendMessage", { chat_id: msg.chat.id, text, parse_mode: "HTML", disable_web_page_preview: true });
    const code = msg.text.split(/\s+/)[1];
    if (code && cfg.linkCode && code === cfg.linkCode) {
      cfg.chatId = String(msg.chat.id);
      cfg.chatTitle = msg.chat.title ?? msg.chat.first_name ?? null;
      cfg.linkCode = null;
      await saveConfig(env.DB, integ.id, cfg);
      await say(
        `✅ Connected to <b>${esc(integ.app_name)}</b>.\nNew requests and comments will show up here with buttons to plan, ship, reply or merge them. Reply to any card to answer the person who asked.`,
      );
    } else if (String(msg.chat.id) !== cfg.chatId) {
      await say("This bot posts feature requests for a YouAsked app. Use the connect link from your dashboard to link a chat.");
    }
    return c.json({ ok: true });
  }

  await handleBotUpdate(env, new URL(c.req.url).origin, update, cfg.botToken, resolveOwn(integ.app_id, integ.app_name, cfg), (p) => c.executionCtx.waitUntil(p));
  return c.json({ ok: true });
});

// The shared @youasked_bot: one webhook for every app that connected through it.
hooks.post("/telegram-shared", async (c) => {
  if (!c.env.YOUASKED_BOT_TOKEN || !c.env.YOUASKED_BOT_SECRET) return c.text("unknown", 404);
  if (c.req.header("x-telegram-bot-api-secret-token") !== c.env.YOUASKED_BOT_SECRET) return c.text("forbidden", 403);
  const update = await c.req.json<TgUpdate>();
  await handleSharedUpdate(c.env, new URL(c.req.url).origin, update, (p) => c.executionCtx.waitUntil(p));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- GitHub

const SHIP_PATTERN = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ship(?:s|ped)?)\s*:?\s+((?:YA-\d+(?:\s*(?:,|and|&)\s*)?)+)/gi;

/** "Add bill splitting (closes YA-12, YA-14)" → shipped: [12, 14] */
export function shippedRefs(text: string): number[] {
  const out = new Set<number>();
  for (const m of text.matchAll(SHIP_PATTERN)) for (const n of m[1].matchAll(/YA-(\d+)/gi)) out.add(Number(n[1]));
  return [...out];
}

export function mentionedRefs(text: string): number[] {
  return [...new Set([...text.matchAll(/\bYA-(\d+)\b/gi)].map((m) => Number(m[1])))];
}

/** Turns a commit or PR title into a note people can read: drops prefixes, refs and PR numbers. */
export function shipNoteFrom(title: string): string {
  const note = title
    .split("\n")[0]
    .replace(SHIP_PATTERN, "")
    .replace(/\bYA-\d+\b/gi, "")
    .replace(/^\s*(?:feat|fix|chore|refactor|perf|style|docs|build|ci|test)(?:\([^)]*\))?!?:\s*/i, "")
    .replace(/\(#\d+\)/g, "")
    .replace(/\(\s*\)|\[\s*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s,;:–-]+$/, "")
    .trim();
  return note ? note[0].toUpperCase() + note.slice(1) : "";
}

async function verifyGithub(secret: string, body: string, header: string | undefined) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = new TextEncoder().encode("sha256=" + (await hmacHex(secret, body)));
  const given = new TextEncoder().encode(header);
  return expected.byteLength === given.byteLength && crypto.subtle.timingSafeEqual(expected, given);
}

hooks.post("/github/:id", async (c) => {
  const integ = await loadIntegration<GithubConfig>(c.env.DB, c.req.param("id"));
  if (!integ || integ.kind !== "github") return c.text("unknown", 404);
  const raw = await c.req.text();
  if (!(await verifyGithub(integ.config.secret, raw, c.req.header("x-hub-signature-256")))) return c.text("bad signature", 401);
  const event = c.req.header("x-github-event");
  const payload = JSON.parse(raw);
  const env = c.env;
  const results: string[] = [];

  const ship = async (numbers: number[], note: string, via: string) => {
    for (const n of numbers) {
      const r = await loadRequestByNumber(env.DB, integ.app_id, n);
      if (!r || r.status === "shipped" || r.status === "merged") continue;
      const previous = r.status;
      const { notified } = await setStatus(env.DB, r, "shipped", r.ship_note ?? (note || null), { env, waitUntil: (p) => c.executionCtx.waitUntil(p) });
      results.push(`${ref(r)} shipped`);
      const fresh = (await loadRequestById(env.DB, integ.app_id, r.id))!;
      c.executionCtx.waitUntil(
        notifyTeam(env, integ.app_id, { kind: "auto-status", appName: integ.app_name, request: fresh, status: "shipped", previous, via, notified }),
      );
    }
  };
  const start = async (numbers: number[], via: string) => {
    for (const n of numbers) {
      const r = await loadRequestByNumber(env.DB, integ.app_id, n);
      if (!r || !["open", "planned"].includes(r.status)) continue;
      await setStatus(env.DB, r, "in_progress");
      results.push(`${ref(r)} in progress`);
      const fresh = (await loadRequestById(env.DB, integ.app_id, r.id))!;
      c.executionCtx.waitUntil(
        notifyTeam(env, integ.app_id, { kind: "auto-status", appName: integ.app_name, request: fresh, status: "in_progress", previous: r.status, via, notified: 0 }),
      );
    }
  };

  if (event === "pull_request") {
    const pr = payload.pull_request;
    const text = `${pr.title}\n${pr.body ?? ""}`;
    const via = `PR #${pr.number} “${pr.title}”`;
    if (payload.action === "closed" && pr.merged) {
      await ship(shippedRefs(text), shipNoteFrom(pr.title), via);
    } else if (["opened", "reopened", "edited", "ready_for_review"].includes(payload.action) && !pr.draft) {
      await start(mentionedRefs(text), via);
    }
  } else if (event === "push") {
    const branch = String(payload.ref ?? "").replace("refs/heads/", "");
    if (branch === payload.repository?.default_branch) {
      for (const commit of payload.commits ?? []) {
        const numbers = shippedRefs(commit.message);
        if (numbers.length) await ship(numbers, shipNoteFrom(commit.message), `commit ${String(commit.id).slice(0, 7)}`);
      }
    }
  }
  return c.json({ ok: true, results });
});

export default hooks;

// ---------------------------------------------------------------- weekly digest

/** Two or three sentences on what people asked for this week. Null without Workers AI or enough to say. */
async function digestSummary(env: Env, appName: string, titles: string[], heard: string[]): Promise<string | null> {
  const all = [...titles.map((t) => `Request: ${t}`), ...heard.map((t) => `Heard elsewhere: ${t}`)];
  if (!env.AI || all.length < 3) return null;
  const text = await aiText(
    env,
    `You write one short paragraph for the owner of "${appName}", summarising what their users asked for this week. ` +
      "2 to 3 plain sentences, no greeting, no bullet points, no markdown. Name the common themes and any numbers " +
      '("Most asks are about exporting data; 3 people want offline mode"). Only use the list you are given.',
    all.slice(0, 40).join("\n"),
  );
  return text ? text.replace(/\s+/g, " ").slice(0, 400) : null;
}

export async function sendDigests(env: Env) {
  const { results: apps } = await env.DB.prepare(
    "SELECT a.id, a.name, i.config FROM integrations i JOIN apps a ON a.id = i.app_id WHERE i.kind = 'telegram'",
  ).all<Pick<AppRow, "id" | "name"> & { config: string }>();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const app of apps) {
    const cfg = JSON.parse(app.config) as TelegramConfig;
    const token = botTokenFor(env, cfg);
    if (!cfg.chatId || !token) continue;
    const stats = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM requests WHERE app_id = ?1 AND created_at > ?2) AS new_requests,
         (SELECT COUNT(*) FROM votes v JOIN requests r ON r.id = v.request_id WHERE r.app_id = ?1 AND v.created_at > ?2) AS votes,
         (SELECT COUNT(*) FROM requests WHERE app_id = ?1 AND status = 'shipped' AND shipped_at > ?2) AS shipped`,
    )
      .bind(app.id, since)
      .first<{ new_requests: number; votes: number; shipped: number }>();
    if (!stats) continue;
    // Heard elsewhere items still waiting in the inbox (the table exists from migration 0008).
    const { results: heard } = await env.DB.prepare(
      "SELECT source, url, feature FROM listening_items WHERE app_id = ? AND status = 'new' AND created_at > ? ORDER BY strength DESC, created_at DESC LIMIT 20",
    )
      .bind(app.id, since)
      .all<{ source: string; url: string; feature: string }>();
    if (stats.new_requests + stats.votes + stats.shipped + heard.length === 0) continue;
    const { results: top } = await env.DB.prepare(
      "SELECT * FROM requests WHERE app_id = ? AND status IN ('open','planned','in_progress') ORDER BY vote_count DESC, created_at DESC LIMIT 3",
    )
      .bind(app.id)
      .all<RequestRow>();
    const { results: fresh } = await env.DB.prepare("SELECT title FROM requests WHERE app_id = ? AND created_at > ? AND status != 'merged' ORDER BY created_at DESC LIMIT 25")
      .bind(app.id, since)
      .all<{ title: string }>();
    const summary = await digestSummary(env, app.name, fresh.map((r) => r.title), heard.map((h) => h.feature));
    const lines = [
      `📬 <b>${esc(app.name)}: your week</b>`,
      `${stats.new_requests} new ${stats.new_requests === 1 ? "request" : "requests"} · ${stats.votes} ${stats.votes === 1 ? "vote" : "votes"} · ${stats.shipped} shipped`,
      summary ? `\n${esc(summary)}` : "",
      top.length ? "\n<b>Most wanted</b>" : "",
      ...top.map((r, i) => `${i + 1}. ${ref(r)} ${esc(r.title)} · ${r.vote_count} ${r.vote_count === 1 ? "vote" : "votes"}`),
      heard.length ? `\n<b>Heard elsewhere</b> · ${heard.length} new` : "",
      ...heard.slice(0, 3).map((h) => `• <a href="${esc(h.url)}">${esc(h.feature)}</a> (${h.source === "reddit" ? "Reddit" : "App Store"})`),
      heard.length ? "Review them in your dashboard." : "",
      top.length ? `\nTip: commit with “closes ${ref(top[0])}” and everyone who asked is told when it ships.` : "",
    ].filter(Boolean);
    await tg(env, token, "sendMessage", { chat_id: cfg.chatId, text: lines.join("\n"), parse_mode: "HTML", disable_web_page_preview: true });
  }
}

export async function connectedIntegrations(db: D1Database, appId: string) {
  return loadIntegrations(db, appId);
}
