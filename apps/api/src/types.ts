export type Env = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  /** Overridable in tests; defaults to https://api.telegram.org */
  TELEGRAM_API?: string;
  /** Screenshots attached to requests. */
  UPLOADS: R2Bucket;
};

export type AppRow = {
  id: string;
  name: string;
  public_key: string;
  secret_key: string;
  watermark: number;
  require_signature: number;
  allowed_origins: string | null;
};

export type UserRow = {
  id: string;
  external_id: string;
  email: string | null;
  name: string | null;
  is_anon: number;
  created_at: number;
  last_seen_at: number;
  last_whats_new_at: number | null;
};

export const STATUSES = ["open", "planned", "in_progress", "shipped", "declined"] as const;
export type Status = (typeof STATUSES)[number] | "merged";

export type RequestRow = {
  id: string;
  app_id: string;
  author_id: string;
  number: number;
  title: string;
  body: string;
  status: Status;
  vote_count: number;
  comment_count: number;
  merged_into: string | null;
  ship_note: string | null;
  shipped_at: number | null;
  /** JSON {path?, topic?} */
  context: string | null;
  /** 1 when the author asked to be thanked by first name when it ships. */
  credit: number;
  created_at: number;
  updated_at: number;
};

export type RequestContext = { path?: string; topic?: string };

export function parseContext(raw: string | null): RequestContext | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RequestContext;
  } catch {
    return null;
  }
}

export type Integration<C = Record<string, unknown>> = {
  id: string;
  app_id: string;
  kind: "telegram" | "github" | "webhook";
  config: C;
};

export type TelegramConfig = {
  botToken: string;
  botUsername: string;
  secret: string;
  linkCode: string | null;
  chatId: string | null;
  chatTitle: string | null;
  /**
   * false when the bot already belongs to something else (it long-polls its own updates), so
   * YouAsked only posts: cards link to the dashboard instead of carrying action buttons.
   */
  interactive?: boolean;
  dashboardUrl?: string;
};

export type GithubConfig = { secret: string };

export type WebhookConfig = { url: string; format: "slack" | "discord" | "json" };
