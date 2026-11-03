export type Status = "open" | "planned" | "in_progress" | "shipped" | "declined" | "pending";

export type FeatureRequest = {
  id: string;
  /** Shown as YA-12; commits and PRs that say "closes YA-12" ship it. */
  number: number;
  title: string;
  body: string;
  status: Status;
  votes: number;
  comments: number;
  shipNote: string | null;
  shippedAt: number | null;
  /** Where it was asked from: the page path and/or a topic like "charts". */
  context: { path?: string; topic?: string } | null;
  /** Set when the team found this ask elsewhere ("reddit" or "appstore") and added it. */
  source?: string;
  sourceUrl?: string | null;
  /** First name of the person who asked, when they opted in to being thanked and it has shipped. */
  creditName: string | null;
  createdAt: number;
  voted: boolean;
  mine: boolean;
};

export type Attachment = { id: string; url: string };

/** What shipped since this person was last shown the list. */
export type WhatsNew = {
  /** Items shown, newest first with the ones they asked for or voted on at the top. */
  items: { id: string; title: string; shipNote: string | null; shippedAt: number; mine: boolean }[];
  /** How many shipped in all; more than items.length when the list was cut short. */
  total: number;
};

export type RequestComment = {
  id: string;
  body: string;
  team: boolean;
  author: string | null;
  mine: boolean;
  createdAt: number;
};

export type Notice = {
  id: string;
  /** "shipped", or "reply" when the team answered */
  kind: string;
  requestId: string;
  title: string;
  shipNote: string | null;
  reply: string | null;
};

export type Config = {
  app: { name: string };
  watermark: boolean;
  identified: boolean;
  /** Identified with a name, so "Credit me when it ships" makes sense. */
  canCredit: boolean;
  unseen: Notice[];
  whatsNew: WhatsNew | null;
  mode?: "test" | "live";
};

export type NewRequest = {
  title: string;
  body: string;
  /** Ids from `upload()`. */
  attachments?: string[];
  context?: { path?: string; topic?: string };
  credit?: boolean;
};

export type RequestDetail = {
  request?: FeatureRequest;
  comments?: RequestComment[];
  attachments?: Attachment[];
  /** Whether this person asked to try it before it ships. */
  earlyAccess?: boolean;
  redirect?: string;
};

export type YouAskedUser = { id: string | number; email?: string | null; name?: string | null };

export class YouAskedError extends Error {
  constructor(
    public code: string,
    /** A ready-to-show sentence from the server, when it sent one (spam and rate-limit answers do). */
    public detail?: string,
  ) {
    super(code);
  }
}

const ANON_KEY = "youasked:anon";
let memoryAnon: string | null = null;

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return (memoryAnon ??= randomId());
  }
}

function base64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type ClientOptions = { appKey: string; apiUrl: string; user?: YouAskedUser | null; signature?: string | null };

export function createClient({ appKey, apiUrl, user, signature }: ClientOptions) {
  const base = apiUrl.replace(/\/$/, "") + "/v1";

  function headers(json: boolean): Record<string, string> {
    const h: Record<string, string> = { "x-youasked-key": appKey, "x-youasked-anon": anonId() };
    if (user && user.id !== undefined && user.id !== null && user.id !== "") {
      h["x-youasked-user"] = base64Url(
        JSON.stringify({ id: String(user.id), email: user.email ?? undefined, name: user.name ?? undefined }),
      );
      if (signature) h["x-youasked-sig"] = signature;
    }
    if (json) h["content-type"] = "application/json";
    return h;
  }

  async function call<T>(path: string, body?: unknown, raw?: Blob): Promise<T> {
    const res = await fetch(base + path, {
      method: body === undefined && !raw ? "GET" : "POST",
      headers: raw ? { ...headers(false), "content-type": raw.type } : headers(body !== undefined),
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new YouAskedError((data as { error?: string }).error ?? `http_${res.status}`, (data as { message?: string }).message);
    return data as T;
  }

  return {
    config: () => call<Config>("/config"),
    list: (sort: "top" | "new", status: "active" | "shipped" | "all") =>
      call<{ requests: FeatureRequest[] }>(`/requests?sort=${sort}&status=${status}`).then((d) => d.requests),
    similar: (q: string) =>
      call<{ requests: FeatureRequest[] }>(`/requests/similar?q=${encodeURIComponent(q)}`).then((d) => d.requests),
    get: (id: string) => call<RequestDetail>(`/requests/${encodeURIComponent(id)}`),
    create: (input: NewRequest) =>
      call<{ request: FeatureRequest; attachments?: Attachment[] }>("/requests", input).then((d) => ({
        ...d.request,
        attachments: d.attachments ?? [],
      })),
    upload: (image: Blob) => call<Attachment>("/uploads", undefined, image),
    earlyAccess: (id: string) => call<{ earlyAccess: boolean }>(`/requests/${encodeURIComponent(id)}/early-access`, {}),
    whatsNewSeen: () => call<{ ok: true }>("/whats-new/seen", {}),
    vote: (id: string) => call<{ voted: boolean; votes: number }>(`/requests/${encodeURIComponent(id)}/vote`, {}),
    comment: (id: string, body: string) =>
      call<{ comment: RequestComment }>(`/requests/${encodeURIComponent(id)}/comments`, { body }).then((d) => d.comment),
    mine: () => call<{ requests: FeatureRequest[] }>("/me/requests").then((d) => d.requests),
    seen: (ids: string[]) => call<{ ok: true }>("/notifications/seen", { ids }),
  };
}

export type Client = ReturnType<typeof createClient>;
