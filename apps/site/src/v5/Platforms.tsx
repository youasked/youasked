import { useState } from "react";
import { PLATFORM_LOGOS, type PlatformKey } from "../platform-logos";
import { CopyButton } from "../ui";

/*
 * What YouAsked runs on. A quiet logo row for the hero, and a section with the platforms grouped by
 * where you build and the few lines each SDK takes.
 */

export function PlatformIcon({ k, size = 20, color }: { k: PlatformKey; size?: number; color?: string }) {
  const l = PLATFORM_LOGOS[k];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: "none" }}>
      <path d={l.d} fill={color ?? (l.color === "#000000" || l.color === "#0F0F11" || l.color === "#1C2024" ? "currentColor" : l.color)} />
    </svg>
  );
}

const HERO_ROW: PlatformKey[] = ["react", "nextdotjs", "vuedotjs", "svelte", "angular", "expo", "swift", "kotlin", "html5"];

/** The logo row under the hero buttons. */
export function WorksWith() {
  return (
    <div className="ww" aria-label="Works with React, Next.js, Vue, Svelte, Angular, React Native and Expo, iOS, Android and any website">
      <span className="ww-label">Works with</span>
      <span className="ww-logos">
        {HERO_ROW.map((k) => (
          <span key={k} className="ww-logo" title={PLATFORM_LOGOS[k].name}>
            <PlatformIcon k={k} size={20} color="currentColor" />
          </span>
        ))}
      </span>
    </div>
  );
}

type Sdk = { key: string; label: string; logo: PlatformKey; pkg: string; install: string; code: string; docs: string };

const SDKS: Sdk[] = [
  {
    key: "react",
    label: "React",
    logo: "react",
    pkg: "@youasked/react",
    install: "npm install @youasked/react",
    docs: "/docs#install",
    code: `import { YouAsked } from "@youasked/react";

export default function App() {
  return (
    <YouAsked appKey="ya_pub_…">
      <YourApp />
    </YouAsked>
  );
}`,
  },
  {
    key: "rn",
    label: "React Native",
    logo: "expo",
    pkg: "@youasked/react-native",
    install: "npx expo install @youasked/react-native",
    docs: "/docs#react-native",
    code: `import { YouAsked } from "@youasked/react-native";

export default function Layout() {
  return (
    <YouAsked appKey="ya_pub_…">
      <Stack />
    </YouAsked>
  );
}`,
  },
  {
    key: "ios",
    label: "iOS",
    logo: "swift",
    pkg: "Swift Package",
    install: "https://github.com/youasked/youasked",
    docs: "/docs#ios",
    code: `import YouAsked

@main struct MyApp: App {
  init() {
    YouAsked.configure(appKey: "ya_pub_…")
  }
  var body: some Scene {
    WindowGroup {
      ContentView().youAsked()
    }
  }
}`,
  },
  {
    key: "android",
    label: "Android",
    logo: "kotlin",
    pkg: "Jetpack Compose",
    install: '"com.github.youasked.youasked:youasked:0.1.0"',
    docs: "/docs#android",
    code: `// Application.onCreate
YouAsked.configure(this, appKey = "ya_pub_…")

// your activity
setContent {
  YouAskedHost {
    AppContent()
  }
}`,
  },
  {
    key: "web",
    label: "Any website",
    logo: "html5",
    pkg: "@youasked/js",
    install: "npm install @youasked/js",
    docs: "/docs#web",
    code: `<!-- in your <head> -->
<script defer
  src="https://cdn.jsdelivr.net/npm/@youasked/js"
  data-app-key="ya_pub_…"></script>

<!-- anywhere on the page -->
<youasked-feature-card>
</youasked-feature-card>`,
  },
];

const GROUPS: { title: string; note: string; items: PlatformKey[] }[] = [
  { title: "Web", note: "React, Next.js, or a script tag for everything else", items: ["react", "nextdotjs", "vuedotjs", "svelte", "angular", "nuxt", "astro", "html5", "webflow", "wordpress"] },
  { title: "Mobile", note: "React Native and Expo, or fully native", items: ["react", "expo", "swift", "android"] },
];

const LABEL: Partial<Record<PlatformKey, string>> = { swift: "iOS, SwiftUI", android: "Android, Compose", html5: "Plain HTML" };

export function Platforms() {
  const [tab, setTab] = useState(SDKS[0].key);
  const sdk = SDKS.find((s) => s.key === tab)!;
  return (
    <section className="v3-section pf" id="platforms">
      <div className="v3-wrap pf-in">
        <div className="pf-copy">
          <h2>Wherever you build.</h2>
          <p>The same sheet, votes and in-app notices on the web, on iOS and on Android. One board, so a request from your iPhone app and one from your website add up.</p>
          {GROUPS.map((g) => (
            <div className="pf-group" key={g.title}>
              <div className="pf-group-head">
                <b>{g.title}</b>
                <span>{g.note}</span>
              </div>
              <ul className="pf-chips">
                {g.items.map((k, i) => (
                  <li key={`${k}${i}`}>
                    <PlatformIcon k={k} size={17} />
                    {g.title === "Mobile" && k === "react" ? "React Native" : (LABEL[k] ?? PLATFORM_LOGOS[k].name)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pf-code">
          <div className="pf-tabs" role="tablist" aria-label="Pick your platform">
            {SDKS.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={s.key === tab} onClick={() => setTab(s.key)}>
                <PlatformIcon k={s.logo} size={15} color="currentColor" />
                {s.label}
              </button>
            ))}
          </div>
          <div className="pf-panel" role="tabpanel">
            <div className="pf-install">
              <code>
                <span className="p">{sdk.key === "ios" ? "Swift Package" : sdk.key === "android" ? "Gradle, JitPack" : "$"}</span> {sdk.install}
              </code>
              <CopyButton text={sdk.install} label="Copy" />
            </div>
            <pre key={sdk.key}>{sdk.code}</pre>
            <a className="pf-docs" href={sdk.docs}>
              Read the {sdk.label} guide
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
