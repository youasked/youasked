// Self-serve app creation for the CLI (`npx youasked init`). No auth while we're in beta;
// instead each IP can make a handful of apps a day.
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { dashboardBase } from "./auth";
import { cleanText, newId } from "./lib";
import type { Env } from "./types";

const signup = new Hono<{ Bindings: Env }>();

const PER_IP_PER_DAY = 5;
const DAY = 24 * 60 * 60 * 1000;

function fail(status: 400 | 429, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

signup.post("/signup", async (c) => {
  const body = await c.req.json<{ name?: string; email?: string }>().catch(() => ({}) as { name?: string; email?: string });
  const name = cleanText(body.name, 80).replace(/\n/g, " ");
  if (name.length < 2 || !/[\p{L}\p{N}]/u.test(name)) fail(400, "name_too_short");
  if (/https?:\/\//i.test(name)) fail(400, "bad_name");
  const email = cleanText(body.email, 320) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, "bad_email");

  // Behind Cloudflare this is always set. Without it (local dev) everyone shares one bucket.
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const t = Date.now();
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM signups WHERE ip = ? AND created_at > ?")
    .bind(ip, t - DAY)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= PER_IP_PER_DAY) fail(429, "too_many_apps");

  const app = { id: newId("app"), publicKey: newId("ya_pub", 24), secretKey: newId("ya_sec", 32) };
  // Whoever holds the claim link can move this app into their workspace, so it's long and random.
  const claimToken = newId("claim", 32);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO apps (id, name, public_key, secret_key, claim_token, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      app.id,
      name,
      app.publicKey,
      app.secretKey,
      claimToken,
      t,
    ),
    c.env.DB.prepare("INSERT INTO signups (id, app_id, ip, email, created_at) VALUES (?, ?, ?, ?, ?)").bind(newId("sgn"), app.id, ip, email, t),
  ]);
  const dashboard = dashboardBase(c.env);
  return c.json(
    { publicKey: app.publicKey, secretKey: app.secretKey, dashboardUrl: dashboard, claimUrl: `${dashboard}/claim?token=${claimToken}` },
    201,
  );
});

export default signup;
