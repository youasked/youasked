/**
 * Server-only helper. Signs a user id with your secret key so nobody can vote or post as someone else.
 *
 *   const signature = await signUser(process.env.YOUASKED_SECRET_KEY!, user.id)
 *
 * Pass their email too if YouAsked should email them when what they asked for ships, and send the
 * same email in `user`. Only emails covered by the signature are ever emailed.
 *
 *   const signature = await signUser(process.env.YOUASKED_SECRET_KEY!, user.id, user.email)
 *
 * Works in Node 18+, edge runtimes, Bun and Deno (Web Crypto).
 */
export async function signUser(secretKey: string, userId: string | number, email?: string | null): Promise<string> {
  if (!secretKey?.startsWith("ya_sec_")) throw new Error("signUser needs your secret key (ya_sec_…)");
  const message = email ? `${userId}\n${email.trim().toLowerCase()}` : String(userId);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}
