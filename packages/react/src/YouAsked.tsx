import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  createClient,
  YouAskedError,
  type Client,
  type Config,
  type FeatureRequest,
  type Notice,
  type RequestComment,
  type Status,
  type YouAskedUser,
} from "./client";
import { injectStyles } from "./styles";
import { resolveTokens, tokenStyle, type Appearance } from "./theme";

export const DEFAULT_API_URL = "https://youasked-api.adenteo.workers.dev";

export type YouAskedProps = {
  /** Publishable key (ya_pub_…). Safe to ship in client code. */
  appKey: string;
  /** Who's asking. Leave out for anonymous visitors. */
  user?: YouAskedUser | null;
  /** hex HMAC-SHA256 of user.id with your secret key, made on your server (see `signUser`). */
  signature?: string | null;
  /** Set false while you're still fetching the signature; the widget waits instead of acting anonymously. */
  ready?: boolean;
  appearance?: Appearance;
  /** "floating" shows a button in the corner; "none" lets you open it yourself with useYouAsked() or openYouAsked(). */
  trigger?: "floating" | "none";
  position?: "bottom-right" | "bottom-left";
  /** Text on the floating button. */
  label?: string;
  /** Heading of the panel. */
  title?: string;
  /** Distance in px from the bottom edge for the button and toast, e.g. to clear a tab bar. Default 20. */
  offset?: number;
  apiUrl?: string;
  children?: ReactNode;
};

type Route =
  | { view: "board" }
  | { view: "new"; draft?: string }
  | { view: "detail"; id: string; justPosted?: boolean }
  | { view: "mine" };

export type OpenOptions = { view?: "board" | "new" | "mine"; requestId?: string; draft?: string };

type ContextValue = {
  open: (options?: OpenOptions) => void;
  close: () => void;
  isOpen: boolean;
  /** Shipped requests this person asked for or voted on that they haven't seen yet. */
  unseenCount: number;
};

const YouAskedContext = createContext<ContextValue | null>(null);

export function useYouAsked(): ContextValue {
  const ctx = useContext(YouAskedContext);
  if (!ctx) throw new Error("useYouAsked must be used inside <YouAsked>…</YouAsked>");
  return ctx;
}

/** Opens the panel from anywhere, even outside React. */
export function openYouAsked(options?: OpenOptions) {
  window.dispatchEvent(new CustomEvent("youasked:open", { detail: options ?? {} }));
}

function toRoute(o: OpenOptions = {}): Route {
  if (o.requestId) return { view: "detail", id: o.requestId };
  if (o.view === "new") return { view: "new", draft: o.draft };
  if (o.view === "mine") return { view: "mine" };
  return { view: "board" };
}

export function YouAsked({
  appKey,
  user,
  signature,
  ready = true,
  appearance,
  trigger = "floating",
  position = "bottom-right",
  label = "Feedback",
  title = "Feature requests",
  offset,
  apiUrl = DEFAULT_API_URL,
  children,
}: YouAskedProps) {
  const userId = user?.id;
  const userEmail = user?.email;
  const userName = user?.name;
  const client = useMemo(
    () => createClient({ appKey, apiUrl, user: userId == null ? null : { id: userId, email: userEmail, name: userName }, signature }),
    [appKey, apiUrl, userId, userEmail, userName, signature],
  );
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const tokens = useTokens(appearance, mounted);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    injectStyles();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    client
      .config()
      .then((c) => alive && setConfig(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client, ready]);

  const open = useCallback((options?: OpenOptions) => {
    openerRef.current = document.activeElement;
    setRoute(toRoute(options));
  }, []);

  const close = useCallback(() => {
    setRoute(null);
    const opener = openerRef.current as HTMLElement | null;
    opener?.focus?.();
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<OpenOptions>).detail);
    window.addEventListener("youasked:open", onOpen);
    return () => window.removeEventListener("youasked:open", onOpen);
  }, [open]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setConfig((c) => (c ? { ...c, unseen: c.unseen.filter((n) => !ids.includes(n.id)) } : c));
      client.seen(ids).catch(() => {});
    },
    [client],
  );

  const unseen = config?.unseen ?? [];
  const value = useMemo(
    () => ({ open, close, isOpen: route !== null, unseenCount: unseen.length }),
    [open, close, route, unseen.length],
  );

  const notice = unseen.find((n) => n.kind === "shipped");

  return (
    <YouAskedContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="ya-scope"
            data-ya-mode={tokens?.mode}
            style={
              {
                ...(tokens ? tokenStyle(tokens) : {}),
                ...(offset !== undefined ? { "--ya-offset": `${offset}px` } : {}),
              } as CSSProperties
            }
          >
            {trigger === "floating" && route === null && (
              <button type="button" className="ya-fab" data-pos={position} onClick={() => open()} aria-label={label}>
                <IconSpark />
                {label}
                {unseen.length > 0 && <span className="ya-dot" aria-hidden="true" />}
              </button>
            )}
            {notice && route === null && (
              <ShippedToast
                notice={notice}
                position={position}
                trigger={trigger}
                onOpen={() => {
                  markSeen([notice.id]);
                  open({ requestId: notice.requestId });
                }}
                onDismiss={() => markSeen([notice.id])}
              />
            )}
            {route && (
              <Panel
                client={client}
                config={config}
                route={route}
                setRoute={setRoute}
                title={title}
                onClose={close}
                onSeen={markSeen}
              />
            )}
          </div>,
          document.body,
        )}
    </YouAskedContext.Provider>
  );
}

function useTokens(appearance: Appearance | undefined, mounted: boolean) {
  const key = JSON.stringify(appearance ?? {});
  const [tokens, setTokens] = useState<ReturnType<typeof resolveTokens> | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const parsed = JSON.parse(key) as Appearance;
    const update = () => setTokens(resolveTokens(parsed));
    update();
    // Follow the host when it flips light/dark (class, data-theme or OS setting).
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", update);
    };
  }, [key, mounted]);
  return tokens;
}

// ---------------------------------------------------------------- panel

type PanelProps = {
  client: Client;
  config: Config | null;
  route: Route;
  setRoute: (r: Route) => void;
  title: string;
  onClose: () => void;
  onSeen: (ids: string[]) => void;
};

function Panel({ client, config, route, setRoute, title, onClose, onSeen }: PanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) trapFocus(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Opening a request someone was notified about counts as seeing it.
  useEffect(() => {
    if (route.view !== "detail" || !config) return;
    onSeen(config.unseen.filter((n) => n.requestId === route.id).map((n) => n.id));
  }, [route, config, onSeen]);

  return (
    <div className="ya-overlay">
      <div className="ya-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="ya-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={panelRef}>
        <div className="ya-grab" aria-hidden="true" />
        {route.view === "board" && (
          <Board client={client} config={config} title={title} setRoute={setRoute} onClose={onClose} />
        )}
        {route.view === "new" && (
          <NewRequest client={client} draft={route.draft} setRoute={setRoute} onClose={onClose} />
        )}
        {route.view === "detail" && (
          <Detail
            key={route.id}
            client={client}
            id={route.id}
            justPosted={route.justPosted}
            setRoute={setRoute}
            onClose={onClose}
          />
        )}
        {route.view === "mine" && <Mine client={client} setRoute={setRoute} onClose={onClose} />}
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function Header({
  title,
  onBack,
  onClose,
  right,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
  right?: ReactNode;
}) {
  return (
    <div className={onBack ? "ya-head ya-head-back" : "ya-head"}>
      {onBack && (
        <button type="button" className="ya-icon-btn" onClick={onBack} aria-label="Back">
          <IconBack />
        </button>
      )}
      <h2 className="ya-h">{title}</h2>
      {right}
      <button type="button" className="ya-icon-btn" onClick={onClose} aria-label="Close">
        <IconClose />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- votes

function useVote(client: Client, initial: FeatureRequest) {
  const [state, setState] = useState({ voted: initial.voted, votes: initial.votes });
  const busy = useRef(false);
  useEffect(() => setState({ voted: initial.voted, votes: initial.votes }), [initial.voted, initial.votes]);
  const toggle = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const before = state;
    setState({ voted: !before.voted, votes: before.votes + (before.voted ? -1 : 1) });
    try {
      setState(await client.vote(initial.id));
    } catch {
      setState(before);
    } finally {
      busy.current = false;
    }
  }, [client, initial.id, state]);
  return { ...state, toggle };
}

function VoteButton({ client, request }: { client: Client; request: FeatureRequest }) {
  const { voted, votes, toggle } = useVote(client, request);
  return (
    <button
      type="button"
      className="ya-vote"
      aria-pressed={voted}
      aria-label={`${voted ? "Remove vote" : "Upvote"}: ${request.title}. ${votes} ${votes === 1 ? "vote" : "votes"}`}
      onClick={toggle}
    >
      <IconUp />
      {votes}
    </button>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Not planned",
};

function StatusPill({ status }: { status: Status }) {
  return (
    <span className="ya-pill" data-s={status}>
      {status === "shipped" && <IconCheck />}
      {STATUS_LABEL[status]}
    </span>
  );
}

function RequestRow({ client, request, onOpen }: { client: Client; request: FeatureRequest; onOpen: () => void }) {
  return (
    <li className="ya-row">
      <VoteButton client={client} request={request} />
      <button type="button" className="ya-row-main" onClick={onOpen}>
        <span className="ya-row-title">{request.title}</span>
        <span className="ya-meta">
          {request.status !== "open" && <StatusPill status={request.status} />}
          {request.comments > 0 && (
            <span>
              <IconChat />
              {request.comments}
            </span>
          )}
          {request.mine && <span>You asked</span>}
        </span>
      </button>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="ya-list" aria-label="Loading" role="status">
      <div className="ya-skel" />
      <div className="ya-skel" />
      <div className="ya-skel" />
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    load()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setError(e instanceof YouAskedError ? e.code : "network"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, setData };
}

function errorText(code: string | null): string {
  switch (code) {
    case "signature_required":
    case "bad_signature":
      return "We couldn't confirm who you are. Refresh the page and try again.";
    case "slow_down":
      return "That's a lot of requests in an hour. Try again a bit later.";
    case "title_too_short":
      return "Add a few more words so others know what you mean.";
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

// ---------------------------------------------------------------- views

const TABS = [
  { key: "top", label: "Top", sort: "top", status: "active" },
  { key: "new", label: "New", sort: "new", status: "active" },
  { key: "shipped", label: "Shipped", sort: "new", status: "shipped" },
] as const;

function Board({
  client,
  config,
  title,
  setRoute,
  onClose,
}: {
  client: Client;
  config: Config | null;
  title: string;
  setRoute: (r: Route) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const { data, error } = useLoad(() => client.list(tab.sort, tab.status), [client, tab.key]);

  return (
    <>
      <Header
        title={title}
        onClose={onClose}
        right={
          <button type="button" className="ya-link" onClick={() => setRoute({ view: "mine" })}>
            Yours
          </button>
        }
      />
      <div className="ya-tabs" role="tablist" aria-label="Sort requests">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" className="ya-tab" aria-selected={tab.key === t.key} onClick={() => setTab(t)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="ya-body">
        {error ? (
          <p className="ya-empty">{errorText(error)}</p>
        ) : !data ? (
          <Skeleton />
        ) : data.length === 0 ? (
          <div className="ya-empty">
            <b>{tab.key === "shipped" ? "Nothing shipped yet" : "No requests yet"}</b>
            {tab.key === "shipped" ? "Requests show up here once they're live." : "Tell us what you'd like next. Others can vote on it."}
          </div>
        ) : (
          <ul className="ya-list">
            {data.map((r) => (
              <RequestRow key={r.id} client={client} request={r} onOpen={() => setRoute({ view: "detail", id: r.id })} />
            ))}
          </ul>
        )}
      </div>
      <div className="ya-foot">
        <button type="button" className="ya-btn" onClick={() => setRoute({ view: "new" })}>
          <IconPlus />
          Request a feature
        </button>
        {config?.watermark && <p className="ya-mark">Feedback by YouAsked</p>}
      </div>
    </>
  );
}

function NewRequest({
  client,
  draft,
  setRoute,
  onClose,
}: {
  client: Client;
  draft?: string;
  setRoute: (r: Route) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(draft ?? "");
  const [body, setBody] = useState("");
  const [similar, setSimilar] = useState<FeatureRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = title.trim();
    if (q.length < 4) {
      setSimilar([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      client
        .similar(q)
        .then((r) => alive && setSimilar(r))
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [client, title]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await client.create(title, body);
      setRoute({ view: "detail", id: created.id, justPosted: true });
    } catch (err) {
      setError(errorText(err instanceof YouAskedError ? err.code : "network"));
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "contents" }}>
      <Header title="Request a feature" onBack={() => setRoute({ view: "board" })} onClose={onClose} />
      <div className="ya-body">
        <label className="ya-label" htmlFor="ya-title">
          What should we build?
        </label>
        <input
          id="ya-title"
          ref={titleRef}
          className="ya-field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dark mode for charts"
          maxLength={120}
          autoComplete="off"
        />
        {similar.length > 0 && (
          <div className="ya-similar" aria-live="polite">
            <p className="ya-similar-h">Someone may have asked already. Vote instead?</p>
            <ul className="ya-list">
              {similar.map((r) => (
                <RequestRow key={r.id} client={client} request={r} onOpen={() => setRoute({ view: "detail", id: r.id })} />
              ))}
            </ul>
          </div>
        )}
        <label className="ya-label" htmlFor="ya-body">
          Anything else? <span className="ya-text-muted">(optional)</span>
        </label>
        <textarea
          id="ya-body"
          className="ya-field"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What would it help you do?"
          maxLength={2000}
        />
        {error && (
          <p className="ya-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="ya-foot">
        <button type="submit" className="ya-btn" disabled={title.trim().length < 3 || sending}>
          {sending ? "Posting…" : "Post request"}
        </button>
      </div>
    </form>
  );
}

function Detail({
  client,
  id,
  justPosted,
  setRoute,
  onClose,
}: {
  client: Client;
  id: string;
  justPosted?: boolean;
  setRoute: (r: Route) => void;
  onClose: () => void;
}) {
  const { data, error, setData } = useLoad(() => client.get(id), [client, id]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.redirect) setRoute({ view: "detail", id: data.redirect });
  }, [data?.redirect, setRoute]);

  const request = data?.request;
  const comments = data?.comments ?? [];

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || sending || !request) return;
    setSending(true);
    setReplyError(null);
    try {
      const c = await client.comment(request.id, reply);
      setData({ ...data, comments: [...comments, c], request: { ...request, comments: request.comments + 1 } });
      setReply("");
    } catch (err) {
      setReplyError(errorText(err instanceof YouAskedError ? err.code : "network"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Header title="" onBack={() => setRoute({ view: "board" })} onClose={onClose} />
      <div className="ya-body">
        {error ? (
          <p className="ya-empty">{error === "not_found" ? "This request was removed." : errorText(error)}</p>
        ) : !request ? (
          <Skeleton />
        ) : (
          <>
            {request.status !== "open" && <StatusPill status={request.status} />}
            <h3 className="ya-detail-title">{request.title}</h3>
            {request.body && <p className="ya-text">{request.body}</p>}
            <BigVote client={client} request={request} />
            {justPosted && (
              <div className="ya-callout" data-tone="info">
                <IconBell />
                <span>
                  <b>Posted.</b> We'll let you know right here when it ships. Votes from others help it move up.
                </span>
              </div>
            )}
            {request.status === "shipped" && (
              <div className="ya-callout" data-tone="success">
                <IconCheck />
                <span>
                  <b>It's live.</b>
                  {request.shipNote ? ` ${request.shipNote}` : " Thanks for asking."}
                </span>
              </div>
            )}
            <p className="ya-section-h">{comments.length ? `Comments (${comments.length})` : "Comments"}</p>
            {comments.length === 0 ? (
              <p className="ya-text ya-text-muted">No comments yet.</p>
            ) : (
              comments.map((c) => <CommentItem key={c.id} comment={c} />)
            )}
          </>
        )}
      </div>
      {request && (
        <form className="ya-compose" onSubmit={send}>
          <textarea
            className="ya-field"
            rows={1}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Add a comment"
            aria-label="Add a comment"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="ya-btn ya-btn-sm" disabled={!reply.trim() || sending}>
            Send
          </button>
          {replyError && <span className="ya-sr" role="alert">{replyError}</span>}
        </form>
      )}
    </>
  );
}

function BigVote({ client, request }: { client: Client; request: FeatureRequest }) {
  const { voted, votes, toggle } = useVote(client, request);
  return (
    <button type="button" className="ya-bigvote" aria-pressed={voted} onClick={toggle}>
      <IconUp />
      {voted ? "Voted" : "Upvote"} · {votes}
    </button>
  );
}

function CommentItem({ comment }: { comment: RequestComment }) {
  return (
    <div className="ya-comment">
      <div className="ya-comment-who">
        {comment.team ? <span className="ya-team">Team</span> : <span>{comment.mine ? "You" : comment.author || "Someone"}</span>}
        <time dateTime={new Date(comment.createdAt).toISOString()}>{ago(comment.createdAt)}</time>
      </div>
      <p className="ya-text">{comment.body}</p>
    </div>
  );
}

function Mine({ client, setRoute, onClose }: { client: Client; setRoute: (r: Route) => void; onClose: () => void }) {
  const { data, error } = useLoad(() => client.mine(), [client]);
  return (
    <>
      <Header title="Your requests" onBack={() => setRoute({ view: "board" })} onClose={onClose} />
      <div className="ya-body">
        {error ? (
          <p className="ya-empty">{errorText(error)}</p>
        ) : !data ? (
          <Skeleton />
        ) : data.length === 0 ? (
          <div className="ya-empty">
            <b>Nothing yet</b>
            Requests you post or vote on show up here, with their status.
          </div>
        ) : (
          <ul className="ya-list">
            {data.map((r) => (
              <RequestRow key={r.id} client={client} request={r} onOpen={() => setRoute({ view: "detail", id: r.id })} />
            ))}
          </ul>
        )}
      </div>
      <div className="ya-foot">
        <button type="button" className="ya-btn" onClick={() => setRoute({ view: "new" })}>
          <IconPlus />
          Request a feature
        </button>
      </div>
    </>
  );
}

function ShippedToast({
  notice,
  position,
  trigger,
  onOpen,
  onDismiss,
}: {
  notice: Notice;
  position: string;
  trigger: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ya-toast" role="status" data-pos={position} data-trigger={trigger}>
      <div className="ya-toast-top">
        <p className="ya-toast-kicker">You asked for</p>
        <button type="button" className="ya-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <IconClose />
        </button>
      </div>
      <p className="ya-toast-title">{notice.title}</p>
      <div className="ya-live">
        <IconCheck />
        It's live
      </div>
      {notice.shipNote && <p className="ya-toast-note">{notice.shipNote}</p>}
      <div className="ya-toast-actions">
        <button type="button" className="ya-btn ya-btn-sm" onClick={onOpen}>
          See it
        </button>
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onDismiss}>
          Nice
        </button>
      </div>
    </div>
  );
}

function ago(t: number): string {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------- icons

const svg = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const IconUp = () => (
  <svg {...svg} strokeWidth={2.6}>
    <path d="m6 15 6-6 6 6" />
  </svg>
);
const IconClose = () => (
  <svg {...svg} width={20} height={20}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconBack = () => (
  <svg {...svg} width={20} height={20}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const IconPlus = () => (
  <svg {...svg}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconCheck = () => (
  <svg {...svg} width={13} height={13} strokeWidth={3}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconChat = () => (
  <svg {...svg}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </svg>
);
const IconBell = () => (
  <svg {...svg}>
    <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
);
const IconSpark = () => (
  <svg {...svg}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
  </svg>
);
