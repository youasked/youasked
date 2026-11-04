import { useEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "../Logos";

/*
 * The hero's product card. One request, "Dark mode", goes through the whole loop in four states.
 * No app around it and no app name: the card is the YouAsked sheet itself (and, for Ship, the
 * message you get). Tabs show where it is, advance on their own, jump on click, and hovering the
 * card holds the current state so it can be read.
 */

const STATES = [
  { key: "ask", label: "Ask", ms: 5600, line: "People ask without leaving your app. If someone already asked, they vote instead." },
  { key: "vote", label: "Vote", ms: 5000, line: "The ideas people want most rise to the top. There's no spreadsheet to keep." },
  { key: "ship", label: "Ship", ms: 4800, line: "You hear it in Telegram, Slack or Discord, and mark it shipped from there or from a commit." },
  { key: "tell", label: "Tell", ms: 5600, line: "Everyone who asked or voted is told it's live, the next time they open your app." },
] as const;
type Key = (typeof STATES)[number]["key"];

const TYPED = "Dark mode for the dashboard";

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const typed = (text: string, ms: number, from: number, cps = 20) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor(((ms - from) / 1000) * cps))));

function useTimeline(paused: boolean) {
  const [state, setState] = useState(0);
  const [ms, setMs] = useState(0);
  const at = useRef({ state: 0, ms: 0 });
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      let { state: s, ms: m } = at.current;
      m += dt;
      if (m >= STATES[s].ms) {
        s = (s + 1) % STATES.length;
        m = 0;
      }
      at.current = { state: s, ms: m };
      setState(s);
      setMs(m);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  const go = (s: number) => {
    at.current = { state: s, ms: 0 };
    setState(s);
    setMs(0);
  };
  return { state, ms, go };
}

export function Showcase() {
  const root = useRef<HTMLDivElement>(null);
  const [hold, setHold] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [still, setStill] = useState(false);
  useEffect(() => {
    setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const { state, ms, go } = useTimeline(hold || offscreen || still);
  // Reduced motion: every state shows its finished frame, and the tabs switch on click only.
  const t = still ? 1e6 : ms;
  const key: Key = STATES[state].key;

  return (
    <div className="sc" ref={root}>
      <div className="sc-tabs" role="tablist" aria-label="How a request travels">
        {STATES.map((s, i) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={i === state}
            className={i === state ? "on" : undefined}
            onClick={() => go(i)}
          >
            <span className="sc-tab-fill" style={i === state ? { width: `${still ? 100 : (ms / s.ms) * 100}%` } : undefined} />
            <span className="sc-tab-label">{s.label}</span>
          </button>
        ))}
      </div>
      <p className="sc-line" aria-live="polite">
        {STATES[state].line}
      </p>

      <div
        className="sc-card"
        data-state={key}
        onMouseEnter={() => setHold(true)}
        onMouseLeave={() => setHold(false)}
        onFocus={() => setHold(true)}
        onBlur={() => setHold(false)}
      >
        {key === "ask" && <Ask t={t} />}
        {key === "vote" && <Vote t={t} />}
        {key === "ship" && <Ship t={t} />}
        {key === "tell" && <Tell t={t} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function SheetHead({ title = "Feature requests", sub = "Ideas, votes and what's new" }: { title?: string; sub?: string }) {
  return (
    <div className="sc-head">
      <div>
        <b>{title}</b>
        <span>{sub}</span>
      </div>
      <i className="sc-x" aria-hidden="true" />
    </div>
  );
}

function Votes({ n, on, pop }: { n: number; on?: boolean; pop?: boolean }) {
  return (
    <span className={on ? "sc-votes on" : "sc-votes"}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 7.5 6 4l3.5 3.5" />
      </svg>
      <b key={pop ? n : undefined} className={pop ? "bump" : undefined}>
        {n}
      </b>
    </span>
  );
}

function Chip({ kind, children }: { kind: "planned" | "doing" | "shipped"; children: ReactNode }) {
  return <span className={`sc-chip ${kind}`}>{children}</span>;
}

/* ------------------------------------------------------------------ Ask */

function Ask({ t }: { t: number }) {
  const text = typed(TYPED, t, 500);
  const suggest = t > 2300;
  const voted = t > 3700;
  return (
    <div className="sc-pane">
      <SheetHead />
      <div className="sc-bubble">What would make this better for you?</div>
      <div className="sc-grow" />
      <div className={suggest ? "sc-suggest on" : "sc-suggest"}>
        <p>Sounds like one of these. Vote instead?</p>
        <div className="sc-row">
          <Votes n={voted ? 32 : 31} on={voted} pop={voted} />
          <div className="sc-row-main">
            <b>Dark mode</b>
            <Chip kind="planned">Planned</Chip>
          </div>
          <span className={voted ? "sc-mini done" : t > 3300 ? "sc-mini press" : "sc-mini"}>{voted ? "Voted" : "Vote"}</span>
        </div>
      </div>
      <div className={text ? "sc-input typing" : "sc-input"}>
        <span className={text ? "" : "sc-placeholder"}>{text || "Ask for a feature…"}</span>
        {!voted && text.length < TYPED.length && <i className="sc-caret" />}
        <span className="sc-send" />
      </div>
      <p className={voted ? "sc-foot on" : "sc-foot"}>Your vote's in. You'll hear when it ships.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ Vote */

const LIST = [
  { id: "dark", title: "Dark mode", from: 32, to: 48, chip: <Chip kind="planned">Planned</Chip> },
  { id: "csv", title: "Export to CSV", from: 24, to: 25, chip: <Chip kind="doing">In progress</Chip> },
  { id: "offline", title: "Offline mode", from: 21, to: 27, chip: null },
  { id: "widget", title: "Home screen widget", from: 9, to: 11, chip: null },
];

function Vote({ t }: { t: number }) {
  const k = ease((t - 400) / 3600);
  const rows = LIST.map((r) => ({ ...r, n: Math.round(r.from + (r.to - r.from) * k) }));
  const order = [...rows].sort((a, b) => b.n - a.n || a.from - b.from);
  return (
    <div className="sc-pane">
      <SheetHead />
      <p className="sc-label">Popular right now</p>
      <div className="sc-list" style={{ height: rows.length * 64 }}>
        {rows.map((r) => {
          const i = order.findIndex((o) => o.id === r.id);
          const rising = r.n !== r.from && r.n !== r.to;
          return (
            <div key={r.id} className="sc-row sc-abs" style={{ transform: `translateY(${i * 64}px)` }}>
              <Votes n={r.n} on={r.id === "dark"} pop={rising} />
              <div className="sc-row-main">
                <b>{r.title}</b>
                {r.chip}
              </div>
              {rising && <span className="sc-plus" key={`${r.id}${r.n}`}>+1</span>}
            </div>
          );
        })}
      </div>
      <div className="sc-grow" />
      <p className="sc-foot on">
        <b>{Math.round(32 + 16 * k)}</b> people want dark mode
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ Ship */

function Ship({ t }: { t: number }) {
  const msg = t > 300;
  const press = t > 2000 && t < 2500;
  const shipped = t > 2400;
  return (
    <div className="sc-pane sc-dev">
      <div className="sc-dev-head">
        <span className="sc-bot" aria-hidden="true">
          <svg viewBox="0 0 64 64">
            <path d="M16 6h32a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H30L16 62V52a12 12 0 0 1-12-12V18A12 12 0 0 1 16 6Z" fill="#fff" />
            <path d="M21 37 32 26l11 11" fill="none" stroke="#2b4bee" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <b>YouAsked</b>
          <span>in your Telegram</span>
        </div>
        <span className="sc-apps" aria-label="Also Slack and Discord">
          <Logo k="telegram" size={16} />
          <Logo k="slack" size={16} mono="#fff" />
          <Logo k="discord" size={16} />
        </span>
      </div>
      <div className="sc-chat">
        <div className={msg ? "sc-msg on" : "sc-msg"}>
          <span className="sc-msg-kicker">Most wanted this week</span>
          <b>Dark mode</b>
          <span className="sc-msg-meta">48 votes and 3 comments</span>
          <p>“Easier on the eyes at night, and it'd match the rest of my phone.”</p>
        </div>
        <div className={msg ? "sc-keys on" : "sc-keys"}>
          <span>Planned</span>
          <span className={press ? "hit" : shipped ? "chosen" : undefined}>Shipped</span>
          <span>Reply</span>
        </div>
        {shipped && (
          <div className="sc-status">
            <i className="sc-ok" aria-hidden="true" />
            Marked shipped. Telling the 48 people who asked.
          </div>
        )}
        <div className={t > 3200 ? "sc-commit on" : "sc-commit"}>
          <span>or from a commit</span>
          <code>git commit -m "Dark mode (closes #12)"</code>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Tell */

function Tell({ t }: { t: number }) {
  const toast = t > 500;
  return (
    <div className="sc-pane">
      <SheetHead />
      <div className={toast ? "sc-live on" : "sc-live"}>
        <span className="sc-burst" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ ["--a" as string]: `${i * 36}deg` }} />
          ))}
        </span>
        <span className="sc-live-icon" aria-hidden="true" />
        <div>
          <span className="sc-live-kicker">It's live</span>
          <b>Dark mode is here</b>
          <p>You asked for this one. Thanks for the idea.</p>
        </div>
      </div>
      <p className="sc-label">Recently shipped</p>
      <div className="sc-row">
        <Votes n={48} on />
        <div className="sc-row-main">
          <b>Dark mode</b>
          <Chip kind="shipped">Shipped</Chip>
        </div>
        <span className="sc-yours">You asked</span>
      </div>
      <div className="sc-row dim">
        <Votes n={8} />
        <div className="sc-row-main">
          <b>Keyboard shortcuts</b>
          <Chip kind="shipped">Shipped</Chip>
        </div>
      </div>
      <div className="sc-grow" />
      <p className="sc-foot on">48 people were told, right where they asked.</p>
    </div>
  );
}
