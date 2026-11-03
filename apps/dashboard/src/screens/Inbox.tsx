import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appApi, type Req, type Status, type WorkspaceApp } from "../api";
import { ShipDialog, StatusPopover } from "../components";
import { Link, navigate } from "../router";
import { appUrl, useSession } from "../session";
import { Button, Empty, ErrorState, Icon, PageHead, Skeleton, StatusChip, timeAgo, useFail, useLoad, useToast } from "../ui";

const FILTERS: { id: string; label: string; match: (r: Req) => boolean }[] = [
  { id: "open", label: "Open", match: (r) => r.status === "open" },
  { id: "planned", label: "Planned", match: (r) => r.status === "planned" },
  { id: "in_progress", label: "In progress", match: (r) => r.status === "in_progress" },
  { id: "shipped", label: "Shipped", match: (r) => r.status === "shipped" },
  { id: "pending", label: "Waiting for approval", match: (r) => r.status === "pending" },
  { id: "all", label: "All", match: () => true },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable));
};

async function loadAll(appId: string) {
  const [all, pending] = await Promise.all([
    appApi<{ requests: Req[] }>(appId, "/requests?status=all"),
    appApi<{ requests: Req[] }>(appId, "/requests?status=pending").catch(() => ({ requests: [] as Req[] })),
  ]);
  const seen = new Set(all.requests.map((r) => r.id));
  return [...all.requests, ...pending.requests.filter((r) => !seen.has(r.id))];
}

export function Inbox({ app }: { app: WorkspaceApp }) {
  const { bump } = useSession();
  const list = useLoad(() => loadAll(app.id), [app.id]);
  const [filter, setFilter] = useState(() => sessionStorage.getItem("ya_filter") || "open");
  const [sort, setSort] = useState<"votes" | "new">("votes");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [statusFor, setStatusFor] = useState<string | null>(null);
  const [shipping, setShipping] = useState<Req | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const fail = useFail();

  const setF = (id: string) => {
    setFilter(id);
    setCursor(0);
    try {
      sessionStorage.setItem("ya_filter", id);
    } catch {
      /* storage blocked */
    }
  };

  const reqs = list.data ?? [];
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, reqs.filter(f.match).length])), [reqs]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const term = q.trim().toLowerCase();
    return reqs
      .filter(f.match)
      .filter((r) => !term || `${r.title} ${r.body} ya-${r.number} ${r.author?.name ?? ""} ${r.author?.email ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => (sort === "votes" ? b.votes - a.votes || b.createdAt - a.createdAt : b.createdAt - a.createdAt));
  }, [reqs, filter, q, sort]);

  const patch = useCallback(
    (id: string, fn: (r: Req) => Req) => list.set((d) => d.map((r) => (r.id === id ? fn(r) : r))),
    [list],
  );

  const setStatus = useCallback(
    async (r: Req, status: Status) => {
      setStatusFor(null);
      if (status === r.status) return;
      if (status === "shipped") return setShipping(r);
      const before = r.status;
      patch(r.id, (x) => ({ ...x, status }));
      try {
        await appApi(app.id, `/requests/${r.id}`, { method: "PATCH", body: { status } });
        toast(`YA-${r.number} moved to ${status.replace("_", " ")}`);
        bump();
      } catch (e) {
        patch(r.id, (x) => ({ ...x, status: before }));
        fail(e);
      }
    },
    [app.id, patch, toast, fail, bump],
  );

  const moderate = async (r: Req, action: "approve" | "reject") => {
    try {
      await appApi(app.id, `/requests/${r.id}/${action}`, { method: "POST" });
      if (action === "approve") patch(r.id, (x) => ({ ...x, status: "open" }));
      else list.set((d) => d.filter((x) => x.id !== r.id));
      toast(action === "approve" ? `YA-${r.number} is now public` : `YA-${r.number} rejected`);
      bump();
    } catch (e) {
      fail(e);
    }
  };

  // Keyboard: j/k move, enter opens, s changes status, / searches.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".dialog")) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "j" || e.key === "ArrowDown") {
        if (statusFor) return;
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, shown.length - 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        if (statusFor) return;
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && shown[cursor] && !statusFor) {
        navigate(appUrl(app.id, `/r/${shown[cursor].id}`));
      } else if (e.key === "s" && shown[cursor]) {
        e.preventDefault();
        setStatusFor(shown[cursor].id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [shown, cursor, statusFor, app.id]);

  useEffect(() => {
    document.querySelector<HTMLElement>(`[data-row="${cursor}"]`)?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const none = !list.loading && !list.error && reqs.length === 0;

  return (
    <div className="page">
      <PageHead
        title="Inbox"
        sub={list.data ? `${counts.all} ${counts.all === 1 ? "request" : "requests"} from people using ${app.name}` : undefined}
        actions={
          <Link to={appUrl(app.id, "/install")} className="btn btn-quiet btn-sm">
            <Icon name="bolt" size={15} /> Install guide
          </Link>
        }
      />

      {list.error != null && <ErrorState error={list.error} retry={list.retry} />}
      {list.loading && !list.data && !list.error && <Skeleton rows={6} />}

      {none && (
        <Empty icon="inbox" title="No requests yet" action={<Link to={appUrl(app.id, "/install")} className="btn btn-primary">Open the install guide</Link>}>
          When someone asks for something in your app, it shows up here and on your phone. Not installed yet? The guide takes about a minute.
        </Empty>
      )}

      {list.data && !none && (
        <>
          <div className="toolbar">
            <div className="tabs" role="tablist" aria-label="Filter requests">
              {FILTERS.map((f) => (
                <button key={f.id} role="tab" aria-selected={filter === f.id} data-pending={f.id === "pending" && counts.pending > 0 || undefined} onClick={() => setF(f.id)}>
                  {f.label}
                  <span className="n">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <div className="tools">
              <div className="search-field">
                <Icon name="search" size={16} />
                <input ref={searchRef} className="input bare-input" placeholder="Search requests" aria-label="Search requests" value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} />
                <kbd>/</kbd>
              </div>
              <div className="seg" role="group" aria-label="Sort">
                <button data-on={sort === "votes" || undefined} onClick={() => setSort("votes")}>Most votes</button>
                <button data-on={sort === "new" || undefined} onClick={() => setSort("new")}>Newest</button>
              </div>
            </div>
          </div>

          {shown.length === 0 ? (
            <Empty icon={q ? "search" : "inbox"} title={q ? "Nothing matches that search" : emptyTitle(filter)}>
              {q ? "Try fewer words, or search by YA number." : emptyHint(filter)}
              {filter === "pending" && !q && <> <Link to={appUrl(app.id, "/settings")}>Open settings</Link></>}
            </Empty>
          ) : (
            <ul className="rows" role="list">
              {shown.map((r, i) => (
                <li key={r.id} data-row={i} data-cursor={i === cursor || undefined} onMouseMove={() => i !== cursor && !statusFor && setCursor(i)}>
                  <div className="votes" aria-label={`${r.votes} votes`}>
                    <Icon name="up" size={14} />
                    <b>{r.votes}</b>
                  </div>
                  <Link to={appUrl(app.id, `/r/${r.id}`)} className="row-main">
                    <span className="row-title">{r.title}</span>
                    <span className="row-meta">
                      <span className="ya">YA-{r.number}</span>
                      {r.comments > 0 && <span><Icon name="chat" size={13} /> {r.comments}</span>}
                      {r.attachments && r.attachments.length > 0 && <span><Icon name="img" size={13} /> {r.attachments.length}</span>}
                      <span>{whoAsked(r)}</span>
                      <span>{timeAgo(r.createdAt)}</span>
                      {r.context?.topic && <span className="topic">{r.context.topic}</span>}
                    </span>
                  </Link>
                  <div className="row-end">
                    {r.status === "pending" ? (
                      <span className="mod">
                        <Button size="sm" kind="primary" onClick={() => moderate(r, "approve")}>Approve</Button>
                        <Button size="sm" kind="quiet" onClick={() => moderate(r, "reject")}>Reject</Button>
                      </span>
                    ) : (
                      <span className="status-wrap">
                        <button className="chip-btn" aria-label={`Change status of YA-${r.number}`} onClick={() => setStatusFor(statusFor === r.id ? null : r.id)}>
                          <StatusChip status={r.status} />
                          <Icon name="down" size={13} />
                        </button>
                        {statusFor === r.id && <StatusPopover current={r.status} onClose={() => setStatusFor(null)} onPick={(s) => setStatus(r, s)} />}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="kbd-help">
            <kbd>j</kbd> <kbd>k</kbd> move · <kbd>enter</kbd> open · <kbd>s</kbd> status · <kbd>/</kbd> search
          </p>
        </>
      )}

      {shipping && (
        <ShipDialog
          appId={app.id}
          request={shipping}
          onClose={() => setShipping(null)}
          onDone={(r) => {
            patch(r.id, (x) => ({ ...x, ...r, status: "shipped" }));
            setShipping(null);
            toast(`YA-${r.number} shipped. Everyone who asked has been told.`);
            bump();
          }}
        />
      )}
    </div>
  );
}

export function whoAsked(r: Req): string {
  const a = r.author;
  if (!a || (a.anonymous && !a.name && !a.email)) return "Someone";
  return a.name ?? a.email ?? "Someone";
}

const emptyTitle = (f: string) =>
  ({ open: "Nothing open right now", planned: "Nothing planned yet", in_progress: "Nothing in progress", shipped: "Nothing shipped yet", pending: "Nothing waiting for approval", all: "No requests" })[f] ?? "Nothing here";
const emptyHint = (f: string) =>
  ({
    open: "New requests land here. Check All for everything else.",
    planned: "Move an open request to Planned to promise it to the people who asked.",
    in_progress: "Move a request here when you start building it.",
    shipped: "When you mark a request shipped, everyone who asked is told and it shows up here.",
    pending: "If you turn on approval, new requests wait here until you approve them.",
    all: "",
  })[f] ?? "";
