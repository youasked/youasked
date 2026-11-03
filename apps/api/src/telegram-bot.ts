// What a team can do from Telegram: button presses on request cards, replies to cards, and the
// shared @youasked_bot's one-tap connect. The same handler serves an app's own bot and the shared
// bot; only the token and the way a chat is matched to an app differ, and both are parameters.
import type { Mail } from "./mail";
import { Hono } from "hono";
import {
  addTeamComment,
  loadRequestById,
  mergeRequests,
  ref,
  setShipNote,
  setStatus,
  undoShip,
} from "./actions";
import { fail, requireApp, type AppEnv } from "./app-auth";
import { buildFor } from "./build";
import { cleanText, newId } from "./lib";
import { esc, requestCard, rememberMessage, tg, tgUpload } from "./notify";
import { STATUSES, type AppRow, type Env, type Status, type TelegramConfig } from "./types";

export const SHARED_BOT = "youasked_bot";
const CODE_TTL = 30 * 60 * 1000;

export type TgUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number; title?: string; first_name?: string; type: string };
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number }; photo?: unknown[] };
  };
};

/** The app a chat is wired to, as found for one update. */
export type Target = { appId: string; appName: string; chatId: string };
/** Finds the app for a chat. requestId is set for button presses and replies (a card belongs to one app). */
export type Resolve = (chatId: string, requestId: string | null) => Promise<Target | null>;

const say = (env: Env, token: string, chatId: string | number, text: string, extra: Record<string, unknown> = {}) =>
  tg(env, token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra });

/** Buttons and replies, for any bot. Returns quietly for chats and cards it does not know. */
/** waitUntil lets status changes and replies send their "it shipped" and reply emails after the webhook answers. */
export async function handleBotUpdate(
  env: Env,
  origin: string,
  update: TgUpdate,
  token: string,
  resolve: Resolve,
  waitUntil: (p: Promise<unknown>) => void = () => {},
) {
  const mail: Mail = { env, waitUntil };
  const msg = update.message;
  const chatId = String(msg?.chat.id ?? update.callback_query?.message?.chat.id ?? "");
  if (!chatId) return;

  // Buttons on a request card.
  const cq = update.callback_query;
  if (cq?.data) {
    const [action, requestId, arg] = cq.data.split(":");
    const target = await resolve(chatId, requestId);
    if (!target) {
      await tg(env, token, "answerCallbackQuery", { callback_query_id: cq.id, text: "That request is gone." });
      return;
    }
    const r = await loadRequestById(env.DB, target.appId, requestId);
    if (!r) {
      await tg(env, token, "answerCallbackQuery", { callback_query_id: cq.id, text: "That request is gone." });
      return;
    }
    let toast = "";
    if (action === "s" && (STATUSES as readonly string[]).includes(arg)) {
      const { notified } = await setStatus(env.DB, r, arg as Status, undefined, mail);
      toast = arg === "shipped" ? `Shipped. ${notified} told.` : `Marked ${arg.replace("_", " ")}.`;
    } else if (action === "u" && (STATUSES as readonly string[]).includes(arg)) {
      await undoShip(env.DB, r, arg as Status);
      toast = "Undone.";
    } else if (action === "m") {
      const into = await loadRequestById(env.DB, target.appId, arg);
      if (into) {
        await mergeRequests(env.DB, r, into);
        toast = `Merged into ${ref(into)}.`;
      }
    } else if (action === "b") {
      await tg(env, token, "answerCallbackQuery", { callback_query_id: cq.id, text: "Writing the prompt…" });
      await sendBuildPrompt(env, origin, token, target, r, cq.message?.message_id);
      return;
    } else if (action === "r" || action === "n") {
      await tg(env, token, "answerCallbackQuery", { callback_query_id: cq.id });
      const prompt =
        action === "r"
          ? `💬 Reply to ${ref(r)} · <b>${esc(r.title)}</b>\nWhatever you send next as a reply to this message goes to everyone who asked, in the app.`
          : `✏️ Ship note for ${ref(r)} · <b>${esc(r.title)}</b>\nReply to this message with the note people will see, e.g. “Find it in Settings → Appearance.”`;
      const sent = await say(env, token, target.chatId, prompt, { reply_markup: { force_reply: true, selective: true } });
      await rememberMessage(env, target.chatId, sent?.result?.message_id, r.id, action === "r" ? "reply" : "note");
      return;
    }
    await tg(env, token, "answerCallbackQuery", { callback_query_id: cq.id, text: toast || "Done." });
    // Refresh the card so it shows where the request stands now.
    const fresh = await loadRequestById(env.DB, target.appId, r.id);
    if (fresh && cq.message && action !== "u") {
      const early = await env.DB.prepare("SELECT COUNT(*) AS n FROM early_access WHERE request_id = ?").bind(fresh.id).first<{ n: number }>();
      const isPhoto = Boolean(cq.message.photo);
      const card = requestCard(fresh, target.appName, { earlyAccess: early?.n ?? 0, photo: isPhoto });
      // A card with a screenshot is a photo message, whose text is its caption.
      await tg(env, token, isPhoto ? "editMessageCaption" : "editMessageText", {
        chat_id: target.chatId,
        message_id: cq.message.message_id,
        ...(isPhoto ? { caption: card.text } : { text: card.text, disable_web_page_preview: true }),
        parse_mode: "HTML",
        reply_markup: card.reply_markup,
      });
    }
    return;
  }

  // A reply to a card or prompt answers the person who asked (or sets the ship note).
  if (msg?.text && msg.reply_to_message && !msg.text.startsWith("/")) {
    const link = await env.DB.prepare("SELECT request_id, action FROM telegram_messages WHERE chat_id = ? AND message_id = ?")
      .bind(chatId, msg.reply_to_message.message_id)
      .first<{ request_id: string; action: string }>();
    if (!link) return;
    const target = await resolve(chatId, link.request_id);
    if (!target) return;
    const r = await loadRequestById(env.DB, target.appId, link.request_id);
    if (!r) return;
    const text = cleanText(msg.text, 2000);
    if (!text) return;
    if (link.action === "note") {
      await setShipNote(env.DB, r, cleanText(text, 500));
      await say(env, token, chatId, `✏️ Ship note saved for ${ref(r)}.`, { reply_to_message_id: msg.message_id });
    } else {
      const { notified } = await addTeamComment(env.DB, r, text, mail);
      await say(env, token, chatId, `✓ Sent to ${notified} ${notified === 1 ? "person" : "people"} in the app.`, { reply_to_message_id: msg.message_id });
    }
  }
}

/** "Build it": the prompt for a coding agent (as a file when it is long) and the issue link. */
async function sendBuildPrompt(env: Env, origin: string, token: string, target: Target, r: Parameters<typeof buildFor>[2], replyTo?: number) {
  const app = await env.DB.prepare("SELECT * FROM apps WHERE id = ?").bind(target.appId).first<AppRow>();
  if (!app) return;
  const { prompt, issueUrl } = await buildFor(env, app, r, origin);
  const tail = issueUrl ? `\n\nGitHub issue: ${issueUrl}` : "";
  const header = `🛠 ${ref(r)} · ${r.title}\nPaste this into Claude Code, Codex or Cursor.`;
  if (prompt.length + tail.length + header.length < 3800) {
    await tg(env, token, "sendMessage", {
      chat_id: target.chatId,
      text: `${header}\n\n${prompt}${tail}`,
      disable_web_page_preview: true,
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
    });
    return;
  }
  const form = new FormData();
  form.set("chat_id", target.chatId);
  form.set("document", new Blob([prompt], { type: "text/markdown" }), `${ref(r).toLowerCase()}-build-prompt.md`);
  form.set("caption", `${header}${tail}`.slice(0, 1000));
  if (replyTo) form.set("reply_to_message_id", String(replyTo));
  await tgUpload(env, token, "sendDocument", form);
}

// ---------------------------------------------------------------- shared bot

/** Own-bot mode: the one chat the app linked. */
export const resolveOwn =
  (appId: string, appName: string, cfg: TelegramConfig): Resolve =>
  async (chatId) =>
    cfg.chatId && chatId === cfg.chatId ? { appId, appName, chatId } : null;

/**
 * Shared mode: a card belongs to one app, and that app must have this chat bound through the
 * shared bot. A chat can hold several apps, so the chat alone is not enough.
 */
export const resolveShared: (env: Env) => Resolve = (env) => async (chatId, requestId) => {
  if (!requestId) return null;
  const row = await env.DB.prepare(
    `SELECT a.id AS appId, a.name AS appName FROM requests r
     JOIN apps a ON a.id = r.app_id
     JOIN integrations i ON i.app_id = a.id AND i.kind = 'telegram'
     WHERE r.id = ? AND json_extract(i.config, '$.shared') = 1 AND json_extract(i.config, '$.chatId') = ?`,
  )
    .bind(requestId, chatId)
    .first<{ appId: string; appName: string }>();
  return row ? { ...row, chatId } : null;
};

const HELP = [
  "<b>YouAsked</b> brings your users' feature requests here.",
  "",
  "Each request arrives as a card. Tap <b>Planned</b>, <b>In progress</b> or <b>Shipped</b> to update it (shipping tells everyone who asked), <b>Reply</b> to answer them in the app, <b>Build it</b> to get a prompt for your coding agent.",
  "You can also reply to any card with plain text to answer the person who asked.",
  "",
  "/apps  apps connected to this chat",
  "/help  this message",
  "",
  "To connect an app, open it in your dashboard (app.youasked.dev) and choose Connect Telegram.",
].join("\n");

/** Messages to the shared bot: /start <code>, /help, /apps. */
async function handleSharedMessage(env: Env, update: TgUpdate, token: string) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const cmd = /^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/.exec(text);
  if (!cmd) return;
  const [, name, arg] = cmd;

  if (name === "start" && arg) {
    const t = Date.now();
    // Taking the row first makes the code single-use even if two updates race.
    const row = await env.DB.prepare("DELETE FROM telegram_connect_codes WHERE code = ? RETURNING app_id, expires_at").bind(arg).first<{ app_id: string; expires_at: number }>();
    if (!row || row.expires_at < t) {
      await say(env, token, chatId, "That link has expired or was already used. Make a new one from your dashboard (Connect Telegram).");
      return;
    }
    const app = await env.DB.prepare("SELECT id, name FROM apps WHERE id = ?").bind(row.app_id).first<{ id: string; name: string }>();
    if (!app) return;
    await bindSharedChat(env, app.id, chatId, msg.chat.title ?? msg.chat.first_name ?? null);
    await say(env, token, chatId, `✅ Connected to <b>${esc(app.name)}</b>. New requests will show up here.\n\nSend /help to see what you can do.`);
    return;
  }
  if (name === "start" || name === "help") {
    await say(env, token, chatId, HELP);
    return;
  }
  if (name === "apps") {
    const { results } = await env.DB.prepare(
      `SELECT a.name FROM integrations i JOIN apps a ON a.id = i.app_id
       WHERE i.kind = 'telegram' AND json_extract(i.config, '$.shared') = 1 AND json_extract(i.config, '$.chatId') = ? ORDER BY a.name`,
    )
      .bind(chatId)
      .all<{ name: string }>();
    await say(
      env,
      token,
      chatId,
      results.length ? `Apps posting here:\n${results.map((a) => `• ${esc(a.name)}`).join("\n")}` : "No apps are connected to this chat yet. Use Connect Telegram in your dashboard.",
    );
  }
}

/** Points the app's Telegram integration at this chat through the shared bot, replacing an own bot if there was one. */
async function bindSharedChat(env: Env, appId: string, chatId: string, title: string | null) {
  const existing = await env.DB.prepare("SELECT id, config FROM integrations WHERE app_id = ? AND kind = 'telegram'").bind(appId).first<{ id: string; config: string }>();
  const config: TelegramConfig = { botToken: "", botUsername: SHARED_BOT, secret: "", linkCode: null, chatId, chatTitle: title, interactive: true, shared: true };
  if (existing) {
    const old = JSON.parse(existing.config) as TelegramConfig;
    // The previous own bot would keep sending updates to a webhook that no longer routes anywhere.
    if (!old.shared && old.interactive !== false && old.botToken) await tg(env, old.botToken, "deleteWebhook", {});
    await env.DB.prepare("UPDATE integrations SET config = ? WHERE id = ?").bind(JSON.stringify(config), existing.id).run();
  } else {
    await env.DB.prepare("INSERT INTO integrations (id, app_id, kind, config, created_at) VALUES (?, ?, 'telegram', ?, ?)")
      .bind(newId("int"), appId, JSON.stringify(config), Date.now())
      .run();
  }
}

/** Entry point for POST /v1/hooks/telegram-shared. */
export async function handleSharedUpdate(env: Env, origin: string, update: TgUpdate, waitUntil?: (p: Promise<unknown>) => void) {
  const token = env.YOUASKED_BOT_TOKEN;
  if (!token) return;
  if (update.message) await handleSharedMessage(env, update, token);
  await handleBotUpdate(env, origin, update, token, resolveShared(env), waitUntil);
}

// ---------------------------------------------------------------- admin: connect

export const telegramConnect = new Hono<AppEnv>();
telegramConnect.use("/integrations/telegram/connect", requireApp);

/** A one-time deep link that binds a chat to this app through the shared bot. */
telegramConnect.post("/integrations/telegram/connect", async (c) => {
  if (!c.env.YOUASKED_BOT_TOKEN || !c.env.YOUASKED_BOT_SECRET) fail(502, "shared_bot_not_configured");
  const app = c.get("app");
  const t = Date.now();
  const code = newId("c", 14).slice(2);
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM telegram_connect_codes WHERE expires_at < ? OR app_id = ?").bind(t, app.id),
    c.env.DB.prepare("INSERT INTO telegram_connect_codes (code, app_id, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(code, app.id, t + CODE_TTL, t),
  ]);
  return c.json({
    link: `https://t.me/${SHARED_BOT}?startgroup=${code}`,
    directLink: `https://t.me/${SHARED_BOT}?start=${code}`,
    code,
    expiresInMinutes: CODE_TTL / 60000,
  });
});
