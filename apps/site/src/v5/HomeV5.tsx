// The homepage. A shader-lit hero with the glass mark and one generic product card that plays the
// whole loop (ask, vote, ship, tell); then the real components, the agent setup, pricing and FAQ.
// No app names and no phone mockups: the product is the card, and the components below are live.
import type { ReactNode } from "react";
import { AskAbout, AskBar, FeatureCard, RequestButton } from "@youasked/react";
import { AGENT_PROMPT } from "../content";
import { GUARANTEE_DAYS, money, price } from "../plans-view";
import { CopyButton } from "../ui";
import { Agents, Demo, Faq, PricingRow, SiteFooter, SiteNav } from "../v3/HomeV3";
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
          </div>
        </Demo>
      </div>
    </section>
  );
}

function Tile({ title, code, tall, children }: { title: string; code: string; tall?: boolean; children: ReactNode }) {
  return (
    <figure className={tall ? "p5-tile tall" : "p5-tile"}>
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
