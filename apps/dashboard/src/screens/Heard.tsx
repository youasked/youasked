import { useEffect, useState, type KeyboardEvent } from "react";
import { ApiError, appApi, type Competitor, type ListeningConfig, type ListeningItem, type WorkspaceApp } from "../api";
import { RequestPicker } from "../components";
import { Link } from "../router";
import { useSession } from "../session";
import { Button, Dialog, Empty, ErrorState, Icon, PageHead, Skeleton, SourceIcon, sourceLabel, timeAgo, useFail, useLoad, useToast } from "../ui";

export function Heard({ app }: { app: WorkspaceApp }) {
  const { ws } = useSession();
  const noPlan = !ws!.workspace.live || (ws!.limits?.listeningApps ?? 0) === 0;
  const items = useLoad(() => (noPlan ? Promise.resolve(null) : appApi<{ items: ListeningItem[] }>(app.id, "/listening/inbox")), [app.id, noPlan]);
  const cfg = useLoad(() => (noPlan ? Promise.resolve(null) : appApi<ListeningConfig>(app.id, "/listening/config")), [app.id, noPlan]);
  const [setup, setSetup] = useState(false);
  const [mergeFor, setMergeFor] = useState<ListeningItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();
  const fail = useFail();
  const { bump } = useSession();

  // A plan check on the server is the source of truth, so a 402 shows the same upgrade card.
  const blocked = noPlan || [items.error, cfg.error].some((e) => e instanceof ApiError && (e.status === 402 || e.status === 403));
  if (blocked) {
    const solo = ws!.workspace.live;
    return (
      <div className="page">
        <PageHead title="Heard elsewhere" sub="Find feature requests in places your users talk about you." />
        <div className="upgrade">
          <span className="upgrade-icon"><Icon name="ear" size={22} /></span>
          <div>
            <h2>People are asking for things you never see</h2>
            <p>Every week we read App Store and Google Play reviews and Reddit for you and your competitors, pick out the feature requests, and put them here for you to approve. One tap turns a post into a request.</p>
            <ul className="ticks">
              <li><Icon name="check" size={15} /> Reviews for your app and your competitors</li>
              <li><Icon name="check" size={15} /> Reddit posts that match your keywords</li>
              <li><Icon name="check" size={15} /> Matched to requests you already have</li>
            </ul>
            <Link to="/billing" className="btn btn-primary">{solo ? "Upgrade to Pro" : "Pick a plan"}</Link>
            <p className="muted small">Included on Pro (1 app) and Studio (5 apps).</p>
          </div>
        </div>
      </div>
    );
  }

  const [scanning, setScanning] = useState(false);
  const scan = async () => {
    setScanning(true);
    try {
      await appApi(app.id, "/listening/run", { method: "POST" });
      toast("Scan started. New finds appear here in a minute or two.");
      setTimeout(() => items.reload(), 4000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) toast("You can scan once every 10 minutes. Try again soon.", "error");
      else fail(e);
    } finally {
      setScanning(false);
    }
  };
  const act = async (item: ListeningItem, action: "approve" | "dismiss" | "merge", requestId?: string) => {
    setBusy(item.id);
    try {
      await appApi(app.id, `/listening/inbox/${item.id}/${action}`, { method: "POST", body: requestId ? { requestId } : {} });
      items.set((x) => (x ? { items: x.items.filter((i) => i.id !== item.id) } : x));
      toast(action === "approve" ? "Added to your inbox as a new request" : action === "merge" ? "Merged into the existing request" : "Dismissed");
      if (action !== "dismiss") bump();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  const list = items.data?.items ?? [];
  const configured = cfg.data && (cfg.data.keywords.length || cfg.data.competitors.length || cfg.data.subreddits.length);

  return (
    <div className="page">
      <PageHead
        title="Heard elsewhere"
        sub="Feature requests found in reviews and on Reddit. Nothing is added until you approve it."
        actions={<><Button size="sm" kind="quiet" busy={scanning} onClick={scan}><Icon name="refresh" size={15} /> Scan now</Button><Button size="sm" onClick={() => setSetup(true)}><Icon name="cog" size={15} /> What we listen for</Button></>}
      />
      {items.error != null && <ErrorState error={items.error} retry={items.retry} />}
      {items.loading && !items.data && !items.error && <Skeleton rows={4} />}

      {items.data && list.length === 0 && (
        <Empty icon="ear" title={configured ? "Nothing new this week" : "Tell us what to listen for"} action={<Button kind="primary" onClick={() => setSetup(true)}>{configured ? "Edit what we listen for" : "Set up listening"}</Button>}>
          {configured ? "We check weekly. New posts and reviews appear here when we find a feature request." : "Add keywords, competitors and subreddits, and we'll look for feature requests every week."}
        </Empty>
      )}

      <ul className="heard">
        {list.map((it) => (
          <li key={it.id}>
            <div className="heard-head">
              <SourceIcon source={it.source} />
              <span className="heard-src">{sourceLabel(it.source)}</span>
              <span className="muted small">{timeAgo(it.createdAt)}</span>
              {it.strength !== undefined && <span className="strength" title="How clearly this asks for a feature"><i style={{ width: `${Math.round(it.strength * 100)}%` }} /></span>}
            </div>
            <blockquote>{it.text}</blockquote>
            <div className="heard-feature">
              <Icon name="spark" size={15} />
              <span><span className="muted">Suggested request:</span> <b>{it.feature}</b></span>
            </div>
            {it.matchedRequest && (
              <div className="heard-match">
                <Icon name="merge" size={14} /> Looks like <Link to={`/a/${app.id}/r/${it.matchedRequest.id}`}>{it.matchedRequest.ref ?? (it.matchedRequest.number ? `YA-${it.matchedRequest.number}` : "an existing request")}{it.matchedRequest.title ? `: ${it.matchedRequest.title}` : ""}</Link>
              </div>
            )}
            <div className="heard-actions">
              {it.matchedRequest ? (
                <Button size="sm" kind="primary" busy={busy === it.id} onClick={() => act(it, "merge", it.matchedRequest!.id)}>Add to that request</Button>
              ) : (
                <Button size="sm" kind="primary" busy={busy === it.id} onClick={() => act(it, "approve")}>Add as a request</Button>
              )}
              {it.matchedRequest ? (
                <Button size="sm" disabled={busy === it.id} onClick={() => act(it, "approve")}>Add as new</Button>
              ) : (
                <Button size="sm" disabled={busy === it.id} onClick={() => setMergeFor(it)}>Merge into existing</Button>
              )}
              {it.matchedRequest && <Button size="sm" kind="quiet" onClick={() => setMergeFor(it)}>Pick another</Button>}
              <Button size="sm" kind="quiet" disabled={busy === it.id} onClick={() => act(it, "dismiss")}>Dismiss</Button>
              <a className="btn btn-quiet btn-sm push" href={it.url} target="_blank" rel="noreferrer">Open original <Icon name="ext" size={13} /></a>
            </div>
          </li>
        ))}
      </ul>

      {mergeFor && (
        <Dialog title="Merge into an existing request" onClose={() => setMergeFor(null)}>
          <p className="muted">"{mergeFor.feature}" is added as a vote on the request you pick.</p>
          <RequestPicker appId={app.id} onPick={(r) => { const it = mergeFor; setMergeFor(null); act(it, "merge", r.id); }} />
        </Dialog>
      )}
      {setup && cfg.data && (
        <SetupDialog
          app={app}
          initial={cfg.data}
          onClose={() => setSetup(false)}
          onSaved={(c) => {
            cfg.set(() => c);
            setSetup(false);
            toast("Saved. We'll look for these on the next weekly scan.");
          }}
        />
      )}
    </div>
  );
}

function ChipInput({ label, values, onChange, placeholder, hint }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; hint: string }) {
  const [text, setText] = useState("");
  const add = () => {
    const parts = text.split(",").map((s) => s.trim().replace(/^r\//, "")).filter(Boolean);
    if (parts.length) onChange([...new Set([...values, ...parts])]);
    setText("");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div className="chips-input">
        {values.map((v) => (
          <span key={v} className="tagchip">
            {v}
            <button aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}><Icon name="x" size={12} /></button>
          </span>
        ))}
        <input value={text} placeholder={values.length ? "" : placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} onBlur={add} aria-label={label} />
      </div>
      <p className="hint">{hint}</p>
    </div>
  );
}

function SetupDialog({ app, initial, onClose, onSaved }: { app: WorkspaceApp; initial: ListeningConfig; onClose: () => void; onSaved: (c: ListeningConfig) => void }) {
  const [keywords, setKeywords] = useState(initial.keywords);
  const [subs, setSubs] = useState(initial.subreddits);
  const [comps, setComps] = useState<Competitor[]>(initial.competitors);
  const [busy, setBusy] = useState(false);
  const fail = useFail();
  useEffect(() => {
    if (!comps.length) setComps([{ name: "" }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setComp = (i: number, patch: Partial<Competitor>) => setComps((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    setBusy(true);
    const clean = comps.filter((c) => c.name.trim()).map((c) => ({ name: c.name.trim(), ...(c.appStoreId?.trim() ? { appStoreId: c.appStoreId.trim() } : {}), ...(c.playId?.trim() ? { playId: c.playId.trim() } : {}) }));
    const body: ListeningConfig = { ...initial, keywords, competitors: clean, subreddits: subs };
    try {
      await appApi(app.id, "/listening/config", { method: "PUT", body });
      onSaved(body);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  return (
    <Dialog title="What we listen for" onClose={onClose} wide>
      <ChipInput label="Keywords" values={keywords} onChange={setKeywords} placeholder="For example: task app, to-do list" hint="Phrases people use when they talk about apps like yours. Press enter after each." />
      <div className="field">
        <label>Competitors</label>
        <p className="hint top">We read their App Store and Google Play reviews. Add the store ids to include reviews.</p>
        {comps.map((c, i) => (
          <div key={i} className="comp-row">
            <input className="input" placeholder="Name" aria-label="Competitor name" value={c.name} onChange={(e) => setComp(i, { name: e.target.value })} />
            <input className="input" placeholder="App Store id" aria-label="App Store id" value={c.appStoreId ?? ""} onChange={(e) => setComp(i, { appStoreId: e.target.value })} />
            <input className="input" placeholder="Google Play id" aria-label="Google Play id" value={c.playId ?? ""} onChange={(e) => setComp(i, { playId: e.target.value })} />
            <button className="icon-btn" aria-label="Remove competitor" onClick={() => setComps((x) => x.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
          </div>
        ))}
        <Button size="sm" kind="quiet" onClick={() => setComps((c) => [...c, { name: "" }])}><Icon name="plus" size={14} /> Add competitor</Button>
      </div>
      <ChipInput label="Subreddits" values={subs} onChange={setSubs} placeholder="For example: productivity" hint="Without the r/. We read new posts that match your keywords." />
      <div className="dialog-actions">
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={save}>Save</Button>
      </div>
    </Dialog>
  );
}
