import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { appApi, uploadReplyImage, type Attachment, type ClientInfo, type Req, type Status } from "./api";
import { Button, CopyButton, Dialog, Icon, STATUS_LABEL, StatusChip, useFail, useKeepInView, useNarrow } from "./ui";

export const PICKABLE: Status[] = ["open", "planned", "in_progress", "shipped", "declined"];

/** A popover listing statuses. The caller controls when it is open, so the keyboard shortcut can open it too. */
export function StatusPopover({ current, onPick, onClose }: { current: Status; onPick: (s: Status) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const narrow = useNarrow();
  useKeepInView(ref, !narrow);
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const n = Number(e.key);
      if (n >= 1 && n <= PICKABLE.length) {
        e.preventDefault();
        onPick(PICKABLE[n - 1]);
      }
    };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [onClose, onPick]);
  const menu = (
    <div className="menu status-menu" role="menu" aria-label="Set status" ref={ref} data-align="right" data-sheet={narrow || undefined}>
      {narrow && <div className="sheet-grab" />}
      <div className="menu-note">{narrow ? "Set status" : "Change status"} <span className="kbd-hint">press 1 to 5</span></div>
      {PICKABLE.map((s, i) => (
        <button key={s} role="menuitem" className="menu-item" data-active={s === current || undefined} onClick={() => onPick(s)}>
          <StatusChip status={s} />
          <span className="spacer" />
          {s === current && <Icon name="check" size={16} className="tick" />}
          <kbd>{i + 1}</kbd>
        </button>
      ))}
    </div>
  );
  // On a phone the menu is a bottom sheet, rendered on the body so no ancestor can clip or offset it.
  return narrow ? createPortal(<div className="scrim sheet-scrim status-scrim">{menu}</div>, document.body) : menu;
}

/** "Mark shipped" asks for an optional note, which goes to everyone who asked. */
export function ShipDialog({ appId, request, onClose, onDone }: { appId: string; request: Req; onClose: () => void; onDone: (r: Req) => void }) {
  const [note, setNote] = useState(request.shipNote ?? "");
  const [busy, setBusy] = useState(false);
  const fail = useFail();
  const ship = async () => {
    setBusy(true);
    try {
      const res = await appApi<{ request: Req }>(appId, `/requests/${request.id}`, { method: "PATCH", body: { status: "shipped", shipNote: note.trim() || null } });
      onDone({ ...request, ...res.request });
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  return (
    <Dialog title={`Mark YA-${request.number} as shipped`} onClose={onClose}>
      <p className="muted">Everyone who asked for "{request.title}" is told it's live{request.votes > 1 ? ` (${request.votes} people)` : ""}. Add a line about what they'll find.</p>
      <textarea className="input" rows={3} autoFocus maxLength={500} placeholder="Optional. For example: it's in Settings, under Appearance." value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="dialog-actions">
        <Button kind="quiet" onClick={onClose}>Cancel</Button>
        <Button kind="primary" busy={busy} onClick={ship}>
          <Icon name="flag" size={15} /> Mark shipped
        </Button>
      </div>
    </Dialog>
  );
}

/** Search for a request by title or YA number. Used to merge, and to match a post from Heard elsewhere. */
export function RequestPicker({ appId, excludeId, onPick, placeholder = "Search by title or YA number" }: { appId: string; excludeId?: string; onPick: (r: { id: string; number: number; title: string; votes: number; status: Status }) => void; placeholder?: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; number: number; title: string; votes: number; status: Status }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const t = setTimeout(() => {
      appApi<{ requests: typeof hits }>(appId, `/search?q=${encodeURIComponent(term)}`)
        .then((r) => setHits(r.requests.filter((x) => x.id !== excludeId)))
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q, appId, excludeId]);
  return (
    <div className="picker">
      <div className="search-field">
        <Icon name="search" size={16} />
        <input autoFocus className="input bare-input" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requests" />
      </div>
      <ul className="picker-list">
        {hits.map((h) => (
          <li key={h.id}>
            <button onClick={() => onPick(h)}>
              <span className="ya">YA-{h.number}</span>
              <span className="grow">{h.title}</span>
              <span className="muted small">{h.votes} {h.votes === 1 ? "vote" : "votes"}</span>
            </button>
          </li>
        ))}
        {q.trim().length >= 2 && !hits.length && !busy && <li className="picker-empty">No matching requests. Try a different word.</li>}
        {q.trim().length < 2 && <li className="picker-empty">Type at least two letters.</li>}
      </ul>
    </div>
  );
}

export { STATUS_LABEL };

const REPLY_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_REPLY_IMAGES = 4;
const MAX_REPLY_BYTES = 2 * 1024 * 1024;
type Picked = { key: number; blob: Blob; url: string };
let pickKey = 1;

/** Up to 4 images for a reply: pick, paste or drop them. `uploadAll` sends them and gives back the ids. */
export function useReplyImages(appId: string) {
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const live = useRef(picked);
  live.current = picked;
  useEffect(() => () => live.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (!images.length) return;
    const typed = images.filter((f) => REPLY_TYPES.includes(f.type));
    const sized = typed.filter((f) => f.size <= MAX_REPLY_BYTES);
    setError(typed.length < images.length ? "Use a PNG, JPEG or WebP image." : sized.length < typed.length ? "Images can be up to 2 MB each." : null);
    setPicked((cur) => [...cur, ...sized.slice(0, Math.max(0, MAX_REPLY_IMAGES - cur.length)).map((blob) => ({ key: pickKey++, blob, url: URL.createObjectURL(blob) }))]);
  };
  const remove = (key: number) =>
    setPicked((cur) => {
      cur.filter((p) => p.key === key).forEach((p) => URL.revokeObjectURL(p.url));
      return cur.filter((p) => p.key !== key);
    });
  const clear = () => {
    picked.forEach((p) => URL.revokeObjectURL(p.url));
    setPicked([]);
    setError(null);
  };
  const uploadAll = async (): Promise<string[]> => Promise.all(picked.map((p) => uploadReplyImage(appId, p.blob).then((a) => a.id)));
  /** Props for the box the images can be dropped on, and for the textarea (paste). */
  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      if (Array.from(e.dataTransfer.types).includes("Files")) {
        e.preventDefault();
        setOver(true);
      }
    },
    onDragLeave: () => setOver(false),
    onDrop: (e: React.DragEvent) => {
      setOver(false);
      if (e.dataTransfer.files.length) {
        e.preventDefault();
        add(Array.from(e.dataTransfer.files));
      }
    },
  };
  const pasteProps = {
    onPaste: (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files);
      if (files.some((f) => f.type.startsWith("image/"))) {
        e.preventDefault();
        add(files);
      }
    },
  };
  return { picked, add, remove, clear, uploadAll, over, error, setError, dropProps, pasteProps, full: picked.length >= MAX_REPLY_IMAGES };
}

/** The thumbnails waiting to go out, and the button that picks more. */
export function ReplyImageTray({ images, disabled }: { images: ReturnType<typeof useReplyImages>; disabled?: boolean }) {
  return images.picked.length === 0 && !images.error ? null : (
    <div className="reply-tray">
      {images.picked.length > 0 && (
        <ul className="reply-thumbs" aria-label="Images to send">
          {images.picked.map((p, i) => (
            <li key={p.key}>
              <img src={p.url} alt={`Image ${i + 1}`} />
              <button type="button" className="reply-thumb-x" aria-label={`Remove image ${i + 1}`} onClick={() => images.remove(p.key)} disabled={disabled}>
                <Icon name="x" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {images.error && <p className="small reply-error" role="alert">{images.error}</p>}
    </div>
  );
}

export function AttachButton({ images, disabled }: { images: ReturnType<typeof useReplyImages>; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          images.add(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <Button size="sm" kind="quiet" disabled={disabled || images.full} onClick={() => input.current?.click()} title="Attach images (or paste or drop them). Up to 4, 2 MB each.">
        <Icon name="image" size={15} /> Attach
      </Button>
    </>
  );
}

/** Images in a message, as thumbnails that open the full size. */
export function Pictures({ files }: { files?: Attachment[] }) {
  if (!files?.length) return null;
  return (
    <span className="cv-shots">
      {files.map((a, i) => (
        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" aria-label={`Open image ${i + 1} full size`}>
          <img src={a.url} alt={`Image ${i + 1}`} loading="lazy" />
        </a>
      ))}
    </span>
  );
}

const PLATFORM_NAMES: Record<string, string> = { ios: "iOS app", android: "Android app", web: "Web", macos: "Mac app", windows: "Windows app" };

/**
 * What the person was using when they asked: the app and its version, then the phone or browser.
 * Sent automatically by the SDKs (browsers: from the User-Agent). Nothing shows for older requests.
 */
export function ClientFacts({ client }: { client?: ClientInfo | null }) {
  if (!client) return null;
  const name = client.platform ? PLATFORM_NAMES[client.platform] : client.app ? "App" : null;
  const app = name ? `${name}${client.app ? ` ${client.app}` : ""}${client.build ? ` (${client.build})` : ""}` : null;
  const device = client.browser
    ? [client.browser, client.os && `on ${client.os}`].filter(Boolean).join(" ") + (client.device ? ` · ${client.device}` : "")
    : [client.device, client.os].filter(Boolean).join(" · ");
  return (
    <>
      {app && <div><dt>App</dt><dd>{app}</dd></div>}
      {device && <div><dt>Device</dt><dd>{device}{client.sdk && <small>{client.sdk}</small>}</dd></div>}
    </>
  );
}

/**
 * The id the app passed for this person (its own user id), so the team can find them in their own
 * database or analytics. Only signed-in people have one; nothing shows for anonymous visitors.
 */
export function AppUserIdFact({ id }: { id?: string | null }) {
  if (!id) return null;
  return (
    <div>
      <dt>User ID</dt>
      <dd className="app-user-id">
        <span className="mono" title={id}>{id}</span>
        <CopyButton text={id} label="Copy" />
      </dd>
    </div>
  );
}
