// The homepage. A shader-lit hero with the glass mark and one generic product card that plays the
// whole loop (ask, vote, ship, tell); then the real components, the agent setup, pricing and FAQ.
// No app names and no phone mockups: the product is the card, and the components below are live.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AskAbout, AskBar, FeatureCard, RequestButton } from "@youasked/react";
import { AGENT_PROMPT } from "../content";
import { GUARANTEE_DAYS, money, price } from "../plans-view";
import { CopyButton } from "../ui";
import { Agents, Demo, Faq, PricingRow, SiteFooter, SiteNav } from "../v3/HomeV3";
import { CARDS, Phone, type Card } from "./Phone";
import { Shader } from "./Shader";
import { Showcase } from "./Showcase";
import "../v3/v3.css";
import "./v5.css";

export function HomeV5() {
  return (
    <div className="v3 v5">
      <SiteNav startDark />
      <main>
        <Hero />
        <Try />
        <MakeItYours />
        <Places />
        <Agents />
        <PricingRow />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="h5" data-dark>
      <div className="h5-sky" aria-hidden="true">
        <Shader className="h5-shader" />
      </div>
      <div className="h5-in">
        <img className="h5-mark" src="/brand/mark-glass.png" alt="" width={168} height={183} />
        <h1>
          You asked.
          <br />
          It's live.
        </h1>
        <p className="h5-lede">
          Feature requests that live inside your app. People ask and vote where they already are, you hear it on your phone, and
          everyone who asked is told when you ship.
        </p>
        <div className="h5-cta">
          <a className="pill pill-primary" href="https://app.youasked.dev">
            <span>Get started</span>
          </a>
          <CopyButton text={AGENT_PROMPT} label="Copy setup prompt" />
        </div>
        <p className="h5-note">
          Free while you build on localhost. Plans from {money(price("solo", "month", true))} a month, with a {GUARANTEE_DAYS}‑day
          money-back guarantee.
        </p>
        <div className="h5-show" id="how">
          <Showcase />
        </div>
      </div>
    </section>
  );
}

/** The real sheet on a phone, live, with a few things to try and the in-app cards on demand. */
function Try() {
  const [card, setCard] = useState<{ kind: Card; n: number } | null>(null);
  const n = useRef(0);
  const show = (kind: Card) => setCard({ kind, n: ++n.current });
  const root = useRef<HTMLDivElement>(null);
  // The first time the phone comes into view, it shows the prompt that invites people in.
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        t = setTimeout(() => setCard((c) => c ?? { kind: "nudge", n: ++n.current }), 1800);
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return (
    <section className="v3-section t5" id="try">
      <div className="v3-wrap t5-in">
        <div className="t5-copy">
          <h2>Try it. It's the real thing.</h2>
          <p>This is the actual YouAsked sheet, the one the people who use your app would see, running here in demo mode. Nothing you do in it is saved.</p>
          <ul className="t5-list">
            <li>
              <b>It asks for you</b>
              <span>Every so often a small card says “Got an idea?”, so people don't have to go looking. You choose how often.</span>
            </li>
            <li>
              <b>Type “dark mode”</b>
              <span>It finds the request that already exists, so you vote instead of asking twice.</span>
            </li>
            <li>
              <b>Get told in the app</b>
              <span>When you reply or ship, a card shows up the next time they open your app. No email, no push setup.</span>
            </li>
          </ul>
        </div>
        <div className="t5-phone" ref={root}>
          <Phone card={card} onClose={() => setCard(null)} />
        </div>
        <div className="t5-send">
          <span>Send one to the phone</span>
          <div className="t5-send-row">
            {(["nudge", "shipped", "reply"] as Card[]).map((k) => (
              <button key={k} type="button" className={card?.kind === k ? "on" : undefined} onClick={() => show(k)}>
                {CARDS[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const ACCENTS = [
  { name: "Cobalt", value: "#2b4bee" },
  { name: "Violet", value: "#6c4cf6" },
  { name: "Coral", value: "#f0533f" },
  { name: "Emerald", value: "#0e9f6e" },
  { name: "Amber", value: "#d97f06" },
  { name: "Ink", value: "#15171c" },
];
const FONTS = [
  { name: "Switzer", value: "Switzer, system-ui, sans-serif", code: "Switzer, sans-serif" },
  { name: "System", value: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", code: "system-ui" },
  { name: "Serif", value: "Fraunces, Georgia, serif", code: "Fraunces, serif" },
  { name: "Mono", value: '"JetBrains Mono", ui-monospace, monospace', code: "JetBrains Mono, monospace" },
];
const BUTTONS = [
  { name: "Pill", value: "pill" as const },
  { name: "Rounded", value: 12 },
  { name: "Square", value: 4 },
];
const DARK = { background: "#11141f", foreground: "#f3f5fb", surface: "#1c2131", border: "#272d40", muted: "#8e94aa" };
const LIGHT = { background: "#ffffff", foreground: "#0b0d12", surface: "#f3f4f8", border: "#e8e9ef", muted: "#6e7385" };

/** Theme the real sheet live: colours, corners, button shape, font and dark mode, and the one prop it takes. */
function MakeItYours() {
  const [accent, setAccent] = useState(ACCENTS[1].value);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [radius, setRadius] = useState(18);
  const [button, setButton] = useState<(typeof BUTTONS)[number]>(BUTTONS[0]);
  const [font, setFont] = useState(FONTS[0]);
  const look = { ...(mode === "dark" ? DARK : LIGHT), accent, mode, radius, buttonRadius: button.value, fontFamily: font.value };
  const q = (v: string | number) => (typeof v === "number" ? String(v) : `"${v}"`);
  return (
    <section className="v3-section m5" id="theming">
      <div className="v3-wrap m5-in">
        <div className="t5-phone m5-phone">
          <Phone look={look} />
        </div>
        <div className="m5-head">
          <h2>It looks like your app, because it's yours.</h2>
          <p>
            It picks up shadcn colours on its own. Everything else is one prop: colours, corners, button shape, font and dark mode. The same prop works on the web and in React Native.
          </p>
        </div>
        <div className="m5-controls">
            <div className="m5-group">
              <span className="m5-label">Accent</span>
              <div className="m5-swatches">
                {ACCENTS.map((a) => (
                  <button key={a.value} type="button" className="m5-swatch" style={{ background: a.value }} aria-label={a.name} aria-pressed={accent === a.value} onClick={() => setAccent(a.value)} />
                ))}
              </div>
            </div>
            <div className="m5-group">
              <span className="m5-label">Mode</span>
              <Seg options={["light", "dark"]} value={mode} label={(v) => (v === "light" ? "Light" : "Dark")} onChange={(v) => setMode(v as "light" | "dark")} />
            </div>
            <div className="m5-group">
              <label className="m5-label" htmlFor="m5-radius">
                Card corners <b>{radius}px</b>
              </label>
              <input id="m5-radius" className="m5-range" type="range" min={0} max={28} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ ["--p" as string]: `${(radius / 28) * 100}%` }} />
            </div>
            <div className="m5-group">
              <span className="m5-label">Buttons</span>
              <Seg options={BUTTONS.map((b) => b.name)} value={button.name} label={(v) => v} onChange={(v) => setButton(BUTTONS.find((b) => b.name === v)!)} />
            </div>
            <div className="m5-group m5-wide">
              <span className="m5-label">Font</span>
              <Seg options={FONTS.map((f) => f.name)} value={font.name} label={(v) => v} onChange={(v) => setFont(FONTS.find((f) => f.name === v)!)} />
            </div>
          </div>
        <pre className="m5-code" aria-label="The code for this look">
            <span className="k">{"<YouAsked"}</span> appearance={"{{"}
            {"\n  "}accent: <span className="s">{q(accent)}</span>,
            {"\n  "}mode: <span className="s">{q(mode)}</span>,
            {"\n  "}radius: <span className="n">{radius}</span>,
            {"\n  "}buttonRadius: <span className={typeof button.value === "number" ? "n" : "s"}>{q(button.value)}</span>,
            {"\n  "}fontFamily: <span className="s">{q(font.code)}</span>,
            {"\n"}
            {"}}"} <span className="k">{"/>"}</span>
          </pre>
      </div>
    </section>
  );
}

function Seg({ options, value, label, onChange }: { options: string[]; value: string; label: (v: string) => string; onChange: (v: string) => void }) {
  return (
    <div className="m5-seg" role="radiogroup">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} onClick={() => onChange(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

/** The real components, each on its own tile, with the one line of code that puts it there. */
function Places() {
  return (
    <section className="v3-section p5" id="entry-points">
      <div className="v3-wrap">
        <div className="v3-head">
          <h2>Put it where people already look.</h2>
          <p>These are the real components, running on this page. In your app they take your colours, your font and your dark mode.</p>
        </div>
        <Demo>
          <div className="p5-grid">
            <Tile title="A chat-style bar" code="<AskBar />">
              <AskBar />
            </Tile>
            <Tile title="A card of top ideas" code="<FeatureCard />" tall>
              <FeatureCard limit={2} />
            </Tile>
            <Tile title="A row in your settings" code={'<RequestButton variant="row" />'}>
              <div className="p5-surface">
                <RequestButton variant="row" />
              </div>
            </Tile>
            <Tile title="Next to any feature" code={'<AskAbout topic="charts" />'}>
              <div className="p5-surface p5-chart">
                <div className="bars" aria-hidden="true">
                  {[38, 62, 46, 80, 56, 92, 70].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <AskAbout topic="charts" prompt="Want more from charts?" />
              </div>
            </Tile>
            <Tile title="An occasional prompt, on your terms" code="<YouAsked nudge={…} />" wide>
              <NudgeConfig />
            </Tile>
          </div>
        </Demo>
      </div>
    </section>
  );
}

const EVERY = [1, 3, 7, 14, 30];
const AFTER = [10, 30, 60, 120];
const SKIP = [0, 1, 2, 4];

/** The prompt's settings, as the dashboard (or the nudge prop) takes them, with a live preview. */
function NudgeConfig() {
  const [everyDays, setEvery] = useState(7);
  const [activeSeconds, setAfter] = useState(30);
  const [skipVisits, setSkip] = useState(1);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");
  const [message, setMessage] = useState("Got an idea for your app?");
  const days = (n: number) => (n === 1 ? "day" : n === 7 ? "week" : n === 14 ? "2 weeks" : n === 30 ? "month" : `${n} days`);
  const secs = (n: number) => (n < 60 ? `${n} seconds` : n === 60 ? "a minute" : "2 minutes");
  // skipVisits n means it can first show on visit n + 1.
  const visits = (n: number) => ["first", "second", "third", "fourth", "fifth"][n] ?? `${n + 1}th`;
  const custom = message.trim() && message.trim() !== "Got an idea for your app?";
  return (
    <div className="nc">
      <div className="nc-stage" data-pos={position} aria-label="Preview of the prompt">
        <div className="nc-skel" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="ph-card nc-card">
          <div className="ph-card-top">
            <span className="ph-card-kicker">Help shape your app</span>
            <span className="ph-card-x" aria-hidden="true" />
          </div>
          <div className="ph-card-nudge">
            <span className="ph-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M6 2.25h12a4.5 4.5 0 0 1 4.5 4.5V15a4.5 4.5 0 0 1-4.5 4.5h-6.75L6 23.25V19.5A4.5 4.5 0 0 1 1.5 15V6.75A4.5 4.5 0 0 1 6 2.25Z" fill="currentColor" />
                <path d="M7.9 13.9 12 9.8l4.1 4.1" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="ph-card-title">{message.trim() || "Got an idea for your app?"}</p>
          </div>
          <p className="ph-card-body">Ask for a feature or vote on what others want.</p>
          <div className="ph-card-actions">
            <span className="primary">Share an idea</span>
            <span>Not now</span>
          </div>
        </div>
      </div>
      <div className="nc-panel">
        <p className="nc-sentence">
          Show it at most once every{" "}
          <Pick label="How often" value={everyDays} options={EVERY} text={days} onChange={setEvery} />, after{" "}
          <Pick label="After how long" value={activeSeconds} options={AFTER} text={secs} onChange={setAfter} /> of use, from their{" "}
          <Pick label="First visit it can show on" value={skipVisits} options={SKIP} text={visits} onChange={setSkip} /> visit, at the{" "}
          <Pick label="Where" value={position} options={["bottom", "top"]} text={(v) => `${v} of the screen`} onChange={(v) => setPosition(v as "bottom" | "top")} />.
        </p>
        <label className="nc-field">
          <span>Headline</span>
          <input value={message} maxLength={60} onChange={(e) => setMessage(e.target.value)} aria-label="Headline" />
        </label>
        <p className="nc-note">It also steps back each time someone dismisses it, and stays away from people who opened the sheet recently. Change any of this in your dashboard, without a release.</p>
        <pre className="m5-code nc-code" aria-label="The code for these settings">
          <span className="k">{"<YouAsked"}</span> nudge={"{{"}
          {"\n  "}everyDays: <span className="n">{everyDays}</span>, activeSeconds: <span className="n">{activeSeconds}</span>,
          {"\n  "}skipVisits: <span className="n">{skipVisits}</span>, position: <span className="s">"{position}"</span>,
          {custom ? (
            <>
              {"\n  "}message: <span className="s">"{message.trim().replace(/"/g, "\\\"")}"</span>,
            </>
          ) : null}
          {"\n"}
          {"}}"} <span className="k">{"/>"}</span>
        </pre>
      </div>
    </div>
  );
}

/** A choice inside a sentence: looks like part of the text, opens like a select. */
function Pick<T extends string | number>({ label, value, options, text, onChange }: { label: string; value: T; options: T[]; text: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <span className="nc-pick">
      <select aria-label={label} value={String(value)} onChange={(e) => onChange((typeof value === "number" ? Number(e.target.value) : e.target.value) as T)}>
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {text(o)}
          </option>
        ))}
      </select>
      <span aria-hidden="true">{text(value)}</span>
    </span>
  );
}

function Tile({ title, code, tall, wide, children }: { title: string; code: string; tall?: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <figure className={["p5-tile", tall && "tall", wide && "wide"].filter(Boolean).join(" ")}>
      <div className="p5-stage">{children}</div>
      <figcaption>
        <b>{title}</b>
        <code>{code}</code>
      </figcaption>
    </figure>
  );
}

function Closing() {
  return (
    <section className="c5" aria-labelledby="c5-title">
      <div className="h5-sky" aria-hidden="true">
        <Shader className="h5-shader" />
      </div>
      <div className="c5-in">
        <img className="c5-mark" src="/brand/mark-glass.png" alt="" width={132} height={144} loading="lazy" />
        <h2 id="c5-title">Give them a way to ask, and a reason to come back.</h2>
        <div className="h5-cta">
          <a className="pill pill-primary" href="https://app.youasked.dev">
            <span>Get started</span>
          </a>
          <CopyButton text={AGENT_PROMPT} label="Copy setup prompt" />
        </div>
      </div>
    </section>
  );
}
