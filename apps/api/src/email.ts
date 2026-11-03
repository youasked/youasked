// Transactional email (sign-in links, invites, "it shipped" notes) through Cloudflare Email Sending
// (the EMAIL binding). When the binding is missing, mail is logged so local dev and tests still see it.
import type { Env } from "./types";

export type Email = { to: string; subject: string; text: string; html?: string };

export const FROM = { email: "hello@youasked.dev", name: "YouAsked" };

export async function sendEmail(env: Env, email: Email): Promise<boolean> {
  if (!env.EMAIL) {
    console.log(`[email] to=${email.to} subject=${JSON.stringify(email.subject)}\n${email.text}`);
    return false;
  }
  try {
    await env.EMAIL.send({ from: FROM, to: email.to, subject: email.subject, text: email.text, ...(email.html ? { html: email.html } : {}) });
    return true;
  } catch (err) {
    console.error(`[email] send to ${email.to} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One calm card: a headline, a line of context, one button, a fallback link. */
function layout(o: { preheader: string; heading: string; body: string; button: string; url: string; foot: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"></head>
<body style="margin:0;padding:0;background:#F4F6FA;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<div style="padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#141B2D;">
  <div style="max-width:440px;margin:0 auto;">
    <div style="font-weight:700;font-size:17px;letter-spacing:-0.01em;margin:0 0 18px 4px;color:#141B2D;">YouAsked</div>
    <div style="background:#ffffff;border:1px solid #dde2ec;border-radius:16px;padding:28px 28px 26px;">
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;letter-spacing:-0.02em;color:#141B2D;">${esc(o.heading)}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#4a5470;">${esc(o.body)}</p>
      <a href="${esc(o.url)}" style="display:inline-block;background:#2B4BEE;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px;">${esc(o.button)}</a>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#6b7590;">Button not working? Paste this link into your browser:<br><a href="${esc(o.url)}" style="color:#2B4BEE;word-break:break-all;">${esc(o.url)}</a></p>
    </div>
    <p style="margin:16px 4px 0;font-size:12.5px;line-height:1.5;color:#6b7590;">${esc(o.foot)}</p>
  </div>
</div>
</body></html>`;
}

export function signInEmail(to: string, url: string): Email {
  return {
    to,
    subject: "Your YouAsked sign-in link",
    text: `Sign in to YouAsked:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
    html: layout({
      preheader: "Your sign-in link works once and expires in 15 minutes.",
      heading: "Sign in to YouAsked",
      body: "Tap the button to sign in. The link works once and expires in 15 minutes.",
      button: "Sign in",
      url,
      foot: "If you didn't ask for this, you can ignore this email. Nobody can sign in without the link.",
    }),
  };
}

export function inviteEmail(to: string, o: { workspace: string; inviter: string; url: string }): Email {
  return {
    to,
    subject: `${o.inviter} invited you to ${o.workspace} on YouAsked`,
    text: `${o.inviter} invited you to join ${o.workspace} on YouAsked.\n\nAccept the invite:\n${o.url}\n\nSign in with this email address (${to}) to join.`,
    html: layout({
      preheader: `Join ${o.workspace} on YouAsked.`,
      heading: `Join ${o.workspace}`,
      body: `${o.inviter} invited you to work on ${o.workspace} in YouAsked. Sign in with this email address to join.`,
      button: "Accept invite",
      url: o.url,
      foot: "If you weren't expecting this, you can ignore this email.",
    }),
  };
}
