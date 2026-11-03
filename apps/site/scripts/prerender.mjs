// After `vite build` and the SSR build: write one HTML file per page into dist/ (the rendered page plus
// its title, description, canonical, social tags and structured data), then the sitemap and robots.txt.
// dist/pricing.html is served at /pricing by Workers static assets.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const dist = new URL("../dist/", import.meta.url);
const ssr = new URL("../dist-ssr/entry-server.js", import.meta.url);
const { render, pages, SITE, API } = await import(ssr.href);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
// JSON inside <script>: stop "</script>" and "<!--" in the data from ending the block.
const ldJson = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

const template = readFileSync(new URL("index.html", dist), "utf8");

function headFor(page) {
  const url = `${SITE}${page.path === "/" ? "/" : page.path}`;
  if (page.hidden) return { tags: `\n    <meta name="robots" content="noindex" />` };
  const tags = [
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="YouAsked" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${SITE}/og.png" />`,
    ...page.jsonLd.map((d) => `<script type="application/ld+json">${ldJson(d)}</script>`),
  ];
  return { tags: "\n    " + tags.join("\n    ") };
}

function build(page) {
  const { tags } = headFor(page);
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${esc(page.description)}"`)
    .replace(/<meta property="og:title"[^>]*>\s*/, "")
    .replace(/<meta property="og:description"[^>]*>\s*/, "")
    .replace("</head>", `${tags}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${render(page.path)}</div>`);
  if (!html.includes('id="root">' )) throw new Error(`no root for ${page.path}`);
  return html;
}

const fileFor = (path) => (path === "/" ? "index.html" : path === "/404" ? "404.html" : `${path.slice(1)}.html`);

let bytes = 0;
for (const page of pages) {
  const html = build(page);
  const out = new URL(fileFor(page.path), dist);
  mkdirSync(dirname(out.pathname), { recursive: true });
  writeFileSync(out, html);
  bytes += html.length;
}

// ---- sitemap: our pages, plus every public board when the API can be reached (skipped silently otherwise)
const today = new Date().toISOString().slice(0, 10);
const entries = pages.filter((p) => !p.hidden).map((p) => ({ loc: `${SITE}${p.path === "/" ? "/" : p.path}`, lastmod: today, priority: p.priority }));
const apiBase = process.env.SITEMAP_API || API;
let boards = 0;
try {
  const res = await fetch(`${apiBase}/v1/public/apps`, { signal: AbortSignal.timeout(4000) });
  if (res.ok) {
    const { apps } = await res.json();
    for (const a of apps) {
      const lastmod = new Date(a.updatedAt).toISOString().slice(0, 10);
      for (const sub of ["", "/roadmap", "/changelog"]) entries.push({ loc: `${SITE}/${a.slug}${sub}`, lastmod, priority: sub ? 0.4 : 0.6 });
      boards++;
    }
  }
} catch {
  // the API isn't reachable from here; the sitemap just lists our own pages
}
writeFileSync(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries
    .map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod><priority>${e.priority}</priority></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(new URL("robots.txt", dist), `User-agent: *\nAllow: /\nDisallow: /lab/\n\nSitemap: ${SITE}/sitemap.xml\n`);

// The Markdown and text files may still be fetched from the old workers.dev hosts; make sure they name the new ones.
const OLD = { "https://youasked.adenteo.workers.dev": SITE, "https://youasked-api.adenteo.workers.dev": API };
for (const f of readdirSync(dist).filter((f) => /\.(md|txt)$/.test(f) && f !== "robots.txt")) {
  const path = new URL(f, dist);
  let text = readFileSync(path, "utf8");
  for (const [from, to] of Object.entries(OLD)) text = text.replaceAll(from, to);
  writeFileSync(path, text);
}
rmSync(new URL("../dist-ssr/", import.meta.url), { recursive: true, force: true });
console.log(`prerendered ${pages.length} pages (${bytes} bytes), ${entries.length} sitemap urls, ${boards} public boards`);
