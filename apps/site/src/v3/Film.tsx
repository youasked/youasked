import { useEffect, useRef, useState } from "react";
import { Mark } from "./Mark";

/*
 * The hero film: one request travelling the whole loop, shown with real screens from Graiden
 * (our expense tracker, in its demo mode) and the places a developer sees it. Four chapters play
 * in order and loop; the chapter bar under the stage shows where it is and jumps on click.
 */

type Frame = "ideas" | "sheet" | "posted" | "reply" | "shipped" | "told";

const STEPS = [
  { key: "ask", title: "They ask", line: "inside your app", ms: 5200 },
  { key: "hear", title: "You hear it", line: "in Telegram, Slack or Discord", ms: 5000 },
  { key: "ship", title: "You ship it", line: "with a commit", ms: 4200 },
  { key: "told", title: "They're told", line: "where they asked", ms: 5600 },
] as const;

const TOTAL = STEPS.reduce((n, s) => n + s.ms, 0);

const REQUEST = "Remind me before a subscription renews";
const REPLY = "Good idea. We'll use the renewal dates from your receipts, so it works without linking a bank.";
const COMMIT = 'git commit -m "Renewal reminders (closes GR-14)"';

/** Where the loop is: which chapter, and how far into it. */
function at(t: number) {
  let left = t % TOTAL;
  for (let i = 0; i < STEPS.length; i++) {
    if (left < STEPS[i].ms) return { step: i, local: left };
    left -= STEPS[i].ms;
  }
  return { step: STEPS.length - 1, local: STEPS[STEPS.length - 1].ms };
}

const startOf = (step: number) => STEPS.slice(0, step).reduce((n, s) => n + s.ms, 0);

/** Which Graiden screen is up, and where the finger taps before it changes. */
function frameAt(step: number, local: number): { frame: Frame; tap?: [number, number] } {
  if (step === 0) {
    if (local < 1500) return { frame: "ideas", tap: local > 900 ? [50, 76] : undefined };
    if (local < 3300) return { frame: "sheet" };
    return { frame: "posted" };
  }
  if (step === 1) return { frame: local < 3600 ? "posted" : "reply" };
  if (step === 2) return { frame: "reply" };
  if (local < 2300) return { frame: "shipped", tap: local > 1500 ? [24, 83] : undefined };
  return { frame: "told" };
}

const typed = (text: string, local: number, from: number, cps = 42) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor(((local - from) / 1000) * cps))));

function useClock(paused: boolean) {
  const [t, setT] = useState(0);
  const base = useRef<number | null>(null);
  const offset = useRef(0);
  useEffect(() => {
    if (paused) {
      base.current = null;
      return;
    }
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      if (base.current === null) base.current = now - offset.current;
      // ~30 fps is plenty for typing and fades; the bars and fades themselves run in CSS.
      if (now - last > 33) {
        last = now;
        offset.current = now - base.current;
        setT(offset.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused]);
  const jump = (ms: number) => {
    offset.current = ms;
    base.current = null;
    setT(ms);
  };
  return [t, jump] as const;
}

export function Film() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(mq.matches);
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const [t, jump] = useClock(!visible || still);
  // Reduced motion: hold the last chapter with everything in place.
  const { step, local } = still ? { step: 3, local: STEPS[3].ms } : at(t);
  const { frame, tap } = frameAt(step, local);

  // The developer's side is on screen while they hear it and ship it; the last chapter is the phone's.
  const tgOn = step === 1 || step === 2;
  const tgMsg = step > 1 || local > 300;
  const replyText = step > 1 ? REPLY : typed(REPLY, local, 1300, 46);
  const replySent = step > 1 || (step === 1 && local > 3400);
  const termOn = step === 2;
  const commitText = step > 2 ? COMMIT : step === 2 ? typed(COMMIT, local, 300, 30) : "";
  const pushed = step > 2 || (step === 2 && local > 2100);
  const shipped = step > 2 || (step === 2 && local > 2900);

  return (
    <div className={visible && !still ? "f" : "f paused"} ref={root}>
      <div className="f-stage" data-step={STEPS[step].key}>
        <svg className="f-wires" viewBox="0 0 640 640" aria-hidden="true">
          <path className={tgOn ? "on" : ""} d="M290 186 C 306 186, 304 262, 320 262" />
          <path className={termOn ? "on" : ""} d="M292 476 C 306 476, 304 440, 320 440" />
        </svg>

        <figure className="f-phone-wrap">
          <figcaption className="f-ctx">
            <img src="/film/graiden-icon.png" alt="" width={20} height={20} />
            <span>
              <b>Graiden</b>, our expense tracker, running YouAsked
            </span>
          </figcaption>
          <div className="f-phone">
            <div className="f-screen">
              {(["ideas", "sheet", "posted", "reply", "shipped", "told"] as Frame[]).map((f) => (
                <img
                  key={f}
                  src={`/film/${f}.webp`}
                  alt={f === frame ? ALT[f] : ""}
                  aria-hidden={f === frame ? undefined : true}
                  className={f === frame ? "on" : undefined}
                  width={320}
                  height={693}
                  loading={f === "ideas" ? "eager" : "lazy"}
                  decoding="async"
                />
              ))}
              {tap && <i className="f-tap" style={{ left: `${tap[0]}%`, top: `${tap[1]}%` }} />}
            </div>
            <i className="f-cam" />
            <i className="f-btn a" />
            <i className="f-btn b" />
          </div>
        </figure>

        <div className={tgOn ? "f-card f-tg on" : "f-card f-tg"} aria-hidden={!tgOn}>
          <div className="fx-tg-head">
            <span className="fx-av">
              <Mark size={18} fill="#fff" ink="#2b4bee" />
            </span>
            <div>
              <b>YouAsked</b>
              <span>bot</span>
            </div>
          </div>
          <div className="fx-tg-body">
            <div className={tgMsg ? "fx-in on" : "fx-in"}>
              <p className="fx-kicker">New request in Graiden</p>
              <p className="fx-title">{REQUEST}</p>
              <p className="fx-meta">3 votes, first asked today</p>
            </div>
            <div className={tgMsg ? "fx-kb on" : "fx-kb"}>
              <span className={step === 1 && local > 900 && local < 1300 ? "hit" : undefined}>Reply</span>
              <span>Planned</span>
              <span>Merge</span>
            </div>
            {replyText && (
              <div className="fx-out">
                {replyText}
                <time>{replySent ? "sent to 3 people" : ""}</time>
              </div>
            )}
          </div>
        </div>

        <div className={termOn ? "f-card f-term on" : "f-card f-term"} aria-hidden={!termOn}>
          <div className="fx-term-head">
            <i />
            <i />
            <i />
            <span>graiden · main</span>
          </div>
          <pre>
            <span className="p">$</span> {commitText}
            {step === 2 && !pushed && <span className="caret" />}
            {pushed && (
              <>
                {"\n"}
                <span className="p">$</span> git push
              </>
            )}
            {shipped && (
              <>
                {"\n"}
                <span className="ok">✓</span> <b>GR-14 shipped.</b> Telling the 3 people who asked.
              </>
            )}
          </pre>
        </div>
      </div>

      <ol className="f-steps" aria-label="How a request travels">
        {STEPS.map((s, i) => (
          <li key={s.key} className={i === step ? "on" : i < step ? "done" : undefined}>
            <button type="button" onClick={() => jump(startOf(i) + 1)}>
              <span className="bar">
                <i key={i === step ? `${s.key}-${Math.floor(t / TOTAL)}` : s.key} style={i === step && !still ? { animationDuration: `${s.ms}ms` } : undefined} />
              </span>
              <b>{s.title}</b>
              <span>{s.line}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

const ALT: Record<Frame, string> = {
  ideas: "Graiden's home screen with a card asking what to build next",
  sheet: "The YouAsked sheet open in Graiden, with popular requests",
  posted: `A request posted in Graiden: ${REQUEST}`,
  reply: "A reply card in Graiden from the developer",
  shipped: "A what's new card in Graiden: one thing shipped, including something you asked for",
  told: "The YouAsked sheet in Graiden saying that one was yours, thanks for asking",
};
