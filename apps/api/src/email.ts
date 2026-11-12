// Transactional email (sign-in links, invites, "it shipped" notes). Sent through Amazon SES when its
// keys are set (the same SES account as Graiden and Otay), else through Cloudflare Email Sending (the
// EMAIL binding), else logged so local dev and tests still see it.
import { alert } from "./alert";
import { AwsClient } from "aws4fetch";
import { accountEmail } from "./email-kit";
import type { Env } from "./types";

export type Email = { to: string; subject: string; text: string; html?: string };

export const FROM = { email: "hello@youasked.dev", name: "YouAsked" };

async function sendWithSes(env: Env, email: Email): Promise<boolean> {
  const region = env.SES_REGION ?? "ap-southeast-1";
  const aws = new AwsClient({ accessKeyId: env.SES_ACCESS_KEY_ID!, secretAccessKey: env.SES_SECRET_ACCESS_KEY!, service: "ses", region });
  const res = await aws.fetch(`https://email.${region}.amazonaws.com/v2/email/outbound-emails`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      FromEmailAddress: `${FROM.name} <${FROM.email}>`,
      Destination: { ToAddresses: [email.to] },
      Content: {
        Simple: {
          Subject: { Data: email.subject, Charset: "UTF-8" },
          Body: { Text: { Data: email.text, Charset: "UTF-8" }, ...(email.html ? { Html: { Data: email.html, Charset: "UTF-8" } } : {}) },
        },
      },
    }),
  });
  if (!res.ok) {
    const why = (await res.text()).slice(0, 300);
    console.error(`[email] SES send to ${email.to} failed: ${res.status} ${why}`);
    await alert(env, "email:ses", `Email failed to send (SES ${res.status}). Sign-in links and notifications may not be arriving.\n${why}`, 30 * 60_000);
    return false;
  }
  return true;
}

export async function sendEmail(env: Env, email: Email): Promise<boolean> {
  if (env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY) {
    try {
      return await sendWithSes(env, email);
    } catch (err) {
      console.error(`[email] SES send to ${email.to} failed:`, err instanceof Error ? err.message : err);
      return false;
    }
  }
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

export function signInEmail(to: string, url: string): Email {
  return {
    to,
    subject: "Your YouAsked sign-in link",
    text: `Sign in to YouAsked:\n\n${url}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, you can ignore this email.`,
    html: accountEmail({
      preheader: "Your sign-in link works once and expires in 15 minutes.",
      kicker: "Sign in",
      title: "Your sign-in link",
      intro: ["Tap the button to sign in to YouAsked. The link works once and expires in 15 minutes."],
      button: "Sign in to YouAsked",
      url,
      foot: "If you didn’t ask for this, you can ignore this email. Nobody can sign in without the link.",
    }),
  };
}

export function inviteEmail(to: string, o: { workspace: string; inviter: string; url: string }): Email {
  return {
    to,
    subject: `${o.inviter} invited you to ${o.workspace} on YouAsked`,
    text: `${o.inviter} invited you to join ${o.workspace} on YouAsked.\n\nAccept the invite:\n${o.url}\n\nSign in with this email address (${to}) to join.`,
    html: accountEmail({
      preheader: `${o.inviter} invited you to ${o.workspace}.`,
      kicker: "Workspace invite",
      title: `Join ${o.workspace}`,
      intro: [`${o.inviter} invited you to work on ${o.workspace} in YouAsked, where your users ask for what they want next. Sign in with this email address to join.`],
      button: "Accept invite",
      url: o.url,
      foot: "If you weren’t expecting this, you can ignore this email.",
    }),
  };
}
