import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, appApi, download, type AppInfo, type WorkspaceApp } from "../api";
import { Link } from "../router";
import { appUrl, useSession } from "../session";
import { Button, CopyButton, Dialog, ErrorState, Icon, PageHead, Skeleton, Switch, useFail, useLoad, useToast } from "../ui";
import { secretStore } from "./FirstRun";

const NUDGE_DEFAULTS = { everyDays: 7, activeSeconds: 30, skipVisits: 1, message: null, position: "bottom" as const };

function Row({ title, hint, children, stack }: { title: string; hint?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`setting ${stack ? "stack-on" : ""}`}>
      <div>
        <h3>{title}</h3>
        {hint && <p className="muted">{hint}</p>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

export function Settings({ app }: { app: WorkspaceApp }) {
  const { ws, reloadWs } = useSession();
  const info = useLoad(() => appApi<AppInfo>(app.id, "/app"), [app.id]);
  const toast = useToast();
  const fail = useFail();
  const d = info.data;

  const [name, setName] = useState("");
  const [origins, setOrigins] = useState("");
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [dialog, setDialog] = useState<"rotate" | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!d) return;
    setName(d.name);
    setOrigins((d.allowedOrigins ?? []).join("\n"));
    setNudgeMessage(d.nudge?.message ?? "");
  }, [d]);

  const patch = async (body: Partial<Record<string, unknown>>, ok?: string) => {
    try {
      await appApi(app.id, "/app", { method: "PATCH", body });
      info.set((x) => ({ ...x, ...(body as Partial<AppInfo>) }));
      if (body.name) await reloadWs();
      if (ok) toast(ok);
    } catch (e) {
      fail(e);
      info.reload();
    }
  };

  const canRemoveBranding = Boolean(ws!.limits?.removeBranding);
  const originsList = origins.split(/[\s,]+/).filter(Boolean);
  const originsDirty = d && originsList.join("\n") !== (d.allowedOrigins ?? []).join("\n");

  return (
    <div className="page narrow">
      <PageHead title="Settings" sub={`For ${app.name}`} actions={<Link to={appUrl(app.id, "/install")} className="btn btn-quiet btn-sm"><Icon name="bolt" size={15} /> Install guide</Link>} />
      {info.error != null && <ErrorState error={info.error} retry={info.retry} />}
      {info.loading && !d && !info.error && <Skeleton rows={6} />}
      {d && (
        <div className="form">
          <h2 className="group">General</h2>
          <Row title="App name" hint="Your replies show up under this name." stack>
            <div className="inline-form">
              <input className="input" aria-label="App name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
              <Button disabled={!name.trim() || name.trim() === d.name} onClick={() => patch({ name: name.trim() }, "Name saved")}>Save</Button>
            </div>
          </Row>
          <Row title="Approve requests before they're public" hint="New requests wait in your inbox until you approve them. Good against spam.">
            <Switch label="Approve requests before they're public" checked={d.moderation === "approve"} onChange={(v) => patch({ moderation: v ? "approve" : "off" }, v ? "New requests now wait for approval" : "New requests go public straight away")} />
          </Row>
          <Row
            title={'Show "Feedback by YouAsked"'}
            hint={canRemoveBranding ? "A small line at the bottom of the sheet. Turn it off for a cleaner look." : <>A small line at the bottom of the sheet. Pro and Studio can turn it off. <Link to="/billing">See plans</Link></>}
          >
            <Switch label={'Show "Feedback by YouAsked"'} checked={canRemoveBranding ? d.watermark : true} disabled={!canRemoveBranding} onChange={(v) => patch({ watermark: v }, v ? "The line is back" : "The line is hidden")} />
            {!canRemoveBranding && <Icon name="lock" size={15} className="lock" />}
          </Row>

          <h2 className="group">Occasional prompt</h2>
          <Row
            title="Ask people for ideas now and then"
            hint={`A small card that asks "Got an idea for ${d.name}?". It waits until someone has been using your app for a while, never shows next to a reply, and backs off each time they tap Not now.`}
          >
            <Switch
              label="Ask people for ideas now and then"
              checked={Boolean(d.nudge)}
              onChange={(v) => patch({ nudge: v ? NUDGE_DEFAULTS : null }, v ? "The prompt is on" : "The prompt is off")}
            />
          </Row>
          {d.nudge && (
            <>
              <Row title="Show it at most once every">
                <select className="input" aria-label="Show it at most once every" value={d.nudge.everyDays} onChange={(e) => patch({ nudge: { ...d.nudge!, everyDays: Number(e.target.value) } }, "Saved")}>
                  {[1, 3, 7, 14, 30].map((n) => (
                    <option key={n} value={n}>{n === 1 ? "day" : `${n} days`}</option>
                  ))}
                </select>
              </Row>
              <Row title="After they've used your app for" hint="Only time with your app open in front of them counts.">
                <select className="input" aria-label="After they've used your app for" value={d.nudge.activeSeconds} onChange={(e) => patch({ nudge: { ...d.nudge!, activeSeconds: Number(e.target.value) } }, "Saved")}>
                  {[10, 30, 60, 120].map((n) => (
                    <option key={n} value={n}>{n < 60 ? `${n} seconds` : n === 60 ? "1 minute" : "2 minutes"}</option>
                  ))}
                </select>
              </Row>
              <Row title="Skip their first" hint="New people get to look around before anyone asks them anything.">
                <select className="input" aria-label="Skip their first" value={d.nudge.skipVisits} onChange={(e) => patch({ nudge: { ...d.nudge!, skipVisits: Number(e.target.value) } }, "Saved")}>
                  {[0, 1, 2, 4].map((n) => (
                    <option key={n} value={n}>{n === 0 ? "No visits (ask on the first)" : n === 1 ? "1 visit" : `${n} visits`}</option>
                  ))}
                </select>
              </Row>
              <Row title="Where it shows">
                <select className="input" aria-label="Where it shows" value={d.nudge.position} onChange={(e) => patch({ nudge: { ...d.nudge!, position: e.target.value as "bottom" | "top" } }, "Saved")}>
                  <option value="bottom">Bottom of the screen</option>
                  <option value="top">Top of the screen</option>
                </select>
              </Row>
              <Row title="Headline" hint="Leave empty for the default." stack>
                <div className="inline-form">
                  <input className="input" aria-label="Headline" value={nudgeMessage} maxLength={120} placeholder={`Got an idea for ${d.name}?`} onChange={(e) => setNudgeMessage(e.target.value)} />
                  <Button disabled={nudgeMessage.trim() === (d.nudge.message ?? "")} onClick={() => patch({ nudge: { ...d.nudge!, message: nudgeMessage.trim() || null } }, "Headline saved")}>Save</Button>
                </div>
              </Row>
            </>
          )}

          <h2 className="group">Who can ask</h2>
          <Row title="Require signed users" hint="Only people your app signs in can ask and vote. Your server signs each user with the secret key.">
            <Switch label="Require signed users" checked={d.requireSignature} onChange={(v) => patch({ requireSignature: v }, v ? "Only signed users can ask now" : "Anyone can ask now")} />
          </Row>
          <Row title="Allowed origins" hint="Websites that may use your publishable key, one per line. Leave empty to allow any website." stack>
            <textarea className="input mono" rows={3} placeholder={"https://acme.app\nhttps://staging.acme.app"} aria-label="Allowed origins" value={origins} onChange={(e) => setOrigins(e.target.value)} />
            <div className="row">
              <Button disabled={!originsDirty} onClick={() => patch({ allowedOrigins: originsList.length ? originsList : null }, "Origins saved")}>Save origins</Button>
            </div>
          </Row>

          <h2 className="group">Keys</h2>
          <Row title="Publishable key" hint="Safe to put in your app's code.">
            <div className="cmdline"><code>{app.publicKey}</code><CopyButton text={app.publicKey} /></div>
          </Row>
          <Row title="Secret key" hint="Server only. Rotating makes a new key and the old one stops working straight away.">
            <Button onClick={() => setDialog("rotate")}><Icon name="refresh" size={15} /> Rotate secret key</Button>
          </Row>

          <h2 className="group">Move your data</h2>
          <Import app={app} />
          <Row title="Export" hint="Everything you have: requests, votes and replies.">
            <div className="row">
              <Button onClick={() => download(app.id, "csv").catch(fail)}><Icon name="download" size={15} /> CSV</Button>
              <Button onClick={() => download(app.id, "json").catch(fail)}><Icon name="download" size={15} /> JSON</Button>
            </div>
          </Row>

        </div>
      )}

      {dialog === "rotate" && (
        <Dialog title="Rotate the secret key?" onClose={() => (setDialog(null), setNewSecret(null))}>
          {newSecret ? (
            <>
              <p>Here's the new key. Copy it now, we only show it once.</p>
              <div className="cmdline"><code>{newSecret}</code><CopyButton text={newSecret} /></div>
              <div className="dialog-actions"><Button kind="primary" onClick={() => (setDialog(null), setNewSecret(null))}>Done</Button></div>
            </>
          ) : (
            <>
              <p>The current key stops working straight away. Anything using it, like your server or the MCP setup, needs the new one.</p>
              <div className="dialog-actions">
                <Button kind="quiet" onClick={() => setDialog(null)}>Cancel</Button>
                <Button
                  kind="primary"
                  onClick={async () => {
                    try {
                      const r = await api<{ secretKey: string }>(`/v1/dash/apps/${app.id}/rotate-secret`, { method: "POST" });
                      secretStore.set(app.id, null);
                      setNewSecret(r.secretKey);
                    } catch (e) {
                      fail(e);
                    }
                  }}
                >
                  Rotate key
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
}

function Import({ app }: { app: WorkspaceApp }) {
  const [source, setSource] = useState("canny");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number }>();
  const input = useRef<HTMLInputElement>(null);
  const { bump } = useSession();
  const fail = useFail();
  const go = async () => {
    if (!file) return;
    setBusy(true);
    setResult(undefined);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("source", source);
      setResult(await appApi<{ imported: number; skipped: number }>(app.id, "/import", { method: "POST", form }));
      setFile(null);
      if (input.current) input.current.value = "";
      bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Row title="Import" hint="Bring your requests and votes from another tool. Export a file from there, then upload it here." stack>
      <div className="import-row">
        <select className="input" aria-label="Import from" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="canny">Canny</option>
          <option value="featurebase">Featurebase</option>
          <option value="csv">CSV file</option>
        </select>
        <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="file" aria-label="File to import" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button busy={busy} disabled={!file} onClick={go}><Icon name="upload" size={15} /> Import</Button>
      </div>
      {result && (
        <p className="result-line" role="status">
          <Icon name="check" size={15} /> Imported {result.imported} {result.imported === 1 ? "request" : "requests"}
          {result.skipped > 0 && <>, skipped {result.skipped} that already exist or were empty</>}.
        </p>
      )}
    </Row>
  );
}

