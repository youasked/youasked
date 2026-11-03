// Public, read-only board pages: no key, open CORS. Only apps that switched their public board on
// are served, with one exception: a shipped request has a share page (and share card) even when the
// board is private, because shipping is something the developer chose to announce, and every person
// who asked was already told. Nothing here returns emails, user ids or request bodies.
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { cleanText } from "./lib";
import type { AppRow, Env, RequestRow } from "./types";

const SHOWN = ["open", "planned", "in_progress", "shipped"] as const;
type Shown = (typeof SHOWN)[number];

/** Paths on youasked.dev that a slug must never shadow, plus names that look official. */
export const RESERVED_SLUGS = new Set(
  (
    "app api docs doc pricing price blog admin login logout signin sign-in signup sign-up register dashboard account settings " +
    "vs alternatives alternative mcp changelog shipped roadmap og www mail email help support status about terms privacy legal " +
    "security contact install skill llms index sitemap robots favicon assets static public v1 hooks cli demo example test null " +
    "undefined youasked youasked-dev team billing checkout cdn download downloads features feature integrations compare " +
    "react widget for new updates releases"
  ).split(" "),
);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function siteUrl(env: Env): string {
  return (env.SITE_URL || "https://youasked.dev").replace(/\/$/, "");
}

export function publicUrl(env: Env, app: Pick<AppRow, "slug" | "public_board">): string | null {
  return app.slug && app.public_board ? `${siteUrl(env)}/${app.slug}` : null;
}

/** The page and the picture to post when a request ships. Null until the app has a slug. */
export function shareFields(env: Env, app: Pick<AppRow, "slug">, r: Pick<RequestRow, "status" | "number">) {
  if (r.status !== "shipped" || !app.slug) return { shareUrl: null, shareImage: null };
  return {
    shareUrl: `${siteUrl(env)}/${app.slug}/shipped/${r.number}`,
    shareImage: `${siteUrl(env)}/og/${app.slug}/${r.number}.png`,
  };
}

/** Validates the public-board fields of PATCH /app and returns the columns to set. Throws an HTTPException. */
export async function publicSettings(
  env: Env,
  app: AppRow,
  body: { slug?: unknown; publicBoard?: unknown; description?: unknown },
): Promise<{ slug: string | null; public_board: number; description: string | null } | null> {
  if (body.slug === undefined && body.publicBoard === undefined && body.description === undefined) return null;
  const bad = (error: string, status: 400 | 409 = 400): never => {
    throw new HTTPException(status, { res: Response.json({ error }, { status }) });
  };

  let slug = app.slug;
  if (body.slug !== undefined) {
    if (body.slug === null || body.slug === "") slug = null;
    else if (typeof body.slug !== "string") return bad("bad_slug");
    else {
      slug = body.slug.trim().toLowerCase();
      if (!SLUG_PATTERN.test(slug)) return bad("bad_slug");
      if (RESERVED_SLUGS.has(slug)) return bad("slug_reserved");
      const taken = await env.DB.prepare("SELECT id FROM apps WHERE slug = ? AND id != ?").bind(slug, app.id).first();
      if (taken) return bad("slug_taken", 409);
    }
  }
  const publicBoard = body.publicBoard === undefined ? Boolean(app.public_board) : Boolean(body.publicBoard);
  if (publicBoard && !slug) return bad("slug_required");
  let description = app.description;
  if (body.description !== undefined) description = body.description === null ? null : cleanText(body.description, 280) || null;
  return { slug, public_board: publicBoard ? 1 : 0, description };
}

const pub = new Hono<{ Bindings: Env; Variables: { app: AppRow } }>();

pub.use("*", cors({ origin: "*", allowMethods: ["GET"], maxAge: 86400 }));
pub.use("*", async (c, next) => {
  await next();
  if (c.res.ok) c.header("cache-control", "public, max-age=30, s-maxage=60");
});

function notFound(): never {
  throw new HTTPException(404, { res: Response.json({ error: "not_found" }, { status: 404 }) });
}

type Row = RequestRow & { author_name: string | null };

/** First name of someone who asked to be thanked, once their request has shipped. */
function credit(r: Row): string | null {
  if (!r.credit || r.status !== "shipped" || !r.author_name) return null;
  return r.author_name.split(/\s+/)[0] || null;
}

function shape(r: Row) {
  return {
    number: r.number,
    title: r.title,
    status: r.status,
    votes: r.vote_count,
    shipNote: r.ship_note,
    shippedAt: r.shipped_at,
    createdAt: r.created_at,
    creditName: credit(r),
  };
}

const SELECT = `SELECT r.*, u.name AS author_name FROM requests r LEFT JOIN users u ON u.id = r.author_id`;

async function boardApp(c: { env: Env; req: { param(k: string): string } }, requireBoard = true): Promise<AppRow> {
  const slug = c.req.param("slug").toLowerCase();
  const row = await c.env.DB.prepare("SELECT * FROM apps WHERE slug = ?").bind(slug).first<AppRow>();
  if (!row || (requireBoard && !row.public_board)) notFound();
  return row as AppRow;
}

// Every public board, for the sitemap.
pub.get("/apps", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.slug, a.name, COALESCE((SELECT MAX(updated_at) FROM requests r WHERE r.app_id = a.id), a.created_at) AS updated_at
     FROM apps a WHERE a.public_board = 1 AND a.slug IS NOT NULL ORDER BY a.created_at LIMIT 2000`,
  ).all<{ slug: string; name: string; updated_at: number }>();
  return c.json({ apps: results.map((a) => ({ slug: a.slug, name: a.name, updatedAt: a.updated_at })) });
});

pub.get("/apps/:slug", async (c) => {
  const a = await boardApp(c);
  const { results } = await c.env.DB.prepare(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(vote_count), 0) AS votes FROM requests
     WHERE app_id = ? AND status IN ('open','planned','in_progress','shipped') GROUP BY status`,
  )
    .bind(a.id)
    .all<{ status: Shown; n: number; votes: number }>();
  const counts = { open: 0, planned: 0, in_progress: 0, shipped: 0, requests: 0, votes: 0 };
  for (const r of results) {
    counts[r.status] = r.n;
    counts.requests += r.n;
    counts.votes += r.votes;
  }
  return c.json({ app: { slug: a.slug, name: a.name, description: a.description, counts } });
});

pub.get("/apps/:slug/requests", async (c) => {
  const a = await boardApp(c);
  const status = c.req.query("status");
  const sort = c.req.query("sort") === "new" ? "r.created_at DESC" : "r.vote_count DESC, r.created_at DESC";
  const filter = status && (SHOWN as readonly string[]).includes(status) ? [status] : ["open", "planned", "in_progress"];
  const marks = filter.map(() => "?").join(",");
  const { results } = await c.env.DB.prepare(
    `${SELECT} WHERE r.app_id = ? AND r.status IN (${marks}) ORDER BY ${sort} LIMIT 200`,
  )
    .bind(a.id, ...filter)
    .all<Row>();
  return c.json({ requests: results.map(shape) });
});

pub.get("/apps/:slug/roadmap", async (c) => {
  const a = await boardApp(c);
  const list = async (status: Shown, order: string, limit: number) =>
    (
      await c.env.DB.prepare(`${SELECT} WHERE r.app_id = ? AND r.status = ? ORDER BY ${order} LIMIT ${limit}`)
        .bind(a.id, status)
        .all<Row>()
    ).results.map(shape);
  return c.json({
    planned: await list("planned", "r.vote_count DESC, r.created_at DESC", 100),
    inProgress: await list("in_progress", "r.vote_count DESC, r.created_at DESC", 100),
    shipped: await list("shipped", "r.shipped_at DESC", 10),
  });
});

pub.get("/apps/:slug/changelog", async (c) => {
  const a = await boardApp(c);
  const { results } = await c.env.DB.prepare(
    `${SELECT} WHERE r.app_id = ? AND r.status = 'shipped' ORDER BY r.shipped_at DESC, r.number DESC LIMIT 200`,
  )
    .bind(a.id)
    .all<Row>();
  return c.json({ entries: results.map(shape) });
});

// Works for private boards too (see the note at the top), but only for shipped requests.
pub.get("/apps/:slug/shipped/:number", async (c) => {
  const a = await boardApp(c, false);
  const n = Number(c.req.param("number"));
  if (!Number.isInteger(n) || n < 1) notFound();
  const r = await c.env.DB.prepare(`${SELECT} WHERE r.app_id = ? AND r.number = ? AND r.status = 'shipped'`)
    .bind(a.id, n)
    .first<Row>();
  if (!r) notFound();
  return c.json({
    app: { slug: a.slug, name: a.name, description: a.description, boardUrl: publicUrl(c.env, a) },
    request: { ...shape(r as Row), peopleAsked: Math.max(1, (r as Row).vote_count), ...shareFields(c.env, a, r as Row) },
  });
});

export default pub;
