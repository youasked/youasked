import { useState, type FormEvent } from "react";
import { api, ApiError, explain, type NewApp, type WorkspaceApp } from "../api";
import { Link, navigate, useRoute } from "../router";
import { appUrl, useSession } from "../session";
import { Button, Empty, Icon, Skeleton, useFail, useLoad } from "../ui";

export const secretStore = {
  get: (id: string) => {
    try {
      return sessionStorage.getItem("ya_secret_" + id);
    } catch {
      return null;
    }
  },
  set: (id: string, v: string | null) => {
    try {
      if (v) sessionStorage.setItem("ya_secret_" + id, v);
      else sessionStorage.removeItem("ya_secret_" + id);
    } catch {
      /* storage blocked */
    }
  },
};

export function CreateApp() {
  const { wid, ws, reloadWs } = useSession();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ text: string; upgrade: boolean }>();
  const first = ws!.apps.length === 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const { app } = await api<{ app: NewApp }>(`/v1/dash/workspaces/${wid}/apps`, { method: "POST", body: { name: name.trim() } });
      secretStore.set(app.id, app.secretKey);
      await reloadWs();
      navigate(appUrl(app.id, "/install"));
    } catch (err) {
      const upgrade = err instanceof ApiError && (err.upgrade || err.status === 402);
      setProblem({
        text: upgrade
          ? `Your ${ws!.workspace.plan ? "plan" : "workspace in test mode"} is at its app limit. Pick or upgrade a plan to add another app.`
          : explain(err),
        upgrade,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="focus">
      <h1>{first ? "Let's set up your first app" : "New app"}</h1>
      <p className="sub">{first ? "What's the app people will ask for features in? You can rename it later." : "Each app has its own requests, board and keys."}</p>
      <form onSubmit={submit} className="stack">
        <label htmlFor="appname" className="sr-only">App name</label>
        <input id="appname" className="input input-lg" autoFocus placeholder="App name, for example Acme" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <div className="row">
          <Button kind="primary" type="submit" busy={busy} disabled={!name.trim()}>Create app</Button>
          {!first && <Link to="/" className="btn btn-quiet">Cancel</Link>}
        </div>
        {problem && (
          <p className="inline-error" role="alert">
            <Icon name="warn" size={16} /> {problem.text} {problem.upgrade && <Link to="/billing">See plans</Link>}
          </p>
        )}
      </form>
      {first && (
        <p className="hint">Already ran <code>npx youasked init</code> in your project? Open the claim link it printed and your app lands here.</p>
      )}
    </div>
  );
}

export function Claim() {
  const { query } = useRoute();
  const token = query.get("token") ?? "";
  const { me, wid, setWid, reloadWs } = useSession();
  const [pick, setPick] = useState(wid);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<WorkspaceApp | { id: string; name: string }>();
  const fail = useFail();
  const [bad, setBad] = useState(false);

  if (!token) {
    return (
      <Empty icon="key" title="This claim link is missing its code" action={<Link to="/new" className="btn btn-default">Create an app instead</Link>}>
        Run <code>npx youasked init</code> again and open the link it prints.
      </Empty>
    );
  }
  if (bad) {
    return (
      <Empty icon="warn" title="That claim link has expired or was already used" action={<Link to="/new" className="btn btn-default">Create an app instead</Link>}>
        Run <code>npx youasked init</code> again to get a fresh link.
      </Empty>
    );
  }

  const claim = async () => {
    setBusy(true);
    try {
      const { app } = await api<{ app: { id: string; name: string } }>("/v1/dash/claim", { method: "POST", body: { claimToken: token, workspaceId: pick } });
      setWid(pick);
      setDone(app);
      await reloadWs();
      navigate(appUrl(app.id, "/install"), true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setBad(true);
      else fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="focus">
      <h1>Add your app to a workspace</h1>
      <p className="sub">The app you set up from the command line is waiting. Choose where it should live.</p>
      <div className="radio-list" role="radiogroup" aria-label="Workspace">
        {me.workspaces.map((w) => (
          <label key={w.id} className="radio-row" data-on={pick === w.id || undefined}>
            <input type="radio" name="ws" checked={pick === w.id} onChange={() => setPick(w.id)} />
            <span>
              <b>{w.name}</b>
              <small>{w.live ? "Subscribed" : "Test mode"} · you are {w.role === "owner" ? "the owner" : `an ${w.role}`}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="row">
        <Button kind="primary" onClick={claim} busy={busy} disabled={!pick || Boolean(done)}>Add app to workspace</Button>
      </div>
    </div>
  );
}

export function Invite() {
  const { query } = useRoute();
  const id = query.get("id") ?? "";
  const { reloadWs, setWid } = useSession();
  const inv = useLoad(() => api<{ invite: { id: string; workspace: string | { id: string; name: string }; role: string; accepted: boolean; expired: boolean } }>(`/v1/dash/invites/${id}`), [id]);
  const [busy, setBusy] = useState(false);
  const fail = useFail();
  if (inv.loading) return <div className="focus"><Skeleton rows={2} /></div>;
  if (inv.error != null || !inv.data) {
    return (
      <Empty icon="warn" title="We can't find that invite" action={<Link to="/" className="btn btn-default">Go to your apps</Link>}>
        It may have been canceled, or it was sent to a different email address than the one you're signed in with.
      </Empty>
    );
  }
  const i = inv.data.invite;
  const wsName = typeof i.workspace === "string" ? i.workspace : i.workspace.name;
  if (i.accepted || i.expired) {
    return (
      <Empty icon="clock" title={i.accepted ? "You already joined" : "This invite has expired"} action={<Link to="/" className="btn btn-default">Go to your apps</Link>}>
        {i.accepted ? `You're already a member of ${wsName}.` : "Ask a workspace admin to send a new one."}
      </Empty>
    );
  }
  return (
    <div className="focus">
      <h1>Join {wsName}</h1>
      <p className="sub">You've been invited as {i.role === "admin" ? "an admin" : "a member"}. You'll see its apps and requests.</p>
      <Button
        kind="primary"
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ workspace?: { id: string } }>(`/v1/dash/invites/${id}/accept`, { method: "POST" });
            if (r?.workspace?.id) setWid(r.workspace.id);
            await reloadWs();
            navigate("/", true);
          } catch (e) {
            fail(e);
            setBusy(false);
          }
        }}
      >
        Join workspace
      </Button>
    </div>
  );
}
