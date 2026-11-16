// The inbox for an app in private mode: one-to-one conversations, like a support inbox.
// List on the left, the conversation in the middle, what it's filed under and who it's with on the right.
// The URL holds the selection (/a/:app/r/:id), so Telegram and email links land on the right one.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appApi, type Comment, type Linked, type Req, type Status, type Voter, type WorkspaceApp } from "../api";
import { RequestPicker, ShipDialog, StatusPopover } from "../components";
import { Link, navigate } from "../router";
import { appUrl, useSession } from "../session";
import { Button, Dialog, Empty, ErrorState, Icon, Skeleton, StatusChip, shortDate, timeAgo, useFail, useInterval, useLoad, useMedia, useToast } from "../ui";
import { BuildDialog, DeleteDialog } from "./Detail";

type Person = { id?: string; email: string | null; name: string | null; anonymous: boolean; conversations?: number };
type Thread = {
  request: Req;
  attachments: { id: string; url: string }[];
  comments: Comment[];
  voters: Voter[];
  author: Person | null;
  linked: Linked;
};

const FILTERS = [
  { id: "needs", label: "Needs reply", match: (r: Req) => Boolean(r.needsReply) },
  { id: "all", label: "All", match: (r: Req) => !r.closedAt },
  { id: "done", label: "Done", match: (r: Req) => Boolean(r.closedAt) },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const nameOf = (p?: Person | null) => (p && !(p.anonymous && !p.name && !p.email) ? (p.name ?? p.email ?? "Someone") : "Someone");
const firstName = (p?: Person | null) => nameOf(p).split(/[\s@]/)[0] || "them";
const initials = (p?: Person | null) => {
  const n = nameOf(p);
  if (n === "Someone") return "?";
  const parts = n.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[1]?.[0] ?? "") : "")).toUpperCase();
};
const lastOf = (r: Req) => r.last ?? { body: r.body || r.title, team: false, at: r.createdAt };
const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable));
};

export function Conversations({ app, selectedId }: { app: WorkspaceApp; selectedId?: string }) {
  const { bump } = useSession();
  const list = useLoad(() => appApi<{ requests: Req[] }>(app.id, "/requests?status=all").then((d) => d.requests), [app.id]);
  const [filter, setFilter] = useState<FilterId>(() => (sessionStorage.getItem("ya_cv_filter") as FilterId) || "needs");
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const wide = useMedia("(min-width: 861px)");

  // New messages arrive while the inbox is open.
  useInterval(() => {
    if (document.visibilityState === "visible") list.reload();
  }, 30_000);

  const all = list.data ?? [];
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, all.filter(f.match).length])) as Record<FilterId, number>, [all]);
  const shown = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const term = q.trim().toLowerCase();
    return all
      .filter((r) => r.id === selectedId || f.match(r))
      .filter((r) => !term || `${r.title} ${r.body} ${r.last?.body ?? ""} ya-${r.number} ${r.author?.name ?? ""} ${r.author?.email ?? ""}`.toLowerCase().includes(term))
      .sort((a, b) => lastOf(b).at - lastOf(a).at);
  }, [all, filter, q, selectedId]);

  const setF = (id: FilterId) => {
    setFilter(id);
    try {
      sessionStorage.setItem("ya_cv_filter", id);
    } catch {
      /* storage blocked */
    }
  };

  const open = useCallback((id: string, replace = false) => navigate(appUrl(app.id, `/r/${id}`), replace), [app.id]);

  // On a wide screen something is always open: the newest in the current filter.
  useEffect(() => {
    if (wide && !selectedId && shown[0]) open(shown[0].id, true);
  }, [wide, selectedId, shown, open]);

  const patchRow = useCallback((id: string, fn: (r: Req) => Req) => list.set((d) => d.map((r) => (r.id === id ? fn(r) : r))), [list]);

  const step = useCallback(
    (by: number) => {
      const i = shown.findIndex((r) => r.id === selectedId);
      const next = shown[Math.min(Math.max(i + by, 0), shown.length - 1)];
      if (next && next.id !== selectedId) open(next.id);
    },
    [shown, selectedId, open],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".dialog, .menu")) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "r") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>(".cv-composer textarea")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step]);

  const none = !list.loading && !list.error && all.length === 0;

  return (
    <div className="cv" data-open={selectedId ? "" : undefined}>
      <section className="cv-list" aria-label="Conversations">
        <div className="cv-list-head">
          <div className="cv-title">
            <h1>Inbox</h1>
            <span className="cv-private" title="Private mode is on: each person only sees their own conversations.">
              <Icon name="lock" size={13} /> Private
            </span>
          </div>
          <p className="muted small">
            {list.data ? (counts.needs ? `${counts.needs} waiting on a reply` : "Nobody is waiting on you") : " "}
          </p>
          <div className="tabs cv-tabs" role="tablist" aria-label="Filter conversations">
            {FILTERS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filter === f.id} data-pending={(f.id === "needs" && counts.needs > 0) || undefined} onClick={() => setF(f.id)}>
                {f.label}
                {f.id !== "all" && <span className="n">{counts[f.id] ?? 0}</span>}
              </button>
            ))}
          </div>
          <div className="search-field">
            <Icon name="search" size={16} />
            <input ref={searchRef} className="input bare-input" placeholder="Search people and messages" aria-label="Search conversations" value={q} onChange={(e) => setQ(e.target.value)} />
            <kbd>/</kbd>
          </div>
        </div>

        {list.error != null && <ErrorState error={list.error} retry={list.retry} />}
        {list.loading && !list.data && <div className="cv-pad"><Skeleton rows={6} /></div>}
        {none && (
          <div className="cv-pad">
            <Empty icon="chat" title="No conversations yet" action={<Link to={appUrl(app.id, "/install")} className="btn btn-default">Open the install guide</Link>}>
              When someone messages you from {app.name}, it lands here. Only you and that person can see it.
            </Empty>
          </div>
        )}
        {list.data && !none && shown.length === 0 && (
          <p className="cv-empty">{q ? "Nothing matches that search." : filter === "needs" ? "All caught up. Nobody is waiting on a reply." : filter === "done" ? "Nothing marked done yet." : "Nothing here."}</p>
        )}
        <ul className="cv-rows">
          {shown.map((r) => {
            const last = lastOf(r);
            return (
              <li key={r.id}>
                <Link to={appUrl(app.id, `/r/${r.id}`)} className="cv-row" data-active={r.id === selectedId || undefined} data-needs={r.needsReply || undefined}>
                  <span className="avatar">{initials(r.author)}</span>
                  <span className="cv-row-main">
                    <span className="cv-row-top">
                      <b>{nameOf(r.author)}</b>
                      <span className="cv-row-when">
                        <time dateTime={new Date(last.at).toISOString()}>{timeAgo(last.at)}</time>
                        {r.needsReply && <span className="cv-dot" aria-label="Needs a reply" />}
                      </span>
                    </span>
                    <span className="cv-row-title">
                      <span className="grow">{r.title}</span>
                      {r.status !== "open" && <StatusChip status={r.status} />}
                    </span>
                    {r.comments > 0 && (
                      <span className="cv-row-last">
                        {last.team ? "You: " : ""}
                        {last.body.replace(/\s+/g, " ")}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="kbd-help cv-kbd">
          <kbd>j</kbd> <kbd>k</kbd> move · <kbd>r</kbd> reply · <kbd>/</kbd> search
        </p>
      </section>

      {selectedId ? (
        <ThreadPane
          key={selectedId}
          app={app}
          id={selectedId}
          onBack={() => navigate(appUrl(app.id))}
          onChanged={(id, fn) => {
            patchRow(id, fn);
            bump();
          }}
          onRefreshList={list.reload}
          onDoneNext={() => {
            // Done in "Needs reply": move straight on to the next person waiting.
            const rest = shown.filter((r) => r.id !== selectedId && r.needsReply);
            if (filter === "needs" && rest[0]) open(rest[0].id);
          }}
        />
      ) : (
        wide && !none && <div className="cv-thread cv-thread-empty"><p className="muted">{list.data ? "Pick a conversation." : ""}</p></div>
      )}
    </div>
  );
}

function ThreadPane({
  app,
  id,
  onBack,
  onChanged,
  onRefreshList,
  onDoneNext,
}: {
  app: WorkspaceApp;
  id: string;
  onBack: () => void;
  onChanged: (id: string, fn: (r: Req) => Req) => void;
  onRefreshList: () => void;
  onDoneNext: () => void;
}) {
  const d = useLoad(() => appApi<Thread>(app.id, `/requests/${id}`), [app.id, id]);
  const [reply, setReply] = useState("");
  const [everyone, setEveryone] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dialog, setDialog] = useState<"ship" | "link" | "build" | "delete" | null>(null);
  const scroller = useRef<HTMLOListElement>(null);
  const toast = useToast();
  const fail = useFail();

  useInterval(() => {
    if (document.visibilityState === "visible" && !sending) d.reload();
  }, 30_000);

  const count = d.data?.comments.length ?? 0;
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, Boolean(d.data)]);

  if (d.loading && !d.data) {
    return (
      <div className="cv-thread">
        <div className="cv-pad"><Skeleton rows={6} /></div>
      </div>
    );
  }
  if (d.error != null || !d.data) {
    const gone = (d.error as { status?: number } | undefined)?.status === 404;
    return (
      <div className="cv-thread">
        <div className="cv-pad">
          <button className="back cv-back" onClick={onBack}><Icon name="left" size={15} /> Inbox</button>
          {gone ? <Empty icon="warn" title="That conversation is gone">It was deleted.</Empty> : <ErrorState error={d.error} retry={d.retry} />}
        </div>
      </div>
    );
  }

  const { request: r, comments, attachments, author, linked } = d.data;
  const person: Person | null = author ?? r.author ?? null;
  const first = firstName(person);
  const group = linked && linked.conversations.length > 1 ? linked : null;
  const isRoot = group ? group.root.id === r.id : false;
  const others = group ? group.conversations.length : 0;
  const update = (fn: (x: Req) => Req) => {
    d.set((x) => ({ ...x, request: fn(x.request) }));
    onChanged(r.id, fn);
  };

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const out = await appApi<{ conversations: number }>(app.id, `/requests/${r.id}/comments`, { method: "POST", body: { body, everyone: Boolean(group && everyone) } });
      setReply("");
      await d.reload();
      onRefreshList();
      toast(out.conversations > 1 ? `Sent to ${out.conversations} people, each in their own conversation.` : `Sent. Only ${first} sees it.`);
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: Status) => {
    setStatusOpen(false);
    if (status === r.status) return;
    if (status === "shipped") return setDialog("ship");
    const before = r.status;
    update((x) => ({ ...x, status }));
    try {
      await appApi(app.id, `/requests/${r.id}`, { method: "PATCH", body: { status } });
      toast(group ? `Moved to ${status.replace("_", " ")} for all ${others} people` : `Moved to ${status.replace("_", " ")}`);
      d.reload();
      onRefreshList();
    } catch (e) {
      update((x) => ({ ...x, status: before }));
      fail(e);
    }
  };

  const setDone = async (done: boolean) => {
    update((x) => ({ ...x, closedAt: done ? Date.now() : null, needsReply: done ? false : x.needsReply }));
    try {
      await appApi(app.id, `/requests/${r.id}/done`, { method: "POST", body: { done } });
      toast(done ? "Marked done. It comes back if they write again." : "Opened again");
      if (done) onDoneNext();
    } catch (e) {
      fail(e);
      d.reload();
    }
  };

  const unlink = async () => {
    try {
      await appApi(app.id, `/requests/${r.id}/unlink`, { method: "POST" });
      toast("Unlinked. It's a conversation on its own again.");
      d.reload();
      onRefreshList();
    } catch (e) {
      fail(e);
    }
  };

  const shippedLine = r.status === "shipped" && (
    <li className="cv-system">
      <Icon name="flag" size={14} /> Shipped{r.shippedAt ? ` on ${shortDate(r.shippedAt)}` : ""}
      {r.shipNote ? `: ${r.shipNote}` : ""}
    </li>
  );

  return (
    <>
      <section className="cv-thread" aria-label={`Conversation with ${nameOf(person)}`}>
        <header className="cv-thread-head">
          <button className="cv-back icon-btn" onClick={onBack} aria-label="Back to the inbox"><Icon name="left" size={18} /></button>
          <span className="avatar">{initials(person)}</span>
          <div className="cv-who">
            <b>{nameOf(person)}</b>
            <span className="muted small">{person?.email ?? (person?.anonymous ? "Not signed in" : "No email")}</span>
          </div>
          {r.closedAt ? (
            <Button size="sm" onClick={() => setDone(false)}>Open again</Button>
          ) : (
            <Button size="sm" onClick={() => setDone(true)} title="Mark done (it comes back if they write again)">
              <Icon name="done" size={15} /> Done
            </Button>
          )}
        </header>

        <div className="cv-subject">
          <span className="ya">YA-{r.number}</span>
          <h2>{r.title}</h2>
          {r.status !== "open" && <StatusChip status={r.status} />}
        </div>

        <ol className="cv-msgs" ref={scroller}>
          <Msg who={nameOf(person)} initials={initials(person)} at={r.createdAt}>
            {r.body || r.title}
            {attachments.length > 0 && (
              <span className="cv-shots">
                {attachments.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" aria-label="Open screenshot">
                    <img src={a.url} alt="Screenshot they attached" loading="lazy" />
                  </a>
                ))}
              </span>
            )}
          </Msg>
          {comments.map((c) =>
            c.is_team ? (
              <Msg key={c.id} team who={app.name} at={c.created_at}>{c.body}</Msg>
            ) : (
              <Msg key={c.id} who={c.name ?? nameOf(person)} initials={initials(person)} at={c.created_at}>{c.body}</Msg>
            ),
          )}
          {shippedLine}
        </ol>

        <div className="cv-composer">
          {group && (
            <div className="seg cv-to" role="group" aria-label="Who gets this reply">
              <button data-on={!everyone || undefined} onClick={() => setEveryone(false)}>Only {first}</button>
              <button data-on={everyone || undefined} onClick={() => setEveryone(true)}>All {others} people</button>
            </div>
          )}
          <label htmlFor="cv-reply" className="sr-only">Reply</label>
          <textarea
            id="cv-reply"
            className="input"
            rows={3}
            placeholder={group && everyone ? `Reply to all ${others}. Each person gets it in their own conversation.` : `Reply to ${first}. Only ${first} sees this.`}
            value={reply}
            maxLength={2000}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()}
          />
          <div className="reply-foot">
            <span className="muted small">
              {person?.email ? `They see it in ${app.name} and get an email.` : `They see it next time they open ${app.name}.`} <kbd>⌘</kbd> <kbd>enter</kbd>
            </span>
            <Button kind="primary" size="sm" busy={sending} disabled={!reply.trim()} onClick={send}>
              <Icon name="send" size={15} /> Send
            </Button>
          </div>
        </div>
      </section>

      <aside className="cv-rail" aria-label="About this conversation">
        <div className="side-block">
          <div className="side-title">Status{group && !isRoot ? " (shared with everyone linked)" : ""}</div>
          <div className="status-wrap">
            <button className="chip-btn wide" onClick={() => setStatusOpen((o) => !o)} aria-label="Change status">
              <StatusChip status={r.status} />
              <Icon name="down" size={14} />
            </button>
            {statusOpen && <StatusPopover current={r.status} onClose={() => setStatusOpen(false)} onPick={setStatus} />}
          </div>
          {r.status !== "shipped" && (
            <Button kind="primary" className="btn-wide" onClick={() => setDialog("ship")}>
              <Icon name="flag" size={16} /> Mark shipped
            </Button>
          )}
        </div>

        <div className="cv-card">
          {group ? (
            <>
              <div className="cv-card-head">
                <Icon name="link" size={15} />
                <span>{isRoot ? "Asked for by" : "Linked to"}</span>
              </div>
              {!isRoot && (
                <Link to={appUrl(app.id, `/r/${group.root.id}`)} className="cv-root">
                  <b>{group.root.title}</b>
                  <span className="muted small">YA-{group.root.number}</span>
                </Link>
              )}
              <p className="muted small">
                {others} people asked privately. Each one only sees their own conversation, and all of them are told when it ships.
              </p>
              <ul className="cv-people">
                {group.conversations.map((c) => (
                  <li key={c.id}>
                    <Link to={appUrl(app.id, `/r/${c.id}`)} data-here={c.id === r.id || undefined}>
                      <span className="avatar sm">{initials(c.author)}</span>
                      <span className="grow">{nameOf(c.author)}</span>
                      {c.needsReply && <span className="cv-dot" aria-label="Needs a reply" />}
                    </Link>
                  </li>
                ))}
              </ul>
              {!isRoot && (
                <Button kind="quiet" size="sm" onClick={unlink}>Unlink this conversation</Button>
              )}
            </>
          ) : (
            <>
              <div className="cv-card-head">
                <Icon name="link" size={15} />
                <span>Others asking for this?</span>
              </div>
              <p className="muted small">Link it to the same request. Each person keeps their own conversation, and they're all told when it ships.</p>
              <Button size="sm" onClick={() => setDialog("link")}>Link to a request</Button>
            </>
          )}
        </div>

        <dl className="facts">
          <div><dt>Started</dt><dd>{shortDate(r.createdAt)}<small>{timeAgo(r.createdAt)}</small></dd></div>
          {(r.context?.page || r.context?.url || (r.context as { path?: string } | null)?.path) && (
            <div><dt>Page</dt><dd className="mono">{r.context?.page ?? r.context?.url ?? (r.context as { path?: string }).path}</dd></div>
          )}
          {r.context?.topic && <div><dt>Topic</dt><dd>{r.context.topic}</dd></div>}
          {(person?.conversations ?? 0) > 1 && <div><dt>Conversations with {first}</dt><dd>{person!.conversations}</dd></div>}
        </dl>

        <div className="side-block actions">
          <Button className="btn-wide" onClick={() => setDialog("build")}>
            <Icon name="bolt" size={16} /> Build it
          </Button>
          <Button kind="quiet" className="btn-wide danger-text" onClick={() => setDialog("delete")}>
            <Icon name="trash" size={16} /> Delete
          </Button>
        </div>
      </aside>

      {dialog === "ship" && (
        <ShipDialog
          appId={app.id}
          request={group ? { ...r, votes: others } : r}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast(group ? `Shipped. All ${others} people are told in their own conversation.` : `Shipped. ${first} is told.`);
            d.reload();
            onRefreshList();
          }}
        />
      )}
      {dialog === "link" && (
        <LinkDialog
          app={app}
          r={r}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            d.reload();
            onRefreshList();
          }}
        />
      )}
      {dialog === "build" && <BuildDialog app={app} r={r} onClose={() => setDialog(null)} />}
      {dialog === "delete" && (
        <DeleteDialog
          app={app}
          r={r}
          onClose={() => setDialog(null)}
          onDone={() => {
            onRefreshList();
            navigate(appUrl(app.id));
          }}
        />
      )}
    </>
  );
}

function Msg({ team, who, initials: ini, at, children }: { team?: boolean; who: string; initials?: string; at: number; children: React.ReactNode }) {
  return (
    <li className="cv-msg" data-team={team || undefined}>
      {!team && <span className="avatar sm">{ini}</span>}
      <div>
        <p className="cv-msg-meta">
          <b>{who}</b>
          <time dateTime={new Date(at).toISOString()}>{timeAgo(at)}</time>
        </p>
        <div className="cv-bubble">{children}</div>
      </div>
    </li>
  );
}

function LinkDialog({ app, r, onClose, onDone }: { app: WorkspaceApp; r: Req; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<{ id: string; number: number; title: string; votes: number }>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useFail();
  const link = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await appApi(app.id, `/requests/${r.id}/link`, { method: "POST", body: { into: target.id } });
      toast(`Linked to YA-${target.number}`);
      onDone();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Link to a request" onClose={onClose}>
      {!target ? (
        <>
          <p className="muted">Pick the request this is the same as. Nothing changes for the person except the status, which follows that request.</p>
          <RequestPicker appId={app.id} excludeId={r.id} onPick={setTarget} />
        </>
      ) : (
        <>
          <p>
            Link <b>YA-{r.number} {r.title}</b> to <b>YA-{target.number} {target.title}</b>?
          </p>
          <p className="muted">They keep their own private conversation and never see anyone else's. When YA-{target.number} ships, they're told.</p>
          <div className="dialog-actions">
            <Button kind="quiet" onClick={() => setTarget(undefined)}>Pick a different one</Button>
            <Button kind="primary" busy={busy} onClick={link}>Link</Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
