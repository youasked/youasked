// Server-rendered public board pages. Plain HTML and a little CSS: fast, crawlable, no JavaScript needed.
export type Req = {
  number: number;
  title: string;
  status: "open" | "planned" | "in_progress" | "shipped";
  votes: number;
  shipNote: string | null;
  shippedAt: number | null;
  createdAt: number;
  creditName: string | null;
};
export type BoardApp = {
  slug: string;
  name: string;
  description: string | null;
  counts: { open: number; planned: number; in_progress: number; shipped: number; requests: number; votes: number };
};
export type Tab = "top" | "roadmap" | "changelog";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ldJson = (d: unknown) => JSON.stringify(d).replace(/</g, "\\u003c");
const date = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const STATUS: Record<Req["status"], string> = { open: "Open", planned: "Planned", in_progress: "In progress", shipped: "Shipped" };

const CSS = `
:root{--ink:#0b1020;--ink2:#283048;--muted:#5b6380;--paper:#f6f7fb;--card:#fff;--line:rgba(11,16,32,.09);--cobalt:#2b4bee;--live:#16a34a;--live-bg:#e5f7ec;--amber:#a16207;--amber-bg:#fdf3d0;--blue-bg:#e6ebff;--grey-bg:#eceff6;--display:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;--body:"Instrument Sans",ui-sans-serif,system-ui,-apple-system,sans-serif}
@media(prefers-color-scheme:dark){:root{--ink:#eef1fa;--ink2:#c9cfe3;--muted:#8f97b2;--paper:#05070d;--card:#0c1121;--line:rgba(255,255,255,.09);--cobalt:#8ea2ff;--live:#3fd07f;--live-bg:rgba(63,208,127,.14);--amber:#ffd45e;--amber-bg:rgba(255,224,102,.14);--blue-bg:rgba(142,162,255,.16);--grey-bg:rgba(255,255,255,.08)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:400 17px/1.6 var(--body);-webkit-font-smoothing:antialiased}
a{color:inherit}
.wrap{width:min(860px,100% - 32px);margin-inline:auto}
.top{display:flex;align-items:center;justify-content:space-between;padding:20px 0}
.brand{display:inline-flex;align-items:center;gap:8px;font:700 18px var(--display);letter-spacing:-.03em;text-decoration:none}
.brand svg{width:26px;height:26px}
.top a.ghost{font-size:14.5px;font-weight:600;text-decoration:none;color:var(--muted)}
.top a.ghost:hover{color:var(--ink)}
h1{font:700 clamp(36px,6vw,60px)/1 var(--display);letter-spacing:-.035em;margin:28px 0 12px;text-wrap:balance}
.lede{color:var(--muted);font-size:19px;max-width:60ch;margin:0 0 20px}
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 28px;padding:0;list-style:none}
.stats li{padding:5px 14px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:14.5px;color:var(--ink2)}
.tabs{display:inline-flex;padding:4px;border-radius:999px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);margin-bottom:24px;max-width:100%;overflow-x:auto}
.tabs a{padding:8px 18px;border-radius:999px;font-weight:600;font-size:15px;text-decoration:none;color:var(--ink2);white-space:nowrap}
.tabs a[aria-current]{background:var(--ink);color:var(--paper)}
.list{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.row{display:flex;gap:16px;align-items:center;padding:14px 18px 14px 14px;border-radius:20px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);text-decoration:none}
a.row:hover{box-shadow:inset 0 0 0 1px var(--cobalt)}
.votes{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:54px;height:54px;border-radius:14px;background:var(--grey-bg);font:700 18px/1 var(--display)}
.votes small{font:600 10px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:3px}
.main{flex:1;min-width:0}
.title{font:600 18px/1.3 var(--display);letter-spacing:-.01em;margin:0;overflow-wrap:anywhere}
.sub{color:var(--muted);font-size:14.5px;margin:2px 0 0}
.badge{flex:none;font:600 12.5px var(--body);padding:4px 11px;border-radius:999px;background:var(--grey-bg);color:var(--ink2)}
.badge.planned{background:var(--blue-bg);color:var(--cobalt)}.badge.in_progress{background:var(--amber-bg);color:var(--amber)}.badge.shipped{background:var(--live-bg);color:var(--live)}
.cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}
.cols h2{font:600 15px var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.cols .row{flex-wrap:wrap}
.empty{color:var(--muted);padding:18px;border-radius:20px;border:1px dashed var(--line);margin:0}
.log{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.entry{display:grid;grid-template-columns:140px minmax(0,1fr);gap:6px 24px;padding:24px 0;border-bottom:1px solid var(--line)}
.entry time{color:var(--muted);font-size:15px;padding-top:3px}
.entry h2{font:600 22px/1.2 var(--display);letter-spacing:-.02em;margin:0 0 6px}
.entry h2 a{text-decoration:none}.entry h2 a:hover{text-decoration:underline}
.entry p{margin:0 0 6px;color:var(--ink2)}
.foot{margin:72px 0 40px;padding-top:22px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;color:var(--muted);font-size:14.5px}
.foot a{color:var(--cobalt);font-weight:600;text-decoration:none}.foot a:hover{text-decoration:underline}
.hero{margin:36px 0 28px;padding:clamp(24px,5vw,44px);border-radius:32px;background:var(--card);box-shadow:inset 0 0 0 1px var(--line)}
.hero .chip{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;background:var(--live-bg);color:var(--live);font-weight:600;font-size:15px}
.hero .chip i{width:9px;height:9px;border-radius:50%;background:var(--live)}
.hero h1{margin-top:18px;font-size:clamp(32px,5.4vw,52px)}
.hero .note{font-size:20px;color:var(--ink2);margin:0 0 18px;max-width:56ch}
.hero .meta{display:flex;flex-wrap:wrap;gap:6px 20px;color:var(--muted);font-size:15px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 0}
.btn{display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:999px;font-weight:600;font-size:15px;text-decoration:none;background:var(--ink);color:var(--paper)}
.btn.alt{background:var(--card);color:var(--ink);box-shadow:inset 0 0 0 1px var(--line)}
.card-img{width:100%;height:auto;border-radius:24px;box-shadow:0 0 0 1px var(--line);margin-top:8px}
@media(max-width:720px){.cols{grid-template-columns:1fr}.entry{grid-template-columns:1fr}.row{gap:12px}.badge{display:none}}
`;

const MARK = `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="g" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#6d84ff"/><stop offset="1" stop-color="#2b4bee"/></linearGradient></defs><path d="M11.4 3.2c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.8L4.6 20.2l4.1-2.06c.86.2 1.76.31 2.7.31 4.97 0 9-3.47 9-7.75S16.37 3.2 11.4 3.2Z" fill="url(#g)"/><path d="m7.9 11.2 2.5 2.4 4.7-4.7" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19.4" cy="4.4" r="2.6" fill="#ffe066"/></svg>`;

export type Page = {
  site: string;
  title: string;
  description: string;
  canonical: string;
  image: string;
  jsonLd: unknown[];
  body: string;
  noindex?: boolean;
  slug?: string;
};

export function shell(p: Page): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${esc(p.canonical)}">
${p.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="YouAsked">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${esc(p.canonical)}">
<meta property="og:image" content="${esc(p.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${esc(p.image)}">
<meta name="theme-color" content="#0b1020">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>${CSS}</style>
${p.jsonLd.map((d) => `<script type="application/ld+json">${ldJson(d)}</script>`).join("\n")}
</head>
<body>
<div class="wrap">
<header class="top"><a class="brand" href="${esc(p.site)}/">${MARK}YouAsked</a><a class="ghost" href="${esc(p.site)}/docs">Docs</a></header>
${p.body}
<footer class="foot"><span>Feedback by <a href="${esc(p.site)}/?ref=board${p.slug ? "-" + esc(p.slug) : ""}">YouAsked</a></span><a href="${esc(p.site)}/?ref=board${p.slug ? "-" + esc(p.slug) : ""}#how">Add YouAsked to your app</a></footer>
</div>
</body>
</html>`;
}

const row = (slug: string, r: Req, showStatus = true) => {
  const inner = `<div class="votes">${r.votes}<small>${r.votes === 1 ? "vote" : "votes"}</small></div>
<div class="main"><p class="title">${esc(r.title)}</p>${
    r.status === "shipped" && r.shipNote ? `<p class="sub">${esc(r.shipNote)}</p>` : ""
  }</div>${showStatus ? `<span class="badge ${r.status}">${STATUS[r.status]}</span>` : ""}`;
  return r.status === "shipped"
    ? `<li><a class="row" href="/${slug}/shipped/${r.number}">${inner}</a></li>`
    : `<li><div class="row">${inner}</div></li>`;
};

const list = (slug: string, rs: Req[], empty: string, showStatus = true) =>
  rs.length ? `<ul class="list">${rs.map((r) => row(slug, r, showStatus)).join("")}</ul>` : `<p class="empty">${esc(empty)}</p>`;

const TAB_PATH: Record<Tab, string> = { top: "", roadmap: "/roadmap", changelog: "/changelog" };
const TAB_NAME: Record<Tab, string> = { top: "Top requests", roadmap: "Roadmap", changelog: "Changelog" };

export function boardPage(site: string, app: BoardApp, tab: Tab, data: { requests?: Req[]; roadmap?: { planned: Req[]; inProgress: Req[]; shipped: Req[] }; entries?: Req[] }): Page {
  const slug = app.slug;
  const c = app.counts;
  const heading = `${app.name}${tab === "top" ? " feature requests" : tab === "roadmap" ? " roadmap" : " changelog"}`;
  const description =
    (app.description ? `${app.description} ` : "") +
    (tab === "top"
      ? `${plural(c.requests, "request")} and ${plural(c.votes, "vote")} so far. See what people want in ${app.name} and what's shipped.`
      : tab === "roadmap"
        ? `What's planned, in progress and recently shipped in ${app.name}.`
        : `Everything that shipped in ${app.name}, newest first.`);
  let content = "";
  let items: Req[] = [];
  if (tab === "top") {
    items = data.requests ?? [];
    content = list(slug, items, "No requests yet. Be the first to ask from inside the app.");
  } else if (tab === "roadmap") {
    const r = data.roadmap!;
    items = [...r.planned, ...r.inProgress, ...r.shipped];
    content = `<div class="cols">
<section><h2>Planned</h2>${list(slug, r.planned, "Nothing planned yet.", false)}</section>
<section><h2>In progress</h2>${list(slug, r.inProgress, "Nothing in progress.", false)}</section>
<section><h2>Recently shipped</h2>${list(slug, r.shipped, "Nothing shipped yet.", false)}</section></div>`;
  } else {
    items = data.entries ?? [];
    content = items.length
      ? `<ol class="log">${items
          .map(
            (r) => `<li class="entry"><time datetime="${new Date(r.shippedAt ?? r.createdAt).toISOString().slice(0, 10)}">${date(r.shippedAt ?? r.createdAt)}</time><div><h2><a href="/${slug}/shipped/${r.number}">${esc(r.title)}</a></h2>${
              r.shipNote ? `<p>${esc(r.shipNote)}</p>` : ""
            }<p class="sub">${plural(r.votes, "person", "people")} asked${r.creditName ? ` · thanks to ${esc(r.creditName)}` : ""}</p></div></li>`,
          )
          .join("")}</ol>`
      : `<p class="empty">Nothing has shipped yet.</p>`;
  }
  const canonical = `${site}/${slug}${TAB_PATH[tab]}`;
  const body = `<main>
<h1>${esc(app.name)}</h1>
${app.description ? `<p class="lede">${esc(app.description)}</p>` : `<p class="lede">Tell ${esc(app.name)} what to build next, and see what has shipped.</p>`}
<ul class="stats"><li>${plural(c.requests, "request")}</li><li>${plural(c.votes, "vote")}</li><li>${c.shipped} shipped</li></ul>
<nav class="tabs" aria-label="Board">${(Object.keys(TAB_PATH) as Tab[])
    .map((t) => `<a href="/${slug}${TAB_PATH[t]}"${t === tab ? ' aria-current="page"' : ""}>${TAB_NAME[t]}</a>`)
    .join("")}</nav>
<h2 class="sr" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${esc(heading)}</h2>
${content}
<p class="sub" style="margin-top:20px">Votes are cast inside ${esc(app.name)}. This page is read-only.</p>
</main>`;
  const crumbs = [
    { "@type": "ListItem", position: 1, name: "YouAsked", item: `${site}/` },
    { "@type": "ListItem", position: 2, name: app.name, item: `${site}/${slug}` },
    ...(tab === "top" ? [] : [{ "@type": "ListItem", position: 3, name: TAB_NAME[tab], item: canonical }]),
  ];
  return {
    site,
    slug,
    title: `${heading} | YouAsked`,
    description: description.slice(0, 300),
    canonical,
    image: `${site}/og.png`,
    jsonLd: [
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs },
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: heading,
        url: canonical,
        description,
        mainEntity: { "@type": "ItemList", itemListElement: items.slice(0, 50).map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.title })) },
      },
    ],
    body,
  };
}

export function shippedPage(
  site: string,
  app: { slug: string; name: string; boardUrl: string | null },
  r: Req & { peopleAsked: number; shareImage: string | null; shareUrl: string | null },
): Page {
  const slug = app.slug;
  const canonical = `${site}/${slug}/shipped/${r.number}`;
  const asked = `${r.peopleAsked} ${r.peopleAsked === 1 ? "person" : "people"} asked`;
  const title = `You asked, it's live: ${r.title} in ${app.name}`;
  const description = `${r.title} is live in ${app.name}. ${asked}.${r.shipNote ? ` ${r.shipNote}` : ""}`;
  const image = `${site}/og/${slug}/${r.number}.png`;
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`You asked, it's live: ${r.title} is now in ${app.name}`)}&url=${encodeURIComponent(canonical)}`;
  const body = `<main>
<article class="hero">
<span class="chip"><i></i>It's live in ${esc(app.name)}</span>
<h1>${esc(r.title)}</h1>
${r.shipNote ? `<p class="note">${esc(r.shipNote)}</p>` : ""}
<div class="meta"><span>${esc(asked)}</span>${r.shippedAt ? `<span>Shipped ${date(r.shippedAt)}</span>` : ""}${r.creditName ? `<span>Thanks to ${esc(r.creditName)}</span>` : ""}</div>
<div class="btns"><a class="btn" href="${esc(tweet)}" rel="noopener">Share on X</a><a class="btn alt" href="/og/${esc(slug)}/${r.number}.png" download="${esc(slug)}-${r.number}.png">Download image</a>${
    app.boardUrl ? `<a class="btn alt" href="/${esc(slug)}">See ${esc(app.name)}'s board</a>` : ""
  }</div>
</article>
<img class="card-img" src="/og/${esc(slug)}/${r.number}.png" width="1200" height="630" alt="${esc(title)}" loading="lazy">
</main>`;
  return {
    site,
    slug,
    title,
    description: description.slice(0, 300),
    canonical,
    image,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "YouAsked", item: `${site}/` },
          ...(app.boardUrl ? [{ "@type": "ListItem", position: 2, name: app.name, item: `${site}/${slug}` }] : []),
          { "@type": "ListItem", position: app.boardUrl ? 3 : 2, name: r.title, item: canonical },
        ],
      },
    ],
    body,
  };
}
