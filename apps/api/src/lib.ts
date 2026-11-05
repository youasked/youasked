const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export function newId(prefix: string, length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => ALPHABET[b % 36]).join("")}`;
}

const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** What a signature covers: the user id, plus the email when the developer's server signed one. */
export const signedMessage = (userId: string, email?: string | null) => (email ? `${userId}\n${email.trim().toLowerCase()}` : userId);

export async function verifySignature(secret: string, userId: string, signature: string, email?: string | null): Promise<boolean> {
  const expected = encoder.encode(await hmacHex(secret, signedMessage(userId, email)));
  const given = encoder.encode(signature.toLowerCase());
  if (expected.byteLength !== given.byteLength) return false;
  return crypto.subtle.timingSafeEqual(expected, given);
}

export function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
}

/** Trims, collapses runs of spaces and drops control characters (keeps newlines). */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

const STOPWORDS = new Set(
  "a an and are as at be but by can could do for from have how i if in is it its me my of on or please pls so that the this to us want we when with would you your add allow make let able there should".split(
    " ",
  ),
);

function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    out.add(raw.length > 3 && raw.endsWith("s") ? raw.slice(0, -1) : raw);
  }
  return out;
}

/** Dice coefficient over content words. Good enough to catch "dark mode" vs "add a dark theme/mode". */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
}

/** Constant-time string compare, for secrets in headers. False for missing or different-length values. */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  if (x.byteLength !== y.byteLength) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}
