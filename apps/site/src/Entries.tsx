import { useState, type ReactNode } from "react";
import { AskAbout, AskBar, AskForIt, FeatureBoard, FeatureCard, RequestButton, YouAsked, useYouAsked } from "@youasked/react";
import { APP_LOOK } from "./Hero";
import { Reveal } from "./ui";

const ENTRIES = [
  { key: "ask", title: "Ask bar", code: "<AskBar />", desc: "Looks like a chat input. Tapping it opens the composer, ready to type." },
  { key: "card", title: "Feature card", code: "<FeatureCard />", desc: "The top requests with vote buttons, for a dashboard or home tab." },
  {
    key: "buttons",
    title: "Buttons",
    code: '<RequestButton variant="icon" />',
    desc: "A pill, a round header icon or a settings row. Each gets a badge when something ships.",
  },
  {
    key: "context",
    title: "Next to a feature",
    code: '<AskAbout topic="charts" />',
    desc: "A quiet prompt beside a feature, or in an empty search. Requests arrive tagged with where they came from.",
  },
  {
    key: "launcher",
    title: "Launcher",
    code: 'trigger="floating"',
    desc: "A chat bubble in the corner, like a support widget. There's a real one on this page.",
  },
  { key: "page", title: "Whole page", code: "<FeatureBoard />", desc: "Everything inline, for a /feedback route or its own tab." },
  {
    key: "code",
    title: "From your code",
    code: "open({ draft })",
    desc: "Open it from any button. A locked feature can open it with the request already typed.",
  },
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
            <YouAsked demo cards={false} offset={84} trigger="none" appearance={APP_LOOK} appName="Your App" appIcon={false}>
              <Preview k={key} />
            </YouAsked>
            <div className="code-chip">{codeFor(entry.key)}</div>
            <div className="preview-legend" aria-hidden="true">
              <span>
                <i className="l-host" /> Your app
              </span>
              <span>
                <i className="l-ya" /> YouAsked
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function codeFor(k: Key): ReactNode {
  switch (k) {
    case "ask":
      return (
        <>
          {"<AskBar "}
          <span className="k">placeholder</span>=<span className="s">"Ask for a feature…"</span>
          {" />"}
        </>
      );
    case "card":
      return (
        <>
          {"<FeatureCard "}
          <span className="k">limit</span>={"{3}"}
          {" />"}
        </>
      );
    case "buttons":
      return (
        <>
          {"<RequestButton "}
          <span className="k">variant</span>=<span className="s">"pill"</span> | <span className="s">"icon"</span> | <span className="s">"row"</span>
          {" />"}
        </>
      );
    case "context":
      return (
        <>
          {"<AskAbout "}
          <span className="k">topic</span>=<span className="s">"charts"</span>
          {" />  <AskForIt "}
          <span className="k">query</span>={"{search}"}
          {" />"}
        </>
      );
    case "launcher":
      return (
        <>
          {"<YouAsked "}
          <span className="k">appKey</span>=<span className="s">"ya_pub_…"</span> <span className="k">trigger</span>=<span className="s">"floating"</span>
          {" />"}
        </>
      );
    case "page":
      return (
        <>
          {"<FeatureBoard "}
          <span className="k">start</span>=<span className="s">"board"</span>
          {" />"}
        </>
      );
    case "code":
      return (
        <>
          {"open({ "}
          <span className="k">view</span>: <span className="s">"new"</span>, <span className="k">draft</span>: <span className="s">"Export to Excel"</span>
          {" })"}
        </>
      );
  }
}

function Preview({ k }: { k: Key }) {
  if (k === "page") {
    return (
      <div className="mock-app" style={{ padding: 0, overflow: "hidden", height: 540 }}>
        <FeatureBoard height="100%" className="page-board" />
      </div>
    );
  }
  const expenses = (
    <div className="app-card host host-box" style={{ padding: "6px 16px" }}>
      <div className="app-row">
        <span className="ic">🛒</span>Groceries<span className="amt">$86.40</span>
      </div>
      <div className="app-row">
        <span className="ic">🚕</span>Taxi<span className="amt">$18.20</span>
      </div>
    </div>
  );
  return (
    <div className="mock-app">
      <div className="mock-top">
        <b className="host">Your App</b>
        <div className="mock-icons">
          {k === "buttons" && <RequestButton variant="icon" />}
          <span className="mock-circle host host-box" aria-hidden="true">
            ⟳
          </span>
        </div>
      </div>
      {k === "ask" && <AskBar />}
      <div className="app-card host host-box">
        <div className="k">This month</div>
        <div className="v">$1,284.20</div>
      </div>
      {k === "card" && <FeatureCard />}
      {k === "buttons" && (
        <>
          <div style={{ marginTop: 8 }}>
            <RequestButton variant="pill" label="Suggest a feature" />
          </div>
          <div style={{ marginTop: 22 }}>
            <RequestButton variant="row" />
          </div>
        </>
      )}
      {k === "code" && <LockedFeature />}
      {k === "context" && (
        <>
          <div className="app-card host-box">
            <div className="k host">Spending by week</div>
            <div className="mini-chart host" aria-hidden="true">
              {[38, 64, 46, 80, 58, 92, 70].map((h, i) => (
                <i key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
            <AskAbout topic="charts" prompt="Want more from charts?" />
          </div>
          <div className="app-card host-box">
            <div className="mock-search host host-box">⌕ split bills</div>
            <p className="mock-empty host">No expenses match “split bills”.</p>
            <AskForIt query="split bills" />
          </div>
        </>
      )}
      {(k === "ask" || k === "launcher" || k === "code") && expenses}
      {k === "launcher" && (
        <>
          <p className="mock-note host">The real launcher is in the bottom corner of this page. Try it.</p>
          <div style={{ height: 70 }} />
          <span>
            <span className="mock-fab" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3.5c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.8L5.2 20.5l4.1-2.06c.86.2 1.76.31 2.7.31 4.97 0 9-3.47 9-7.75S16.97 3.5 12 3.5Z" />
                <path d="M8.2 13.2 12 9.4l3.8 3.8" strokeWidth={2.6} />
              </svg>
            </span>
          </span>
        </>
      )}
    </div>
  );
}

function LockedFeature() {
  const { open } = useYouAsked();
  return (
    <button type="button" className="mock-locked host-box" onClick={() => open({ view: "new", draft: "Export to Excel" })}>
      <div>
        Export to Excel
        <br />
        <span>Not available yet. Tap to ask for it.</span>
      </div>
      🔒
    </button>
  );
}
