import { useEffect, useRef, useState } from "react";
import { YouAskedError, type FeatureRequest, type Notice, type RequestComment } from "./client";
import { useInternal, type Route } from "./context";
import { IconCheck, IconChevron, IconClose, IconFrame, IconPlus, IconSend, IconSpark } from "./icons";
import {
  AppAvatar,
  BigVote,
  Header,
  RequestRow,
  Skeleton,
  StatusPill,
  ago,
  errorText,
  useLoad,
  whatsNewHeading,
} from "./shared";

type NavProps = { route: Route; setRoute: (r: Route) => void; onClose?: () => void };

/** Renders the current screen. Shared by the overlay sheet and the embedded page. */
export function Navigator({ route, setRoute, onClose }: NavProps) {
  switch (route.view) {
    case "home":
      return <Home key={`${route.draft ?? ""}${route.focus ? "f" : ""}${route.topic ?? ""}`} route={route} setRoute={setRoute} onClose={onClose} />;
    case "board":
      return <Board initialTab={route.tab} setRoute={setRoute} onClose={onClose} />;
    case "detail":
      return <Detail key={route.id} id={route.id} setRoute={setRoute} onClose={onClose} />;
    case "mine":
      return <Mine setRoute={setRoute} onClose={onClose} />;
  }
}

// ---------------------------------------------------------------- home: a chat-style start screen

type ThreadItem =
  | { kind: "out"; text: string; images?: string[] }
  | { kind: "typing" }
  | { kind: "posted"; request: FeatureRequest }
  | { kind: "reply"; notice: Notice }
  | { kind: "error"; text: string };

/** Long messages keep their first line or sentence as the title and the full text as details. */
function splitMessage(text: string): { title: string; body: string } {
  const t = text.trim();
  if (t.length <= 120 && !t.includes("\n")) return { title: t, body: "" };
  const first = t.split("\n")[0];
  const sentence = first.match(/^(.{12,120}?[.!?])\s/)?.[1];
  const title = (sentence ?? first).slice(0, 120).trim();
  return { title, body: t };
}

function ReplyBubble({ notice, appName, onOpen }: { notice: Notice; appName: string; onOpen: () => void }) {
  return (
    <div className="ya-bubble ya-bubble-in">
      <span className="ya-bubble-kicker">
        {appName} replied about {notice.title}
      </span>
      <span>{notice.reply}</span>
      <button type="button" className="ya-bubble-link" onClick={onOpen}>
        Reply
      </button>
    </div>
  );
}

/** A screenshot waiting to go out with the message. */
type Shot = { blob: Blob; url: string };
const MAX_SHOTS = 3;

/** A short burst from the corner of a bubble when something they asked for has shipped. */
function Confetti() {
  const colors = ["var(--_accent)", "var(--_green)", "var(--_amber)", "#ff7eb3"];
  return (
    <span className="ya-confetti" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const angle = (Math.PI * (0.15 + (i / 13) * 0.7)) % Math.PI;
        const dist = 38 + (i % 4) * 14;
        return (
          <i
            key={i}
            style={
              {
                "--x": `${Math.round(Math.cos(angle) * dist * (i % 2 ? -1 : 1))}px`,
                "--y": `${Math.round(-Math.sin(angle) * dist)}px`,
                "--r": `${(i * 67) % 360}deg`,
                background: colors[i % colors.length],
                animationDelay: `${(i % 5) * 40}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </span>
  );
}

function Home({ route, setRoute, onClose }: NavProps & { route: Extract<Route, { view: "home" }> }) {
  const { client, config, appName, appIcon, greeting, markSeen, whatsNew, dismissWhatsNew, pointAtIt } = useInternal();
  const top = useLoad(() => client.list("top", "active"), [client]);
  const shipped = useLoad(() => client.list("new", "shipped"), [client]);
  const [text, setText] = useState(route.draft ?? "");
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [similar, setSimilar] = useState<FeatureRequest[]>([]);
  const [notices] = useState<Notice[]>(() => config?.unseen ?? []);
  // What shipped since the last visit is shown once: read it now, then tell the server it's been seen.
  const [news] = useState(() => whatsNew);
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotError, setShotError] = useState<string | null>(null);
  const [credit, setCredit] = useState(false);
  const urls = useRef<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sending = thread.some((t) => t.kind === "typing");

  useEffect(() => {
    if (notices.length) markSeen(notices.map((n) => n.id));
  }, [notices, markSeen]);

  useEffect(() => {
    if (news) dismissWhatsNew();
  }, [news, dismissWhatsNew]);

  // The team answering while this screen is open (the demo does this a few seconds after you post).
  const arrived = config?.unseen.filter((n) => n.kind === "reply" && !notices.some((o) => o.id === n.id)) ?? [];
  const arrivedKey = arrived.map((n) => n.id).join(",");
  useEffect(() => {
    if (!arrived.length) return;
    setThread((th) => [...th, ...arrived.map((notice) => ({ kind: "reply" as const, notice }))]);
    markSeen(arrived.map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedKey]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  useEffect(() => {
    if (!route.focus) return;
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 60);
    return () => clearTimeout(t);
  }, [route.focus]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    // Only grow for multi-line text; an empty box keeps its CSS height (fonts may still be loading).
    el.style.height = "";
    if (text.includes("\n") || el.scrollHeight > el.clientHeight + 2) el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [text]);

  useEffect(() => {
    if (thread.length) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [thread]);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 4) {
      setSimilar([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      client
        .similar(q)
        .then((r) => alive && setSimilar(r.slice(0, 3)))
        .catch(() => {});
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [client, text]);

  const point = async () => {
    setShotError(null);
    try {
      const blob = await pointAtIt();
      if (blob) {
        const url = URL.createObjectURL(blob);
        urls.current.push(url);
        setShots((s) => [...s, { blob, url }]);
      }
    } catch {
      setShotError("Couldn't capture this page. You can still describe it in words.");
    }
    inputRef.current?.focus({ preventScroll: true });
  };

  const send = async () => {
    const message = text.trim();
    if (message.length < 3 || sending) return;
    const attached = shots;
    const credited = credit && Boolean(config?.canCredit);
    setText("");
    setSimilar([]);
    setShots([]);
    setShotError(null);
    setCredit(false);
    setThread((th) => [...th, { kind: "out", text: message, images: attached.map((s) => s.url) }, { kind: "typing" }]);
    const { title, body } = splitMessage(message);
    try {
      const attachments = await Promise.all(attached.map((s) => client.upload(s.blob).then((a) => a.id)));
      const context = { path: location.pathname, topic: route.topic };
      const [request] = await Promise.all([
        client.create({ title, body, attachments, context, credit: credited }),
        new Promise((r) => setTimeout(r, 650)),
      ]);
      setThread((th) => [...th.filter((t) => t.kind !== "typing"), { kind: "posted", request }]);
    } catch (err) {
      setThread((th) => [
        ...th.filter((t) => t.kind !== "typing" && !(t.kind === "out" && t.text === message)),
        { kind: "error", text: errorText(err instanceof YouAskedError ? err.code : "network") },
      ]);
      setText(message);
      setShots(attached);
      setCredit(credited);
    }
  };

  const chatting = thread.length > 0;
  const openRequest = (id: string) => setRoute({ view: "detail", id });
  const asking = route.topic && route.placeholder ? route.topic : null;
  const placeholder = route.placeholder ?? "Ask for a feature…";
  const yours = news?.items.find((i) => i.mine);
  // Shipped notices for things already listed in the "what's new" bubble would just say it twice.
  const listed = new Set(news?.items.map((i) => i.id));
  const shownNotices = notices.filter((n) => !(n.kind === "shipped" && listed.has(n.requestId)));

  return (
    <>
      <Header
        leading={<AppAvatar icon={appIcon} />}
        title={appName}
        subtitle="Ideas, votes and what's new"
        onClose={onClose}
      />
      <div className="ya-body ya-chat" ref={bodyRef}>
        <div className="ya-bubble ya-bubble-in">
          {asking ? `Let's talk about ${asking}. What's missing, or what bugs you?` : (greeting ?? `Hey! What would make ${appName} better for you?`)}
        </div>
        {news && (
          <div className={yours ? "ya-bubble ya-bubble-in ya-bubble-win ya-bubble-news" : "ya-bubble ya-bubble-in ya-bubble-news"}>
            {yours && <Confetti />}
            <span className="ya-bubble-kicker">{whatsNewHeading(news.total)}</span>
            <ul className="ya-news">
              {news.items.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => openRequest(i.id)}>
                    <span className="ya-shipped-dot">
                      <IconCheck />
                    </span>
                    <span className="ya-news-text">
                      <span className="ya-news-title">{i.title}</span>
                      {i.mine && <span className="ya-news-you">You asked for this</span>}
                    </span>
                    <IconChevron />
                  </button>
                </li>
              ))}
            </ul>
            {yours && <span>That one was yours. Thanks for asking.</span>}
            {news.total > news.items.length && (
              <button type="button" className="ya-bubble-link" onClick={() => setRoute({ view: "board", tab: "shipped" })}>
                See all {news.total}
              </button>
            )}
          </div>
        )}
        {shownNotices.map((n) =>
          n.kind === "reply" ? (
            <ReplyBubble key={n.id} notice={n} appName={appName} onOpen={() => openRequest(n.requestId)} />
          ) : (
            <div key={n.id} className="ya-bubble ya-bubble-in ya-bubble-win">
              <span className="ya-live">
                <IconCheck />
                It's live
              </span>
              <span>
                You asked for <b>{n.title}</b>. {n.shipNote ?? "Thanks for asking."}
              </span>
              <button type="button" className="ya-bubble-link" onClick={() => openRequest(n.requestId)}>
                See it
              </button>
            </div>
          ),
        )}

        {!chatting && (
          <>
            <Section title="Popular right now" action="See all" onAction={() => setRoute({ view: "board" })}>
              {top.error ? (
                <p className="ya-note">{errorText(top.error)}</p>
              ) : !top.data ? (
                <Skeleton rows={2} />
              ) : top.data.length === 0 ? (
                <p className="ya-note">No requests yet. Yours could be the first.</p>
              ) : (
                <ul className="ya-list">
                  {top.data.slice(0, 3).map((r) => (
                    <RequestRow key={r.id} client={client} request={r} compact onOpen={() => openRequest(r.id)} />
                  ))}
                </ul>
              )}
            </Section>
            {shipped.data && shipped.data.length > 0 && (
              <Section title="Recently shipped" action="All" onAction={() => setRoute({ view: "board", tab: "shipped" })}>
                <ul className="ya-shipped">
                  {shipped.data.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => openRequest(r.id)}>
                        <span className="ya-shipped-dot">
                          <IconCheck />
                        </span>
                        <span className="ya-shipped-title">{r.title}</span>
                        <span className="ya-shipped-when">{r.shippedAt ? ago(r.shippedAt) : ""}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}

        {thread.map((t, i) =>
          t.kind === "out" ? (
            <div key={i} className="ya-bubble ya-bubble-out">
              {t.images?.map((src) => (
                <img key={src} className="ya-bubble-img" src={src} alt="Your screenshot" />
              ))}
              {t.text}
            </div>
          ) : t.kind === "typing" ? (
            <div key={i} className="ya-bubble ya-bubble-in ya-typing" aria-label="Posting">
              <span />
              <span />
              <span />
            </div>
          ) : t.kind === "reply" ? (
            <ReplyBubble key={i} notice={t.notice} appName={appName} onOpen={() => openRequest(t.notice.requestId)} />
          ) : t.kind === "posted" ? (
            <div key={i} className="ya-bubble ya-bubble-in">
              <span>
                Got it. <b>{t.request.title}</b> is on the board, and we'll tell you right here when it ships.
              </span>
              <button type="button" className="ya-bubble-link" onClick={() => openRequest(t.request.id)}>
                View request
              </button>
            </div>
          ) : (
            <div key={i} className="ya-bubble ya-bubble-in ya-bubble-error" role="alert">
              {t.text}
            </div>
          ),
        )}
        {chatting && !sending && (
          <button type="button" className="ya-chip" onClick={() => setRoute({ view: "board" })}>
            See what others asked for
          </button>
        )}
      </div>

      <div className="ya-composer-wrap">
        {similar.length > 0 && (
          <div className="ya-tray" aria-live="polite">
            <p className="ya-tray-h">Sounds like one of these. Vote instead?</p>
            <ul className="ya-list">
              {similar.map((r) => (
                <RequestRow key={r.id} client={client} request={r} compact onOpen={() => openRequest(r.id)} />
              ))}
            </ul>
          </div>
        )}
        {shots.length > 0 && (
          <ul className="ya-shots" aria-label="Screenshots">
            {shots.map((s, i) => (
              <li key={s.url} className="ya-shot">
                <img src={s.url} alt="" />
                <span>Screenshot{shots.length > 1 ? ` ${i + 1}` : ""}</span>
                <button
                  type="button"
                  className="ya-shot-x"
                  aria-label={`Remove screenshot${shots.length > 1 ? ` ${i + 1}` : ""}`}
                  onClick={() => setShots((all) => all.filter((x) => x !== s))}
                >
                  <IconClose />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="ya-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            ref={inputRef}
            className="ya-composer-input"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label={asking ? placeholder : "Ask for a feature"}
            maxLength={2000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="submit" className="ya-send" disabled={text.trim().length < 3 || sending} aria-label="Send">
            <IconSend />
          </button>
        </form>
        <div className="ya-tools">
          <button
            type="button"
            className="ya-tool"
            onClick={point}
            onPointerEnter={() => void import("./capture")}
            onFocus={() => void import("./capture")}
            disabled={sending || shots.length >= MAX_SHOTS}
          >
            <IconFrame />
            Show us
          </button>
          {config?.canCredit && text.trim().length > 0 && (
            <button type="button" className="ya-switch-row" role="switch" aria-checked={credit} onClick={() => setCredit((c) => !c)}>
              Credit me when it ships
              <span className="ya-switch" aria-hidden="true" />
            </button>
          )}
        </div>
        {shotError && (
          <p className="ya-note" role="alert">
            {shotError}
          </p>
        )}
        {config?.watermark && <p className="ya-mark">Feedback by YouAsked</p>}
      </div>
    </>
  );
}

function Section({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="ya-section">
      <div className="ya-section-head">
        <h3>{title}</h3>
        {action && (
          <button type="button" className="ya-link" onClick={onAction}>
            {action}
            <IconChevron />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- full board

const TABS = [
  { key: "top", label: "Top", sort: "top", status: "active" },
  { key: "new", label: "New", sort: "new", status: "active" },
  { key: "shipped", label: "Shipped", sort: "new", status: "shipped" },
] as const;

function Board({
  initialTab,
  setRoute,
  onClose,
}: {
  initialTab?: "top" | "new" | "shipped";
  setRoute: (r: Route) => void;
  onClose?: () => void;
}) {
  const { client, title } = useInternal();
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS.find((t) => t.key === initialTab) ?? TABS[0]);
  const { data, error } = useLoad(() => client.list(tab.sort, tab.status), [client, tab.key]);

  return (
    <>
      <Header
        title={title}
        onBack={() => setRoute({ view: "home" })}
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
        <button type="button" className="ya-btn" onClick={() => setRoute({ view: "home", focus: true })}>
          <IconPlus />
          Request a feature
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- one request

function Detail({ id, setRoute, onClose }: { id: string; setRoute: (r: Route) => void; onClose?: () => void }) {
  const { client, config, markSeen, appName, appIcon } = useInternal();
  const { data, error, setData } = useLoad(() => client.get(id), [client, id]);

  // Opening a request someone was told about counts as seeing it.
  const unseenHere = config?.unseen.filter((n) => n.requestId === id).map((n) => n.id).join(",") ?? "";
  const loaded = useRef(false);
  loaded.current = Boolean(data);
  useEffect(() => {
    if (!unseenHere) return;
    markSeen(unseenHere.split(","));
    // A reply that lands while you're reading shows up in the thread.
    if (loaded.current) {
      client
        .get(id)
        .then((d) => setData(d))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenHere, markSeen]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [voted, setVoted] = useState<boolean | null>(null);
  const [early, setEarly] = useState(false);
  useEffect(() => setEarly(Boolean(data?.earlyAccess)), [data?.earlyAccess]);

  const toggleEarly = async () => {
    if (!data?.request) return;
    const before = early;
    setEarly(!before);
    try {
      setEarly((await client.earlyAccess(data.request.id)).earlyAccess);
    } catch {
      setEarly(before);
    }
  };

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
            <div className="ya-detail-meta">
              {request.status !== "open" && <StatusPill status={request.status} />}
              <span className="ya-ref">YA-{request.number}</span>
            </div>
            <h3 className="ya-detail-title">{request.title}</h3>
            {request.body && request.body !== request.title && <p className="ya-text">{request.body}</p>}
            {data?.attachments && data.attachments.length > 0 && (
              <div className="ya-attachments">
                {data.attachments.map((a) => (
                  <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer">
                    <img src={a.url} alt="Screenshot attached to this request" loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            <BigVote client={client} request={request} onChange={setVoted} />
            {(request.status === "planned" || request.status === "in_progress") && (voted ?? request.voted) && (
              <button type="button" className="ya-early" role="switch" aria-checked={early} onClick={toggleEarly}>
                <span className="ya-card-icon" aria-hidden="true">
                  <IconSpark />
                </span>
                <span className="ya-menurow-text">
                  <span className="ya-menurow-label">Try it early</span>
                  <span className="ya-menurow-sub">{early ? "You're on the list. We'll let you in first." : "Get access before everyone else"}</span>
                </span>
                <span className="ya-switch" aria-hidden="true" />
              </button>
            )}
            {request.mine && request.status !== "shipped" && (
              <p className="ya-note">You asked for this. We'll tell you here when it ships.</p>
            )}
            {request.status === "shipped" && (
              <div className="ya-callout" data-tone="success">
                <IconCheck />
                <span>
                  <b>It's live.</b>
                  {request.shipNote ? ` ${request.shipNote}` : " Thanks for asking."}
                  {request.creditName && <span className="ya-credit">Thanks to {request.creditName} for asking.</span>}
                </span>
              </div>
            )}
            <p className="ya-section-h">Conversation</p>
            {comments.length === 0 ? (
              <p className="ya-text ya-text-muted">No messages yet. Add details or ask a question below.</p>
            ) : (
              <div className="ya-thread">
                {comments.map((c) => (
                  <Message key={c.id} comment={c} appName={appName} appIcon={appIcon} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {request && (
        <form className="ya-composer ya-composer-bar" onSubmit={send}>
          <textarea
            className="ya-composer-input"
            rows={1}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Message"
            aria-label="Message"
            maxLength={1000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
              }
            }}
          />
          <button type="submit" className="ya-send" disabled={!reply.trim() || sending} aria-label="Send comment">
            <IconSend />
          </button>
          {replyError && (
            <span className="ya-sr" role="alert">
              {replyError}
            </span>
          )}
        </form>
      )}
    </>
  );
}

/** Team replies read as messages from the app, yours sit on the right like any chat. */
function Message({ comment, appName, appIcon }: { comment: RequestComment; appName: string; appIcon: string | null }) {
  const when = <time dateTime={new Date(comment.createdAt).toISOString()}>{ago(comment.createdAt)}</time>;
  if (comment.mine) {
    return (
      <div className="ya-msg ya-msg-out">
        <div className="ya-bubble ya-bubble-out">{comment.body}</div>
        <span className="ya-msg-meta">{when}</span>
      </div>
    );
  }
  return (
    <div className="ya-msg">
      {comment.team && appIcon ? <AppAvatar icon={appIcon} size={26} /> : null}
      <div className="ya-msg-body">
        <span className="ya-msg-meta">
          <b>{comment.team ? appName : comment.author || "Someone"}</b>
          {comment.team && <span className="ya-team">Team</span>}
          {when}
        </span>
        <div className="ya-bubble ya-bubble-in">{comment.body}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- yours

function Mine({ setRoute, onClose }: { setRoute: (r: Route) => void; onClose?: () => void }) {
  const { client } = useInternal();
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
        <button type="button" className="ya-btn" onClick={() => setRoute({ view: "home", focus: true })}>
          <IconPlus />
          Request a feature
        </button>
      </div>
    </>
  );
}
