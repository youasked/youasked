// A small client for the YouAsked admin API. Everything is authorised with the app's secret key.
export const DEFAULT_API = "https://youasked-api.adenteo.workers.dev";

export type Status = "open" | "planned" | "in_progress" | "shipped" | "declined" | "merged";

export type RequestSummary = {
  id: string;
  ref?: string;
  number: number;
  title: string;
  body?: string;
  status: Status;
  votes: number;
  comments: number;
  /** Times the ask was also found elsewhere (Reddit, App Store reviews). */
  elsewhere?: number;
  shipNote: string | null;
  createdAt: number;
  updatedAt?: number;
  author?: { email: string | null; name: string | null; anonymous: boolean };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(
      code === "not_found"
        ? "No request with that number."
        : status === 401
          ? "The API rejected YOUASKED_SECRET_KEY. Check it's the secret key (ya_sec_…) for the right app."
          : `YouAsked API error: ${code} (${status})`,
    );
  }
}

export function createApi(secretKey: string, baseUrl = DEFAULT_API) {
  const base = baseUrl.replace(/\/$/, "");
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}/v1/admin${path}`, {
      method,
      headers: { authorization: `Bearer ${secretKey}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new ApiError(res.status, json.error ?? "unknown");
    return json;
  }
  return {
    app: () => call<{ id: string; name: string }>("GET", "/app"),
    list: (status: string) => call<{ requests: RequestSummary[] }>("GET", `/requests?status=${encodeURIComponent(status)}`),
    lookup: (ref: string) =>
      call<{
        request: RequestSummary & { body: string; mergedInto: string | null; shippedAt: number | null };
        comments: { id: string; body: string; team: boolean; author: string | null; createdAt: number }[];
        voters: number;
      }>("GET", `/lookup?ref=${encodeURIComponent(ref)}`),
    search: (q: string) => call<{ requests: (RequestSummary & { score: number })[] }>("GET", `/search?q=${encodeURIComponent(q)}`),
    digest: (days: number) =>
      call<{ days: number; top: RequestSummary[]; new: RequestSummary[]; shipped: RequestSummary[]; votes: number; comments: number }>(
        "GET",
        `/digest?days=${days}`,
      ),
    reply: (id: string, body: string) => call<{ id: string; notified: number }>("POST", `/requests/${id}/comments`, { body }),
    setStatus: (id: string, status: string, shipNote?: string) =>
      call<{ request: RequestSummary; notified: boolean; told: number }>("PATCH", `/requests/${id}`, {
        status,
        ...(shipNote === undefined ? {} : { shipNote }),
      }),
    build: (id: string) => call<{ prompt: string; issueUrl?: string; refined?: boolean }>("POST", `/requests/${id}/build`),
    merge: (id: string, into: string) => call<{ ok: true }>("POST", `/requests/${id}/merge`, { into }),
  };
}

export type Api = ReturnType<typeof createApi>;
