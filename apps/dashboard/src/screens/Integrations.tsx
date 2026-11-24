import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { appApi, type EventDelivery, type EventType, type Integrations as Ints, type TelegramState, type WorkspaceApp } from "../api";
import { Button, CopyButton, ErrorState, GitHubMark, Icon, PageHead, Skeleton, timeAgo, useFail, useInterval, useLoad, useToast } from "../ui";

export function QR({ text }: { text: string }) {
  const cells = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return { n, d };
  }, [text]);
  return (
    <svg className="qr" viewBox={`-2 -2 ${cells.n + 4} ${cells.n + 4}`} role="img" aria-label="QR code for the Telegram link" shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={cells.n + 4} height={cells.n + 4} fill="#fff" />
      <path d={cells.d} fill="#0b1020" />
    </svg>
  );
}

export function Integrations({ app }: { app: WorkspaceApp }) {
  const ints = useLoad(() => appApi<Ints>(app.id, "/integrations"), [app.id]);
  const data = ints.data;
  const set = (patch: Partial<Ints>) => ints.set((x) => ({ ...x, ...patch }));
  return (
    <div className="page narrow">
      <PageHead title="Integrations" sub="Hear about requests where you already are, and close the loop from your code." />
      {ints.error != null && <ErrorState error={ints.error} retry={ints.retry} />}
      {ints.loading && !data && !ints.error && <Skeleton rows={4} />}
      {data && (
        <>
          <TelegramCard app={app} state={data.telegram} reload={ints.reload} />
          <WebhookCard app={app} state={data.webhook} onChange={(webhook) => set({ webhook })} />
          <GithubCard app={app} state={data.github} reload={ints.reload} />
          <EventsCard app={app} state={data.events} onChange={(events) => set({ events })} />
        </>
      )}
    </div>
  );
}

function Section({ icon, title, status, children }: { icon: ReactNode; title: string; status?: ReactNode; children: ReactNode }) {
  return (
    <section className="int">
      <header>
        <span className="int-icon">{icon}</span>
        <h2>{title}</h2>
        {status && <span className="int-status">{status}</span>}
      </header>
      <div className="int-body">{children}</div>
    </section>
  );
}
const Connected = ({ text }: { text: string }) => <span className="connected"><i /> {text}</span>;

export const TelegramGlyph = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M21.400 4.200 2.900 11.300c-1.200.5-1.200 1.200-.2 1.500l4.700 1.500 1.800 5.600c.2.600.4.800.9.800.4 0 .6-.2.9-.4l2.200-2.200 4.600 3.400c.8.500 1.500.2 1.700-.8l3.100-14.600c.3-1.300-.5-1.900-1.300-1.400ZM9 14l9.800-6.200c.5-.3.900-.1.500.2l-8.200 7.400-.3 3.400L9 14Z" />
  </svg>
);

function TelegramCard({ app, state, reload }: { app: WorkspaceApp; state?: TelegramState; reload: () => void }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [own, setOwn] = useState(false);
  const toast = useToast();
  const fail = useFail();
  const connected = Boolean(state?.connected);
  const pendingLink = !connected ? link ?? state?.directLink ?? state?.groupLink ?? state?.link ?? null : null;

  // After you tap the link in Telegram, the bot reports back. Poll until it does.
  useInterval(reload, pendingLink ? 2500 : null);
  const was = useMemo(() => ({ connected }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (connected && !was.connected) {
      toast("Telegram is connected");
      was.connected = true;
    }
  }, [connected, toast, was]);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await appApi<{ link: string; directLink?: string; code: string }>(app.id, "/integrations/telegram/connect", { method: "POST" });
      setLink(r.directLink ?? r.link);
      reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    try {
      await appApi(app.id, "/integrations/telegram", { method: "DELETE" });
      setLink(null);
      was.connected = false;
      reload();
      toast("Telegram disconnected");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Section icon={<TelegramGlyph />} title="Telegram" status={connected ? <Connected text={`Connected${state?.chatTitle ? ` to ${state.chatTitle}` : ""}`} /> : undefined}>
      {connected ? (
        <>
          <p>
            {state?.mode === "notify" ? "New requests are posted to your chat. " : "New requests arrive in your chat with buttons to reply, plan and ship. "}
            {state?.botUsername && <>Using <b>@{state.botUsername}</b>.</>}
          </p>
          <div className="row"><Button kind="quiet" size="sm" onClick={disconnect}>Disconnect</Button></div>
        </>
      ) : pendingLink ? (
        <div className="tg-wait">
          <QR text={pendingLink} />
          <div>
            <p><b>Scan with your phone, or open the link.</b> Pick the chat or group where you want requests to arrive, then tap Start.</p>
            <div className="cmdline"><code>{pendingLink.replace("https://", "")}</code><CopyButton text={pendingLink} /></div>
            <div className="row">
              <a className="btn btn-primary" href={pendingLink} target="_blank" rel="noreferrer">Open Telegram <Icon name="ext" size={14} /></a>
              <span className="waiting"><span className="pulse" /> Waiting for Telegram</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p>Get new requests on your phone and reply, plan or ship with one tap. Connect with our bot, <b>@youasked_bot</b>. It takes ten seconds.</p>
          <div className="row">
            <Button kind="primary" busy={busy} onClick={connect}><TelegramGlyph /> Connect Telegram</Button>
            <button className="linklike" onClick={() => setOwn((o) => !o)}>{own ? "Hide" : "Use your own bot"}</button>
          </div>
        </>
      )}
      {!connected && own && <OwnBot app={app} onDone={(l) => { if (l) setLink(l); reload(); }} />}
    </Section>
  );
}

function OwnBot({ app, onDone }: { app: WorkspaceApp; onDone: (link?: string) => void }) {
  const [token, setToken] = useState("");
  const [notify, setNotify] = useState(false);
  const [chat, setChat] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = useFail();
  const toast = useToast();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await appApi<{ groupLink?: string; link?: string }>(app.id, "/integrations/telegram", {
        method: "PUT",
        body: { botToken: token.trim(), ...(notify ? { mode: "notify", chatId: chat.trim() } : {}) },
      });
      toast(notify ? "Bot connected. Requests will post to your chat." : "Bot connected. Open the link to pick a chat.");
      onDone(notify ? undefined : r.groupLink ?? r.link);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="own-bot" onSubmit={submit}>
      <p className="muted">Create a bot with <b>@BotFather</b> in Telegram, then paste its token here.</p>
      <label htmlFor="bottoken" className="sr-only">Bot token</label>
      <input id="bottoken" className="input mono" placeholder="123456789:AAH…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />
      <label className="check">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        <span><b>Notify only.</b> Post new requests to a chat, but leave the bot's other behaviour alone. Good if the bot already does something else.</span>
      </label>
      {notify && <input className="input" placeholder="Chat id, for example -1001234567890" aria-label="Chat id" value={chat} onChange={(e) => setChat(e.target.value)} />}
      <Button kind="primary" type="submit" busy={busy} disabled={!token.trim() || (notify && !chat.trim())}>Connect your bot</Button>
    </form>
  );
}

function WebhookCard({ app, state, onChange }: { app: WorkspaceApp; state?: Ints["webhook"]; onChange: (w: Ints["webhook"]) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useFail();
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await appApi<{ format: "slack" | "discord" | "json" }>(app.id, "/integrations/webhook", { method: "PUT", body: { url: url.trim() } });
      onChange({ url: url.trim(), format: r.format });
      setUrl("");
      toast(`${fmt(r.format)} connected`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await appApi(app.id, "/integrations/webhook", { method: "DELETE" });
      onChange(undefined);
      toast("Webhook removed");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <Section icon={<Icon name="chat" />} title="Slack and Discord" status={state ? <Connected text={`${fmt(state.format)} connected`} /> : undefined}>
      {state ? (
        <>
          <p>New requests and shipped updates post to your {fmt(state.format)} channel.</p>
          <div className="cmdline"><code>{maskUrl(state.url)}</code></div>
          <div className="row"><Button kind="quiet" size="sm" onClick={remove}>Remove</Button></div>
        </>
      ) : (
        <form onSubmit={save}>
          <p>Post new requests to a channel. Create an incoming webhook in Slack or Discord and paste its address.</p>
          <div className="inline-form">
            <label htmlFor="hook" className="sr-only">Webhook URL</label>
            <input id="hook" className="input" placeholder="https://hooks.slack.com/services/…" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
            <Button kind="primary" type="submit" busy={busy} disabled={!url.trim()}>Connect</Button>
          </div>
        </form>
      )}
    </Section>
  );
}
const EVENT_INFO: { type: EventType; label: string; hint: string }[] = [
  { type: "reply.created", label: "Reply sent", hint: "You replied to someone. Tell them, so they come back to read it." },
  { type: "request.shipped", label: "Request shipped", hint: "Something a person asked for or voted on shipped." },
];

/** Signed webhooks to the app's own server, so it can reach its users its own way (push, email, chat). */
function EventsCard({ app, state, onChange }: { app: WorkspaceApp; state?: Ints["events"]; onChange: (e: Ints["events"]) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; code: number | null; error: string | null; ms: number } | null>(null);
  const log = useLoad(() => (state ? appApi<{ deliveries: EventDelivery[] }>(app.id, "/integrations/events/deliveries?limit=20") : Promise.resolve({ deliveries: [] })), [app.id, Boolean(state)]);
  const toast = useToast();
  const fail = useFail();
  const save = async (e: FormEvent | null, patch: { url?: string; events?: EventType[] }) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const r = await appApi<NonNullable<Ints["events"]>>(app.id, "/integrations/events", { method: "PUT", body: { url: patch.url ?? state?.url, events: patch.events ?? state?.events } });
      onChange(r);
      setUrl("");
      if (!state) toast("Endpoint saved. Send a test event to check it.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (t: EventType) => {
    if (!state) return;
    const next = state.events.includes(t) ? state.events.filter((x) => x !== t) : [...state.events, t];
    if (next.length) void save(null, { events: next });
  };
  const sendTest = async () => {
    setTesting(true);
    try {
      setTest(await appApi(app.id, "/integrations/events/test", { method: "POST" }));
      log.reload();
    } catch (e) {
      fail(e);
    } finally {
      setTesting(false);
    }
  };
  const rotate = async () => {
    if (!state || !window.confirm("Make a new signing secret? Events are signed with the new one straight away, so update your server first.")) return;
    try {
      const r = await appApi<{ secret: string }>(app.id, "/integrations/events/rotate", { method: "POST" });
      onChange({ ...state, secret: r.secret });
      toast("New secret made");
    } catch (e) {
      fail(e);
    }
  };
  const resend = async (id: string) => {
    try {
      const r = await appApi<{ ok: boolean; code: number | null; error: string | null }>(app.id, `/integrations/events/deliveries/${id}/resend`, { method: "POST" });
      toast(r.ok ? "Delivered" : `Still failing: ${r.error ?? r.code}`);
      log.reload();
    } catch (e) {
      fail(e);
    }
  };
  const remove = async () => {
    try {
      await appApi(app.id, "/integrations/events", { method: "DELETE" });
      onChange(undefined);
      setTest(null);
      toast("Endpoint removed");
    } catch (e) {
      fail(e);
    }
  };
  return (
    <Section icon={<Icon name="send" />} title="Your server" status={state ? <Connected text="Sending events" /> : undefined}>
      {!state ? (
        <form onSubmit={(e) => save(e, { url: url.trim() })}>
          <p>Hear when one of your users should get a message: you replied to them, or something they asked for shipped. Your server gets a signed event with the user id you gave YouAsked, and you reach them your own way, with a push notification, an email or a chat message.</p>
          <div className="inline-form">
            <label htmlFor="events-url" className="sr-only">Endpoint URL</label>
            <input id="events-url" className="input" placeholder="https://yourapp.com/api/youasked/webhook" value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
            <Button kind="primary" type="submit" busy={busy} disabled={!url.trim()}>Save</Button>
          </div>
          <p className="muted small">Only people your app identifies (signed user ids) get events. <a href="https://youasked.dev/docs#webhooks" target="_blank" rel="noreferrer">How to verify them</a></p>
        </form>
      ) : (
        <>
          <div className="cmdline"><code>{state.url}</code></div>
          <h3>Events</h3>
          {EVENT_INFO.map((e) => (
            <label key={e.type} className="check">
              <input type="checkbox" checked={state.events.includes(e.type)} disabled={busy || (state.events.length === 1 && state.events.includes(e.type))} onChange={() => toggle(e.type)} />
              <span><b>{e.label}</b> <code>{e.type}</code>. {e.hint}</span>
            </label>
          ))}
          <h3>Signing secret</h3>
          <div className="cmdline"><code>{state.secret}</code><CopyButton text={state.secret} /></div>
          <p className="muted small">Check the <code>YouAsked-Signature</code> header on every event. <a href="https://youasked.dev/docs#webhooks" target="_blank" rel="noreferrer">How</a></p>
          <div className="row">
            <Button kind="primary" size="sm" busy={testing} onClick={sendTest}>Send test event</Button>
            <Button kind="quiet" size="sm" onClick={rotate}>New secret</Button>
            <Button kind="quiet" size="sm" onClick={remove}>Remove</Button>
          </div>
          {test && (
            <p className={test.ok ? "small" : "small error-text"}>
              {test.ok ? `Delivered. Your server answered ${test.code} in ${test.ms} ms.` : `Didn't arrive: ${test.error ?? `HTTP ${test.code}`}. Check the address and that your server answers with a 2xx.`}
            </p>
          )}
          {!!log.data?.deliveries.length && (
            <>
              <h3>Recent deliveries</h3>
              <ul className="deliveries">
                {log.data.deliveries.map((d) => (
                  <li key={d.id}>
                    <span className={`dot ${d.status}`} aria-hidden="true" />
                    <span className="d-main">
                      <code>{d.type}</code> {d.payload.data?.request?.ref ? <span className="muted">{d.payload.data.request.ref}</span> : null}
                      <span className="muted small">
                        {" · "}
                        {d.status === "delivered" ? `delivered ${timeAgo(d.delivered_at)}` : d.status === "failed" ? `failed after ${d.attempts} ${d.attempts === 1 ? "try" : "tries"} (${d.last_error ?? d.last_code})` : `retrying, ${d.attempts} ${d.attempts === 1 ? "try" : "tries"} so far (${d.last_error ?? d.last_code ?? "queued"})`}
                      </span>
                    </span>
                    {d.status !== "delivered" && <Button kind="quiet" size="sm" onClick={() => resend(d.id)}>Resend</Button>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Section>
  );
}

const fmt = (f?: string) => (f === "slack" ? "Slack" : f === "discord" ? "Discord" : "Webhook");
const maskUrl = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.host}/…${x.pathname.slice(-6)}`;
  } catch {
    return "…";
  }
};

function GithubCard({ app, state, reload }: { app: WorkspaceApp; state?: Ints["github"]; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState(state?.repo ?? "");
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const fail = useFail();
  const setup = async () => {
    setBusy(true);
    try {
      await appApi(app.id, "/integrations/github", { method: "PUT" });
      reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const saveToken = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await appApi(app.id, "/integrations/github-token", { method: "PUT", body: { token: token.trim(), repo: repo.trim() } });
      setToken("");
      toast("Saved. Build it can now open issues.");
      reload();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Section icon={<GitHubMark />} title="GitHub" status={state ? <Connected text="Webhook ready" /> : undefined}>
      {!state ? (
        <>
          <p>Write <code>closes YA-12</code> in a commit or pull request, and when it merges, request 12 is marked shipped and everyone who asked is told.</p>
          <div className="row"><Button kind="primary" busy={busy} onClick={setup}>Set up GitHub</Button></div>
        </>
      ) : (
        <>
          <ol className="steps">
            <li>In your repo, open <b>Settings, Webhooks, Add webhook</b>.</li>
            <li>
              Payload URL
              <div className="cmdline"><code>{state.payloadUrl}</code><CopyButton text={state.payloadUrl} /></div>
            </li>
            <li>
              Content type <b>application/json</b>, and this secret
              <div className="cmdline"><code>{state.secret}</code><CopyButton text={state.secret} /></div>
            </li>
            <li>Choose <b>Let me select</b>, tick <b>Pull requests</b> and <b>Pushes</b>, and save.</li>
          </ol>
          <p className="muted">Then write <code>closes YA-12</code> in a commit or pull request.</p>
          <hr />
          <form onSubmit={saveToken}>
            <h3>Open issues and hand them to agents <span className="optional">optional</span></h3>
            <p className="muted">With a token, Build it opens a GitHub issue with the spec, and you can assign it to Copilot or ask @claude to build it. {(state.hasToken || state.tokenConnected) && <b>A token is saved{state.repo ? ` for ${state.repo}` : ""}.</b>}</p>
            <ul className="muted small token-scopes">
              <li>Make a <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">fine-grained token</a> for just this repo, with read and write access to <b>Issues</b>. That's enough to open issues and ask @claude.</li>
              <li>To assign Copilot, also give it read and write access to <b>Contents</b>, <b>Pull requests</b> and <b>Actions</b>, and turn on the Copilot coding agent for the repo.</li>
              <li>To ask @claude, set up the Claude Code GitHub Action once: run <code>/install-github-app</code> in Claude Code.</li>
            </ul>
            <div className="grid2">
              <input className="input" placeholder="owner/repo" aria-label="Repository" value={repo} onChange={(e) => setRepo(e.target.value)} />
              <input className="input mono" type="password" placeholder={(state.hasToken || state.tokenConnected) ? "Paste a new token to replace it" : "github_pat_…"} aria-label="GitHub token" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <Button type="submit" busy={saving} disabled={!token.trim() || !/^[\w.-]+\/[\w.-]+$/.test(repo.trim())}>Save token</Button>
          </form>
        </>
      )}
    </Section>
  );
}
