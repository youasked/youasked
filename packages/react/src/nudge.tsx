// The occasional in-app prompt: "Got an idea for <App>?". The developer turns it on and tunes it in the
// dashboard (or with the `nudge` prop). It waits until someone has actually used the app for a while,
// skips their first visits, never shows twice within the chosen interval, steps back further each
// time it's dismissed, and stays away from people who opened the sheet recently.
import { useCallback, useEffect, useRef, useState } from "react";
import { IconClose, IconIdea } from "./icons";

export type NudgeSettings = {
  /** Show at most once every this many days. */
  everyDays: number;
  /** Seconds someone must have the app open (in the foreground) in this visit before it shows. */
  activeSeconds: number;
  /** Visits to skip before the first prompt, so brand-new people get to look around. */
  skipVisits: number;
  /** Headline. Defaults to "Got an idea for <App>?". */
  message: string | null;
  position: "bottom" | "top";
};

export const NUDGE_DEFAULTS: NudgeSettings = { everyDays: 7, activeSeconds: 30, skipVisits: 1, message: null, position: "bottom" };

type Memory = { visits: number; lastVisitAt: number; lastShownAt: number; lastEngagedAt: number; dismissals: number };

const DAY = 24 * 60 * 60 * 1000;
/** A new visit starts after this long away. */
const VISIT_GAP = 30 * 60 * 1000;

/** What the developer asked for: prop false turns it off, an object overrides the dashboard settings. */
export function resolveNudge(server: NudgeSettings | null | undefined, prop: boolean | Partial<NudgeSettings> | undefined): NudgeSettings | null {
  if (prop === false) return null;
  if (typeof prop === "object") return { ...NUDGE_DEFAULTS, ...server, ...prop };
  if (prop === true) return server ?? NUDGE_DEFAULTS;
  return server ?? null;
}

function load(key: string | null): Memory {
  const empty = { visits: 0, lastVisitAt: 0, lastShownAt: 0, lastEngagedAt: 0, dismissals: 0 };
  if (!key) return empty;
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(key) ?? "{}") };
  } catch {
    return empty;
  }
}

function save(key: string | null, m: Memory) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(m));
  } catch {
    /* private mode: it just won't remember */
  }
}

/**
 * `blocked` is true while something more important is on screen (the sheet, a reply or "it's live"
 * card); the prompt waits for it to clear. The demo has no memory, so it only needs the active time.
 */
export function useNudge(settings: NudgeSettings | null, storageKey: string | null, blocked: boolean) {
  const memory = useRef<Memory | null>(null);
  const [show, setShow] = useState(false);

  // Count this visit once settings are known.
  useEffect(() => {
    if (!settings || memory.current) return;
    const m = load(storageKey);
    const now = Date.now();
    if (now - m.lastVisitAt > VISIT_GAP) m.visits += 1;
    m.lastVisitAt = now;
    memory.current = m;
    save(storageKey, m);
  }, [settings, storageKey]);

  // Time spent with the app in front of them, then show if this person is due one.
  useEffect(() => {
    if (!settings || show) return;
    let active = 0;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || blocked) return;
      active += 1;
      if (active < settings.activeSeconds) return;
      window.clearInterval(timer);
      const m = memory.current;
      if (!m) return;
      const now = Date.now();
      const wait = settings.everyDays * DAY * 2 ** Math.min(m.dismissals, 3);
      const due = !storageKey || (m.visits > settings.skipVisits && now - m.lastShownAt >= wait && now - m.lastEngagedAt >= wait);
      if (!due) return;
      m.lastShownAt = now;
      save(storageKey, m);
      setShow(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [settings, storageKey, blocked, show]);

  /** They opened the sheet, from the prompt or anywhere else: no prompt until the interval passes. */
  const engaged = useCallback(() => {
    const m = memory.current;
    if (m) {
      m.lastEngagedAt = Date.now();
      m.dismissals = 0;
      save(storageKey, m);
    }
    setShow(false);
  }, [storageKey]);

  const dismiss = useCallback(() => {
    const m = memory.current;
    if (m) {
      m.dismissals += 1;
      save(storageKey, m);
    }
    setShow(false);
  }, [storageKey]);

  return { show, engaged, dismiss };
}

export function NudgeToast({
  settings,
  appName,
  position,
  trigger,
  onOpen,
  onDismiss,
}: {
  settings: NudgeSettings;
  appName: string;
  position: string;
  trigger: string;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="ya-toast ya-nudge" role="status" data-pos={position} data-trigger={trigger} data-place={settings.position}>
      <div className="ya-toast-top">
        <p className="ya-toast-kicker">Help shape {appName}</p>
        <button type="button" className="ya-icon-btn" onClick={onDismiss} aria-label="Dismiss">
          <IconClose />
        </button>
      </div>
      <div className="ya-nudge-body">
        <span className="ya-card-icon" aria-hidden="true">
          <IconIdea />
        </span>
        <div>
          <p className="ya-toast-title">{settings.message ?? `Got an idea for ${appName}?`}</p>
          <p className="ya-toast-note">Ask for a feature or vote on what others want.</p>
        </div>
      </div>
      <div className="ya-toast-actions">
        <button type="button" className="ya-btn ya-btn-sm" onClick={onOpen}>
          Share an idea
        </button>
        <button type="button" className="ya-btn ya-btn-sm ya-btn-ghost" onClick={onDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
