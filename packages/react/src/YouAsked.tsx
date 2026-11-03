import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createClient, type Config, type Notice, type WhatsNew, type YouAskedUser } from "./client";
import { YouAskedContext, toRoute, type InternalContext, type OpenOptions, type Route } from "./context";
import { createDemoClient } from "./demo";
import { IconCheck, IconClose, IconIdea } from "./icons";
import { injectStyles } from "./styles";
import { resolveTokens, tokenStyle, type Appearance } from "./theme";
import { whatsNewHeading } from "./shared";
import { Navigator } from "./views";

export const DEFAULT_API_URL = "https://youasked-api.adenteo.workers.dev";

export type YouAskedProps = {
  /** Publishable key (ya_pub_…). Safe to ship in client code. Not needed with `demo`. */
  appKey?: string;
  /**
   * Runs entirely in the browser with sample requests and a pretend team, no network. Posting, voting,
   * commenting and a reply a few seconds later all work. For docs, Storybook and landing pages.
   */
  demo?: boolean;
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
  /** Square image URL for your app's icon. By default it's found from the page (apple-touch-icon or a large favicon); false hides it. */
  appIcon?: string | false;
  /** First message on the home screen. */
  greeting?: string;
  /** Heading of the full list. */
  title?: string;
  /** Distance in px from the bottom edge for the launcher, toast and desktop panel, e.g. to clear a tab bar. */
  offset?: number;
  /** Show the corner card for replies, shipped requests and what's new. Turn off for previews embedded in a page. */
  cards?: boolean;
  apiUrl?: string;
  children?: ReactNode;
};

/**
 * localStorage backup for "what's new", for when the server can't be told (offline, blocked). Kept per
 * app and person so two people sharing a browser don't hide each other's news. The demo never uses it.
 */
function lastWhatsNew(key: string | null): number {
  try {
    return key ? Number(localStorage.getItem(key)) || 0 : 0;
  } catch {
    return 0;
  }
}

function coveredBy(news: WhatsNew | null, n: Notice): boolean {
  return n.kind === "shipped" && Boolean(news?.items.some((i) => i.id === n.requestId));
}

export function YouAsked({
  appKey = "",
  demo = false,
  cards = true,
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
    () =>
      demo
        ? createDemoClient(appName)
        : createClient({ appKey, apiUrl, user: userId == null ? null : { id: userId, email: userEmail, name: userName }, signature }),
    [demo, appName, appKey, apiUrl, userId, userEmail, userName, signature],
  );
  const whatsNewKey = demo ? null : `youasked:whats-new:${appKey}:${userId ?? "anon"}`;
  const [mounted, setMounted] = useState(false);
  const [route, setRoute] = useState<Route | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [whatsNew, setWhatsNew] = useState<WhatsNew | null>(null);
  const [whatsNewToast, setWhatsNewToast] = useState(false);
  const [capture, setCapture] = useState<{
    Layer: ComponentType<{ onDone: (image: Blob) => void; onCancel: () => void }>;
    resolve: (image: Blob | null) => void;
  } | null>(null);
  const tokens = useTokens(appearance, mounted);
  const openerRef = useRef<Element | null>(null);
  const [detectedIcon, setDetectedIcon] = useState<string | null>(null);

  useEffect(() => {
    if (appIcon === undefined) setDetectedIcon(findPageIcon());
  }, [appIcon]);

  useEffect(() => {
    injectStyles();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    client
      .config()
      .then((c) => {
        if (!alive) return;
        // Only what shipped after the last time they were shown the list, even if the server missed the news.
        const seenAt = lastWhatsNew(whatsNewKey);
        const items = c.whatsNew?.items.filter((i) => i.shippedAt > seenAt) ?? [];
        const news = c.whatsNew && items.length ? { ...c.whatsNew, items } : null;
        setConfig(c);
        setWhatsNew(news);
        // A toast on first load, unless a notice that isn't already part of the list is waiting.
        setWhatsNewToast(Boolean(news) && c.unseen.filter((n) => !coveredBy(news, n)).length === 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, ready]);

  // The demo's pretend team writes in a few seconds after you post.
  useEffect(() => {
    if (!("onNotice" in client)) return;
    return (client as ReturnType<typeof createDemoClient>).onNotice((n) =>
      setConfig((c) => (c ? { ...c, unseen: [...c.unseen, n] } : c)),
    );
  }, [client]);

  const dismissWhatsNew = useCallback(() => {
    setWhatsNew(null);
    setWhatsNewToast(false);
    try {
      if (whatsNewKey) localStorage.setItem(whatsNewKey, String(Date.now()));
    } catch {
      /* private mode: the server still remembers */
    }
    client.whatsNewSeen().catch(() => {});
  }, [client, whatsNewKey]);

  const pointAtIt = useCallback(
    () =>
      new Promise<Blob | null>((resolve, reject) => {
        // The screenshot library only loads the first time someone asks to point at something.
        import("./capture").then(
          (m) => setCapture({ Layer: m.default, resolve }),
          (err) => reject(err),
        );
      }),
    [],
  );

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
      whatsNew,
      dismissWhatsNew,
      pointAtIt,
      scope: { className: "ya-scope", style: scopeStyle, "data-ya-mode": tokens?.mode },
      appName: appName ?? config?.app.name ?? "us",
      appIcon: appIcon === false ? null : (appIcon ?? detectedIcon),
      title,
      greeting,
    }),
    [open, close, route, unseen.length, client, config, markSeen, whatsNew, dismissWhatsNew, pointAtIt, scopeStyle, tokens?.mode, appName, appIcon, detectedIcon, title, greeting],
  );

  // "It's live" notices for things already in the what's-new list wait for that list instead of saying it twice.
  const standing = unseen.filter((n) => !coveredBy(whatsNew, n));
  const notice = standing.find((n) => n.kind === "shipped") ?? standing.find((n) => n.kind === "reply");

  return (
    <YouAskedContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div className="ya-scope" data-ya-mode={tokens?.mode} data-ya-skip="" style={scopeStyle}>
            {trigger === "floating" && !capture && (
              <Launcher
                position={position}
                label={label}
                isOpen={route !== null}
                badge={unseen.length > 0}
                onClick={() => (route ? close() : open())}
              />
            )}
            {cards && !notice && whatsNewToast && whatsNew && route === null && (
              <WhatsNewToast
                news={whatsNew}
                position={position}
                trigger={trigger}
                onOpen={() => open()}
                onDismiss={dismissWhatsNew}
              />
            )}
            {cards && notice && route === null && (
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
              <Panel
                route={route}
                setRoute={setRoute}
                onClose={close}
                position={position}
                hasLauncher={trigger === "floating"}
                hidden={capture !== null}
              />
            )}
            {capture && (
              <capture.Layer
                onDone={(image) => {
                  capture.resolve(image);
                  setCapture(null);
                }}
                onCancel={() => {
                  capture.resolve(null);
                  setCapture(null);
                }}
              />
            )}
          </div>,
          document.body,
        )}
    </YouAskedContext.Provider>
  );
}

/**
 * The page's app icon, if it declares one we can trust: an apple-touch-icon, or a favicon of at
 * least 96px. Tiny or vector favicons are skipped (often a monogram that reads badly at avatar size).
 */
function findPageIcon(): string | null {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel~='icon'], link[rel~='apple-touch-icon']"));
  const touch = links.find((l) => l.rel.includes("apple-touch-icon") && l.href);
  if (touch) return touch.href;
  const large = links
    .filter((l) => l.href && !/\.svg(\?|$)/i.test(l.href) && !/\.ico(\?|$)/i.test(l.href))
    .map((l) => ({ l, size: Math.max(0, ...(l.sizes?.value ?? "").split(/\s+/).map((v) => parseInt(v, 10) || 0)) }))
    .filter((x) => x.size >= 96)
    .sort((a, b) => b.size - a.size)[0];
  return large?.l.href ?? null;
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
  hidden,
}: {
  route: Route;
  setRoute: (r: Route) => void;
  onClose: () => void;
  position: string;
  hasLauncher: boolean;
  /** Tucked away while someone points at the page; the screen underneath keeps its state. */
  hidden: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const isSheet = useMedia("(max-width: 639px)");
  const reduceMotion = useMedia("(prefers-reduced-motion: reduce)");
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
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
      if (hiddenRef.current) return;
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
    <div
      className="ya-overlay"
      data-pos={position}
      data-launcher={hasLauncher || undefined}
      data-closing={closing || undefined}
      hidden={hidden}
    >
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

function WhatsNewToast({
  news,
  position,
  trigger,
  onOpen,
  onDismiss,
}: {
  news: WhatsNew;
  position: string;
  trigger: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const mine = news.items.some((i) => i.mine);
  return (
    <div className="ya-toast" role="status" data-pos={position} data-trigger={trigger}>
      <div className="ya-toast-top">
        <p className="ya-toast-kicker">What's new</p>
        <button type="button" className="ya-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <IconClose />
        </button>
      </div>
      <p className="ya-toast-title">{whatsNewHeading(news.total)}</p>
      {mine && (
        <div className="ya-live">
          <IconCheck />
          Including something you asked for
        </div>
      )}
      <div className="ya-toast-actions">
        <button type="button" className="ya-btn ya-btn-sm" onClick={onOpen}>
          See what's new
        </button>
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
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
