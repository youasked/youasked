import { useState } from "react";
import { api, appApi, type Req, type WorkspaceApp } from "../api";
import { Link } from "../router";
import { appUrl } from "../session";
import { Button, CopyButton, Dialog, Icon, PageHead, useFail, useInterval, useLoad } from "../ui";
import { secretStore } from "./FirstRun";

export const setupPrompt = (name: string, publicKey: string) =>
  `Add YouAsked to ${name} so people can ask for features, vote, and hear when what they asked for ships.

Read https://youasked.dev/install.md and follow it from start to finish:
1. Before changing anything, work out the platforms (web, React Native or Expo, or both) and how the app is laid out.
2. Propose where the entry points should go and why, and whether users will be signed in. Wait for my OK, and ask me anything you can't tell from the code.
3. Set it up with \`npx youasked init --key ${publicKey}\` (my publishable key; it's safe in client code). The secret key is only for the server: ask me for it, keep it out of git, and never ship it in the app.
4. Sign users on the server if the app has sign-in, and match our theme in light and dark.
5. Test every entry point on localhost or a dev build (test mode works there).
6. Finish with what changed, where each entry point lives, and what I need to do to go live.`;

export function Install({ app }: { app: WorkspaceApp }) {
  const cmd = `npx youasked init --key ${app.publicKey}`;
  const prompt = setupPrompt(app.name, app.publicKey);
  const [secret, setSecret] = useState(() => secretStore.get(app.id));
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const fail = useFail();

  // Watch for the first request, so the screen flips by itself when the widget reaches us.
  const seen = useLoad(() => appApi<{ requests: Req[] }>(app.id, "/requests?status=all"), [app.id]);
  useInterval(() => seen.reload(), seen.data?.requests.length ? null : 3000);
  const connected = (seen.data?.requests.length ?? 0) > 0;

  const rotate = async () => {
    setRotating(true);
    try {
      const { secretKey } = await api<{ secretKey: string }>(`/v1/dash/apps/${app.id}/rotate-secret`, { method: "POST" });
      secretStore.set(app.id, secretKey);
      setSecret(secretKey);
      setConfirmRotate(false);
    } catch (e) {
      fail(e);
    } finally {
      setRotating(false);
    }
  };
  const hide = () => {
    secretStore.set(app.id, null);
    setSecret(null);
  };

  return (
    <div className="page narrow">
      <PageHead title={`Install YouAsked in ${app.name}`} sub="Two ways to do it. Either one takes about a minute." />

      <div className="status-line" data-ok={connected || undefined} role="status">
        <span className="pulse" />
        <b>{connected ? "Connected" : "Waiting for the first request"}</b>
        <span>{connected ? "Your app is talking to YouAsked." : "Open your app and send a test request. This updates by itself."}</span>
      </div>

      <section className="block">
        <h2>1. Paste this into Claude Code, Codex or Cursor</h2>
        <p className="muted">Your coding agent reads the guide, adds the widget and sets the keys.</p>
        <div className="codebox">
          <pre>{prompt}</pre>
          <CopyButton text={prompt} label="Copy prompt" className="codebox-copy" />
        </div>
      </section>

      <section className="block">
        <h2>2. Or run one command</h2>
        <p className="muted">In your project folder. It detects your framework and writes the keys for you.</p>
        <div className="cmdline">
          <code><span>$</span> {cmd}</code>
          <CopyButton text={cmd} />
        </div>
      </section>

      <section className="block">
        <h2>Your keys</h2>
        <dl className="keys">
          <div>
            <dt>Publishable key</dt>
            <dd>
              <code>{app.publicKey}</code>
              <CopyButton text={app.publicKey} />
            </dd>
            <p className="hint">Safe to put in your app's code.</p>
          </div>
          <div>
            <dt>Secret key</dt>
            <dd>
              {secret ? (
                <>
                  <code className="reveal">{secret}</code>
                  <CopyButton text={secret} />
                </>
              ) : (
                <>
                  <code className="masked">{app.secretKeyHint ?? "ya_sec_••••••••••••"}</code>
                  <Button size="sm" kind="quiet" onClick={() => setConfirmRotate(true)}>
                    <Icon name="refresh" size={15} /> Rotate
                  </Button>
                </>
              )}
            </dd>
            {secret ? (
              <p className="hint warn">
                <Icon name="lock" size={14} /> Copy it now. We only show it once, then it's hidden.{" "}
                <button className="linklike" onClick={hide}>I've saved it</button>
              </p>
            ) : (
              <p className="hint">Server only, never in client code. Lost it? Rotate to make a new one; the old one stops working.</p>
            )}
          </div>
        </dl>
      </section>

      <div className="note-line">
        <Icon name="clock" size={16} />
        <span><b>Test mode:</b> it works on localhost until you pick a plan.</span>
        <Link to="/billing">See plans</Link>
      </div>

      <div className="row">
        <Link to={appUrl(app.id)} className="btn btn-primary">{connected ? "Open your inbox" : "Skip to your inbox"}</Link>
        {!secret && <span className="muted small">You can come back to this page from Settings.</span>}
      </div>

      {confirmRotate && (
        <Dialog title="Rotate the secret key?" onClose={() => setConfirmRotate(false)}>
          <p>The current key stops working straight away. Anything using it, like your server or the MCP setup, needs the new one.</p>
          <div className="dialog-actions">
            <Button kind="quiet" onClick={() => setConfirmRotate(false)}>Cancel</Button>
            <Button kind="primary" busy={rotating} onClick={rotate}>Rotate key</Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
