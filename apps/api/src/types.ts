export type Env = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  /** Overridable in tests; defaults to https://api.telegram.org */
  TELEGRAM_API?: string;
  /** Screenshots attached to requests. */
  UPLOADS: R2Bucket;

  /** Public URLs. Defaults: https://youasked.dev, https://app.youasked.dev, https://api.youasked.dev */
  SITE_URL?: string;
  DASHBOARD_URL?: string;
  API_URL?: string;

  /** Sign-in. Each provider is only offered when its secrets are set. "off" hides email links (until Email Sending is set up for the domain). */
  EMAIL_SIGN_IN?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  /** Billing. */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  /** Operator alerts go to this Telegram chat through this bot (see alert.ts). */
  ALERT_TELEGRAM_TOKEN?: string;
  ALERT_CHAT_ID?: string;

  /** The shared @youasked_bot that apps connect to with one tap (apps can still bring their own bot). */
  YOUASKED_BOT_TOKEN?: string;
  YOUASKED_BOT_SECRET?: string;

  /** Encrypts stored third-party tokens (GitHub, Linear, own Telegram bots). 32 random bytes, base64. */
  TOKEN_ENC_KEY?: string;
  /** Domain that receives forwarded support email (default in.youasked.dev). */
  INBOX_DOMAIN?: string;
  /** Where mail for other youasked.dev addresses goes once the catch-all points at this Worker. */
  CATCHALL_FORWARD?: string;

  /** Cloudflare bindings for AI features and email. Optional so local tests run without them. */
  AI?: Ai;
  VECTORIZE?: VectorizeIndex;
  EMAIL?: SendEmail;

  /** Amazon SES for email (preferred over the EMAIL binding when set). Region defaults to ap-southeast-1. */
  SES_ACCESS_KEY_ID?: string;
  SES_SECRET_ACCESS_KEY?: string;
  SES_REGION?: string;

  /** Heard elsewhere (social listening) data source. */
  SCRAPECREATORS_API_KEY?: string;
  /** Workers AI model for classifying and summarising; the default is set in ai.ts. */
  AI_MODEL?: string;
  /** Overridable in tests; default https://api.github.com */
  GITHUB_API?: string;
  /**
   * One password sign-in, for app store reviewers only (they can't receive our email links, and Google challenges
   * new logins). Off unless both are set. The hash is the SHA-256 hex of the password; the password lives in
   * ~/.config/youasked/reviewer.env, never in the repo.
   */
  REVIEW_LOGIN_EMAIL?: string;
  REVIEW_LOGIN_HASH?: string;
  /** The verification token OpenAI's app portal asks us to serve at /.well-known/openai-apps-challenge. */
  OPENAI_APPS_CHALLENGE?: string;
  /** Test only: serve listening sources from fixtures at this base URL instead of the real services. */
  LISTENING_FIXTURES?: string;
};

export type AppRow = {
  id: string;
  name: string;
  public_key: string;
  secret_key: string;
  watermark: number;
  require_signature: number;
  allowed_origins: string | null;
  workspace_id: string | null;
  claim_token: string | null;
  /** JSON settings for the occasional in-app prompt; NULL means off. */
  nudge?: string | null;
  moderation?: "off" | "approve";
  /** 1 skips test mode (set by hand for the Demo app and our own site). */
  always_live?: number;
  slug: string | null;
  public_board: number;
  description: string | null;
  /** 1 when each person sees only their own conversations with the team (no public board, no votes). */
  private_mode?: number;
  /** Email inbox: 1 when forwarded email becomes conversations; the address token; last confirmation email (JSON); last email time. */
  email_inbox?: number;
  email_token?: string | null;
  email_setup?: string | null;
  email_last_at?: number | null;
  /** JSON: who the widget's messages come from (name, role, photo, welcome note). NULL means not set. */
  persona?: string | null;
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
  email_optout?: number;
};

export const STATUSES = ["open", "planned", "in_progress", "shipped", "declined"] as const;
/** "pending" waits for approval (moderation on); the team never picks it as a status. */
export type Status = (typeof STATUSES)[number] | "merged" | "pending";

export type RequestRow = {
  id: string;
  app_id: string;
  author_id: string;
  number: number;
  title: string;
  body: string;
  status: Status;
  vote_count: number;
  /** Votes from an import, which have no individual voters; vote_count includes them. */
  imported_votes?: number;
  comment_count: number;
  merged_into: string | null;
  ship_note: string | null;
  shipped_at: number | null;
  /** JSON {path?, topic?} */
  context: string | null;
  /** 1 when the author asked to be thanked by first name when it ships. */
  credit: number;
  /** GitHub issue opened by "Build it". */
  issue_url: string | null;
  /** "reddit" | "appstore" when the request was approved from Heard elsewhere. */
  source: string | null;
  source_url: string | null;
  /** Mentions found outside the widget (Heard elsewhere), counted like quiet votes. */
  elsewhere_count: number;
  /** 1 when written while the app was in private mode: only the author and the team ever see it. */
  private?: number;
  /** The request this private conversation is filed under. It follows that request's status. */
  linked_to?: string | null;
  /** When the team marked the conversation done; cleared when the person writes again. */
  closed_at?: number | null;
  created_at: number;
  updated_at: number;
};

export type RequestContext = {
  path?: string;
  topic?: string;
  /** Set only by the email inbox handler (never by clients): how it arrived, from whom, the subject. */
  via?: "email";
  from?: string;
  subject?: string;
  /** Up to 6 short labels the app's server attaches (wedding: maya-and-daniel, source: chatgpt). */
  meta?: Record<string, string>;
};

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
  kind: "telegram" | "github" | "webhook" | "events";
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
  /** true when the chat is bound through the shared @youasked_bot; botToken is then empty. */
  shared?: boolean;
};

export type GithubConfig = {
  secret: string;
  /** "owner/name" and the AES-GCM encrypted token that can open issues there (see crypto.ts). */
  repo?: string;
  tokenEnc?: string;
};

export type WebhookConfig = { url: string; format: "slack" | "discord" | "json" };
