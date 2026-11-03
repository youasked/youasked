// Admin endpoints made for agents (the @youasked/mcp server): look a request up by its YA number,
// search by text, and summarise the week. Same secret-key auth as the rest of /v1/admin.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadRequestById, loadRequestByNumber, ref } from "./actions";
import { cleanText, similarity } from "./lib";
import type { AppRow, Env, RequestRow } from "./types";

const agent = new Hono<{ Bindings: Env; Variables: { app: AppRow } }>();

function fail(status: 401 | 404, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

// Registered under the same prefix as the main admin routes, so each path here checks the key itself.
const AGENT_PATHS = ["/lookup", "/search", "/digest"];
for (const path of AGENT_PATHS) {
  agent.use(path, async (c, next) => {
    const key = c.req.header("authorization")?.replace(/^Bearer /, "");
    if (!key?.startsWith("ya_sec_")) fail(401, "unauthorized");
    const row = await c.env.DB.prepare("SELECT * FROM apps WHERE secret_key = ?").bind(key).first<AppRow>();
    if (!row) fail(401, "unauthorized");
    c.set("app", row);
    await next();
  });
}

const summary = (r: RequestRow) => ({
  id: r.id,
  ref: ref(r),
  number: r.number,
  title: r.title,
  status: r.status,
  votes: r.vote_count,
  comments: r.comment_count,
  shipNote: r.ship_note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** "YA-12", "12" or a request id → the request with its comments. */
agent.get("/lookup", async (c) => {
  const q = (c.req.query("ref") ?? "").trim();
  const n = /^(?:ya-)?(\d+)$/i.exec(q);
  const appId = c.get("app").id;
  const r = n ? await loadRequestByNumber(c.env.DB, appId, Number(n[1])) : await loadRequestById(c.env.DB, appId, q);
  if (!r) fail(404, "not_found");
  const { results: comments } = await c.env.DB.prepare(
    `SELECT c.id, c.body, c.is_team, c.created_at, u.name FROM comments c
     LEFT JOIN users u ON u.id = c.user_id WHERE c.request_id = ? ORDER BY c.created_at LIMIT 200`,
  )
    .bind(r.id)
    .all<{ id: string; body: string; is_team: number; created_at: number; name: string | null }>();
  const voters = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM votes WHERE request_id = ?").bind(r.id).first<{ n: number }>();
  return c.json({
    request: { ...summary(r), body: r.body, mergedInto: r.merged_into, shippedAt: r.shipped_at },
    comments: comments.map((cm) => ({
      id: cm.id,
      body: cm.body,
      team: Boolean(cm.is_team),
      author: cm.is_team ? "team" : cm.name,
      createdAt: cm.created_at,
    })),
    voters: voters?.n ?? 0,
  });
});

agent.get("/search", async (c) => {
  const q = cleanText(c.req.query("q"), 200);
  if (q.length < 2) return c.json({ requests: [] });
  const { results } = await c.env.DB.prepare("SELECT * FROM requests WHERE app_id = ? AND status != 'merged' ORDER BY created_at DESC LIMIT 500")
    .bind(c.get("app").id)
    .all<RequestRow>();
  const hits = results
    .map((r) => ({ r, score: Math.max(similarity(q, r.title), similarity(q, `${r.title} ${r.body}`) * 0.8) }))
    .filter((x) => x.score >= 0.2)
    .sort((a, b) => b.score - a.score || b.r.vote_count - a.r.vote_count)
    .slice(0, 10);
  return c.json({ requests: hits.map((x) => ({ ...summary(x.r), score: Math.round(x.score * 100) / 100 })) });
});

agent.get("/digest", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days")) || 7, 1), 90);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const appId = c.get("app").id;
  const db = c.env.DB;
  const list = async (where: string, order: string, limit: number, ...extra: number[]) =>
    (await db.prepare(`SELECT * FROM requests WHERE app_id = ? AND ${where} ORDER BY ${order} LIMIT ${limit}`).bind(appId, ...extra).all<RequestRow>()).results.map(summary);
  const [top, fresh, shipped, newVotes, newComments] = await Promise.all([
    list("status IN ('open','planned','in_progress')", "vote_count DESC, created_at DESC", 5),
    list("created_at > ? AND status != 'merged'", "created_at DESC", 10, since),
    list("shipped_at > ?", "shipped_at DESC", 10, since),
    db
      .prepare("SELECT COUNT(*) AS n FROM votes v JOIN requests r ON r.id = v.request_id WHERE r.app_id = ? AND v.created_at > ?")
      .bind(appId, since)
      .first<{ n: number }>(),
    db
      .prepare("SELECT COUNT(*) AS n FROM comments c JOIN requests r ON r.id = c.request_id WHERE r.app_id = ? AND c.is_team = 0 AND c.created_at > ?")
      .bind(appId, since)
      .first<{ n: number }>(),
  ]);
  return c.json({ days, top, new: fresh, shipped, votes: newVotes?.n ?? 0, comments: newComments?.n ?? 0 });
});

export default agent;
