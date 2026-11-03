import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AskAbout, AskBar, AskForIt, FeatureBoard, FeatureCard, RequestButton, YouAsked, useYouAsked } from "../src";
import keys from "./keys.json";

const params = new URLSearchParams(location.search);
const graidenLook = params.get("look") !== "default";
// ?user=<id>&sig=<hmac> signs in as someone else; ?demo=1 runs with no server.
const who = params.get("user") ? { id: params.get("user")!, name: params.get("name") ?? params.get("user")! } : keys.sig ? { id: "you", name: "You" } : null;
const sig = params.get("sig") ?? keys.sig ?? null;
const appearance = graidenLook
  ? { accent: "var(--accent)", background: "var(--surface-1)", foreground: "var(--text-1)", muted: "var(--text-2)", surface: "var(--surface-2)", border: "var(--hairline)", radius: 16 }
  : undefined;

function Label({ n, children }: { n: string; children: string }) {
  return (
    <p className="label">
      <span>{n}</span>
      {children}
    </p>
  );
}

function Home() {
  const { open } = useYouAsked();
  const [q, setQ] = useState("export to excel");
  return (
    <div className="app">
      <header>
        <b>Graiden</b>
        <div className="hdr-actions">
          <RequestButton variant="icon" />
          <button className="ghost" onClick={() => document.documentElement.classList.toggle("dark")}>
            Dark
          </button>
        </div>
      </header>
      <Label n="1">Ask bar</Label>
      <AskBar />
      <section className="card">
        <p className="muted">This month</p>
        <p className="big">$1,284.20</p>
      </section>
      <Label n="2">Feature card</Label>
      <FeatureCard />
      <Label n="3">Ask about a feature · empty search</Label>
      <section className="card">
        <p className="muted">Spending by category</p>
        <p className="big">Charts</p>
        <AskAbout topic="charts" prompt="Want more from charts?" />
      </section>
      <section className="card search">
        <input placeholder="Search expenses" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="muted">No expenses match “{q}”.</p>
        <AskForIt query={q} />
      </section>
      <Label n="4">Buttons: pill · icon (top right) · settings row</Label>
      <div className="row">
        <RequestButton variant="pill" label="Suggest a feature" />
      </div>
      <div className="settings">
        <RequestButton variant="row" />
        <button className="fake-row" onClick={() => open({ view: "new", draft: "Export to Excel" })}>
          Locked feature → opens with a draft
        </button>
      </div>
      <Label n="5">Embedded page</Label>
      <FeatureBoard height={600} />
      <p className="foot">6 · The launcher bubble is bottom-right.</p>
    </div>
  );
}

function Root() {
  return (
    <YouAsked
      demo={params.get("demo") === "1"}
      appKey={keys.publicKey}
      apiUrl={keys.apiUrl ?? "http://localhost:8833"}
      user={who}
      signature={sig}
      trigger={params.get("launcher") === "0" ? "none" : "floating"}
      appearance={appearance}
    >
      <Home />
    </YouAsked>
  );
}
createRoot(document.getElementById("root")!).render(<Root />);
