// The YouAsked email kit. Table layout, inline styles, 600px max and fluid below it, logo PNGs hosted on
// youasked.dev (apps/site/public/email), and a plain-text part written by each caller. Web fonts load in
// Apple Mail and iOS Mail; Gmail and Outlook fall back to Georgia and the system sans, which the type is
// set to survive.
export const SITE = "https://youasked.dev";
const asset = (f: string) => `${SITE}/email/${f}`;

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const INK = "#0b1020", INK2 = "#283048", MUTED = "#5b6380", LINE = "#e4e8f2", WASH = "#f1f3f9", COBALT = "#2b4bee", NIGHT = "#0b1020", LIVE = "#16a34a";

function shell(o: { title: string; preheader: string; body: string }): string {
  return `<!doctype html><html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%}table{border-collapse:collapse}img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}a{text-decoration:none}@media (max-width:620px){.px{padding-left:24px!important;padding-right:24px!important}.h1{font-size:28px!important}}</style></head>
<body style="margin:0;padding:0;background:${WASH}"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${WASH}"><tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">${o.body}</table>
</td></tr></table></body></html>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 6px"><tr><td align="center" bgcolor="${COBALT}" style="border-radius:999px;background:${COBALT}"><a href="${esc(href)}" style="display:inline-block;padding:17px 32px;font-family:${SANS};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px">${esc(label)}&nbsp;&nbsp;&#8594;</a></td></tr></table>`;
}

const para = (t: string, color = INK2) => `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.65;color:${color}">${esc(t)}</p>`;
const label = (t: string) => `<p style="margin:0 0 6px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED}">${esc(t)}</p>`;

/** A quiet quote card: a small caption over the text, with a cobalt rule down the side. */
function quote(caption: string, text: string, big = false): string {
  const size = big ? `font-family:${SERIF};font-weight:600;font-size:22px;line-height:1.3;letter-spacing:-0.2px` : `font-family:${SANS};font-size:16px;line-height:1.65`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 22px"><tr><td width="4" bgcolor="${COBALT}" style="width:4px;background:${COBALT};border-radius:4px">&nbsp;</td><td bgcolor="${WASH}" style="background:${WASH};padding:16px 20px;border-radius:0 12px 12px 0">${label(caption)}<p style="margin:0;${size};color:${INK};white-space:pre-line">${esc(text)}</p></td></tr></table>`;
}

const mastheadCell = (inner: string) => `<tr><td align="left" class="px" bgcolor="${NIGHT}" style="background:${NIGHT};padding:24px 48px;border-radius:16px 16px 0 0">${inner}</td></tr>`;

function brandedMasthead(): string {
  return mastheadCell(`<a href="${SITE}"><img src="${asset("logo-light.png")}" width="140" height="29" alt="YouAsked" style="display:block;width:140px;height:auto"></a>`);
}

/** For mail to people who use someone else's app: the app's name leads, YouAsked stays in the footer. */
function appMasthead(app: string, tag: string): string {
  return mastheadCell(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="left" style="font-family:${SERIF};font-weight:700;font-size:22px;line-height:1.2;letter-spacing:-0.4px;color:#ffffff">${esc(app)}</td><td align="right" style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#9fb0ff;white-space:nowrap;padding-left:12px">${esc(tag)}</td></tr></table>`);
}

function card(inner: string): string {
  return `<tr><td class="px" bgcolor="#ffffff" style="background:#ffffff;padding:40px 48px 40px;border-radius:0 0 16px 16px">${inner}</td></tr>`;
}

function footer(lines: string[], links: { label: string; href: string }[] = [], powered = false): string {
  const sep = ` &nbsp;·&nbsp; `;
  return `<tr><td align="center" style="padding:26px 24px 0">
<img src="${asset("mark.png")}" width="22" height="22" alt="" style="display:block;width:22px;height:22px;margin:0 auto 12px">
${lines.map((l) => `<p style="margin:0 0 6px;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">${esc(l)}</p>`).join("")}
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">${powered ? `Powered by <a href="${SITE}/?utm_source=email&amp;utm_medium=footer" style="color:${INK};font-weight:700;text-decoration:none">YouAsked</a>${links.length ? sep : ""}` : ""}${links.map((l) => `<a href="${esc(l.href)}" style="color:${MUTED};text-decoration:underline">${esc(l.label)}</a>`).join(sep)}</p></td></tr>`;
}

const h1 = (t: string) => `<h1 class="h1" style="margin:0 0 18px;font-family:${SERIF};font-weight:600;font-size:34px;line-height:1.12;letter-spacing:-0.8px;color:${INK}">${esc(t)}</h1>`;
const kicker = (t: string, dot = false) => `<p style="margin:0 0 14px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${dot ? LIVE : COBALT}">${dot ? `<span style="color:${LIVE}">&#9679;</span>&nbsp;&nbsp;` : ""}${esc(t)}</p>`;
const fallbackLink = (url: string) => `<p style="margin:22px 0 0;padding-top:18px;border-top:1px solid ${LINE};font-family:${SANS};font-size:13px;line-height:1.6;color:${MUTED}">Button not working? Paste this link into your browser:<br><a href="${esc(url)}" style="color:${COBALT};text-decoration:underline;word-break:break-all">${esc(url)}</a></p>`;

/** Sign-in link and workspace invite: from YouAsked itself, to people with an account. */
export function accountEmail(o: { title: string; preheader: string; kicker: string; intro: string[]; quote?: { caption: string; text: string }; button: string; url: string; foot: string }): string {
  const body =
    brandedMasthead() +
    card(`${kicker(o.kicker)}${h1(o.title)}${o.intro.map((t) => para(t)).join("")}${o.quote ? quote(o.quote.caption, o.quote.text) : ""}${button(o.button, o.url)}${fallbackLink(o.url)}`) +
    footer([o.foot], [{ label: "youasked.dev", href: SITE }, { label: "Help", href: `${SITE}/docs` }]);
  return shell({ title: o.title, preheader: o.preheader, body });
}

/** "It shipped" and "the team replied": to people who asked in somebody else's app. */
export function requestEmail(o: {
  app: string;
  tag: string;
  title: string;
  preheader: string;
  kicker: string;
  live?: boolean;
  greeting: string | null;
  intro: string;
  quote: { caption: string; text: string; big?: boolean };
  note?: { caption: string; text: string } | null;
  closing: string;
  cta?: { label: string; href: string } | null;
  unsubscribe: string;
}): string {
  const body =
    appMasthead(o.app, o.tag) +
    card(
      `${kicker(o.kicker, o.live)}${h1(o.title)}${o.greeting ? para(o.greeting, INK) : ""}${para(o.intro)}${quote(o.quote.caption, o.quote.text, o.quote.big)}${o.note ? quote(o.note.caption, o.note.text) : ""}${para(o.closing)}${o.cta ? button(o.cta.label, o.cta.href) : ""}`,
    ) +
    footer([`You’re getting this because you shared an idea in ${o.app}.`], [{ label: "Unsubscribe", href: o.unsubscribe }], true);
  return shell({ title: o.title, preheader: o.preheader, body });
}
