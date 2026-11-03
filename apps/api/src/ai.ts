// Thin wrapper over Workers AI. Every caller must work without it: these return null when the
// binding is missing or the model fails, and the caller falls back to plain text rules.
import type { Env } from "./types";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type Message = { role: "system" | "user"; content: string };

async function run(env: Env, messages: Message[], extra: Record<string, unknown>): Promise<unknown> {
  if (!env.AI) return null;
  try {
    const res: any = await (env.AI as any).run(env.AI_MODEL || DEFAULT_MODEL, { messages, max_tokens: 700, temperature: 0.2, ...extra });
    return res?.response ?? res?.choices?.[0]?.message?.content ?? null;
  } catch (err) {
    console.error("workers-ai", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Asks for JSON matching `schema`. Returns the parsed object, or null on any failure. */
export async function aiJson<T>(env: Env, system: string, user: string, schema: Record<string, unknown>): Promise<T | null> {
  const out = await run(env, [{ role: "system", content: system }, { role: "user", content: user }], {
    response_format: { type: "json_schema", json_schema: schema },
  });
  if (out && typeof out === "object") return out as T;
  if (typeof out !== "string") return null;
  const start = out.indexOf("{");
  const end = out.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(out.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export async function aiText(env: Env, system: string, user: string): Promise<string | null> {
  const out = await run(env, [{ role: "system", content: system }, { role: "user", content: user }], {});
  return typeof out === "string" && out.trim() ? out.trim() : null;
}
