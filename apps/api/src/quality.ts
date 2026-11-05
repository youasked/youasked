// Keeping the board clean: duplicates by meaning, moderation, unsubscribe, import and export.
// Admin routes use the app's secret key like the rest of /v1/admin; each path checks it itself
// because this router shares the prefix with the main admin router.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { loadRequestById, ref } from "./actions";
import { cleanText, similarity } from "./lib";
import { overLimit } from "./spam";
import { verifyUnsubscribeToken } from "./mail";
import { exportRequests, importRequests } from "./portability";
import { blend, nearestPairs, pairOf, removeRequests, searchByMeaning, semanticAvailable, upsertRequests } from "./semantic";
import type { AppRow, Env, RequestRow } from "./types";

type Vars = { app: AppRow };

/** Hands new-request side effects (team notification, similar-request hint) to the caller that owns them. */
export type QualityDeps = {
  announce: (env: Env, ctx: Pick<ExecutionContext, "waitUntil">, app: AppRow, request: RequestRow, origin: string) => Promise<void>;
};

function fail(status: 400 | 401 | 404 | 413, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

const PUBLIC_STATUSES = "('open','planned','in_progress','shipped')";

type Scored = RequestRow & { voted: number; author_name: string | null };

/**
 * Requests like `q`, for the "already asked?" tray. Word overlap on the app's 500 newest requests,
 * blended with a meaning search when Workers AI and Vectorize are bound. Pending and merged
 * requests never show.
 */
export async function findSimilar(env: Env, appId: string, q: string, meId: string, excludeId?: string, who = meId) {
  const sql = `SELECT r.*, au.name AS author_name, (v.user_id IS NOT NULL) AS voted FROM requests r
       LEFT JOIN votes v ON v.request_id = r.id AND v.user_id = ?
       LEFT JOIN users au ON au.id = r.author_id`;
  const [{ results }, semantic] = await Promise.all([
    env.DB.prepare(`${sql} WHERE r.app_id = ? AND r.status IN ${PUBLIC_STATUSES} ORDER BY r.created_at DESC LIMIT 500`)
      .bind(meId, appId)
      .all<Scored>(),
    searchByMeaning(env, appId, q, who),
  ]);
  const rows = new Map(results.map((r) => [r.id, r]));
  const missing = semantic.filter((s) => !rows.has(s.id) && s.id !== excludeId).map((s) => s.id);
  if (missing.length) {
    const extra = await env.DB.prepare(`${sql} WHERE r.app_id = ? AND r.status IN ${PUBLIC_STATUSES} AND r.id IN (${missing.map(() => "?").join(",")})`)
      .bind(meId, appId, ...missing)
      .all<Scored>();
    for (const r of extra.results) rows.set(r.id, r);
  }
  const sem = new Map(semantic.map((s) => [s.id, s.score]));
  const out: { r: Scored; score: number }[] = [];
  for (const r of rows.values()) {
    if (r.id === excludeId) continue;
    const text = Math.max(similarity(q, r.title), similarity(q, `${r.title} ${r.body}`) * 0.8);
    const score = blend(text, sem.get(r.id));
    if (score !== null) out.push({ r, score });
  }
  return out.sort((x, y) => y.score - x.score || y.r.vote_count - x.r.vote_count);
}

/** Deletes a request and everything hanging off it (also used when the team rejects a pending one). */
export async function purgeRequest(env: Env, r: RequestRow): Promise<void> {
  const { results: files } = await env.DB.prepare("SELECT id FROM uploads WHERE request_id = ?").bind(r.id).all<{ id: string }>();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM votes WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM comments WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM notifications WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM early_access WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM uploads WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM email_log WHERE request_id = ?").bind(r.id),
    env.DB.prepare("DELETE FROM duplicate_dismissals WHERE app_id = ?1 AND (a = ?2 OR b = ?2)").bind(r.app_id, r.id),
    env.DB.prepare("DELETE FROM requests WHERE id = ?").bind(r.id),
  ]);
  if (files.length) await env.UPLOADS.delete(files.map((f) => f.id));
  await removeRequests(env, [r.id]);
}

const summary = (r: RequestRow) => ({
  id: r.id,
  ref: ref(r),
  number: r.number,
  title: r.title,
  body: r.body,
  status: r.status,
  votes: r.vote_count,
  comments: r.comment_count,
  createdAt: r.created_at,
});

export default function quality(deps: QualityDeps) {
  const router = new Hono<{ Bindings: Env; Variables: Vars }>();

  for (const path of ["/duplicates", "/duplicates/dismiss", "/embeddings/backfill", "/requests/:id/approve", "/requests/:id/reject", "/import", "/export"]) {
    router.use(path, async (c, next) => {
      const key = c.req.header("authorization")?.replace(/^Bearer /, "");
      if (!key?.startsWith("ya_sec_")) fail(401, "unauthorized");
      const row = await c.env.DB.prepare("SELECT * FROM apps WHERE secret_key = ?").bind(key).first<AppRow>();
      if (!row) fail(401, "unauthorized");
      c.set("app", row);
      await next();
    });
  }

  // ---- duplicates

  router.get("/duplicates", async (c) => {
    const app = c.get("app");
    if (!semanticAvailable(c.env)) return c.json({ pairs: [], semantic: false });
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM requests WHERE app_id = ? AND status IN ('open','planned','in_progress') ORDER BY created_at DESC LIMIT 150",
    )
      .bind(app.id)
      .all<RequestRow>();
    const byId = new Map(results.map((r) => [r.id, r]));
    const pairs = await nearestPairs(c.env, app.id, [...byId.keys()]);
    const { results: dismissed } = await c.env.DB.prepare("SELECT a, b FROM duplicate_dismissals WHERE app_id = ?")
      .bind(app.id)
      .all<{ a: string; b: string }>();
    const skip = new Set(dismissed.map((d) => `${d.a}|${d.b}`));
    return c.json({
      semantic: true,
      pairs: pairs
        .filter((p) => !skip.has(`${p.a}|${p.b}`))
        .slice(0, 50)
        .map((p) => ({ a: summary(byId.get(p.a)!), b: summary(byId.get(p.b)!), score: Math.round(p.score * 1000) / 1000 })),
    });
  });

  router.post("/duplicates/dismiss", async (c) => {
    const app = c.get("app");
    const body = await c.req.json<{ a?: string; b?: string }>().catch(() => ({}) as { a?: string; b?: string });
    if (!body.a || !body.b || body.a === body.b) fail(400, "two_requests_required");
    const [a, b] = pairOf(body.a, body.b);
    await c.env.DB.prepare("INSERT OR IGNORE INTO duplicate_dismissals (app_id, a, b, created_at) VALUES (?, ?, ?, ?)").bind(app.id, a, b, Date.now()).run();
    return c.json({ ok: true });
  });

  /** Embeds existing requests. Call repeatedly with `after` set to the previous `next` until it is null. */
  router.post("/embeddings/backfill", async (c) => {
    const app = c.get("app");
    if (await overLimit(c.env.DB, `backfill:${app.id}`, 20)) throw new HTTPException(429, { message: "slow_down" });
    if (!semanticAvailable(c.env)) return c.json({ available: false, embedded: 0, next: null });
    const body = await c.req.json<{ after?: string }>().catch(() => ({}) as { after?: string });
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM requests WHERE app_id = ? AND status != 'merged' AND id > ? ORDER BY id LIMIT 200",
    )
      .bind(app.id, body.after ?? "")
      .all<RequestRow>();
    const embedded = await upsertRequests(c.env, results);
    return c.json({ available: true, embedded, next: results.length === 200 ? results[results.length - 1].id : null });
  });

  // ---- moderation

  router.post("/requests/:id/approve", async (c) => {
    const app = c.get("app");
    const r = await loadRequestById(c.env.DB, app.id, c.req.param("id"));
    if (!r) fail(404, "not_found");
    if (r.status !== "pending") return c.json({ ok: true, status: r.status });
    await c.env.DB.prepare("UPDATE requests SET status = 'open', updated_at = ? WHERE id = ?").bind(Date.now(), r.id).run();
    const open = { ...r, status: "open" as const };
    c.executionCtx.waitUntil(upsertRequests(c.env, [open]).then(() => deps.announce(c.env, c.executionCtx, app, open, new URL(c.req.url).origin)));
    return c.json({ ok: true, status: "open" });
  });

  /** Removes a pending request without telling its author anything. */
  router.post("/requests/:id/reject", async (c) => {
    const r = await loadRequestById(c.env.DB, c.get("app").id, c.req.param("id"));
    if (!r) fail(404, "not_found");
    if (r.status !== "pending") fail(400, "not_pending");
    await purgeRequest(c.env, r);
    return c.json({ ok: true });
  });

  // ---- import and export

  router.post("/import", async (c) => {
    const app = c.get("app");
    if (await overLimit(c.env.DB, `import:${app.id}`, 10)) throw new HTTPException(429, { message: "slow_down" });
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > 3 * 1024 * 1024) fail(413, "file_too_large");
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!form || !(file instanceof File)) fail(400, "file_required");
    if (file.size > 2 * 1024 * 1024) fail(413, "file_too_large");
    const source = cleanText(form.get("source"), 20).toLowerCase();
    if (source !== "canny" && source !== "featurebase" && source !== "csv") fail(400, "bad_source");
    const result = await importRequests(c.env, app.id, source, await file.text());
    if ("error" in result) fail(400, result.error);
    return c.json({ imported: result.imported, skipped: result.skipped });
  });

  router.get("/export", async (c) => {
    const format = c.req.query("format") === "json" ? "json" : "csv";
    const { body, type } = await exportRequests(c.env.DB, c.get("app").id, format);
    return new Response(body, {
      headers: { "content-type": type, "content-disposition": `attachment; filename="youasked-requests.${format}"`, "cache-control": "no-store" },
    });
  });

  return router;
}

// ---------------------------------------------------------------- public: unsubscribe

export const unsubscribe = new Hono<{ Bindings: Env }>();

const page = (title: string, line: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:17px/1.5 -apple-system,Segoe UI,sans-serif;max-width:440px;margin:18vh auto;padding:0 20px;color:#222"><h1 style="font-size:22px">${title}</h1><p>${line}</p>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

unsubscribe.get("/unsubscribe", async (c) => {
  const userId = await verifyUnsubscribeToken(c.env, c.req.query("token") ?? "");
  if (!userId) return page("That link doesn't work", "It may be incomplete. Reply to any of our emails and we'll sort it out.");
  await c.env.DB.prepare("UPDATE users SET email_optout = 1 WHERE id = ?").bind(userId).run();
  return page("You're unsubscribed", "We won't email you about feature requests in this app again.");
});
