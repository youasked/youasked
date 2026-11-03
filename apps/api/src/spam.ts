// Spam and flood protection for new requests and comments: cheap text heuristics plus hourly
// counters per IP and per device. Answers come with a sentence the widget can show as is.
import { HTTPException } from "hono/http-exception";
import type { Env } from "./types";

/** Throws a JSON error that carries a friendly `message` next to the machine `error` code. */
export function reject(status: 400 | 403 | 404 | 422 | 429, error: string, message: string): never {
  throw new HTTPException(status, { res: Response.json({ error, message }, { status }) });
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|ru|cn|top|biz|info|shop|click|site|online)\b\S*/gi;

const SPAM_PHRASES = [
  /\b(?:buy|cheap|order)\s+(?:followers|likes|views|backlinks|viagra|cialis)\b/i,
  /\b(?:viagra|cialis|casino|porn|escort|payday loan|forex signals?|crypto giveaway|bitcoin doubler)\b/i,
  /\bseo (?:services|expert|agency|packages?)\b/i,
  /\bguest post(?:ing)?\b.*\b(?:paid|sponsored|link)\b/i,
  /\b(?:click here|limited time offer|act now|100% free|work from home|make money fast|earn \$?\d+)\b/i,
  /\b(?:whatsapp|telegram|wechat)\b.*(?:\+\d{6,}|@\w{4,})/i,
];

export type Verdict = { kind: "ok" } | { kind: "review"; why: string } | { kind: "spam"; why: string };

/** Pure: judges one piece of text. "review" means hold it for a person to look at. */
export function judgeText(text: string): Verdict {
  const t = text.trim();
  if (!t) return { kind: "ok" };
  const links = t.match(URL_RE) ?? [];
  const withoutLinks = t.replace(URL_RE, " ");
  const letters = withoutLinks.replace(/[^\p{L}\p{N}]/gu, "");
  if (links.length > 0 && letters.length < 8) return { kind: "spam", why: "links_only" };
  if (links.length >= 3) return { kind: "spam", why: "many_links" };
  if (/(.)\1{9,}/u.test(t.replace(/\s+/g, ""))) return { kind: "spam", why: "repeated_characters" };
  const words = t.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    if (Math.max(...counts.values()) / words.length > 0.5) return { kind: "spam", why: "repeated_words" };
  }
  for (const re of SPAM_PHRASES) if (re.test(t)) return { kind: "spam", why: "spam_phrase" };
  if (links.length === 2) return { kind: "review", why: "two_links" };
  const upper = t.replace(/[^A-Z]/g, "").length;
  const alpha = t.replace(/[^A-Za-z]/g, "").length;
  if (alpha >= 30 && upper / alpha > 0.8) return { kind: "review", why: "shouting" };
  return { kind: "ok" };
}

async function shortHash(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Counts this hit and says whether the limit for the current hour is already used up. */
export async function overLimit(db: D1Database, key: string, limit: number): Promise<boolean> {
  const bucket = Math.floor(Date.now() / 3_600_000);
  const row = await db
    .prepare("INSERT INTO rate_limits (key, bucket, n) VALUES (?1, ?2, 1) ON CONFLICT (key, bucket) DO UPDATE SET n = n + 1 RETURNING n")
    .bind(key, bucket)
    .first<{ n: number }>();
  if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limits WHERE bucket < ?").bind(bucket - 2).run();
  return (row?.n ?? 1) > limit;
}

const LIMITS = { request: { ip: 30, device: 8 }, comment: { ip: 90, device: 25 } } as const;

/**
 * Runs before a request or comment is saved. Throws a friendly 429 when someone is going too fast
 * (by IP or by device) and a 422 for obvious spam. Returns "review" for text that deserves a person's eye.
 */
export async function guardContent(
  env: Env,
  headers: Headers,
  appId: string,
  kind: "request" | "comment",
  text: string,
): Promise<"ok" | "review"> {
  const verdict = judgeText(text);
  if (verdict.kind === "spam") {
    reject(422, "looks_like_spam", "That looks like spam, so we didn't post it. Reword it and try again.");
  }
  const ip = headers.get("cf-connecting-ip");
  const device = headers.get("x-youasked-anon");
  const noun = kind === "request" ? "requests" : "comments";
  const slow = `You're posting ${noun} very fast. Please try again in a little while.`;
  if (ip && (await overLimit(env.DB, `${kind}:${appId}:ip:${await shortHash(ip)}`, LIMITS[kind].ip))) {
    reject(429, "slow_down", slow);
  }
  if (device && (await overLimit(env.DB, `${kind}:${appId}:dev:${await shortHash(device)}`, LIMITS[kind].device))) {
    reject(429, "slow_down", slow);
  }
  return verdict.kind === "review" ? "review" : "ok";
}
