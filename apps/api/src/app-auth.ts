// Auth for admin routes that live in their own files. The dashboard proxy sets "app" itself after
// checking the signed-in account; otherwise the app's secret key is required.
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppRow, Env } from "./types";

export type AppEnv = { Bindings: Env; Variables: { app: AppRow } };

export function fail(status: 400 | 401 | 402 | 403 | 404 | 409 | 502, error: string, extra: Record<string, unknown> = {}): never {
  throw new HTTPException(status, { res: Response.json({ error, ...extra }, { status }) });
}

export const requireApp: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("app")) {
    const key = c.req.header("authorization")?.replace(/^Bearer /, "");
    if (!key?.startsWith("ya_sec_")) fail(401, "unauthorized");
    const row = await c.env.DB.prepare("SELECT * FROM apps WHERE secret_key = ?").bind(key).first<AppRow>();
    if (!row) fail(401, "unauthorized");
    c.set("app", row);
  }
  await next();
};
