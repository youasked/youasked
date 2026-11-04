// The script-tag build. Sets window.YouAsked, and starts itself when the tag carries data-app-key:
//
//   <script src="https://cdn.jsdelivr.net/npm/@youasked/js"
//           data-app-key="ya_pub_…" data-label="Ask us" data-accent="#2b4bee" defer></script>
import api, { init, type Options } from "./index";

declare global {
  interface Window {
    YouAsked: typeof api;
    YouAskedOptions?: Options;
  }
}

window.YouAsked = api;

const tag = document.currentScript as HTMLScriptElement | null;
const d = tag?.dataset ?? {};

function fromTag(): Options | null {
  // Options set on the page before the script loads win over the tag's data- attributes.
  if (window.YouAskedOptions) return window.YouAskedOptions;
  if (!d.appKey && d.demo === undefined) return null;
  const n = (v?: string) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
  const appearance = {
    ...(d.accent ? { accent: d.accent } : {}),
    ...(d.mode ? { mode: d.mode as "auto" | "light" | "dark" } : {}),
    ...(d.radius ? { radius: n(d.radius) ?? d.radius } : {}),
    ...(d.buttonRadius ? { buttonRadius: d.buttonRadius === "pill" ? ("pill" as const) : (n(d.buttonRadius) ?? d.buttonRadius) } : {}),
    ...(d.font ? { fontFamily: d.font } : {}),
  };
  return {
    appKey: d.appKey,
    demo: d.demo !== undefined,
    trigger: d.trigger === "none" ? "none" : "floating",
    position: d.position === "bottom-left" ? "bottom-left" : "bottom-right",
    label: d.label,
    appName: d.appName,
    apiUrl: d.apiUrl,
    offset: n(d.offset),
    nudge: d.nudge === "off" ? false : d.nudge === "on" ? true : undefined,
    // A page that signs users in later calls YouAsked.identify(); data-wait-for-user holds the widget until then.
    ready: d.waitForUser === undefined,
    appearance: Object.keys(appearance).length ? appearance : undefined,
  } as Options;
}

const start = () => {
  const opts = fromTag();
  if (opts) init(opts);
};
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
