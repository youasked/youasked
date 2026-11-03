// The dashboard's API client and the shapes it expects. See docs/build-plan.md ("API contract").
import { mockFetch, mockEnabled } from "./mock";

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://api.youasked.dev";

export type Status = "open" | "planned" | "in_progress" | "shipped" | "declined" | "pending" | "merged";

export type Req = {
  id: string;
  number: number;
  title: string;
  body: string;
  status: Status;
  votes: number;
  comments: number;
  shipNote: string | null;
  shippedAt: number | null;
  context: { topic?: string; page?: string; url?: string } | null;
  creditName: string | null;
  createdAt: number;
  updatedAt?: number;
  attachments?: { id: string; url: string }[];
  earlyAccess?: number;
  author?: { email: string | null; name: string | null; anonymous: boolean };
  shareUrl?: string | null;
  shareImage?: string | null;
};

export type Comment = { id: string; body: string; is_team: number; created_at: number; name: string | null; email: string | null };
export type Voter = { email: string | null; name: string | null; is_anon: number };

export type Account = { id: string; email: string; name: string | null; avatarUrl: string | null };
export type WorkspaceSummary = { id: string; name: string; role: Role; plan: Plan | null; live: boolean };
export type Role = "owner" | "admin" | "member";
export type Plan = "solo" | "pro" | "studio";
export type Interval = "month" | "year";

export type Me = { account: Account; workspaces: WorkspaceSummary[] };

export type WorkspaceApp = { id: string; name: string; publicKey: string; secretKeyHint?: string; live: boolean; createdAt: number };
export type Member = { accountId: string; email: string; name: string | null; role: Role };
export type Invite = { id: string; email: string; role: Role; createdAt?: number };
export type Limits = { plan?: Plan | null; apps: number | null; members: number; listeningApps: number; removeBranding: boolean; linear: boolean; customDomain: boolean };
export type WorkspaceDetail = {
  workspace: {
    id: string;
    name: string;
    plan: Plan | null;
    interval: Interval | null;
    status: string | null;
    live: boolean;
    founding: boolean;
    currentPeriodEnd: number | null;
  };
  limits: Limits | null;
  usage: { apps: number; members: number };
  members: Member[];
  invites: Invite[];
  apps: WorkspaceApp[];
  foundingLeft: number;
};

export type AppInfo = {
  id: string;
  name: string;
  watermark: boolean;
  requireSignature: boolean;
  allowedOrigins: string[] | null;
  moderation?: "off" | "approve";
  slug?: string | null;
  publicBoard?: boolean;
  publicUrl?: string | null;
  description?: string | null;
  publicKey?: string;
};

export type NewApp = { id: string; name: string; publicKey: string; secretKey: string };

export type TelegramState = {
  connected: boolean;
  mode: "interactive" | "notify";
  chatTitle?: string | null;
  botUsername?: string;
  shared?: boolean;
  link?: string | null;
  groupLink?: string | null;
  directLink?: string | null;
};
export type Integrations = {
  telegram?: TelegramState;
  github?: { payloadUrl: string; secret: string; repo?: string | null; hasToken?: boolean; tokenConnected?: boolean };
  webhook?: { url: string; format: "slack" | "discord" | "json" };
};

export type Competitor = { name: string; appStoreId?: string; playId?: string };
export type ListeningConfig = { keywords: string[]; competitors: Competitor[]; subreddits: string[]; countries?: string[]; about?: string; appStoreId?: string };
export type ListeningItem = {
  id: string;
  source: "reddit" | "appstore" | "playstore" | "x" | string;
  url: string;
  text: string;
  feature: string;
  strength?: number;
  createdAt: number;
  matchedRequest?: { id: string; ref?: string; number?: number; title?: string; votes?: number } | null;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public upgrade = false,
    public serverMessage = "",
  ) {
    super(code);
  }
}

/** Turns an API error into a sentence that says what went wrong and what to do. */
export function explain(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong on our side of the screen. Check your connection and try again.";
  const known: Record<string, string> = {
    unauthorized: "You are signed out. Sign in again to continue.",
    not_found: "That no longer exists. It may have been deleted or merged.",
    bad_bot_token: "That doesn't look like a Telegram bot token. Copy it again from @BotFather.",
    bot_token_rejected: "Telegram rejected that token. Check it in @BotFather and paste it again.",
    chat_not_found: "Telegram can't find that chat. Add your bot to the chat first, then try again.",
    https_only: "Webhook addresses must start with https://.",
    bad_url: "That doesn't look like a web address. Paste the full URL, starting with https://.",
    body_required: "Write something first.",
    same_request: "Pick a different request to merge into.",
    plan_required: "Pick a plan to use this.",
    upgrade_required: "Your plan doesn't include this. Upgrade to use it.",
    slug_taken: "That address is taken. Try another one.",
    slug_reserved: "That address is reserved. Try another one.",
    slug_required: "Choose an address for your public board first.",
    test_mode: "This app is in test mode. Pick a plan to use it on your real website.",
    bad_slug: "Use 3 to 40 lowercase letters, numbers or dashes.",
  };
  if (e.serverMessage && e.status < 500) return e.serverMessage;
  if (known[e.code]) return known[e.code];
  if (e.status === 401) return known.unauthorized;
  if (e.status === 402) return "Your plan doesn't include this. Upgrade to use it.";
  if (e.status === 403) return "You don't have permission to do that. Ask a workspace admin.";
  if (e.status === 404) return known.not_found;
  if (e.status === 429) return "Too many tries. Wait a minute and try again.";
  if (e.status === 503) return "That feature isn't switched on for this server yet. Try again later.";
  if (e.status >= 500) return "Our server hit a problem. Try again in a moment.";
  return e.code ? `Couldn't do that (${e.code.replaceAll("_", " ")}).` : "Couldn't do that. Try again.";
}

type Opts = { method?: string; body?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const method = opts.method ?? "GET";
  let res: Response;
  try {
    res = mockEnabled()
      ? await mockFetch(method, path, opts.form ?? opts.body)
      : await fetch(API_URL + path, {
          method,
          credentials: "include",
          headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
          body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        });
  } catch {
    throw new ApiError(0, "network");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; upgrade?: boolean; message?: string };
    throw new ApiError(res.status, j.error ?? "", Boolean(j.upgrade), j.message ?? "");
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Same as api() but for app routes: /v1/dash/apps/:appId/… */
export const appApi = <T = unknown>(appId: string, path: string, opts?: Opts) => api<T>(`/v1/dash/apps/${appId}${path}`, opts);

export async function download(appId: string, format: "csv" | "json") {
  const path = `/v1/dash/apps/${appId}/export?format=${format}`;
  const res = mockEnabled() ? await mockFetch("GET", path) : await fetch(API_URL + path, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "export_failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `youasked-requests.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const signInUrl = (provider: "google" | "github", next: string) => `${API_URL}/v1/auth/${provider}/start?next=${encodeURIComponent(next)}`;
