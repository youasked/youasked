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
            <Tile title="An occasional prompt" code="<YouAsked nudge />" wide>
              <div className="p5-nudge">
                <NudgePreview />
                <ul className="p5-nudge-rules" aria-label="Default settings, all changeable in the dashboard">
                  <li>Once a week at most</li>
                  <li>After 30 seconds of use</li>
                  <li>Never on a first visit</li>
                  <li>Backs off when dismissed</li>
                </ul>
              </div>
            </Tile>
          </div>
        </Demo>
      </div>
    </section>
  );
}

/** The prompt as the SDK draws it, standing still so it can be read. */
function NudgePreview() {
  return (
    <div className="ph-card p5-nudge-card" aria-label="The occasional prompt">
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
        <p className="ph-card-title">Got an idea for your app?</p>
      </div>
      <p className="ph-card-body">Ask for a feature or vote on what others want.</p>
      <div className="ph-card-actions">
        <span className="primary">Share an idea</span>
        <span>Not now</span>
      </div>
    </div>
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
