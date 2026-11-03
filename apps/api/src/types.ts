export type Env = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  /** Overridable in tests; defaults to https://api.telegram.org */
  TELEGRAM_API?: string;
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
  last_seen_at: number;
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
  created_at: number;
  updated_at: number;
};

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
};

export type GithubConfig = { secret: string };

export type WebhookConfig = { url: string; format: "slack" | "discord" | "json" };
