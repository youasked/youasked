// The youasked.dev worker. Static pages come from the assets binding; this script runs first to
//  - redirect www and the old workers.dev host to the apex,
//  - render public boards (/<slug>, /<slug>/roadmap, /<slug>/changelog, /<slug>/shipped/<n>) from the API,
//  - draw share cards (/og/<slug>/<n>.png).
import { boardPage, shell, shippedPage, type BoardApp, type Req, type Tab } from "./board";
import { renderCard } from "./og";

type Env = {
  ASSETS: Fetcher;
  API_URL?: string;
  SITE_URL?: string;
  /** "1" draws a card per shipped request. Drawing needs more CPU than the Workers free plan allows (error 1102), so it's off until the account is on Workers Paid; until then cards use the site's own preview image. */
  SHARE_CARDS?: string;
};

const SITE_DEFAULT = "https://youasked.dev";
const API_DEFAULT = "https://api.youasked.dev";

const BOARD = /^\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])(?:\/(roadmap|changelog)|\/shipped\/(\d{1,9}))?\/?$/;
const OG = /^\/og\/([a-z0-9][a-z0-9-]{1,38}[a-z0-9])\/(\d{1,9})\.png$/;

async function api<T>(env: Env, path: string): Promise<T | null> {
  const res = await fetch(`${env.API_URL ?? API_DEFAULT}/v1/public${path}`, { cf: { cacheTtl: 30, cacheEverything: true } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`api ${res.status}`);
  return res.json<T>();
}

const html = (body: string, status = 200, cache = "public, max-age=60, s-maxage=300") =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff" } });

async function notFound(env: Env, request: Request) {
  // The prerendered 404 page, served with a 404 status by the assets binding.
  const res = await env.ASSETS.fetch(new Request(new URL("/__not_found__", request.url)));
  return new Response(res.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}

async function board(env: Env, request: Request, slug: string, tab: string | undefined, shipped: string | undefined) {
  const site = env.SITE_URL ?? SITE_DEFAULT;
  if (shipped) {
    const d = await api<{ app: { slug: string; name: string; boardUrl: string | null }; request: Req & { peopleAsked: number; shareImage: string | null; shareUrl: string | null } }>(env, `/apps/${slug}/shipped/${shipped}`);
    return d ? html(shell(shippedPage(site, d.app, d.request))) : notFound(env, request);
  }
  const info = await api<{ app: BoardApp }>(env, `/apps/${slug}`);
  if (!info) return notFound(env, request);
  const t: Tab = tab === "roadmap" || tab === "changelog" ? tab : "top";
  const data: Parameters<typeof boardPage>[3] = {};
  if (t === "top") data.requests = (await api<{ requests: Req[] }>(env, `/apps/${slug}/requests`))?.requests ?? [];
  else if (t === "roadmap") data.roadmap = (await api<{ planned: Req[]; inProgress: Req[]; shipped: Req[] }>(env, `/apps/${slug}/roadmap`)) ?? { planned: [], inProgress: [], shipped: [] };
  else data.entries = (await api<{ entries: Req[] }>(env, `/apps/${slug}/changelog`))?.entries ?? [];
  return html(shell(boardPage(site, info.app, t, data)));
}

async function card(env: Env, request: Request, ctx: ExecutionContext, slug: string, n: string) {
  if (env.SHARE_CARDS !== "1") {
    return new Response(null, { status: 302, headers: { location: "/og.png", "cache-control": "public, max-age=3600" } });
  }
  const cache = (caches as unknown as { default: Cache }).default;
  const key = new Request(new URL(request.url).origin + `/og/${slug}/${n}.png`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const d = await api<{ app: { name: string }; request: { title: string; shipNote: string | null; peopleAsked: number } }>(env, `/apps/${slug}/shipped/${n}`);
  if (!d) return new Response("Not found", { status: 404, headers: { "cache-control": "public, max-age=60" } });
  const png = await renderCard({ app: d.app.name, title: d.request.title, note: d.request.shipNote, people: d.request.peopleAsked });
  const res = new Response(png, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=86400, s-maxage=2592000", "x-content-type-options": "nosniff" },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const site = new URL(env.SITE_URL ?? SITE_DEFAULT);

    // Everything lives on the apex. (Markdown and text files skip the worker, so they stay reachable on every host.)
    if (url.hostname === `www.${site.hostname}` || url.hostname.endsWith(".workers.dev")) {
      return Response.redirect(`${site.origin}${url.pathname}${url.search}`, 301);
    }
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });

    try {
      const og = OG.exec(url.pathname);
      if (og) return await card(env, request, ctx, og[1], og[2]);

      // A real file or prerendered page wins.
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;

      const m = BOARD.exec(url.pathname);
      if (m) return await board(env, request, m[1], m[2], m[3]);
      return asset;
    } catch (err) {
      console.error(err);
      return html("<!doctype html><title>Temporarily unavailable</title><p>This page is temporarily unavailable. Please try again in a minute.</p>", 502, "no-store");
    }
  },
};
