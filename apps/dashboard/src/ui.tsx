import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { explain, type Status } from "./api";

// ---------- icons (24px grid, 1.8 stroke)
const P: Record<string, string> = {
  inbox: "M3 13h5l1.5 3h5L16 13h5M3 13l2.2-7.2A2 2 0 0 1 7.1 4.4h9.8a2 2 0 0 1 1.9 1.4L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Z",
  copy: "M9 9h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V9ZM5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5",
  check: "m5 12.5 4.5 4.5L19 7.5",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  x: "M6 6l12 12M18 6 6 18",
  down: "m6 9 6 6 6-6",
  right: "m9 6 6 6-6 6",
  left: "m15 6-6 6 6 6",
  up: "m6 15 6-6 6 6",
  merge: "M6 3v5a6 6 0 0 0 6 6M18 3v5a6 6 0 0 1-6 6M12 14v7M9 18l3 3 3-3",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6l1-7Z",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.500 5.600 12 3Z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5a7.800 7.800 0 0 0 0-3l1.900-1.500-2-3.400-2.300.9a7.700 7.700 0 0 0-2.600-1.500L14 2.500h-4l-.4 2.500a7.700 7.700 0 0 0-2.600 1.500l-2.300-.9-2 3.400 1.900 1.500a7.800 7.800 0 0 0 0 3l-1.900 1.500 2 3.400 2.300-.9a7.700 7.700 0 0 0 2.600 1.500l.4 2.500h4l.4-2.500a7.700 7.700 0 0 0 2.600-1.500l2.300.9 2-3.400-1.900-1.500Z",
  users: "M9 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7ZM2.500 20a6.500 6.500 0 0 1 13 0M16 4.300a3.500 3.500 0 0 1 0 6.400M18 14.200A6.500 6.500 0 0 1 21.500 20",
  card: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1ZM3 10h18M7 15h3",
  ear: "M8 10a4 4 0 1 1 8 0c0 2-1.500 3-2.500 4.200-.800 1-.800 1.800-.800 2.800a2.700 2.700 0 0 1-5.200.800M12 10a1.200 1.200 0 0 1 1.200-1.200",
  dup: "M4 4h10v10H4zM10 10h10v10H10z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400",
  moon: "M20 14.500A8.500 8.500 0 0 1 9.500 4a8.500 8.500 0 1 0 10.500 10.500Z",
  logout: "M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  ext: "M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4",
  send: "M12 19V5M5 12l7-7 7 7",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 7l9 6.500L21 7",
  img: "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM3 16l5-5 4 4 3-3 6 6M9 9.500a1 1 0 1 0 0-.01",
  key: "M15 9a4 4 0 1 1-7.800 1.300L3 14.500V18h3.500v-2h2v-2l1.200-1.200A4 4 0 0 1 15 9ZM16.500 8h.01",
  refresh: "M20 11a8 8 0 0 0-14.500-4M4 5v4h4M4 13a8 8 0 0 0 14.500 4M20 19v-4h-4",
  menu: "M4 7h16M4 12h16M4 17h16",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  flag: "M5 21V4M5 4h11l-1.500 3.500L16 11H5",
  chat: "M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z",
  spark: "M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3ZM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z",
  upload: "M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  warn: "M12 4 2.500 20h19L12 4ZM12 10v4M12 17h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
};
export function Icon({ name, size = 18, className }: { name: keyof typeof P | string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={P[name] ?? ""} />
    </svg>
  );
}

export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M16 6h32a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H30L16 62V52a12 12 0 0 1-12-12V18A12 12 0 0 1 16 6Z" fill="#2b4bee" />
    <path d="M21 37 32 26l11 11" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GoogleG = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.300-.2-1.900H12v3.600h5.400a4.600 4.600 0 0 1-2 3v2.500h3.200c1.900-1.700 3-4.300 3-7.200Z" />
    <path fill="#34A853" d="M12 22c2.700 0 5-.9 6.600-2.500l-3.200-2.500c-.9.600-2 1-3.400 1-2.600 0-4.800-1.700-5.600-4.100H3.100v2.600A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.400 13.900a6 6 0 0 1 0-3.800V7.500H3.100a10 10 0 0 0 0 9l3.300-2.600Z" />
    <path fill="#EA4335" d="M12 5.900c1.500 0 2.800.5 3.800 1.500l2.900-2.900A10 10 0 0 0 3.100 7.500l3.300 2.600C7.200 7.600 9.400 5.900 12 5.900Z" />
  </svg>
);
export const GitHubMark = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.200 19.500c.5.100.7-.2.7-.5v-1.700c-2.800.6-3.400-1.300-3.400-1.300-.5-1.200-1.100-1.500-1.100-1.500-.9-.6.1-.6.1-.6 1 .1 1.500 1 1.500 1 .9 1.500 2.400 1.100 3 .8.1-.7.4-1.100.6-1.400-2.200-.3-4.600-1.100-4.600-5 0-1.100.4-2 1-2.700-.1-.3-.4-1.300.1-2.700 0 0 .8-.3 2.700 1a9.300 9.300 0 0 1 5 0c1.900-1.300 2.700-1 2.700-1 .5 1.400.2 2.400.1 2.700.6.700 1 1.600 1 2.700 0 3.900-2.400 4.700-4.600 5 .4.3.7.9.7 1.900v2.800c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
  </svg>
);

/** Where a Heard elsewhere post came from. */
export function SourceIcon({ source }: { source: string }) {
  const map: Record<string, { bg: string; label: string; glyph: ReactNode }> = {
    reddit: { bg: "#ff4500", label: "Reddit", glyph: <><circle cx="12" cy="13.500" r="5" fill="#fff" /><circle cx="10" cy="13" r="1" fill="#ff4500" /><circle cx="14" cy="13" r="1" fill="#ff4500" /><circle cx="17.200" cy="7.200" r="1.300" fill="#fff" /><path d="M12 8.500 13 5l4.200 1.200" stroke="#fff" strokeWidth="1.200" fill="none" /></> },
    appstore: { bg: "#1d8bff", label: "App Store", glyph: <path d="m12 6-4.500 8M12 6l4.500 8M8.800 16.500h6.400M6.500 14h4" stroke="#fff" strokeWidth="1.800" strokeLinecap="round" fill="none" /> },
    playstore: { bg: "#0f9d58", label: "Google Play", glyph: <path d="M8 6.500v11l9-5.500-9-5.500Z" fill="#fff" /> },
  };
  const s = map[source] ?? { bg: "#6b7391", label: source, glyph: <circle cx="12" cy="12" r="4" fill="#fff" /> };
  return (
    <span className="source-icon" title={s.label} style={{ background: s.bg }}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">{s.glyph}</svg>
    </span>
  );
}
export const sourceLabel = (s: string) => ({ reddit: "Reddit", appstore: "App Store review", playstore: "Google Play review" })[s] ?? s;

// ---------- small helpers
export function timeAgo(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = Date.now() - ts;
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: days > 330 ? "numeric" : undefined });
}
export const shortDate = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "");

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const t = useRef<number>(undefined);
  return (
    <button
      type="button"
      className={`btn btn-quiet btn-sm ${className}`}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          clearTimeout(t.current);
          t.current = window.setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      <Icon name={done ? "check" : "copy"} size={15} />
      {done ? "Copied" : label}
    </button>
  );
}

// ---------- buttons and inputs
export function Button({ kind = "default", size, busy, children, className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: "primary" | "default" | "quiet" | "danger"; size?: "sm"; busy?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || busy} className={`btn btn-${kind} ${size ? "btn-" + size : ""} ${className}`}>
      {busy && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="switch" data-on={checked || undefined} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {typeof children === "object" && children && "type" in (children as object) ? cloneWithId(children as React.ReactElement<{ id?: string }>, id) : children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
import { cloneElement, isValidElement } from "react";
function cloneWithId(el: React.ReactElement<{ id?: string }>, id: string) {
  return isValidElement(el) ? cloneElement(el, { id: el.props.id ?? id }) : el;
}

export function Spinner() {
  return <span className="spinner big" role="status" aria-label="Loading" />;
}

// ---------- status
export const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
  pending: "Waiting for approval",
  merged: "Merged",
};
export function StatusChip({ status }: { status: Status }) {
  return (
    <span className="chip" data-status={status}>
      <i />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ---------- toasts
type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastCtx = createContext<(text: string, kind?: "ok" | "error") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function useFail() {
  const toast = useToast();
  return useCallback((e: unknown) => toast(explain(e), "error"), [toast]);
}
export function Toasts({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), kind === "error" ? 7000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="toast" data-kind={t.kind} role={t.kind === "error" ? "alert" : "status"}>
            <Icon name={t.kind === "error" ? "warn" : "check"} size={16} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- popover menu
export function Menu({ trigger, children, align = "left", label }: { trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        {trigger(open)}
      </button>
      {open && (
        <div className="menu" role="menu" data-align={align}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
export function MenuItem({ children, onClick, active, danger, icon }: { children: ReactNode; onClick: () => void; active?: boolean; danger?: boolean; icon?: string }) {
  return (
    <button type="button" role="menuitem" className="menu-item" data-active={active || undefined} data-danger={danger || undefined} onClick={onClick}>
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
      {active && <Icon name="check" size={15} className="tick" />}
    </button>
  );
}

// ---------- dialog
export function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title} data-wide={wide || undefined}>
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ---------- empty / error / skeleton
export function Empty({ icon = "inbox", title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="empty error">
      <span className="empty-icon">
        <Icon name="warn" size={22} />
      </span>
      <h3>Couldn't load this</h3>
      <p>{explain(error)}</p>
      {retry && (
        <Button onClick={retry}>
          <Icon name="refresh" size={15} /> Try again
        </Button>
      )}
    </div>
  );
}
export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="skeleton" aria-hidden="true">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} style={{ animationDelay: `${i * 60}ms` }} />
    ))}
  </div>
);

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ---------- data loading
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const seq = useRef(0);
  const run = useCallback(
    (quiet = false) => {
      const my = ++seq.current;
      if (!quiet) setState((s) => ({ data: s.data, loading: true }));
      return fn().then(
        (data) => my === seq.current && setState({ data, loading: false }),
        (error) => my === seq.current && setState((s) => ({ data: quiet ? s.data : undefined, error, loading: false })),
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  useEffect(() => {
    run();
  }, [run]);
  const set = useCallback((updater: (d: T) => T) => setState((s) => (s.data === undefined ? s : { ...s, data: updater(s.data) })), []);
  return { ...state, reload: () => run(true), retry: () => run(false), set };
}

export function useInterval(fn: () => void, ms: number | null) {
  const saved = useRef(fn);
  saved.current = fn;
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return m;
}
