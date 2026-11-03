import { useEffect, useState } from "react";
import { appApi, type AppInfo, type WorkspaceApp } from "../api";
import { Button, ErrorState, Icon, PageHead, Skeleton, Switch, useFail, useLoad, useToast } from "../ui";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function Board({ app }: { app: WorkspaceApp }) {
  const info = useLoad(() => appApi<AppInfo>(app.id, "/app"), [app.id]);
  const [on, setOn] = useState(false);
  const [slug, setSlug] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const fail = useFail();

  useEffect(() => {
    const d = info.data;
    if (!d) return;
    setOn(Boolean(d.publicBoard));
    setSlug(d.slug ?? slugify(app.name));
    setDesc(d.description ?? "");
  }, [info.data, app.name]);

  const d = info.data;
  const slugOk = /^[a-z0-9-]{3,40}$/.test(slug);
  const dirty = d && (on !== Boolean(d.publicBoard) || slug !== (d.slug ?? slugify(app.name)) || desc !== (d.description ?? ""));

  const save = async () => {
    if (on && !slugOk) return toast("Use 3 to 40 lowercase letters, numbers or dashes for the address.", "error");
    setBusy(true);
    try {
      await appApi(app.id, "/app", { method: "PATCH", body: { slug, publicBoard: on, description: desc.trim() } });
      await info.reload();
      toast(on ? "Public board saved" : "Public board is off");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const url = `https://youasked.dev/${slug || "your-app"}`;
  return (
    <div className="page narrow">
      <PageHead title="Public board" sub="A page anyone can open to see what you're building and what just shipped, and to ask for things." />
      {info.error != null && <ErrorState error={info.error} retry={info.retry} />}
      {info.loading && !d && !info.error && <Skeleton rows={3} />}
      {d && (
        <div className="form">
          <div className="setting">
            <div>
              <h2>Show a public board</h2>
              <p className="muted">Search engines can find it, and people can share it.</p>
            </div>
            <Switch checked={on} onChange={setOn} label="Show a public board" />
          </div>

          <div className="setting stack-on" data-off={!on || undefined}>
            <div>
              <h2>Address</h2>
              <p className="muted">Lowercase letters, numbers and dashes.</p>
            </div>
            <div className="slug-field">
              <div className="slug" data-bad={(on && !slugOk) || undefined}>
                <span>youasked.dev/</span>
                <input aria-label="Board address" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} disabled={!on} spellCheck={false} />
              </div>
              {on && !slugOk && <p className="inline-error"><Icon name="warn" size={14} /> Use 3 to 40 letters, numbers or dashes.</p>}
            </div>
          </div>

          <div className="setting stack-on" data-off={!on || undefined}>
            <div>
              <h2>Description</h2>
              <p className="muted">Shown at the top of the board.</p>
            </div>
            <textarea className="input" rows={3} maxLength={300} disabled={!on} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={`What's coming next in ${app.name}`} aria-label="Board description" />
          </div>

          <div className="form-foot">
            <Button kind="primary" busy={busy} disabled={!dirty} onClick={save}>Save changes</Button>
            {d.publicBoard && d.slug && !dirty && (
              <a className="btn btn-default" href={d.publicUrl ?? url} target="_blank" rel="noreferrer">
                View your board <Icon name="ext" size={14} />
              </a>
            )}
            {on && slugOk && <span className="muted small">Will be live at <b>{url.replace("https://", "")}</b></span>}
          </div>
        </div>
      )}
    </div>
  );
}
