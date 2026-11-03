import { useState } from "react";
import { AskBar, FeatureCard, YouAsked } from "@youasked/react";
import { Reveal } from "./ui";

const ACCENTS = [
  { name: "Violet", value: "#5b3df5" },
  { name: "Cobalt", value: "#2b4bee" },
  { name: "Coral", value: "#ff6b57" },
  { name: "Emerald", value: "#0f9f6e" },
  { name: "Ink", value: "#111318" },
];

const FONTS = [
  { name: "Sans", value: '"Instrument Sans", system-ui, sans-serif' },
  { name: "Rounded", value: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' },
  { name: "Serif", value: 'Georgia, "Times New Roman", serif' },
];

export function Theming() {
  const [accent, setAccent] = useState(ACCENTS[0].value);
  const [radius, setRadius] = useState(16);
  const [dark, setDark] = useState(false);
  const [font, setFont] = useState(FONTS[0]);

  const appearance = {
    accent,
    radius,
    mode: dark ? ("dark" as const) : ("light" as const),
    fontFamily: font.value,
    background: dark ? "#1c1c1e" : "#ffffff",
    foreground: dark ? "#ffffff" : "#000000",
    surface: dark ? "#2c2c2e" : "#f2f2f7",
    border: dark ? "#2c2c2e" : "#e5e5ea",
    muted: dark ? "#98989f" : "#6c6c70",
  };

  return (
    <section className="section" id="theming" style={{ paddingTop: 0 }}>
      <div className="wrap theme-grid">
        <Reveal className="controls">
          <h2 className="h2">It looks like your app, because it is.</h2>
          <p className="lede">
            It picks up shadcn colours on its own. Anything else is one prop: colours, corners, font and dark mode, all following your theme as it changes.
          </p>
          <div>
            <div className="control-label">Accent</div>
            <div className="swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  className="swatch"
                  style={{ background: a.value }}
                  aria-label={a.name}
                  aria-pressed={accent === a.value}
                  onClick={() => setAccent(a.value)}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="control-label">Corners · {radius}px</div>
            <input type="range" min={0} max={24} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Corner radius" />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="control-label">Mode</div>
              <div className="seg">
                <button type="button" aria-pressed={!dark} onClick={() => setDark(false)}>
                  Light
                </button>
                <button type="button" aria-pressed={dark} onClick={() => setDark(true)}>
                  Dark
                </button>
              </div>
            </div>
            <div>
              <div className="control-label">Font</div>
              <div className="seg">
                {FONTS.map((f) => (
                  <button key={f.name} type="button" aria-pressed={font.name === f.name} onClick={() => setFont(f)}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="theme-code" aria-label="Code for this look">
            {"<YouAsked "}
            <span className="k">appearance</span>
            {"={{\n  "}
            <span className="k">accent</span>: <span className="s">"{accent}"</span>
            {",\n  "}
            <span className="k">radius</span>: {radius}
            {",\n  "}
            <span className="k">mode</span>: <span className="s">"{dark ? "dark" : "light"}"</span>
            {",\n}} />"}
          </div>
        </Reveal>
        <div className="entry-frame" style={{ minHeight: 600 }}>
          <YouAsked demo cards={false} offset={84} trigger="none" appearance={appearance} appName="Your App" appIcon={false}>
            <div className={dark ? "mock-app dark" : "mock-app"} style={{ fontFamily: font.value }}>
              <div className="mock-top">
                <b className="host" style={{ fontFamily: font.value }}>
                  Your App
                </b>
              </div>
              <AskBar />
              <div style={{ height: 8 }} />
              <FeatureCard limit={2} />
            </div>
          </YouAsked>
        </div>
      </div>
    </section>
  );
}
