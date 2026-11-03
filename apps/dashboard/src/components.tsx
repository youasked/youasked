import { useEffect, useRef, useState } from "react";
import { appApi, type Req, type Status } from "./api";
import { Button, Dialog, Icon, STATUS_LABEL, StatusChip, useFail } from "./ui";

export const PICKABLE: Status[] = ["open", "planned", "in_progress", "shipped", "declined"];

/** A popover listing statuses. The caller controls when it is open, so the keyboard shortcut can open it too. */
export function StatusPopover({ current, onPick, onClose }: { current: Status; onPick: (s: Status) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
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
  return (
    <div className="menu status-menu" role="menu" ref={ref} data-align="right">
      <div className="menu-note">Change status <span className="kbd-hint">press 1 to 5</span></div>
      {PICKABLE.map((s, i) => (
        <button key={s} role="menuitem" className="menu-item" data-active={s === current || undefined} onClick={() => onPick(s)}>
          <StatusChip status={s} />
          <span className="spacer" />
          <kbd>{i + 1}</kbd>
        </button>
      ))}
    </div>
  );
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
