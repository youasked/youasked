// The consent screen for connecting an AI assistant (Claude and others) through the hosted MCP
// connector. The API's /oauth/authorize sends people here with ?req=<id>. By this point they are
// signed in (the app shows the normal sign-in first and brings them back).
import { useState } from "react";
import { api, type Me } from "../api";
import { Button, ErrorState, Icon, Mark, Spinner, useFail, useLoad } from "../ui";

type Pending = { client: { name: string; returnsTo: string }; apps: { id: string; name: string }[]; account: { email: string } };

const CAN = [
  "Read feature requests, comments and vote counts for your apps",
  "Reply to the people who asked, as your team",
  "Change a request's status. Marking one shipped tells everyone who asked or voted, and that can't be undone",
  "Merge duplicate requests, and open a GitHub issue if your app has GitHub connected",
];
const CANNOT = [
  "See your secret keys, billing or payment details",
  "Change app settings, integrations or your team",
  "Delete requests or apps",
  "See the email addresses of the people who asked",
];

export function Connect({ me, reqId }: { me: Me; reqId: string }) {
  const pending = useLoad(() => api<Pending>(`/v1/dash/oauth/requests/${encodeURIComponent(reqId)}`), [reqId]);
  const [busy, setBusy] = useState<"allow" | "deny" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const fail = useFail();
  const p = pending.data;

  const decide = async (allow: boolean) => {
    setBusy(allow ? "allow" : "deny");
    try {
      const { redirect } = await api<{ redirect: string }>(`/v1/dash/oauth/requests/${encodeURIComponent(reqId)}/decision`, { method: "POST", body: { allow } });
      setLeaving(true);
      location.href = redirect;
    } catch (err) {
      setBusy(null);
      fail(err);
    }
  };

  const otherAccount = async () => {
    await api("/v1/auth/logout", { method: "POST" }).catch(() => {});
    location.reload();
  };

  let body;
  if (pending.loading && !p) body = <Spinner />;
  else if (pending.error != null) {
    const gone = (pending.error as { status?: number }).status === 404;
    body = gone ? (
      <>
        <h1>This request has expired</h1>
        <p className="sub">Go back to the assistant and choose Connect again. Each connection link works once, for 15 minutes.</p>
      </>
    ) : (
      <ErrorState error={pending.error} retry={pending.retry} />
    );
  } else if (p) {
    body = (
      <>
        <h1>Connect {p.client.name} to YouAsked?</h1>
        <p className="sub">
          Signed in as <b>{me.account.email}</b>. <button className="linklike" onClick={otherAccount}>Use a different account</button>
        </p>
        <div className="consent">
          <h2>{p.client.name} will be able to</h2>
          <ul className="consent-list can">
            {CAN.map((t) => (
              <li key={t}><Icon name="check" size={15} /> {t}</li>
            ))}
          </ul>
          <h2>It will not be able to</h2>
          <ul className="consent-list cannot">
            {CANNOT.map((t) => (
              <li key={t}><Icon name="x" size={15} /> {t}</li>
            ))}
          </ul>
          <p className="hint">
            This covers {p.apps.length === 1 ? "your app" : `all ${p.apps.length} of your apps`}
            {p.apps.length > 0 ? `: ${p.apps.map((a) => a.name).join(", ")}` : ""}, and any you add later. You can disconnect it any time under AI assistants.
          </p>
        </div>
        <div className="consent-actions">
          <Button kind="primary" className="btn-wide" busy={busy === "allow" || leaving} disabled={busy !== null} onClick={() => decide(true)}>Allow</Button>
          <Button className="btn-wide" busy={busy === "deny"} disabled={busy !== null} onClick={() => decide(false)}>Not now</Button>
        </div>
        <p className="legal">
          After you choose, we send you back to {p.client.returnsTo || "the assistant"}. Only connect assistants you started the connection from yourself.
        </p>
      </>
    );
  }

  return (
    <div className="signin">
      <div className="signin-card consent-card">
        <Mark className="signin-mark" />
        {body}
      </div>
    </div>
  );
}
