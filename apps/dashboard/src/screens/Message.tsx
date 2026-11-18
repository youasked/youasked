import { useEffect, useMemo, useRef, useState } from "react";
import { appApi, uploadAvatar, type AppInfo, type WorkspaceApp } from "../api";
import { useSession } from "../session";
import { Button, ErrorState, Icon, PageHead, Skeleton, Switch, useFail, useLoad, useToast } from "../ui";

const NUDGE_DEFAULTS = { everyDays: 7, activeSeconds: 30, skipVisits: 1, message: null, position: "bottom" as const };
type Nudge = NonNullable<AppInfo["nudge"]>;
type Text = { name: string; role: string; message: string; intro: string };

const LIMITS = { name: 40, role: 60, message: 200, intro: 600 };

/** Square, 320px, webp: small enough to load instantly in the corner, sharp on any screen. */
async function squarePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 320, 320);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("bad_image"))), "image/webp", 0.88));
}

export function MessageSetup({ app }: { app: WorkspaceApp }) {
  const { me } = useSession();
  const info = useLoad(() => appApi<AppInfo>(app.id, "/app"), [app.id]);
  const toast = useToast();
  const fail = useFail();
  const d = info.data;

  const saved: Text = useMemo(
    () => ({ name: d?.persona?.name ?? "", role: d?.persona?.role ?? "", message: d?.nudge?.message ?? "", intro: d?.persona?.intro ?? "" }),
    [d],
  );
  const [text, setText] = useState<Text>(saved);
  useEffect(() => setText(saved), [saved]);
  const dirty = (Object.keys(LIMITS) as (keyof Text)[]).some((k) => text[k].trim() !== saved[k].trim());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [view, setView] = useState<"corner" | "chat">("corner");
  const [replay, setReplay] = useState(0);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameReady, setFrameReady] = useState(false);

  const patch = async (body: Record<string, unknown>, ok?: string) => {
    try {
      await appApi(app.id, "/app", { method: "PATCH", body });
      info.reload();
      if (ok) toast(ok);
    } catch (e) {
      fail(e);
    }
  };

  const save = async () => {
    setSaving(true);
    const body: Record<string, unknown> = {
      persona: { name: text.name.trim() || null, role: text.role.trim() || null, intro: text.intro.trim() || null },
    };
    if (d?.nudge) body.nudge = { ...d.nudge, message: text.message.trim() || null };
    await patch(body, "Your message is saved");
    setSaving(false);
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAvatar(app.id, await squarePhoto(file));
      info.reload();
      toast("Photo saved");
    } catch (e) {
      fail(e);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // The preview gets every keystroke.
  const firstName = me?.account.name?.trim().split(/\s+/)[0];
  const draft = d && {
    appName: d.name,
    persona: { name: text.name.trim() || null, role: text.role.trim() || null, avatar: d.persona?.avatar ?? null, intro: text.intro.trim() || null },
    message: text.message.trim() || null,
    place: d.nudge?.position ?? "bottom",
    popup: Boolean(d.nudge),
    view,
    replay,
  };
  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === "ya-preview-ready") setFrameReady(true);
    };
    addEventListener("message", onReady);
    return () => removeEventListener("message", onReady);
  }, []);
  const draftKey = JSON.stringify(draft);
  useEffect(() => {
    if (frameReady && draft) frameRef.current?.contentWindow?.postMessage({ type: "ya-preview", draft }, location.origin);
  }, [frameReady, draftKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const field = (k: keyof Text) => ({
    value: text[k],
    maxLength: LIMITS[k],
    onChange: (e: { target: { value: string } }) => setText((t) => ({ ...t, [k]: e.target.value })),
  });
  const timing = (key: keyof Nudge, value: number | string) => patch({ nudge: { ...d!.nudge!, [key]: value } }, "Saved");

  return (
    <div className="page">
      <PageHead title="Your message" sub={`A message from you in the corner of ${app.name}, and a welcome note when the chat opens. People reply to a person, not a form.`} />
      {info.error != null && <ErrorState error={info.error} retry={info.retry} />}
      {info.loading && !d && !info.error && <Skeleton rows={6} />}
      {d && draft && (
        <div className="msg-setup">
          <div className="msg-form">
            <section className="msg-card">
              <h2>From you</h2>
              <div className="msg-photo">
                <span className="msg-avatar">
                  {d.persona?.avatar ? <img src={d.persona.avatar} alt="" /> : <span>{(text.name.trim() || d.name).charAt(0).toUpperCase()}</span>}
                </span>
                <div className="msg-photo-actions">
                  <div className="row">
                    <Button size="sm" busy={uploading} onClick={() => fileRef.current?.click()}>
                      <Icon name="upload" size={15} /> {d.persona?.avatar ? "Change photo" : "Add your photo"}
                    </Button>
                    {d.persona?.avatar && (
                      <Button size="sm" kind="quiet" onClick={() => patch({ persona: { avatar: null } }, "Photo removed")}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="muted">A clear photo of your face. Without one, people see your initial.</p>
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
              </div>
              <div className="msg-fields">
                <label className="msg-field">
                  <span>Your name</span>
                  <input className="input" placeholder={firstName ?? "Your first name"} {...field("name")} />
                </label>
                <label className="msg-field">
                  <span>
                    Next to your name <em className="optional">optional</em>
                  </span>
                  <input className="input" placeholder={`Made ${d.name}`} {...field("role")} />
                </label>
              </div>
            </section>

            <section className="msg-card">
              <div className="msg-card-head">
                <div>
                  <h2>Message in the corner</h2>
                  <p className="muted">Pops up now and then, like a text. Tapping it opens the chat.</p>
                </div>
                <Switch
                  label="Pop up the message now and then"
                  checked={Boolean(d.nudge)}
                  onChange={(v) => patch({ nudge: v ? { ...NUDGE_DEFAULTS, message: text.message.trim() || null } : null }, v ? "The message is on" : "The message is off")}
                />
              </div>
              {d.nudge ? (
                <>
                  <label className="msg-field">
                    <span>The message</span>
                    <textarea className="input" rows={3} placeholder={`Hey! Got an idea for ${d.name}, or something not working? Tell ${text.name.trim() ? "me" : "us"} here.`} {...field("message")} />
                    <small className="msg-count">{text.message.length}/{LIMITS.message}</small>
                  </label>
                  <div className="msg-timing">
                    <label className="msg-field">
                      <span>After they've used {d.name} for</span>
                      <select className="input" value={d.nudge.activeSeconds} onChange={(e) => timing("activeSeconds", Number(e.target.value))}>
                        {[10, 30, 60, 120].map((n) => (
                          <option key={n} value={n}>{n < 60 ? `${n} seconds` : n === 60 ? "1 minute" : "2 minutes"}</option>
                        ))}
                      </select>
                    </label>
                    <label className="msg-field">
                      <span>At most once every</span>
                      <select className="input" value={d.nudge.everyDays} onChange={(e) => timing("everyDays", Number(e.target.value))}>
                        {[1, 3, 7, 14, 30].map((n) => (
                          <option key={n} value={n}>{n === 1 ? "day" : `${n} days`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="msg-field">
                      <span>Skip their first</span>
                      <select className="input" value={d.nudge.skipVisits} onChange={(e) => timing("skipVisits", Number(e.target.value))}>
                        {[0, 1, 2, 4].map((n) => (
                          <option key={n} value={n}>{n === 0 ? "No visits" : n === 1 ? "1 visit" : `${n} visits`}</option>
                        ))}
                      </select>
                    </label>
                    <label className="msg-field">
                      <span>Where</span>
                      <select className="input" value={d.nudge.position} onChange={(e) => timing("position", e.target.value)}>
                        <option value="bottom">Bottom corner</option>
                        <option value="top">Top corner</option>
                      </select>
                    </label>
                  </div>
                  <p className="muted msg-small">It never shows next to a reply, and backs off each time someone closes it.</p>
                </>
              ) : (
                <p className="muted msg-off">Off. People can still open the chat from the corner button or your own buttons.</p>
              )}
            </section>

            <section className="msg-card">
              <h2>Welcome note</h2>
              <p className="muted">The first thing they read when the chat opens. Say who you are, why you built it, and how quickly you reply.</p>
              <label className="msg-field">
                <span className="sr-only">Welcome note</span>
                <textarea
                  className="input"
                  rows={5}
                  placeholder={`I built ${d.name} because I wanted it myself. Tell me what's missing or what's broken. I read every message and usually reply within a few hours.`}
                  {...field("intro")}
                />
                <small className="msg-count">{text.intro.length}/{LIMITS.intro}</small>
              </label>
            </section>

            <div className="msg-save" data-dirty={dirty || undefined}>
              <span className="muted">{dirty ? "Unsaved changes. The preview already shows them." : "Saved"}</span>
              <Button kind="primary" busy={saving} disabled={!dirty} onClick={save}>
                Save
              </Button>
            </div>
          </div>

          <aside className="msg-preview" aria-label="Preview">
            <div className="msg-seg" role="tablist" aria-label="What to preview">
              <button type="button" role="tab" aria-selected={view === "corner"} onClick={() => (setView("corner"), setReplay((n) => n + 1))}>
                In the corner
              </button>
              <button type="button" role="tab" aria-selected={view === "chat"} onClick={() => (setView("chat"), setReplay((n) => n + 1))}>
                In the chat
              </button>
            </div>
            <div className="msg-screen">
              <iframe ref={frameRef} src="/preview.html" title="Preview of your message" />
            </div>
            <button type="button" className="msg-replay" onClick={() => setReplay((n) => n + 1)}>
              <Icon name="refresh" size={14} /> Play it again
            </button>
            <p className="muted msg-small">Shows in @youasked/react 0.9 and @youasked/js 0.3 and later.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

