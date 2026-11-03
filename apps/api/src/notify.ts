// Tells the team about new requests, comments and automatic status changes, in Telegram (with
// buttons to act on them) and in plain Slack/Discord/JSON webhooks.
import { ref } from "./actions";
import { parseContext, type Env, type Integration, type RequestRow, type Status, type TelegramConfig, type WebhookConfig } from "./types";

type Author = { name: string | null; email: string | null; is_anon: number } | null;
type Attachment = { id: string; url: string };

export type TeamEvent =
  | {
      kind: "request";
      appName: string;
      request: RequestRow;
      author: Author;
      similar?: RequestRow | null;
      attachments?: Attachment[];
      /** The API's own origin, for links to screenshots in chat apps that only take text. */
      origin?: string;
    }
  | { kind: "comment"; appName: string; request: RequestRow; author: Author; body: string }
  | {
      kind: "auto-status";
      appName: string;
      request: RequestRow;
      status: Status;
      previous: Status;
      via: string;
      notified: number;
    };

const STATUS_WORD: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Not planned",
  merged: "Merged",
  pending: "Needs approval",
};

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function who(a: Author): string {
  if (!a) return "Someone";
  if (a.is_anon) return "Anonymous";
  return a.name || a.email || "A user";
}

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

export async function tg(env: Env, token: string, method: string, body: unknown): Promise<any> {
  const res = await fetch(`${env.TELEGRAM_API ?? "https://api.telegram.org"}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
  if (!data.ok) console.error("telegram", method, data.description);
  return data;
}

/** Like tg(), for methods that upload a file. */
export async function tgUpload(env: Env, token: string, method: string, form: FormData): Promise<any> {
  const res = await fetch(`${env.TELEGRAM_API ?? "https://api.telegram.org"}/bot${token}/${method}`, { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; description?: string };
  if (!data.ok) console.error("telegram", method, data.description);
  return data;
}

/** The token to call Telegram with: the shared bot's for shared chats, the app's own otherwise. */
export function botTokenFor(env: Env, cfg: TelegramConfig): string | null {
  return (cfg.shared ? env.YOUASKED_BOT_TOKEN : cfg.botToken) || null;
}

type Button = { text: string; callback_data: string };

/** "/pricing · charts": where the request came from, in one short line. */
export function contextLine(r: RequestRow): string | null {
  const ctx = parseContext(r.context);
  if (!ctx) return null;
  return [ctx.path, ctx.topic && `about ${ctx.topic}`].filter(Boolean).join(" · ") || null;
}

/** Telegram captions stop at 1024 characters, so a card with a screenshot keeps its details shorter. */
const CAPTION_BODY = 280;

/** The card for a request: its text and the buttons that act on it. */
export function requestCard(
  r: RequestRow,
  appName: string,
  extra: { author?: Author; similar?: RequestRow | null; earlyAccess?: number; photo?: boolean } = {},
) {
  const lines = [
    `💡 <b>${esc(appName)}</b> · ${ref(r)}${r.status !== "open" ? ` · ${STATUS_WORD[r.status]}` : ""}`,
    `<b>${esc(r.title)}</b>`,
  ];
  if (r.body && r.body !== r.title) lines.push(esc(clip(r.body, extra.photo ? CAPTION_BODY : 600)));
  const meta = [`${r.vote_count} ${r.vote_count === 1 ? "vote" : "votes"}`];
  if (extra.author !== undefined) meta.unshift(esc(who(extra.author)));
  lines.push(`<i>${meta.join(" · ")}</i>`);
  const where = contextLine(r);
  if (where) lines.push(`📍 ${esc(clip(where, 120))}`);
  if (r.source) lines.push(`🌐 Found on ${r.source === "reddit" ? "Reddit" : "the App Store"}`);
  if (r.elsewhere_count) lines.push(`🌐 Also asked elsewhere ×${r.elsewhere_count}`);
  if (extra.earlyAccess) lines.push(`🙋 ${extra.earlyAccess} want early access`);
  if (extra.similar) {
    lines.push(`\n🔁 Looks like ${ref(extra.similar)} “${esc(clip(extra.similar.title, 80))}” (${extra.similar.vote_count} votes)`);
  }
  if (r.status === "shipped" && r.ship_note) lines.push(`\nShip note: “${esc(r.ship_note)}”`);

  const statusRow: Button[] = (["planned", "in_progress", "shipped"] as const)
    .filter((s) => s !== r.status)
    .map((s) => ({ text: s === "planned" ? "📌 Planned" : s === "in_progress" ? "🛠 In progress" : "✅ Shipped", callback_data: `s:${r.id}:${s}` }));
  const second: Button[] = [{ text: "💬 Reply", callback_data: `r:${r.id}` }];
  if (r.status !== "shipped" && r.status !== "declined") second.push({ text: "🛠 Build it", callback_data: `b:${r.id}` });
  const third: Button[] = [];
  if (extra.similar) third.push({ text: `🔀 Merge into ${ref(extra.similar)}`, callback_data: `m:${r.id}:${extra.similar.id}` });
  if (r.status === "shipped") third.push({ text: "✏️ Ship note", callback_data: `n:${r.id}` });
  else if (r.status !== "declined") third.push({ text: "🚫 Decline", callback_data: `s:${r.id}:declined` });
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: [statusRow, second, third].filter((row) => row.length) } };
}

async function rememberMessage(env: Env, chatId: string, messageId: number | undefined, requestId: string, action = "card") {
  if (!messageId) return;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO telegram_messages (chat_id, message_id, request_id, action, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(chatId, messageId, requestId, action, Date.now())
    .run();
}

async function sendTelegram(env: Env, cfg: TelegramConfig, e: TeamEvent) {
  const token = botTokenFor(env, cfg);
  if (!cfg.chatId || !token) return;
  let text: string;
  let reply_markup: unknown;
  let photo: Attachment | undefined;
  if (e.kind === "request") {
    photo = e.attachments?.[0];
    ({ text, reply_markup } = requestCard(e.request, e.appName, { author: e.author, similar: e.similar, photo: Boolean(photo) }));
    text = text.replace("💡", "💡 New request ·");
  } else if (e.kind === "comment") {
    text = `💬 <b>${esc(who(e.author))}</b> on ${ref(e.request)} · ${esc(clip(e.request.title, 80))}\n“${esc(clip(e.body, 800))}”`;
    reply_markup = { inline_keyboard: [[{ text: "💬 Reply", callback_data: `r:${e.request.id}` }]] };
  } else {
    const shipped = e.status === "shipped";
    text = [
      `${shipped ? "✅" : "🛠"} <b>${ref(e.request)} → ${STATUS_WORD[e.status]}</b> · ${esc(clip(e.request.title, 80))}`,
      `<i>via ${esc(e.via)}</i>`,
      shipped && e.request.ship_note ? `Ship note: “${esc(e.request.ship_note)}”` : null,
      shipped ? `${e.notified} ${e.notified === 1 ? "person who asked has" : "people who asked have"} been told.` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const row: Button[] = shipped
      ? [
          { text: "✏️ Edit note", callback_data: `n:${e.request.id}` },
          { text: "↩️ Undo", callback_data: `u:${e.request.id}:${e.previous}` },
        ]
      : [{ text: "💬 Reply", callback_data: `r:${e.request.id}` }];
    reply_markup = { inline_keyboard: [row] };
  }
  if (cfg.interactive === false) {
    reply_markup = { inline_keyboard: [[{ text: "Open dashboard", url: cfg.dashboardUrl ?? "https://youasked-api.adenteo.workers.dev/admin" }]] };
  }
  // A request with a screenshot goes out as a photo with the card as its caption.
  let sent: any;
  const object = photo ? await env.UPLOADS.get(photo.id) : null;
  if (object) {
    const form = new FormData();
    form.set("chat_id", cfg.chatId);
    form.set("photo", new Blob([await object.arrayBuffer()], { type: object.httpMetadata?.contentType ?? "image/jpeg" }), "screenshot");
    form.set("caption", text);
    form.set("parse_mode", "HTML");
    form.set("reply_markup", JSON.stringify(reply_markup));
    sent = await tgUpload(env, token, "sendPhoto", form);
  }
  if (!sent?.ok) {
    sent = await tg(env, token, "sendMessage", {
      chat_id: cfg.chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    });
  }
  await rememberMessage(env, cfg.chatId, sent?.result?.message_id, e.request.id);
}

function plainText(e: TeamEvent): string {
  if (e.kind === "request") {
    const where = contextLine(e.request);
    const files = (e.attachments ?? []).map((a) => `\n📎 ${a.url}`).join("");
    return `New request in ${e.appName} · ${ref(e.request)}: ${e.request.title} (${who(e.author)})${where ? `\n📍 ${where}` : ""}${files}`;
  }
  if (e.kind === "comment") return `${who(e.author)} commented on ${ref(e.request)} (${e.request.title}): ${clip(e.body, 400)}`;
  return `${ref(e.request)} (${e.request.title}) → ${STATUS_WORD[e.status]} via ${e.via}`;
}

async function sendWebhook(cfg: WebhookConfig, e: TeamEvent) {
  const text = plainText(e);
  const body =
    cfg.format === "slack"
      ? { text }
      : cfg.format === "discord"
        ? { content: text }
        : {
            event: e.kind,
            text,
            request: {
              id: e.request.id,
              number: e.request.number,
              title: e.request.title,
              status: e.request.status,
              context: parseContext(e.request.context),
              attachments: e.kind === "request" ? (e.attachments ?? []).map((a) => a.url) : [],
            },
          };
  await fetch(cfg.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch((err) =>
    console.error("webhook", err),
  );
}

export async function loadIntegrations(db: D1Database, appId: string): Promise<Integration[]> {
  const { results } = await db
    .prepare("SELECT id, app_id, kind, config FROM integrations WHERE app_id = ?")
    .bind(appId)
    .all<{ id: string; app_id: string; kind: Integration["kind"]; config: string }>();
  return results.map((r) => ({ ...r, config: JSON.parse(r.config) }));
}

export async function notifyTeam(env: Env, appId: string, e: TeamEvent) {
  const integrations = await loadIntegrations(env.DB, appId);
  await Promise.all(
    integrations.map((i) => {
      if (i.kind === "telegram") return sendTelegram(env, i.config as TelegramConfig, e);
      if (i.kind === "webhook") return sendWebhook(i.config as WebhookConfig, e);
      return null;
    }),
  ).catch((err) => console.error("notifyTeam", err));
}

export { rememberMessage };
