import { createRoot } from "react-dom/client";
import { useState } from "react";
import { YouAsked, useYouAsked } from "../src";
import keys from "./keys.json";

function FakeApp() {
  const { open, unseenCount } = useYouAsked();
  return (
    <div className="app">
      <header>
        <b>Graiden</b>
        <button onClick={() => document.documentElement.classList.toggle("dark")}>Toggle dark</button>
      </header>
      <section className="card">
        <p className="muted">This month</p>
        <p className="big">$1,284.20</p>
      </section>
      <section className="card">
        <button className="menu" onClick={() => open()}>
          Request a feature {unseenCount > 0 && <span className="badge">{unseenCount}</span>}
        </button>
        <button className="menu" onClick={() => open({ view: "new" })}>Suggest something new</button>
      </section>
    </div>
  );
}

function Root() {
  const params = new URLSearchParams(location.search);
  const trigger = (params.get("trigger") as "floating" | "none") ?? "floating";
  return (
    <YouAsked
      appKey={keys.publicKey}
      apiUrl="http://localhost:8833"
      user={{ id: "you", name: "You" }}
      signature={keys.sig}
      trigger={trigger}
      appearance={params.get("graiden") ? { accent: "var(--accent)", background: "var(--surface-1)", foreground: "var(--text-1)", muted: "var(--text-2)", surface: "var(--surface-2)", border: "var(--hairline)", radius: 16 } : undefined}
    >
      <FakeApp />
    </YouAsked>
  );
}
createRoot(document.getElementById("root")!).render(<Root />);
