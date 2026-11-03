// Incoming webhooks: Telegram (buttons and replies from the team's chat) and GitHub (PRs and
// commits that mention YA-12), plus the weekly digest.
import { Hono } from "hono";
import {
  addTeamComment,
  loadRequestById,
  loadRequestByNumber,
  mergeRequests,
  ref,
  setShipNote,
  setStatus,
  undoShip,
} from "./actions";
import { cleanText, hmacHex } from "./lib";
import { esc, loadIntegrations, notifyTeam, rememberMessage, requestCard, tg } from "./notify";
import { STATUSES, type AppRow, type Env, type GithubConfig, type Integration, type RequestRow, type Status, type TelegramConfig } from "./types";

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

type TgUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; title?: string; first_name?: string; type: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

hooks.post("/telegram/:id", async (c) => {
  const integ = await loadIntegration<TelegramConfig>(c.env.DB, c.req.param("id"));
  if (!integ || integ.kind !== "telegram") return c.text("unknown", 404);
  const cfg = integ.config;
  // Notify-only bots never point their webhook here, so nothing here should be accepted for them.
  if (cfg.interactive === false || !cfg.secret) return c.text("unknown", 404);
  if (c.req.header("x-telegram-bot-api-secret-token") !== cfg.secret) return c.text("forbidden", 403);
  const update = await c.req.json<TgUpdate>();
  const env = c.env;
  const say = (chatId: string | number, text: string, extra: Record<string, unknown> = {}) =>
    tg(env, cfg.botToken, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

  // Linking: /start <code> from the deep link connects that chat.
  const msg = update.message;
  if (msg?.text?.startsWith("/start")) {
    const code = msg.text.split(/\s+/)[1];
    if (code && cfg.linkCode && code === cfg.linkCode) {
      cfg.chatId = String(msg.chat.id);
      cfg.chatTitle = msg.chat.title ?? msg.chat.first_name ?? null;
      cfg.linkCode = null;
      await saveConfig(env.DB, integ.id, cfg);
      await say(
        msg.chat.id,
        `✅ Connected to <b>${esc(integ.app_name)}</b>.\nNew requests and comments will show up here with buttons to plan, ship, reply or merge them. Reply to any card to answer the person who asked.`,
      );
    } else if (String(msg.chat.id) !== cfg.chatId) {
      await say(msg.chat.id, "This bot posts feature requests for a YouAsked app. Use the connect link from your dashboard to link a chat.");
    }
    return c.json({ ok: true });
  }

  const chatId = String(msg?.chat.id ?? update.callback_query?.message?.chat.id ?? "");
  if (!cfg.chatId || chatId !== cfg.chatId) return c.json({ ok: true });

  // Buttons on a request card.
  const cq = update.callback_query;
  if (cq?.data) {
    const [action, requestId, arg] = cq.data.split(":");
    const r = await loadRequestById(env.DB, integ.app_id, requestId);
    if (!r) {
      await tg(env, cfg.botToken, "answerCallbackQuery", { callback_query_id: cq.id, text: "That request is gone." });
      return c.json({ ok: true });
    }
    let toast = "";
    if (action === "s" && (STATUSES as readonly string[]).includes(arg)) {
      const { notified } = await setStatus(env.DB, r, arg as Status);
      toast = arg === "shipped" ? `Shipped. ${notified} told.` : `Marked ${arg.replace("_", " ")}.`;
    } else if (action === "u" && (STATUSES as readonly string[]).includes(arg)) {
      await undoShip(env.DB, r, arg as Status);
      toast = "Undone.";
    } else if (action === "m") {
      const into = await loadRequestById(env.DB, integ.app_id, arg);
      if (into) {
        await mergeRequests(env.DB, r, into);
        toast = `Merged into ${ref(into)}.`;
      }
    } else if (action === "r" || action === "n") {
      await tg(env, cfg.botToken, "answerCallbackQuery", { callback_query_id: cq.id });
      const prompt =
        action === "r"
          ? `💬 Reply to ${ref(r)} · <b>${esc(r.title)}</b>\nWhatever you send next as a reply to this message goes to everyone who asked, in the app.`
          : `✏️ Ship note for ${ref(r)} · <b>${esc(r.title)}</b>\nReply to this message with the note people will see, e.g. “Find it in Settings → Appearance.”`;
      const sent = await say(cfg.chatId, prompt, { reply_markup: { force_reply: true, selective: true } });
      await rememberMessage(env, cfg.chatId, sent?.result?.message_id, r.id, action === "r" ? "reply" : "note");
      return c.json({ ok: true });
    }
    await tg(env, cfg.botToken, "answerCallbackQuery", { callback_query_id: cq.id, text: toast || "Done." });
    // Refresh the card so it shows where the request stands now.
    const fresh = await loadRequestById(env.DB, integ.app_id, r.id);
    if (fresh && cq.message && action !== "u") {
      const card = requestCard(fresh, integ.app_name);
      await tg(env, cfg.botToken, "editMessageText", {
        chat_id: cfg.chatId,
        message_id: cq.message.message_id,
        text: card.text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: card.reply_markup,
      });
    }
    return c.json({ ok: true });
  }

  // A reply to a card or prompt answers the person who asked (or sets the ship note).
  if (msg?.text && msg.reply_to_message) {
    const link = await env.DB.prepare("SELECT request_id, action FROM telegram_messages WHERE chat_id = ? AND message_id = ?")
      .bind(chatId, msg.reply_to_message.message_id)
      .first<{ request_id: string; action: string }>();
    if (!link) return c.json({ ok: true });
    const r = await loadRequestById(env.DB, integ.app_id, link.request_id);
    if (!r) return c.json({ ok: true });
    const text = cleanText(msg.text, 2000);
    if (!text) return c.json({ ok: true });
    if (link.action === "note") {
      await setShipNote(env.DB, r, cleanText(text, 500));
      await say(chatId, `✏️ Ship note saved for ${ref(r)}.`, { reply_to_message_id: msg.message_id });
    } else {
      const { notified } = await addTeamComment(env.DB, r, text);
      await say(chatId, `✓ Sent to ${notified} ${notified === 1 ? "person" : "people"} in the app.`, { reply_to_message_id: msg.message_id });
    }
  }
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
      const { notified } = await setStatus(env.DB, r, "shipped", r.ship_note ?? (note || null));
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

export async function sendDigests(env: Env) {
  const { results: apps } = await env.DB.prepare(
    "SELECT a.id, a.name, i.config FROM integrations i JOIN apps a ON a.id = i.app_id WHERE i.kind = 'telegram'",
  ).all<Pick<AppRow, "id" | "name"> & { config: string }>();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const app of apps) {
    const cfg = JSON.parse(app.config) as TelegramConfig;
    if (!cfg.chatId) continue;
    const stats = await env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM requests WHERE app_id = ?1 AND created_at > ?2) AS new_requests,
         (SELECT COUNT(*) FROM votes v JOIN requests r ON r.id = v.request_id WHERE r.app_id = ?1 AND v.created_at > ?2) AS votes,
         (SELECT COUNT(*) FROM requests WHERE app_id = ?1 AND status = 'shipped' AND shipped_at > ?2) AS shipped`,
    )
      .bind(app.id, since)
      .first<{ new_requests: number; votes: number; shipped: number }>();
    if (!stats || stats.new_requests + stats.votes + stats.shipped === 0) continue;
    const { results: top } = await env.DB.prepare(
      "SELECT * FROM requests WHERE app_id = ? AND status IN ('open','planned','in_progress') ORDER BY vote_count DESC, created_at DESC LIMIT 3",
    )
      .bind(app.id)
      .all<RequestRow>();
    const lines = [
      `📬 <b>${esc(app.name)}: your week</b>`,
      `${stats.new_requests} new ${stats.new_requests === 1 ? "request" : "requests"} · ${stats.votes} ${stats.votes === 1 ? "vote" : "votes"} · ${stats.shipped} shipped`,
      top.length ? "\n<b>Most wanted</b>" : "",
      ...top.map((r, i) => `${i + 1}. ${ref(r)} ${esc(r.title)} · ${r.vote_count} ${r.vote_count === 1 ? "vote" : "votes"}`),
      top.length ? `\nTip: commit with “closes ${ref(top[0])}” and everyone who asked is told when it ships.` : "",
    ].filter(Boolean);
    await tg(env, cfg.botToken, "sendMessage", { chat_id: cfg.chatId, text: lines.join("\n"), parse_mode: "HTML" });
  }
}

export async function connectedIntegrations(db: D1Database, appId: string) {
  return loadIntegrations(db, appId);
}
