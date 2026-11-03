import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createClient, type Config, type Notice, type YouAskedUser } from "./client";
import { YouAskedContext, toRoute, type InternalContext, type OpenOptions, type Route } from "./context";
import { IconCheck, IconClose, IconIdea } from "./icons";
import { injectStyles } from "./styles";
import { resolveTokens, tokenStyle, type Appearance } from "./theme";
import { Navigator } from "./views";

export const DEFAULT_API_URL = "https://youasked-api.adenteo.workers.dev";

export type YouAskedProps = {
  /** Publishable key (ya_pub_…). Safe to ship in client code. */
  appKey: string;
  /** Who's asking. Leave out for anonymous visitors. */
  user?: YouAskedUser | null;
  /** hex HMAC-SHA256 of user.id with your secret key, made on your server (see `signUser`). */
  signature?: string | null;
  /** Set false while you're still fetching the signature; the widget waits instead of acting anonymously. */
  ready?: boolean;
  appearance?: Appearance;
  /** "floating" adds a chat-style launcher in the corner. "none" if you use the inline entry points or your own buttons. */
  trigger?: "floating" | "none";
  position?: "bottom-right" | "bottom-left";
  /** Text next to the launcher icon. Leave empty for an icon-only bubble. */
  label?: string;
  /** Your app's name in the greeting. Defaults to the name you created the app with. */
  appName?: string;
  /** Square image URL shown as the app's avatar. Defaults to the first letter of the name. */
  appIcon?: string;
  /** First message on the home screen. */
  greeting?: string;
  /** Heading of the full list. */
  title?: string;
  /** Distance in px from the bottom edge for the launcher, toast and desktop panel, e.g. to clear a tab bar. */
  offset?: number;
  apiUrl?: string;
  children?: ReactNode;
};

export function YouAsked({
  appKey,
  user,
  signature,
  ready = true,
  appearance,
  trigger = "floating",
  position = "bottom-right",
  label,
  appName,
  appIcon,
  greeting,
  title = "Feature requests",
  offset,
  apiUrl = DEFAULT_API_URL,
  children,
}: YouAskedProps) {
  const userId = user?.id;
  const userEmail = user?.email;
  const userName = user?.name;
  const client = useMemo(
    () => createClient({ appKey, apiUrl, user: userId == null ? null : { id: userId, email: userEmail, name: userName }, signature }),
    [appKey, apiUrl, userId, userEmail, userName, signature],
  );
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const tokens = useTokens(appearance, mounted);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    injectStyles();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    client
      .config()
      .then((c) => alive && setConfig(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [client, ready]);

  const open = useCallback((options?: OpenOptions) => {
    openerRef.current = document.activeElement;
    setRoute(toRoute(options));
  }, []);

  const close = useCallback(() => {
    setRoute(null);
    (openerRef.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onOpen = (e: Event) => open((e as CustomEvent<OpenOptions>).detail);
    window.addEventListener("youasked:open", onOpen);
    return () => window.removeEventListener("youasked:open", onOpen);
  }, [open]);

  const markSeen = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      setConfig((c) => (c ? { ...c, unseen: c.unseen.filter((n) => !ids.includes(n.id)) } : c));
      client.seen(ids).catch(() => {});
    },
    [client],
  );

  const scopeStyle = useMemo(
    () =>
      ({
        ...(tokens ? tokenStyle(tokens) : {}),
        ...(offset !== undefined ? { "--ya-offset": `${offset}px` } : {}),
      }) as CSSProperties,
    [tokens, offset],
  );

  const unseen = config?.unseen ?? [];
  const value = useMemo<InternalContext>(
    () => ({
      open,
      close,
      isOpen: route !== null,
      unseenCount: unseen.length,
      client,
      config,
      markSeen,
      scope: { className: "ya-scope", style: scopeStyle, "data-ya-mode": tokens?.mode },
      appName: appName ?? config?.app.name ?? "us",
      appIcon,
      title,
      greeting,
    }),
    [open, close, route, unseen.length, client, config, markSeen, scopeStyle, tokens?.mode, appName, appIcon, title, greeting],
  );

  const notice = unseen.find((n) => n.kind === "shipped") ?? unseen.find((n) => n.kind === "reply");

  return (
    <YouAskedContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="ya-scope" data-ya-mode={tokens?.mode} style={scopeStyle}>
            {trigger === "floating" && (
              <Launcher
                position={position}
                label={label}
                isOpen={route !== null}
                badge={unseen.length > 0}
                onClick={() => (route ? close() : open())}
              />
            )}
            {notice && route === null && (
              <ShippedToast
                notice={notice}
                position={position}
                trigger={trigger}
                onOpen={() => {
                  markSeen([notice.id]);
                  open({ requestId: notice.requestId });
                }}
                onDismiss={() => markSeen([notice.id])}
              />
            )}
            {route && (
              <Panel route={route} setRoute={setRoute} onClose={close} position={position} hasLauncher={trigger === "floating"} />
            )}
          </div>,
          document.body,
        )}
    </YouAskedContext.Provider>
  );
}

function useTokens(appearance: Appearance | undefined, mounted: boolean) {
  const key = JSON.stringify(appearance ?? {});
  const [tokens, setTokens] = useState<ReturnType<typeof resolveTokens> | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const parsed = JSON.parse(key) as Appearance;
    const update = () => setTokens(resolveTokens(parsed));
    update();
    // Follow the host when it flips light/dark (class, data-theme or OS setting).
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", update);
    return () => {
      observer.disconnect();
      media?.removeEventListener?.("change", update);
    };
  }, [key, mounted]);
  return tokens;
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return matches;
}

// ---------------------------------------------------------------- panel: bottom sheet on phones, corner panel on desktop

function Panel({
  route,
  setRoute,
  onClose,
  position,
  hasLauncher,
}: {
  route: Route;
  setRoute: (r: Route) => void;
  onClose: () => void;
  position: string;
  hasLauncher: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const isSheet = useMedia("(max-width: 639px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const drag = useRef<{ startY: number; lastY: number; lastT: number; v: number; dy: number } | null>(null);

  const requestClose = useCallback(() => {
    if (reduceMotion) return onClose();
    setClosing(true);
    setTimeout(onClose, 200);
  }, [onClose, reduceMotion]);

  useEffect(() => {
    if (!isSheet) return;
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = previous;
    };
  }, [isSheet]);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        requestClose();
      }
      if (e.key === "Tab" && panelRef.current) trapFocus(e, panelRef.current);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [requestClose]);

  // Swipe down on the handle or header to dismiss, like a native sheet.
  const onPointerDown = (e: React.PointerEvent) => {
    if (!isSheet || e.button !== 0) return;
    const target = e.target as Element;
    if (!target.closest(".ya-grab-zone, .ya-head") || target.closest("button, input, textarea, a")) return;
    const panel = panelRef.current!;
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0, dy: 0 };
    panel.setPointerCapture(e.pointerId);
    panel.style.transition = "none";
    panel.style.animation = "none";
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const panel = panelRef.current!;
    const raw = e.clientY - d.startY;
    const dy = raw < 0 ? Math.max(-18, raw * 0.2) : raw;
    const now = performance.now();
    d.v = (e.clientY - d.lastY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    d.dy = dy;
    panel.style.transform = `translateY(${dy}px)`;
    if (backdropRef.current) backdropRef.current.style.opacity = String(1 - Math.max(0, dy) / panel.offsetHeight);
  };
  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const panel = panelRef.current!;
    const backdrop = backdropRef.current;
    const h = panel.offsetHeight;
    panel.style.transition = "transform .3s cubic-bezier(.2,.9,.3,1)";
    if (backdrop) backdrop.style.transition = "opacity .3s";
    if (d.dy > h * 0.25 || d.v > 0.5) {
      panel.style.transform = `translateY(${h}px)`;
      if (backdrop) backdrop.style.opacity = "0";
      setTimeout(onClose, 260);
    } else {
      panel.style.transform = "";
      if (backdrop) backdrop.style.opacity = "";
    }
  };

  return (
    <div className="ya-overlay" data-pos={position} data-launcher={hasLauncher || undefined} data-closing={closing || undefined}>
      <div className="ya-backdrop" ref={backdropRef} onClick={requestClose} aria-hidden="true" />
      <div
        className="ya-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Feature requests"
        tabIndex={-1}
        ref={panelRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="ya-grab-zone" aria-hidden="true">
          <div className="ya-grab" />
        </div>
        <Navigator route={route} setRoute={setRoute} onClose={requestClose} />
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement) {
  const items = Array.from(
    root.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, a[href], [tabindex]:not([tabindex="-1"])'),
  ).filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function Launcher({
  position,
  label,
  isOpen,
  badge,
  onClick,
}: {
  position: string;
  label?: string;
  isOpen: boolean;
  badge: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={label && !isOpen ? "ya-fab ya-fab-label" : "ya-fab"}
      data-pos={position}
      data-open={isOpen || undefined}
      onClick={onClick}
      aria-label={isOpen ? "Close feature requests" : label || "Feature requests"}
      aria-expanded={isOpen}
    >
      <span className="ya-fab-icon">{isOpen ? <IconClose /> : <IconIdea />}</span>
      {label && !isOpen && <span>{label}</span>}
      {badge && !isOpen && <span className="ya-dot" aria-hidden="true" />}
    </button>
  );
}

function ShippedToast({
  notice,
  position,
  trigger,
  onOpen,
  onDismiss,
}: {
  notice: Notice;
  position: string;
  trigger: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ya-toast" role="status" data-pos={position} data-trigger={trigger}>
      {notice.kind === "reply" ? (
        <>
          <div className="ya-toast-top">
            <p className="ya-toast-kicker">New reply about</p>
            <button type="button" className="ya-icon-btn" onClick={onDismiss} aria-label="Dismiss">
              <IconClose />
            </button>
          </div>
          <p className="ya-toast-title">{notice.title}</p>
          <p className="ya-toast-note ya-toast-quote">{notice.reply}</p>
          <div className="ya-toast-actions">
            <button type="button" className="ya-btn ya-btn-sm" onClick={onOpen}>
              Reply
            </button>
            <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onDismiss}>
              Later
            </button>
          </div>
        </>
      ) : (
        <ShippedBody notice={notice} onOpen={onOpen} onDismiss={onDismiss} />
      )}
    </div>
  );
}

function ShippedBody({ notice, onOpen, onDismiss }: { notice: Notice; onOpen: () => void; onDismiss: () => void }) {
  return (
    <>
      <div className="ya-toast-top">
        <p className="ya-toast-kicker">You asked for</p>
        <button type="button" className="ya-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <IconClose />
        </button>
      </div>
      <p className="ya-toast-title">{notice.title}</p>
      <div className="ya-live">
        <IconCheck />
        It's live
      </div>
      {notice.shipNote && <p className="ya-toast-note">{notice.shipNote}</p>}
      <div className="ya-toast-actions">
        <button type="button" className="ya-btn ya-btn-sm" onClick={onOpen}>
          See it
        </button>
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onDismiss}>
          Nice
        </button>
      </div>
    </>
  );
}
