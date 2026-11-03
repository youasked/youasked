// Copied from packages/react/src/client.ts (types and endpoints are identical). The differences:
// the anonymous id is async (AsyncStorage), headers say the caller is a native app, and a 402
// `test_mode` answer becomes its own error code. To be unified with the web package later.

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
  /** Where it was asked from: the page path and/or a topic like "charts". */
  context: { path?: string; topic?: string } | null;
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
  constructor(public code: string) {
    super(code);
  }
}

function base64Url(text: string): string {
  // Hand-rolled so it works on any Hermes version (no TextEncoder or btoa needed).
  const bytes: number[] = [];
  const utf8 = unescape(encodeURIComponent(text));
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += chars[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += chars[n & 63];
  }
  return out;
}

declare const __DEV__: boolean | undefined;

export type ClientOptions = {
  appKey: string;
  apiUrl: string;
  user?: YouAskedUser | null;
  signature?: string | null;
  /** The anonymous device id. Async because it lives in AsyncStorage when that's installed. */
  getAnon: () => Promise<string>;
};

export function createClient({ appKey, apiUrl, user, signature, getAnon }: ClientOptions) {
  const base = apiUrl.replace(/\/$/, "") + "/v1";

  async function headers(json: boolean): Promise<Record<string, string>> {
    const h: Record<string, string> = {
      "x-youasked-key": appKey,
      "x-youasked-anon": await getAnon(),
      // Native apps send no Origin header, so say who is calling (and whether it's a dev build).
      "x-youasked-platform": "react-native",
    };
    if (typeof __DEV__ !== "undefined" && __DEV__) h["x-youasked-dev"] = "1";
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
    const h = await headers(body !== undefined && !raw);
    if (raw) h["content-type"] = raw.type || "image/png";
    let res: Response;
    try {
      res = await fetch(base + path, {
        method: body === undefined && !raw ? "GET" : "POST",
        headers: h,
        body: (raw ?? (body === undefined ? undefined : JSON.stringify(body))) as never,
      });
    } catch {
      throw new YouAskedError("network");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = (data as { error?: string }).error;
      throw new YouAskedError(res.status === 402 && code === "test_mode" ? "test_mode" : (code ?? `http_${res.status}`));
    }
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
