// The homepage. The hero film follows one real request through Graiden (our expense tracker), Telegram
// and a commit; the sections below run the real YouAsked components in Graiden's colours.
import { useEffect, useState, type ReactNode } from "react";
import { AskAbout, AskBar, FeatureBoard, FeatureCard, RequestButton, YouAsked } from "@youasked/react";
import { AGENT_PROMPT, MCP_CMD } from "../content";
import { LANDING_FAQ } from "../faq";
import { Logo } from "../Logos";
import { FOUNDING_SLOTS, GUARANTEE_DAYS, PLANS, PLAN_ORDER, money, perMonth, price, type Interval } from "../plans-view";
import { CopyButton } from "../ui";
import { Film } from "./Film";
import { Wordmark } from "./Mark";
import "./v3.css";
import "./film.css";

// The widgets below wear a plain, generic look: YouAsked's cobalt on white. They take your app's look.
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

export function Demo({ children }: { children: ReactNode }) {
  return (
    <YouAsked demo cards={false} trigger="none" appearance={LOOK} appIcon={false} nudge={false}>
      {children}
    </YouAsked>
  );
}

export function HomeV3() {
  return (
    <div className="v3">
      <SiteNav startDark />
      <main>
        <Hero />
        <Entries />
        <Details />
        <Agents />
        <PricingRow />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

/** The bar goes dark while it sits over a dark hero (marked data-dark), and light everywhere else. */
export function SiteNav({ startDark = false }: { startDark?: boolean }) {
  const [dark, setDark] = useState(startDark);
  useEffect(() => {
    const hero = document.querySelector("[data-dark]");
    if (!hero) return;
    const on = () => setDark(hero.getBoundingClientRect().bottom > 64);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className="v3-nav" data-tone={dark ? "dark" : undefined}>
      <div className="v3-wrap v3-nav-in">
        <a href="/" aria-label="YouAsked home">
          <Wordmark />
        </a>
        <nav className="v3-links" aria-label="Main">
          <a href="/#how">How it works</a>
          <a href="/docs">Docs</a>
          <a href="/pricing">Pricing</a>
          <a href="/changelog">Changelog</a>
        </nav>
        <div className="v3-nav-cta">
          <a className="v3-quiet" href="https://app.youasked.dev">
            Sign in
          </a>
          <a className="v3-btn" href="https://app.youasked.dev">
            Get started
          </a>
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="v4-hero" data-dark>
      <div className="v3-wrap v4-hero-in">
        <div className="v4-hero-copy">
          <h1>
            You asked.
            <br />
            It's live.
          </h1>
          <p className="v4-lede">
            Feature requests that live inside your app. People ask and vote where they already are, you hear it on your phone, and
            when you ship, everyone who asked is told.
          </p>
          <div className="v4-cta">
            <a className="v4-btn" href="https://app.youasked.dev">
              Get started
            </a>
            <CopyButton text={AGENT_PROMPT} label="Copy setup prompt" />
          </div>
          <p className="v4-note">
            Free while you build on localhost. Plans from {money(price("solo", "month", true))} a month, with a {GUARANTEE_DAYS}‑day
            money-back guarantee.
          </p>
        </div>
        <Film />
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- entry points */

function Spec({ title, code, children, wide }: { title: string; code: string; children: ReactNode; wide?: boolean }) {
  return (
    <figure className={wide ? "v3-spec wide" : "v3-spec"}>
      <div className="v3-spec-stage">{children}</div>
      <figcaption>
        <span>{title}</span>
        <code>{code}</code>
      </figcaption>
    </figure>
  );
}

export function Entries() {
  return (
    <section className="v3-section v3-rule" id="entry-points">
      <div className="v3-wrap">
        <div className="v3-head">
          <h2>Put it where people already look.</h2>
          <p>Each one is the real component, running here. They follow your colours, font and dark mode, and all open the same sheet.</p>
        </div>
        <Demo>
          <div className="v3-specs">
            <Spec title="Ask bar" code="<AskBar />">
              <div className="mini-app">
                <div className="mini-title">Good morning</div>
                <AskBar />
              </div>
            </Spec>
            <Spec title="Feature card" code="<FeatureCard />">
              <FeatureCard limit={2} />
            </Spec>
            <Spec title="Settings row and header button" code={'<RequestButton variant="row" />'}>
              <div className="mini-stack">
                <div className="mini-head">
                  <b>Settings</b>
                  <RequestButton variant="icon" />
                </div>
                <RequestButton variant="row" />
              </div>
            </Spec>
            <Spec title="Next to a feature" code={'<AskAbout topic="charts" />'}>
              <div className="v3-chart">
                <div className="bars" aria-hidden="true">
                  {[40, 64, 48, 82, 58, 90, 70].map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <AskAbout topic="charts" prompt="Want more from charts?" />
              </div>
            </Spec>
          </div>
        </Demo>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- the details */

function Details() {
  return (
    <section className="v3-section v3-rule v3-tint" id="how">
      <div className="v3-wrap">
        <div className="v3-head">
          <h2>The small things that keep people asking.</h2>
          <p>Every screen here is Graiden running YouAsked. Nothing is mocked up.</p>
        </div>
        <div className="v4-details">
          <figure className="v4-detail">
            <figcaption>
              <h3>One idea, every vote</h3>
              <p>As someone types, they see what others already asked and can vote instead, so the same idea doesn't arrive twenty ways.</p>
            </figcaption>
            <img src="/film/d-dupes.webp" alt="Graiden suggesting existing requests that match what someone is typing" width={450} height={295} loading="lazy" />
          </figure>
          <figure className="v4-detail">
            <figcaption>
              <h3>Reply from your phone</h3>
              <p>Answer in Telegram, Slack or Discord. The person who asked reads it in your app, not in an email they'll never open.</p>
            </figcaption>
            <img src="/film/d-reply.webp" alt="A reply from the developer shown as a card inside Graiden" width={450} height={199} loading="lazy" />
          </figure>
          <figure className="v4-detail">
            <figcaption>
              <h3>Ship it from a commit</h3>
              <p>Write closes GR-14 and push. You can also tap Shipped in Telegram, or let your coding agent do it over MCP.</p>
            </figcaption>
            <pre className="v4-detail-term" aria-label="A commit that closes a request">
              <span className="p">$</span> git commit -m "Renewal reminders (closes GR-14)"{"\n"}
              <span className="p">$</span> git push{"\n"}
              <span className="ok">✓</span> <b>GR-14 shipped.</b> Telling the 3 people who asked.
            </pre>
          </figure>
          <figure className="v4-detail">
            <figcaption>
              <h3>They hear it was theirs</h3>
              <p>The next time they open your app, the people who asked see it's live and that it came from them.</p>
            </figcaption>
            <img src="/film/d-told.webp" alt="Graiden telling someone the feature they asked for has shipped" width={450} height={304} loading="lazy" />
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- agents */

const AGENTS = [
  ["claude", "Claude Code"],
  ["openai", "Codex"],
  ["cursor", "Cursor"],
] as const;

export function Agents() {
  return (
    <section className="v3-section v3-rule" id="agents">
      <div className="v3-wrap v3-agents">
        <div className="v3-head left">
          <h2>Set up by your coding agent.</h2>
          <p>Paste one prompt into Claude Code, Codex or Cursor. It looks at your app first, proposes where people should ask, then wires it in and signs your users.</p>
          <ul className="v3-agent-logos" aria-label="Works with">
            {AGENTS.map(([k, name]) => (
              <li key={k}>
                <Logo k={k} size={18} mono={k === "claude" ? undefined : "#0b0d12"} />
                {name}
              </li>
            ))}
          </ul>
        </div>
        <div className="v3-code">
          <div className="v3-code-bar">
            <span>Setup prompt</span>
            <CopyButton text={AGENT_PROMPT} label="Copy" />
          </div>
          <pre>{AGENT_PROMPT}</pre>
          <div className="v3-code-bar">
            <span>Let your agent ship requests</span>
            <CopyButton text={MCP_CMD} label="Copy" />
          </div>
          <pre className="one">{MCP_CMD}</pre>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- pricing */

export function PricingRow() {
  const [interval, setInterval] = useState<Interval>("year");
  return (
    <section className="v3-section v3-rule v3-tint" id="pricing">
      <div className="v3-wrap">
        <div className="v3-head">
          <h2>One flat price. Unlimited users and votes.</h2>
          <p>
            Free on localhost while you try it. The first {FOUNDING_SLOTS} workspaces keep the founding price for as long as they stay. {GUARANTEE_DAYS}-day money-back guarantee.
          </p>
        </div>
        <div className="v3-toggle" role="tablist" aria-label="Billing period">
          <button type="button" role="tab" aria-selected={interval === "month"} onClick={() => setInterval("month")}>
            Monthly
          </button>
          <button type="button" role="tab" aria-selected={interval === "year"} onClick={() => setInterval("year")}>
            Yearly <em>2 months free</em>
          </button>
        </div>
        <div className="v3-plans">
          {PLAN_ORDER.map((p) => {
            const full = price(p, interval, false);
            const founding = price(p, interval, true);
            const plan = PLANS[p];
            return (
              <div className={p === "pro" ? "v3-plan pick" : "v3-plan"} key={p}>
                <h3>{plan.name}</h3>
                <div className="amt">
                  {money(interval === "year" ? perMonth(founding) : founding)}
                  <span>/month</span>
                </div>
                <p className="was">
                  Founding price. Regularly {money(interval === "year" ? perMonth(full) : full)}
                  {interval === "year" ? ", billed yearly" : ""}
                </p>
                <ul>
                  <li>{Number.isFinite(plan.apps) ? `${plan.apps} app${plan.apps > 1 ? "s" : ""}` : "Unlimited apps"}</li>
                  <li>
                    {plan.members} team member{plan.members > 1 ? "s" : ""}
                  </li>
                  <li>{plan.listeningApps ? `Heard elsewhere on ${plan.listeningApps} app${plan.listeningApps > 1 ? "s" : ""}` : "Every entry point and integration"}</li>
                  <li>{plan.removeBranding ? "Remove the YouAsked line" : "Telegram, Slack, Discord, GitHub"}</li>
                </ul>
                <a className={p === "pro" ? "v3-btn" : "v3-btn line"} href="https://app.youasked.dev">
                  Start with {plan.name}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- faq, closing, footer */

export function Faq() {
  return (
    <section className="v3-section v3-rule" id="faq">
      <div className="v3-wrap v3-faq">
        <h2>Questions</h2>
        <div>
          {LANDING_FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="v3-closing v4-dark">
      <div className="v3-wrap v3-closing-in">
        <img className="v3-object" src="/brand/mark-glass.png" alt="" width={360} height={360} loading="lazy" />
        <h2>You asked. It's live.</h2>
        <p>Give the people who use your app a way to ask, and a reason to come back.</p>
        <div className="v3-cta center">
          <a className="v4-btn" href="https://app.youasked.dev">
            Get started
          </a>
          <CopyButton text={AGENT_PROMPT} label="Copy setup prompt" />
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="v3-footer">
      <div className="v3-wrap v3-footer-in">
        <Wordmark />
        <nav aria-label="Footer">
          <a href="/docs">Docs</a>
          <a href="/pricing">Pricing</a>
          <a href="/mcp">MCP</a>
          <a href="/alternatives">Alternatives</a>
          <a href="/changelog">Changelog</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
