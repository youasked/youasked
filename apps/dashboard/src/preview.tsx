// The live preview on the "Your message" page: a stand-in app with the real widget running in demo
// mode, driven by the form through postMessage, so what the developer types is exactly what people see.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { YouAsked, openYouAsked, type Persona } from "@youasked/react";
import "./preview.css";

export type PreviewDraft = {
  appName: string;
  persona: Persona;
  message: string | null;
  place: "bottom" | "top";
  /** The corner message is switched on. Off, the corner shows just the button. */
  popup: boolean;
  view: "corner" | "chat";
  /** Bumped to show the message again (it types in once, like a real one). */
  replay: number;
};

function Preview() {
  const [d, setD] = useState<PreviewDraft | null>(null);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== "ya-preview") return;
      setD(e.data.draft as PreviewDraft);
    };
    addEventListener("message", on);
    parent.postMessage({ type: "ya-preview-ready" }, location.origin);
    return () => removeEventListener("message", on);
  }, []);

  // "In the chat" opens the sheet the way the message does.
  useEffect(() => {
    if (!d || d.view !== "chat") return;
    const t = setTimeout(() => openYouAsked({ view: "new", via: "message" }), 60);
    return () => clearTimeout(t);
  }, [d?.view, d?.replay]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null;
  return (
    <>
      <StandIn name={d.appName} />
      <YouAsked
        key={`${d.view}-${d.replay}`}
        demo="quiet"
        appName={d.appName}
        appIcon={false}
        persona={d.persona}
        // In the chat view the message never pops up (it would wait 9999s), but its words still start the chat.
        nudge={{ activeSeconds: d.view === "corner" && d.popup ? 0 : 9999, everyDays: 1, skipVisits: 0, message: d.message, position: d.place }}
      />
    </>
  );
}

/** A quiet, generic app behind the widget: just enough to read as "your app". */
function StandIn({ name }: { name: string }) {
  return (
    <div className="stand-in" aria-hidden="true">
      <header>
        <span className="si-logo">{name.trim().charAt(0).toUpperCase() || "A"}</span>
        <b>{name}</b>
      </header>
      <div className="si-hero" />
      <div className="si-lines">
        <i style={{ width: "72%" }} />
        <i style={{ width: "54%" }} />
      </div>
      {[0, 1, 2].map((n) => (
        <div className="si-row" key={n}>
          <span />
          <div>
            <i style={{ width: `${60 - n * 8}%` }} />
            <i style={{ width: `${38 + n * 6}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
