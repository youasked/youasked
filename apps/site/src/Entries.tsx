import { useState, type ReactNode } from "react";
import { AskAbout, AskBar, AskForIt, FeatureBoard, FeatureCard, RequestButton, YouAsked, useYouAsked } from "@youasked/react";
import { GRAIDEN_LOOK } from "./Hero";
import { Reveal } from "./ui";

const ENTRIES = [
  { key: "ask", title: "Ask bar", code: "<AskBar />", desc: "Looks like a chat input. Tapping it opens the composer, ready to type." },
  { key: "card", title: "Feature card", code: "<FeatureCard />", desc: "The top requests with vote buttons, for a dashboard or home tab." },
  { key: "buttons", title: "Buttons", code: '<RequestButton variant="icon" />', desc: "A pill, a round header icon or a settings row. Each gets a badge when something ships." },
  { key: "context", title: "Next to a feature", code: '<AskAbout topic="charts" />', desc: "A quiet prompt beside a feature, or in an empty search. Requests arrive tagged with where they came from." },
  { key: "launcher", title: "Launcher", code: 'trigger="floating"', desc: "A chat bubble in the corner, like a support widget. There's a real one on this page." },
  { key: "page", title: "Whole page", code: "<FeatureBoard />", desc: "Everything inline, for a /feedback route or its own tab." },
  { key: "code", title: "From your code", code: "open({ draft })", desc: "Open it from any button. A locked feature can open it with the request already typed." },
] as const;

type Key = (typeof ENTRIES)[number]["key"];

export function Entries() {
  const [key, setKey] = useState<Key>("ask");
  const entry = ENTRIES.find((e) => e.key === key)!;
  return (
    <section className="section" id="entry-points">
      <div className="wrap">
        <Reveal className="section-head">
          <h2 className="h2">Pick a way in. They all feel built in.</h2>
          <p className="lede">Pick the ones that fit your app. They all open the same sheet, in your colours, your font and your dark mode.</p>
        </Reveal>
        <div className="entries">
          <div className="entry-list" role="tablist" aria-label="Entry points">
            {ENTRIES.map((e) => (
              <button key={e.key} type="button" role="tab" className="entry-btn" aria-selected={key === e.key} onClick={() => setKey(e.key)}>
                <span className="t">{e.title}</span>
                <span className="d">{e.desc}</span>
                <code>{e.code}</code>
              </button>
            ))}
          </div>
          <div className="entry-frame">
            <YouAsked demo cards={false} offset={84} trigger="none" appearance={GRAIDEN_LOOK} appName="Graiden" appIcon={false}>
              <Preview k={key} />
            </YouAsked>
            <div className="code-chip">{codeFor(entry.key)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function codeFor(k: Key): ReactNode {
  switch (k) {
    case "ask":
      return <>{"<AskBar "}<span className="k">placeholder</span>=<span className="s">"Ask for a feature…"</span>{" />"}</>;
    case "card":
      return <>{"<FeatureCard "}<span className="k">limit</span>={"{3}"}{" />"}</>;
    case "buttons":
      return <>{"<RequestButton "}<span className="k">variant</span>=<span className="s">"pill"</span> | <span className="s">"icon"</span> | <span className="s">"row"</span>{" />"}</>;
    case "context":
      return <>{"<AskAbout "}<span className="k">topic</span>=<span className="s">"charts"</span>{" />  <AskForIt "}<span className="k">query</span>={"{search}"}{" />"}</>;
    case "launcher":
      return <>{"<YouAsked "}<span className="k">appKey</span>=<span className="s">"ya_pub_…"</span> <span className="k">trigger</span>=<span className="s">"floating"</span>{" />"}</>;
    case "page":
      return <>{"<FeatureBoard "}<span className="k">start</span>=<span className="s">"board"</span>{" />"}</>;
    case "code":
      return <>{"open({ "}<span className="k">view</span>: <span className="s">"new"</span>, <span className="k">draft</span>: <span className="s">"Export to Excel"</span>{" })"}</>;
  }
}

function Preview({ k }: { k: Key }) {
  if (k === "page") {
    return (
      <div className="mock-app" style={{ padding: 0, overflow: "hidden", height: 560 }}>
        <FeatureBoard height="100%" className="page-board" />
      </div>
    );
  }
  return (
    <div className="mock-app">
      <div className="mock-top">
        <b>Graiden</b>
        <div className="mock-icons">
          {k === "buttons" && <RequestButton variant="icon" />}
          <span className="mock-circle" aria-hidden="true">
            ⟳
          </span>
        </div>
      </div>
      {k === "ask" && <AskBar />}
      <div className="app-card">
        <div className="k">This month</div>
        <div className="v">$1,284.20</div>
      </div>
      {k === "card" && <FeatureCard />}
      {k === "buttons" && (
        <>
          <div>
            <RequestButton variant="pill" label="Suggest a feature" />
          </div>
          <RequestButton variant="row" />
        </>
      )}
      {k === "code" && <LockedFeature />}
      {k === "context" && (
        <>
          <div className="app-card">
            <div className="k">Spending by week</div>
            <div className="mini-chart" aria-hidden="true">
              {[38, 64, 46, 80, 58, 92, 70].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <AskAbout topic="charts" prompt="Want more from charts?" />
          </div>
          <div className="app-card">
            <div className="mock-search">⌕ split bills</div>
            <p className="mock-empty">No expenses match “split bills”.</p>
            <AskForIt query="split bills" />
          </div>
        </>
      )}
      {(k === "ask" || k === "launcher" || k === "code") && (
        <div className="app-card" style={{ padding: "6px 16px" }}>
          <div className="app-row">
            <span className="ic">🛒</span>FairPrice<span className="amt">$86.40</span>
          </div>
          <div className="app-row">
            <span className="ic">🚕</span>Grab<span className="amt">$18.20</span>
          </div>
        </div>
      )}
      {k === "launcher" && (
        <>
          <p className="mock-note">The real launcher is in the bottom corner of this page. Try it.</p>
          <div style={{ height: 70 }} />
          <span className="mock-fab" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11.5a8 8 0 0 1-11.3 7.3L4 20l1.2-4.4A8 8 0 1 1 20 11.5Z" />
              <path d="m12 8 .9 1.8 1.9.3-1.4 1.3.3 1.9-1.7-.9-1.7.9.3-1.9-1.4-1.3 1.9-.3Z" fill="currentColor" strokeWidth={1} />
            </svg>
          </span>
        </>
      )}
    </div>
  );
}

function LockedFeature() {
  const { open } = useYouAsked();
  return (
    <button type="button" className="mock-locked" onClick={() => open({ view: "new", draft: "Export to Excel" })}>
      <div>
        Export to Excel
        <br />
        <span>Not available yet. Tap to ask for it.</span>
      </div>
      🔒
    </button>
  );
}

