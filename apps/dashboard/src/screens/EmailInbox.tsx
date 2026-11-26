import { useState } from "react";
import { appApi, type AppInfo, type EmailInbox as Inbox } from "../api";
import { Link } from "../router";
import { Button, CopyButton, Icon, Switch, timeAgo, useFail, useInterval, useToast } from "../ui";

type Provider = "gmail" | "workspace" | "outlook" | "cloudflare" | "other";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "gmail", label: "Gmail" },
  { id: "workspace", label: "Google Workspace" },
  { id: "outlook", label: "Outlook" },
  { id: "cloudflare", label: "Cloudflare" },
  { id: "other", label: "Other" },
];

function Steps({ provider, address }: { provider: Provider; address: string }) {
  const addr = <code className="ei-inline">{address}</code>;
  switch (provider) {
    case "gmail":
      return (
        <ol className="steps">
          <li>In the Gmail that receives your support mail, open <b>Settings → See all settings → Forwarding and POP/IMAP</b>.</li>
          <li>Click <b>Add a forwarding address</b> and paste {addr}.</li>
          <li>Gmail sends a confirmation code. It appears right here within seconds: open the link or type the code into Gmail.</li>
          <li>Choose <b>Forward a copy of incoming mail</b> and <b>keep Gmail's copy</b>, so your inbox keeps working too.</li>
        </ol>
      );
    case "workspace":
      return (
        <ol className="steps">
          <li>Easiest: follow the Gmail steps in the mailbox that receives support mail.</li>
          <li>For a whole address or group, an admin can open <b>Admin console → Apps → Gmail → Routing</b> and add a route that also delivers to {addr}.</li>
          <li>Any confirmation email shows up here, ready to approve.</li>
        </ol>
      );
    case "outlook":
      return (
        <ol className="steps">
          <li>In Outlook, open <b>Settings → Mail → Forwarding</b> (or <b>Rules</b> for one address only).</li>
          <li>Turn on forwarding to {addr} and tick <b>Keep a copy of forwarded messages</b>.</li>
          <li>Microsoft 365 admins may need to allow external forwarding for the mailbox.</li>
        </ol>
      );
    case "cloudflare":
      return (
        <ol className="steps">
          <li>In Cloudflare, open your domain's <b>Email → Email Routing → Destination addresses</b> and add {addr}.</li>
          <li>Cloudflare sends a verification link. It appears right here: open it to confirm.</li>
          <li>Under <b>Routing rules</b>, send your support address (for example hello@) to it. To keep your own copy too, use an Email Worker that forwards to both.</li>
        </ol>
      );
    default:
      return (
        <ol className="steps">
          <li>Wherever your support mail arrives, add a forwarding rule or alias that sends a copy to {addr}.</li>
          <li>Inbound webhooks (Resend, Postmark, SendGrid) work too: forward the message to the address from your handler.</li>
          <li>If your provider asks you to confirm the address, the confirmation shows up here.</li>
        </ol>
      );
  }
}

export function EmailInboxSettings({ app, info, entitled, onChange }: { app: { id: string; name: string }; info: AppInfo; entitled: boolean; onChange: (next: Inbox) => void }) {
  const toast = useToast();
  const fail = useFail();
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider>("gmail");
  const inbox = info.emailInbox;
  const waiting = Boolean(inbox?.enabled && !inbox.lastEmailAt);

  // While waiting for the first email or a confirmation, check every few seconds.
  useInterval(
    async () => {
      try {
        const next = await appApi<AppInfo>(app.id, "/app");
        if (next.emailInbox) onChange(next.emailInbox);
      } catch {
        /* the next tick tries again */
      }
    },
    waiting ? 5000 : null,
  );

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      const r = await appApi<{ ok: true; emailInbox?: Inbox }>(app.id, "/app", { method: "PATCH", body: { emailInbox: on } });
      if (r.emailInbox) onChange(r.emailInbox);
      toast(on ? "Email inbox is on. Add the forwarding rule below." : "Email inbox is off. Emails to the address are refused.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const freshSetup = inbox?.setup && Date.now() - inbox.setup.at < 7 * 24 * 3600_000 ? inbox.setup : null;

  return (
    <>
      <div className="setting">
        <div>
          <h3>Email inbox</h3>
          <p className="muted">
            Forward your support email here. Each email becomes a private conversation next to in-app messages, with the same alerts. Your replies go back by email, and their answers thread into the same conversation.
          </p>
        </div>
        <div className="setting-control">
          <Switch label="Email inbox" checked={Boolean(inbox?.enabled)} disabled={busy || (!entitled && !inbox?.enabled)} onChange={toggle} />
          {!entitled && !inbox?.enabled && <Icon name="lock" size={15} className="lock" />}
        </div>
      </div>
      {!entitled && !inbox?.enabled && (
        <p className="ei-plan muted small">
          Part of the paid plans. <Link to="/billing">See plans</Link>
        </p>
      )}

      {inbox?.enabled && inbox.address && (
        <div className="ei">
          <div className="ei-head">
            <div className="ei-label">Forward to</div>
            <div className={`ei-status ${waiting ? "wait" : "ok"}`}>
              <span className="pulse" />
              {waiting ? "Waiting for the first email" : `Receiving · last email ${timeAgo(inbox.lastEmailAt)}`}
            </div>
          </div>
          <div className="cmdline ei-address">
            <code>{inbox.address}</code>
            <CopyButton text={inbox.address} />
          </div>

          {freshSetup && (
            <div className="ei-confirm">
              <div className="ei-confirm-icon"><Icon name="check" size={16} /></div>
              <div className="grow">
                <b>{/google/i.test(freshSetup.from) ? "Gmail" : /cloudflare/i.test(freshSetup.from) ? "Cloudflare" : /microsoft|outlook/i.test(freshSetup.from) ? "Outlook" : "Your provider"} wants you to confirm forwarding</b>
                <p className="muted small">{freshSetup.subject} · {timeAgo(freshSetup.at)}</p>
                {freshSetup.code && (
                  <div className="ei-code">
                    <span>Code</span>
                    <code>{freshSetup.code}</code>
                    <CopyButton text={freshSetup.code} />
                  </div>
                )}
              </div>
              {freshSetup.link && (
                <a className="btn btn-primary btn-sm" href={freshSetup.link} target="_blank" rel="noopener noreferrer">
                  Confirm <Icon name="ext" size={14} />
                </a>
              )}
            </div>
          )}

          <div className="ei-guide">
            <div className="seg ei-seg" role="tablist" aria-label="Where your support mail arrives">
              {PROVIDERS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={provider === p.id} data-on={provider === p.id ? "" : undefined} onClick={() => setProvider(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            <Steps provider={provider} address={inbox.address} />
          </div>

          <p className="ei-foot muted small">
            <Icon name="mail" size={14} /> Replies are sent as “{app.name} via YouAsked”. Auto-replies, newsletters and bounces are skipped. Turning it off refuses new email but keeps this address for when you turn it back on.
          </p>
          {!waiting && (
            <div className="row">
              <Button kind="quiet" size="sm" onClick={() => toggle(true)}>
                <Icon name="refresh" size={14} /> Refresh
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
