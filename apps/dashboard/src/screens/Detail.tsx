import { useEffect, useState } from "react";
import { appApi, type ApiError, type Comment, type Req, type Status, type Voter, type WorkspaceApp } from "../api";
import { AgentLogo } from "../agent-logos";
import { RequestPicker, ShipDialog, StatusPopover } from "../components";
import { Link, navigate } from "../router";
import { appUrl, useSession } from "../session";
import { Button, CopyButton, Dialog, Empty, ErrorState, Icon, Skeleton, StatusChip, shortDate, timeAgo, useFail, useLoad, useToast } from "../ui";


type Detail = { request: Req; attachments: { id: string; url: string }[]; comments: Comment[]; voters: Voter[]; earlyAccess: Voter[] };

export function RequestDetail({ app, requestId }: { app: WorkspaceApp; requestId: string }) {
  const { bump } = useSession();
  const d = useLoad(() => appApi<Detail>(app.id, `/requests/${requestId}`), [app.id, requestId]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<"ship" | "merge" | "build" | "delete" | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const toast = useToast();
  const fail = useFail();

  useEffect(() => {
    setReply("");
    setDialog(null);
  }, [requestId]);

  // Esc goes back to the inbox when nothing else is open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "Escape" && !document.querySelector(".dialog, .menu") && t.tagName !== "TEXTAREA" && t.tagName !== "INPUT") navigate(appUrl(app.id));
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [app.id]);

  const back = (
    <Link to={appUrl(app.id)} className="back">
      <Icon name="left" size={15} /> Inbox
    </Link>
  );

  if (d.loading && !d.data) return <div className="page">{back}<Skeleton rows={5} /></div>;
  if (d.error != null || !d.data) {
    const gone = (d.error as { status?: number } | undefined)?.status === 404;
    return (
      <div className="page">
        {back}
        {gone ? (
          <Empty icon="warn" title="That request is gone" action={<Link to={appUrl(app.id)} className="btn btn-default">Back to your inbox</Link>}>
            It was deleted, or merged into another request.
          </Empty>
        ) : (
          <ErrorState error={d.error} retry={d.retry} />
        )}
      </div>
    );
  }

  const { request: r, comments, voters, attachments } = d.data;
  const asker = r.author ?? (voters[0] ? { email: voters[0].email, name: voters[0].name, anonymous: Boolean(voters[0].is_anon) } : undefined);
  const askerName = asker && !(asker.anonymous && !asker.name && !asker.email) ? asker.name ?? asker.email : null;

  const update = (fn: (x: Req) => Req) => d.set((x) => ({ ...x, request: fn(x.request) }));

  const setStatus = async (status: Status) => {
    setStatusOpen(false);
    if (status === r.status) return;
    if (status === "shipped") return setDialog("ship");
    const before = r.status;
    update((x) => ({ ...x, status }));
    try {
      await appApi(app.id, `/requests/${r.id}`, { method: "PATCH", body: { status } });
      toast(`Moved to ${status.replace("_", " ")}`);
      bump();
    } catch (e) {
      update((x) => ({ ...x, status: before }));
      fail(e);
    }
  };

  const send = async () => {
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await appApi(app.id, `/requests/${r.id}/comments`, { method: "POST", body: { body } });
      setReply("");
      await d.reload();
      toast("Reply sent. The person is told.");
    } catch (e) {
      fail(e);
    } finally {
      setSending(false);
    }
  };

  const moderate = async (action: "approve" | "reject") => {
    try {
      await appApi(app.id, `/requests/${r.id}/${action}`, { method: "POST" });
      bump();
      if (action === "approve") {
        update((x) => ({ ...x, status: "open" }));
        toast("Approved. It's now public.");
      } else {
        toast("Rejected");
        navigate(appUrl(app.id));
      }
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="page detail">
      {back}

      {r.status === "pending" && (
        <div className="pending-bar" role="note">
          <span><Icon name="clock" size={16} /> <b>Waiting for your approval.</b> Only you can see this until you approve it.</span>
          <span className="row">
            <Button kind="primary" size="sm" onClick={() => moderate("approve")}>Approve</Button>
            <Button kind="quiet" size="sm" onClick={() => moderate("reject")}>Reject</Button>
          </span>
        </div>
      )}

      <div className="detail-grid">
        <article className="detail-main">
          <div className="detail-top">
            <span className="ya">YA-{r.number}</span>
            <StatusChip status={r.status} />
          </div>
          <h1>{r.title}</h1>
          {r.body && <p className="body">{r.body}</p>}

          {attachments.length > 0 && (
            <div className="shots">
              {attachments.map((a) => (
                <a key={a.id} href={a.url} target="_blank" rel="noreferrer" aria-label="Open screenshot">
                  <img src={a.url} alt="Screenshot attached to the request" loading="lazy" />
                </a>
              ))}
            </div>
          )}

          {r.status === "shipped" && (
            <div className="shipped-note">
              <Icon name="flag" size={16} />
              <div>
                <b>Shipped{r.shippedAt ? ` on ${shortDate(r.shippedAt)}` : ""}</b>
                {r.shipNote && <p>{r.shipNote}</p>}
                {(r.shareUrl || r.shareImage) && (
                  <p className="links">
                    {r.shareUrl && <a href={r.shareUrl} target="_blank" rel="noreferrer">Share page <Icon name="ext" size={12} /></a>}
                    {r.shareImage && <a href={r.shareImage} target="_blank" rel="noreferrer">Share image <Icon name="ext" size={12} /></a>}
                  </p>
                )}
              </div>
            </div>
          )}
          {r.status === "declined" && r.shipNote && (
            <div className="shipped-note declined">
              <Icon name="x" size={16} />
              <div><b>Declined</b><p>{r.shipNote}</p></div>
            </div>
          )}

          <section className="thread" aria-label="Conversation">
            <h2>Conversation</h2>
            {comments.length === 0 && <p className="muted">No replies yet. Say something and the person who asked is told.</p>}
            <ol>
              {comments.map((c) => (
                <li key={c.id} data-team={c.is_team || undefined}>
                  <span className={c.is_team ? "app-dot sm" : "avatar sm"}>{(c.is_team ? app.name : c.name ?? c.email ?? "?").slice(0, 1).toUpperCase()}</span>
                  <div>
                    <p className="who">
                      <b>{c.is_team ? app.name : c.name ?? c.email ?? "Someone"}</b>
                      {c.is_team ? <span className="tag">your reply</span> : null}
                      <time>{timeAgo(c.created_at)}</time>
                    </p>
                    <p className="text">{c.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="reply">
              <label htmlFor="reply" className="sr-only">Reply</label>
              <textarea
                id="reply"
                className="input"
                rows={3}
                placeholder={`Reply as ${app.name}`}
                value={reply}
                maxLength={2000}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && send()}
              />
              <div className="reply-foot">
                <span className="muted small">Posted as {app.name}. The person is told. <kbd>⌘</kbd> <kbd>enter</kbd> to send.</span>
                <Button kind="primary" size="sm" busy={sending} disabled={!reply.trim()} onClick={send}>
                  <Icon name="send" size={15} /> Reply
                </Button>
              </div>
            </div>
          </section>
        </article>

        <aside className="detail-side">
          <div className="side-block">
            <div className="side-title">Status</div>
            <div className="status-wrap">
              <button className="chip-btn wide" onClick={() => setStatusOpen((o) => !o)} aria-label="Change status">
                <StatusChip status={r.status} />
                <Icon name="down" size={14} />
              </button>
              {statusOpen && <StatusPopover current={r.status} onClose={() => setStatusOpen(false)} onPick={setStatus} />}
            </div>
            {r.status !== "shipped" && r.status !== "pending" && (
              <Button kind="primary" className="btn-wide" onClick={() => setDialog("ship")}>
                <Icon name="flag" size={16} /> Mark shipped
              </Button>
            )}
          </div>

          <dl className="facts">
            <div><dt>Votes</dt><dd>{r.votes}</dd></div>
            <div>
              <dt>Asked by</dt>
              <dd>
                {askerName ?? "Someone who isn't signed in"}
                {asker?.email && asker.name && <small>{asker.email}</small>}
              </dd>
            </div>
            <div><dt>Asked</dt><dd>{shortDate(r.createdAt)}<small>{timeAgo(r.createdAt)}</small></dd></div>
            {r.context?.topic && <div><dt>Topic</dt><dd>{r.context.topic}</dd></div>}
            {(r.context?.page || r.context?.url) && <div><dt>Page</dt><dd className="mono">{r.context.page ?? r.context.url}</dd></div>}
            {(r.earlyAccess ?? 0) > 0 && <div><dt>Early access</dt><dd>{r.earlyAccess} want to try it first</dd></div>}
          </dl>

          {voters.length > 0 && (
            <div className="side-block">
              <div className="side-title">Who voted</div>
              <ul className="voters">
                {voters.slice(0, 8).map((v, i) => (
                  <li key={i}>{v.is_anon && !v.name && !v.email ? <span className="muted">Someone</span> : v.name ?? v.email}</li>
                ))}
                {r.votes > voters.length && <li className="muted">and {r.votes - voters.length} more</li>}
              </ul>
            </div>
          )}

          <div className="side-block actions">
            <Button className="btn-wide" onClick={() => setDialog("build")}>
              <Icon name="bolt" size={16} /> Build it
            </Button>
            <Button className="btn-wide" onClick={() => setDialog("merge")}>
              <Icon name="merge" size={16} /> Merge into another
            </Button>
            <Button kind="quiet" className="btn-wide danger-text" onClick={() => setDialog("delete")}>
              <Icon name="trash" size={16} /> Delete
            </Button>
          </div>
        </aside>
      </div>

      {dialog === "ship" && (
        <ShipDialog
          appId={app.id}
          request={r}
          onClose={() => setDialog(null)}
          onDone={(x) => {
            update((p) => ({ ...p, ...x, status: "shipped" }));
            setDialog(null);
            toast("Shipped. Everyone who asked has been told.");
            bump();
            d.reload();
          }}
        />
      )}
      {dialog === "merge" && <MergeDialog app={app} r={r} onClose={() => setDialog(null)} onDone={() => { bump(); navigate(appUrl(app.id)); }} />}
      {dialog === "build" && <BuildDialog app={app} r={r} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog app={app} r={r} onClose={() => setDialog(null)} onDone={() => { bump(); navigate(appUrl(app.id)); }} />}
    </div>
  );
}

function MergeDialog({ app, r, onClose, onDone }: { app: WorkspaceApp; r: Req; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<{ id: string; number: number; title: string; votes: number }>();
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useFail();
  const merge = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await appApi(app.id, `/requests/${r.id}/merge`, { method: "POST", body: { into: target.id } });
      toast(`Merged into YA-${target.number}`);
      onDone();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  return (
    <Dialog title="Merge into another request" onClose={onClose}>
      {!target ? (
        <>
          <p className="muted">Pick the request to keep. Votes and people who asked move across, and they're told when it ships.</p>
          <RequestPicker appId={app.id} excludeId={r.id} onPick={setTarget} />
        </>
      ) : (
        <>
          <p>
            Merge <b>YA-{r.number} {r.title}</b> into <b>YA-{target.number} {target.title}</b>?
          </p>
          <p className="muted">{r.votes} {r.votes === 1 ? "vote moves" : "votes move"} across. YA-{r.number} stops showing in your inbox.</p>
          <div className="dialog-actions">
            <Button kind="quiet" onClick={() => setTarget(undefined)}>Pick a different one</Button>
            <Button kind="primary" busy={busy} onClick={merge}>Merge</Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

type Built = { prompt: string; issueUrl?: string; cursorUrl?: string; github?: boolean };
type Handed = { ok: boolean; message: string; issueUrl?: string };

function BuildDialog({ app, r, onClose }: { app: WorkspaceApp; r: Req; onClose: () => void }) {
  const b = useLoad(() => appApi<Built>(app.id, `/requests/${r.id}/build`, { method: "POST" }), [r.id]);
  const [busy, setBusy] = useState<"copilot" | "claude" | null>(null);
  const [handed, setHanded] = useState<Handed | null>(null);
  const issueUrl = handed?.issueUrl ?? b.data?.issueUrl;

  const send = async (agent: "copilot" | "claude") => {
    setBusy(agent);
    setHanded(null);
    try {
      const out = await appApi<Handed>(app.id, `/requests/${r.id}/handoff`, { method: "POST", body: { agent } });
      setHanded(out);
    } catch (e) {
      const err = e as ApiError;
      setHanded({
        ok: false,
        message: err.status === 403 ? "Only owners and admins can hand requests to an agent." : err.serverMessage || "That didn't go through. Try again in a moment.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog title={`Build YA-${r.number}`} onClose={onClose} wide>
      {b.loading && <Skeleton rows={4} />}
      {b.error != null && <ErrorState error={b.error} retry={b.retry} />}
      {b.data && (
        <>
          <div className="handoff">
            <div className="handoff-head">
              <b>Hand it to an agent</b>
              <span className="muted small">It builds from the prompt below and opens a pull request. Merging it with <code>closes YA-{r.number}</code> tells everyone who asked.</span>
            </div>
            <div className="handoff-row">
              {b.data.cursorUrl && (
                <a className="btn btn-default handoff-btn" href={b.data.cursorUrl} target="_blank" rel="noreferrer">
                  <AgentLogo name="cursor" /> Open in Cursor
                </a>
              )}
              <Button className="handoff-btn" busy={busy === "copilot"} disabled={!b.data.github || busy !== null} onClick={() => send("copilot")}>
                {busy !== "copilot" && <AgentLogo name="copilot" />} Assign to Copilot
              </Button>
              <Button className="handoff-btn" busy={busy === "claude"} disabled={!b.data.github || busy !== null} onClick={() => send("claude")}>
                {busy !== "claude" && <AgentLogo name="claude" />} Ask @claude on GitHub
              </Button>
            </div>
            {!b.data.github && (
              <p className="muted small">
                Copilot and Claude work from a GitHub issue. Connect GitHub with a token in{" "}
                <Link to={appUrl(app.id, "/integrations")} onClick={onClose}>Integrations</Link> to send requests to them.
              </p>
            )}
            {handed && (
              <p className={`handoff-result ${handed.ok ? "ok" : "warn"}`} role="status">
                <Icon name={handed.ok ? "check" : "warn"} size={16} /> {handed.message}
                {handed.issueUrl && (
                  <>
                    {" "}<a href={handed.issueUrl} target="_blank" rel="noreferrer">Open the issue <Icon name="ext" size={12} /></a>
                  </>
                )}
              </p>
            )}
          </div>

          <p className="muted">Or paste this into Claude Code, Codex or any coding agent. It tells the agent to write <code>closes YA-{r.number}</code> in the commit, so everyone who asked is told when it lands.</p>
          <div className="codebox">
            <pre>{b.data.prompt}</pre>
            <CopyButton text={b.data.prompt} label="Copy prompt" className="codebox-copy" />
          </div>
          {issueUrl && !handed && (
            <p className="issue-line"><Icon name="check" size={16} /> We opened a GitHub issue too. <a href={issueUrl} target="_blank" rel="noreferrer">View issue <Icon name="ext" size={12} /></a></p>
          )}
        </>
      )}
    </Dialog>
  );
}

function DeleteDialog({ app, r, onClose, onDone }: { app: WorkspaceApp; r: Req; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useFail();
  return (
    <Dialog title="Delete this request?" onClose={onClose}>
      <p>YA-{r.number} "{r.title}", its votes and its replies will be removed for good. Nobody is told.</p>
      <p className="muted">If it's a duplicate, merge it instead so the votes aren't lost.</p>
      <div className="dialog-actions">
        <Button kind="quiet" onClick={onClose}>Keep it</Button>
        <Button
          kind="danger"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await appApi(app.id, `/requests/${r.id}`, { method: "DELETE" });
              toast("Request deleted");
              onDone();
            } catch (e) {
              fail(e);
              setBusy(false);
            }
          }}
        >
          Delete request
        </Button>
      </div>
    </Dialog>
  );
}
