// Duplicate catching by meaning: each request's title + body is embedded with Workers AI and kept in
// Vectorize (one namespace per app). Every function here is safe to call without the AI or VECTORIZE
// bindings (local dev, tests) and never throws: callers just get "nothing found" and fall back to text.
import type { Env } from "./types";

export const EMBED_MODEL = "@cf/baai/bge-small-en-v1.5"; // 384 dimensions, cosine
export const DIMENSIONS = 384;

/** Cosine scores from a small English model: related wording sits around 0.75+, unrelated below 0.65. */
export const TRAY_MIN = 0.74; // shown as "already asked?" while typing
export const DUPLICATE_MIN = 0.84; // listed as a likely duplicate pair for the team
export const TEXT_MIN = 0.34; // the older word-overlap match

export const semanticAvailable = (env: Env) => Boolean(env.AI && env.VECTORIZE);

export const requestText = (r: { title: string; body: string }) => `${r.title}\n${r.body}`.trim().slice(0, 1500);

/** Blends the word-overlap score with the meaning score. Either one alone is enough to count. */
export function blend(text: number, semantic: number | undefined): number | null {
  const sem = semantic !== undefined && semantic >= TRAY_MIN ? semantic : 0;
  const t = text >= TEXT_MIN ? text : 0;
  const best = Math.max(sem, t);
  return best > 0 ? best : null;
}

/** A pair is stored once, smaller id first. */
export const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

async function embed(env: Env, texts: string[]): Promise<number[][] | null> {
  if (!env.AI || !texts.length) return null;
  try {
    const out = (await (env.AI as unknown as { run: (m: string, i: unknown) => Promise<{ data?: number[][] }> }).run(EMBED_MODEL, {
      text: texts,
    })) as { data?: number[][] };
    return out.data && out.data.length === texts.length ? out.data : null;
  } catch (err) {
    console.error("[semantic] embed failed", err);
    return null;
  }
}

// The widget asks as people type (debounced), so keep recent query vectors and cap embeds per person.
const queryCache = new Map<string, number[]>();
const spent = new Map<string, number[]>();
const PER_MINUTE = 20;

function allowEmbed(who: string): boolean {
  const t = Date.now();
  const recent = (spent.get(who) ?? []).filter((x) => t - x < 60_000);
  if (recent.length >= PER_MINUTE) {
    spent.set(who, recent);
    return false;
  }
  recent.push(t);
  spent.set(who, recent);
  if (spent.size > 2000) spent.clear();
  return true;
}

async function embedQuery(env: Env, q: string, who: string): Promise<number[] | null> {
  const key = q.toLowerCase();
  const hit = queryCache.get(key);
  if (hit) return hit;
  if (!allowEmbed(who)) return null;
  const v = (await embed(env, [q]))?.[0] ?? null;
  if (v) {
    queryCache.set(key, v);
    if (queryCache.size > 300) queryCache.delete(queryCache.keys().next().value as string);
  }
  return v;
}

/** Requests whose meaning is close to `q`, best first. */
export async function searchByMeaning(env: Env, appId: string, q: string, who: string, topK = 8): Promise<{ id: string; score: number }[]> {
  if (!semanticAvailable(env)) return [];
  try {
    const v = await embedQuery(env, q, who);
    if (!v) return [];
    const res = await env.VECTORIZE!.query(v, { topK, namespace: appId, returnValues: false, returnMetadata: "none" });
    return res.matches.map((m) => ({ id: m.id, score: m.score }));
  } catch (err) {
    console.error("[semantic] query failed", err);
    return [];
  }
}

type Embeddable = { id: string; app_id: string; number: number; title: string; body: string };

/** Adds or refreshes vectors, in batches. Returns how many were stored. */
export async function upsertRequests(env: Env, rows: Embeddable[]): Promise<number> {
  if (!semanticAvailable(env) || !rows.length) return 0;
  let stored = 0;
  try {
    for (let i = 0; i < rows.length; i += 40) {
      const chunk = rows.slice(i, i + 40);
      const vectors = await embed(env, chunk.map(requestText));
      if (!vectors) continue;
      await env.VECTORIZE!.upsert(
        chunk.map((r, k) => ({ id: r.id, namespace: r.app_id, values: vectors[k], metadata: { app_id: r.app_id, number: r.number } })),
      );
      stored += chunk.length;
    }
  } catch (err) {
    console.error("[semantic] upsert failed", err);
  }
  return stored;
}

export async function removeRequests(env: Env, ids: string[]): Promise<void> {
  if (!env.VECTORIZE || !ids.length) return;
  try {
    await env.VECTORIZE.deleteByIds(ids);
  } catch (err) {
    console.error("[semantic] delete failed", err);
  }
}

/** For each id, the other requests in the app whose meaning is nearly the same (score >= DUPLICATE_MIN). */
export async function nearestPairs(env: Env, appId: string, ids: string[]): Promise<{ a: string; b: string; score: number }[]> {
  if (!semanticAvailable(env) || ids.length < 2) return [];
  const wanted = new Set(ids);
  const found = new Map<string, { a: string; b: string; score: number }>();
  try {
    const stored: VectorizeVector[] = [];
    for (let i = 0; i < ids.length; i += 20) stored.push(...(await env.VECTORIZE!.getByIds(ids.slice(i, i + 20))));
    for (let i = 0; i < stored.length; i += 10) {
      const matches = await Promise.all(
        stored.slice(i, i + 10).map((v) =>
          env.VECTORIZE!.query(v.values as number[], { topK: 6, namespace: appId, returnValues: false, returnMetadata: "none" }),
        ),
      );
      matches.forEach((res, k) => {
        const from = stored[i + k].id;
        for (const m of res.matches) {
          if (m.id === from || !wanted.has(m.id) || m.score < DUPLICATE_MIN) continue;
          const [a, b] = pairOf(from, m.id);
          const key = `${a}|${b}`;
          if ((found.get(key)?.score ?? 0) < m.score) found.set(key, { a, b, score: m.score });
        }
      });
    }
  } catch (err) {
    console.error("[semantic] pairs failed", err);
    return [];
  }
  return [...found.values()].sort((x, y) => y.score - x.score);
}
