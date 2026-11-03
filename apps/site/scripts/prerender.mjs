// After `vite build` and the SSR build: put the rendered page and the SEO tags into
// dist/index.html, write sitemap.xml, and point the Markdown/text files at the live site.
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const ssr = new URL("../dist-ssr/entry-server.js", import.meta.url);
const { render, SITE } = await import(ssr.href);
const OLD_SITE = "https://youasked.adenteo.workers.dev";

const title = "YouAsked: in-app feature requests that tell users when you ship";
const description =
  "Feature requests that live inside your React app. Users ask and vote, you hear it on Telegram, Slack or Discord, and everyone who asked is told when you ship. Set up with one prompt.";

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "YouAsked",
    url: SITE,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description,
    image: `${SITE}/og.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "YouAsked",
    url: SITE,
    logo: `${SITE}/apple-touch-icon.png`,
    sameAs: ["https://github.com/youasked/youasked", "https://www.npmjs.com/package/@youasked/react"],
  },
];

const head = `
    <link rel="canonical" href="${SITE}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="YouAsked" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="YouAsked" />
    <meta name="twitter:description" content="Your users ask. You ship. They hear about it, in your app." />
    <meta name="twitter:image" content="${SITE}/og.png" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;

let html = readFileSync(new URL("index.html", dist), "utf8");
html = html
  .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
  .replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${description}"`)
  .replace("</head>", `${head}\n  </head>`)
  .replace('<div id="root"></div>', `<div id="root">${render()}</div>`);
writeFileSync(new URL("index.html", dist), html);

const today = new Date().toISOString().slice(0, 10);
const pages = ["/"];
writeFileSync(
  new URL("sitemap.xml", dist),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`,
);
writeFileSync(new URL("robots.txt", dist), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

for (const f of readdirSync(dist).filter((f) => /\.(md|txt)$/.test(f))) {
  const path = new URL(f, dist);
  writeFileSync(path, readFileSync(path, "utf8").replaceAll(OLD_SITE, SITE));
}
rmSync(new URL("../dist-ssr/", import.meta.url), { recursive: true, force: true });
console.log(`prerendered ${html.length} bytes for ${SITE}`);
