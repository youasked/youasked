import { FeatureBoard, YouAsked } from "@youasked/react";
import { useEffect, useRef, useState } from "react";

/*
 * A phone with the real YouAsked sheet running inside it, in demo mode. The frame is drawn in CSS
 * (titanium edge, black bezel, Dynamic Island, side buttons); the screen keeps the real safe areas:
 * a status bar on top, the home indicator underneath, and the sheet filling what's between.
 * Everything inside is sized by flex, so the phone can shrink to fit a small screen without
 * anything overlapping.
 *
 * The SDK's in-app cards (shipped, reply, the occasional prompt) are pinned to the browser window,
 * so the phone draws its own copies of them, in the same design, over the sheet.
 */

const LOOK = {
  accent: "#2b4bee",
  background: "#ffffff",
  foreground: "#0b0d12",
  muted: "#6e7385",
  surface: "#f3f4f8",
  border: "#e8e9ef",
  radius: 18,
  fontFamily: "Switzer, system-ui, sans-serif",
  mode: "light" as const,
};

export type Card = "shipped" | "reply" | "nudge";

export const CARDS: Record<Card, { label: string; kicker: string; title: string; body: string; quote?: boolean; actions: [string, string] }> = {
  shipped: {
    label: "It's live",
    kicker: "It's live",
    title: "Dark mode",
    body: "You asked for this one. Thanks for the idea.",
    actions: ["See what's new", "Not now"],
  },
  reply: {
    label: "A reply",
    kicker: "New reply about",
    title: "Dark mode",
    body: "On the list for December. Would following your phone's setting be enough to start?",
    quote: true,
    actions: ["Reply", "Later"],
  },
  nudge: {
    label: "“Got an idea?”",
    kicker: "Help shape your app",
    title: "Got an idea for your app?",
    body: "Ask for a feature or vote on what others want.",
    actions: ["Share an idea", "Not now"],
  },
};

export function Phone({ card, onClose }: { card: { kind: Card; n: number } | null; onClose: () => void }) {
  const screen = useRef<HTMLDivElement>(null);
  // "Share an idea" on the prompt does what it does in an app: puts you in the composer.
  const ask = () => screen.current?.querySelector<HTMLElement>("textarea, input")?.focus({ preventScroll: true });
  return (
    <figure className="ph" aria-label="The YouAsked sheet on a phone. It's live: tap, type and vote.">
      <i className="ph-btn ph-action" aria-hidden="true" />
      <i className="ph-btn ph-vol-up" aria-hidden="true" />
      <i className="ph-btn ph-vol-down" aria-hidden="true" />
      <i className="ph-btn ph-power" aria-hidden="true" />
      <div className="ph-bezel">
        <div className="ph-screen" ref={screen}>
          <StatusBar />
          <div className="ph-app">
            <YouAsked
              demo
              cards={false}
              trigger="none"
              appearance={LOOK}
              appName="Your app"
              appIcon={false}
              greeting="Hey! What would make this better for you?"
              nudge={false}
            >
              <FeatureBoard height="100%" />
            </YouAsked>
          </div>
          {card && <InAppCard key={card.n} kind={card.kind} onClose={onClose} onPrimary={card.kind === "nudge" ? ask : undefined} />}
          <div className="ph-home" aria-hidden="true">
            <i />
          </div>
        </div>
      </div>
    </figure>
  );
}

/** The in-app card, as the SDK shows it: slides up over the app, closes itself after a while. */
function InAppCard({ kind, onClose, onPrimary }: { kind: Card; onClose: () => void; onPrimary?: () => void }) {
  const c = CARDS[kind];
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = () => {
    setLeaving(true);
    timer.current = setTimeout(onClose, 260);
  };
  useEffect(() => {
    const t = setTimeout(close, 6500);
    return () => {
      clearTimeout(t);
      clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className={leaving ? "ph-card leaving" : "ph-card"} role="status" data-kind={kind}>
      <div className="ph-card-top">
        <span className="ph-card-kicker">
          {kind === "shipped" && <i className="ph-live" aria-hidden="true" />}
          {c.kicker}
        </span>
        <button type="button" className="ph-card-x" aria-label="Dismiss" onClick={close} />
      </div>
      {kind === "nudge" ? (
        <div className="ph-card-nudge">
          <span className="ph-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M6 2.25h12a4.5 4.5 0 0 1 4.5 4.5V15a4.5 4.5 0 0 1-4.5 4.5h-6.75L6 23.25V19.5A4.5 4.5 0 0 1 1.5 15V6.75A4.5 4.5 0 0 1 6 2.25Z" fill="currentColor" />
              <path d="M7.9 13.9 12 9.8l4.1 4.1" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="ph-card-title">{c.title}</p>
        </div>
      ) : (
        <p className="ph-card-title">{c.title}</p>
      )}
      <p className={c.quote ? "ph-card-body quote" : "ph-card-body"}>{c.quote ? `“${c.body}”` : c.body}</p>
      <div className="ph-card-actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            close();
            onPrimary?.();
          }}
        >
          {c.actions[0]}
        </button>
        <button type="button" onClick={close}>
          {c.actions[1]}
        </button>
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="ph-status" aria-hidden="true">
      <span className="ph-time">9:41</span>
      <span className="ph-island" />
      <span className="ph-icons">
        <svg viewBox="0 0 18 12" width="18" height="12">
          <rect x="0" y="7.5" width="3" height="4.5" rx="1" />
          <rect x="5" y="5" width="3" height="7" rx="1" />
          <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
          <rect x="15" y="0" width="3" height="12" rx="1" />
        </svg>
        <svg viewBox="0 0 16 12" width="16" height="12">
          <path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3A10.6 10.6 0 0 0 8 .4C5.2.4 2.5 1.5.5 3.4l1.2 1.3A8.8 8.8 0 0 1 8 2.2Z" />
          <path d="M8 5.6c1.5 0 2.9.6 4 1.6l1.2-1.3A7.4 7.4 0 0 0 8 3.8c-2 0-3.8.8-5.2 2.1L4 7.2a5.6 5.6 0 0 1 4-1.6Z" />
          <path d="M8 9.1c.6 0 1.2.2 1.7.6L8 11.6 6.3 9.7c.5-.4 1.1-.6 1.7-.6Z" />
        </svg>
        <svg viewBox="0 0 27 12" width="27" height="12">
          <rect x="0.5" y="0.5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.4" />
          <rect x="2" y="2" width="20" height="8" rx="2" />
          <path d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4Z" fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  );
}
