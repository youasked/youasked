// Transactional email (sign-in links, "it shipped" notes). The accounts stream implements sending
// through Cloudflare Email Sending (env.EMAIL); until then, and whenever the binding is missing,
// mail is logged so local dev and tests still see it.
import type { Env } from "./types";

export type Email = { to: string; subject: string; text: string; html?: string };

export const FROM = "YouAsked <hello@youasked.dev>";

export async function sendEmail(env: Env, email: Email): Promise<boolean> {
  if (!env.EMAIL) {
    console.log(`[email] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`);
    return false;
  }
  // Replaced by the accounts stream with a real send.
  console.log(`[email] EMAIL binding present but sending not implemented yet: to=${email.to}`);
  return false;
}
