// The redesigned homepage. The product isn't pictured, it's here: the real YouAsked widget runs in the
// page, laid into the same grid as the text, and a cobalt line drawing shows where each request goes.
import { useState, type ReactNode } from "react";
import { AskAbout, AskBar, FeatureBoard, FeatureCard, RequestButton, YouAsked } from "@youasked/react";
import { AGENT_PROMPT, INSTALL_CMD, MCP_CMD } from "../content";
import { LANDING_FAQ } from "../faq";
import { Logo } from "../Logos";
import { FOUNDING_SLOTS, GUARANTEE_DAYS, PLANS, PLAN_ORDER, money, perMonth, price, type Interval } from "../plans-view";
import { CopyButton } from "../ui";
import { Mark, Wordmark } from "./Mark";
import "./v3.css";

// The pretend app the widget sits in: calm, neutral, so YouAsked's cobalt is the only colour.
const ACME = {
  accent: "#2b4bee",
  background: "#ffffff",
  foreground: "#0b0d12",
  muted: "#6e7385",
  surface: "#f3f4f7",
  border: "#e8e9ee",
  radius: 18,
  fontFamily: "Switzer, system-ui, sans-serif",
  mode: "light" as const,
};

function Demo({ children }: { children: ReactNode }) {
  return (
    <YouAsked demo cards={false} trigger="none" appearance={ACME} appName="Acme" appIcon={false} nudge={false}>
      {children}
    </YouAsked>
  );
}

export function HomeV3() {
  return (
    <div className="v3">
      <SiteNav />
      <main>
        <Hero />
        <Entries />
        <Loop />
        <Agents />
        <PricingRow />
        <Faq />
        <Closing />
      </main>
      <SiteFooter />
    </div>
  );
}

export function SiteNav() {
  return (
    <header className="v3-nav">
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
    <section className="v3-hero v3-rule">
      <div className="v3-wrap v3-hero-in">
        <div className="v3-hero-copy">
          <p className="v3-tag">
            <span className="v3-dot" />
            Feature requests for apps you ship yourself
          </p>
          <h1>
            You asked.
            <br />
            It's live.
          </h1>
          <p className="v3-lede">
            People ask and vote inside your app. You hear it on your phone. When you ship, everyone who asked is told, right where they asked.
          </p>
          <div className="v3-cta">
            <a className="v3-btn v3-btn-lg" href="https://app.youasked.dev">
              Start free on localhost
            </a>
            <CopyButton text={AGENT_PROMPT} label="Copy setup prompt" />
          </div>
          <div className="v3-cmd">
            <span>$</span> {INSTALL_CMD}
          </div>
        </div>
        <Canvas />
      </div>
    </section>
  );
}

/** The live widget, the app it lives in, and where a request travels next. */
function Canvas() {
  return (
    <div className="v3-canvas" aria-label="The real YouAsked widget, running in a sample app">
      <div className="v3-ghost" aria-hidden="true">
        <div className="g-top">
          <b>Acme</b>
          <i />
        </div>
        <div className="g-big">$1,284.20</div>
        <div className="g-sub">spent this month</div>
        {["FairPrice", "Common Man", "Grab", "Netflix", "Shell"].map((n) => (
          <div className="g-row" key={n}>
            <span />
            {n}
            <em />
          </div>
        ))}
      </div>

      <svg className="v3-wires" viewBox="0 0 700 640" aria-hidden="true">
        <path id="w1" d="M440 168 C 500 168, 500 96, 556 96" />
        <path id="w2" d="M604 196 C 604 250, 604 270, 604 318" />
        <path id="w3" d="M604 386 C 604 440, 560 470, 520 500" />
        <circle r="3.5" className="pulse">
          <animateMotion dur="5.5s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
            <mpath href="#w1" />
          </animateMotion>
        </circle>
        {[
          [440, 168],
          [556, 96],
          [604, 196],
          [604, 318],
          [604, 386],
          [520, 500],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" className="node" />
        ))}
      </svg>

      <div className="v3-live">
        <Demo>
          <FeatureBoard height={560} />
        </Demo>
      </div>

      <div className="v3-tg">
        <div className="tg-who">
          <span className="tg-av">
            <Mark size={14} fill="#fff" ink="var(--cobalt)" />
          </span>
          Acme requests
          <time>now</time>
        </div>
        <p className="tg-t">YA-12 · Split a bill with my partner</p>
        <p className="tg-m">Mei · 14 votes</p>
        <div className="tg-b">
          <span>Planned</span>
          <span>Shipped</span>
          <span>Reply</span>
        </div>
      </div>

      <div className="v3-commit">
        <span className="c-hash">a41f0c2</span>
        Split bills between two people, <b>closes YA-12</b>
      </div>

      <div className="v3-told">
        <span className="told-dot" />
        <div>
          <b>It's live. 14 people were told.</b>
          <span>“You asked for Split a bill with my partner.”</span>
        </div>
      </div>
    </div>
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

function Entries() {
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

/* ---------------------------------------------------------------- the loop */

const LoopIcons = {
  ask: (
    <svg viewBox="0 0 48 48">
      <path d="M13 7h22a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H23l-10 8v-8a8 8 0 0 1-8-8V15a8 8 0 0 1 8-8Z" />
      <path d="M17 27l7-7 7 7" />
    </svg>
  ),
  hear: (
    <svg viewBox="0 0 48 48">
      <rect x="7" y="9" width="34" height="30" rx="7" />
      <path d="M13 18h16M13 24h10" />
      <rect x="12" y="30" width="8" height="4" rx="2" />
      <rect x="22" y="30" width="8" height="4" rx="2" />
      <rect x="32" y="30" width="4" height="4" rx="2" />
    </svg>
  ),
  ship: (
    <svg viewBox="0 0 48 48">
      <path d="M4 24h12M32 24h12" />
      <circle cx="24" cy="24" r="8" />
      <path d="M24 4v6M24 38v6" strokeDasharray="2 4" />
    </svg>
  ),
  tell: (
    <svg viewBox="0 0 48 48">
      <path d="M13 7h22a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H23l-10 8v-8a8 8 0 0 1-8-8V15a8 8 0 0 1 8-8Z" />
      <path d="M16 22l6 6 11-11" />
    </svg>
  ),
};

const STEPS = [
  { k: "ask" as const, t: "They ask", d: "In your app, in a sheet that looks like part of it. Duplicates turn into votes as they type." },
  { k: "hear" as const, t: "You hear it", d: "A card in Telegram, Slack or Discord, with buttons to plan, reply or merge." },
  { k: "ship" as const, t: "You ship", d: "Write closes YA-12 in a commit. YouAsked marks it shipped and writes the note." },
  { k: "tell" as const, t: "They're told", d: "Everyone who asked or voted sees it's live, the next time they open your app." },
];

function Loop() {
  return (
    <section className="v3-section v3-rule v3-tint" id="how">
      <div className="v3-wrap">
        <div className="v3-head">
          <h2>One request, all the way to shipped.</h2>
          <p>Nobody has to check a dashboard. Each step reaches the people it's about.</p>
        </div>
        <ol className="v3-loop">
          {STEPS.map((s, i) => (
            <li key={s.k}>
              <div className="loop-icon">{LoopIcons[s.k]}</div>
              <span className="loop-n">0{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
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

function Agents() {
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

function PricingRow() {
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

function Faq() {
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
    <section className="v3-closing v3-rule">
      <div className="v3-wrap v3-closing-in">
        <img className="v3-object" src="/brand/mark-glass.png" alt="" width={360} height={360} loading="lazy" />
        <h2>You asked. It's live.</h2>
        <p>Give the people who use your app a way to ask, and a reason to come back.</p>
        <div className="v3-cta center">
          <a className="v3-btn v3-btn-lg" href="https://app.youasked.dev">
            Start free on localhost
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
