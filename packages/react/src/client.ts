export type Status = "open" | "planned" | "in_progress" | "shipped" | "declined";

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
  createdAt: number;
  voted: boolean;
  mine: boolean;
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

export type Config = { app: { name: string }; watermark: boolean; identified: boolean; unseen: Notice[] };

export type YouAskedUser = { id: string | number; email?: string | null; name?: string | null };

export class YouAskedError extends Error {
  constructor(public code: string) {
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

  async function call<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: headers(body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new YouAskedError((data as { error?: string }).error ?? `http_${res.status}`);
    return data as T;
  }

  return {
    config: () => call<Config>("/config"),
    list: (sort: "top" | "new", status: "active" | "shipped" | "all") =>
      call<{ requests: FeatureRequest[] }>(`/requests?sort=${sort}&status=${status}`).then((d) => d.requests),
    similar: (q: string) =>
      call<{ requests: FeatureRequest[] }>(`/requests/similar?q=${encodeURIComponent(q)}`).then((d) => d.requests),
    get: (id: string) =>
      call<{ request?: FeatureRequest; comments?: RequestComment[]; redirect?: string }>(`/requests/${encodeURIComponent(id)}`),
    create: (title: string, body: string) =>
      call<{ request: FeatureRequest }>("/requests", { title, body }).then((d) => d.request),
    vote: (id: string) => call<{ voted: boolean; votes: number }>(`/requests/${encodeURIComponent(id)}/vote`, {}),
    comment: (id: string, body: string) =>
      call<{ comment: RequestComment }>(`/requests/${encodeURIComponent(id)}/comments`, { body }).then((d) => d.comment),
    mine: () => call<{ requests: FeatureRequest[] }>("/me/requests").then((d) => d.requests),
    seen: (ids: string[]) => call<{ ok: true }>("/notifications/seen", { ids }),
  };
}

export type Client = ReturnType<typeof createClient>;
