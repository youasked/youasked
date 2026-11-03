// Run with: npx tsx apps/api/test/quality.test.ts
// Exercises the pure parts of the quality stream and the Vectorize logic against fakes.
import assert from "node:assert/strict";
import { mapStatus, parseCsv, parseIncoming } from "../src/portability";
import { blend, nearestPairs, pairOf, removeRequests, searchByMeaning, upsertRequests } from "../src/semantic";
import { judgeText } from "../src/spam";
import type { Env } from "../src/types";

// A fake embedding: synonyms share a dimension, so related sentences land close together.
const CONCEPTS = [["dark", "night", "black"], ["theme", "mode", "appearance"], ["pdf", "export", "download"], ["slack", "chat"]];
const vec = (text: string) => {
  const v = CONCEPTS.map((words) => words.filter((w) => text.toLowerCase().includes(w)).length);
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

const store = new Map<string, { values: number[]; namespace: string }>();
const env = {
  AI: { run: async (_m: string, i: { text: string[] }) => ({ data: i.text.map(vec) }) },
  VECTORIZE: {
    upsert: async (vs: { id: string; values: number[]; namespace: string }[]) => vs.forEach((v) => store.set(v.id, v)),
    deleteByIds: async (ids: string[]) => ids.forEach((id) => store.delete(id)),
    getByIds: async (ids: string[]) => ids.filter((id) => store.has(id)).map((id) => ({ id, values: store.get(id)!.values })),
    query: async (q: number[], o: { topK: number; namespace: string }) => ({
      matches: [...store.entries()]
        .filter(([, v]) => v.namespace === o.namespace)
        .map(([id, v]) => ({ id, score: cosine(q, v.values) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, o.topK),
    }),
  },
} as unknown as Env;

const row = (id: string, title: string, body = "") => ({ id, app_id: "app1", number: 1, title, body });

// semantic
assert.equal(await upsertRequests(env, [row("a", "Dark mode"), row("b", "Night theme"), row("c", "Export to PDF"), row("d", "Slack chat")]), 4);
const hits = await searchByMeaning(env, "app1", "black appearance", "u1");
assert.equal(hits[0].id === "a" || hits[0].id === "b", true);
const pairs = await nearestPairs(env, "app1", ["a", "b", "c", "d"]);
assert.deepEqual(pairs.map((p) => [p.a, p.b]), [["a", "b"]]);
await removeRequests(env, ["b"]);
assert.deepEqual(await nearestPairs(env, "app1", ["a", "b", "c", "d"]), []);
assert.deepEqual(await searchByMeaning({} as Env, "app1", "anything", "u"), []); // no bindings: empty, no throw
assert.equal(blend(0.1, 0.9), 0.9);
assert.equal(blend(0.5, 0.2), 0.5);
assert.equal(blend(0.1, 0.2), null);
assert.deepEqual(pairOf("z", "a"), ["a", "z"]);

// spam
assert.equal(judgeText("https://spam.example.com").kind, "spam");
assert.equal(judgeText("aaaaaaaaaaaaaaaa").kind, "spam");
assert.equal(judgeText("buy cheap followers today").kind, "spam");
assert.equal(judgeText("Add dark mode, see https://example.com/x for an example").kind, "ok");
assert.equal(judgeText("I would love offline support for flights").kind, "ok");

// import parsing
assert.equal(mapStatus("Under Review"), "open");
assert.equal(mapStatus("In Progress"), "in_progress");
assert.equal(mapStatus("Complete"), "shipped");
assert.equal(mapStatus("Planned"), "planned");
assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n'), [["a", "b"], ["x, y", 'say "hi"']]);
const fb = parseIncoming("featurebase", "Post Title,Post Content,Upvote Count,Status\nSync,Body,25,In Progress\n");
assert.ok(Array.isArray(fb) && fb[0].votes === 25 && fb[0].status === "in_progress");

console.log("quality tests passed");
