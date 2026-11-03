import { useSyncExternalStore } from "react";
import { YouAsked } from "@youasked/react";
import { API, SITE_KEY } from "./content";
import { SiteFooter, SiteNav } from "./v3/HomeV3";
import { routeFor } from "./routes";

// The site runs YouAsked on itself: the launcher in the corner is a real board for YouAsked.
const SITE_LOOK = {
  accent: "#2b4bee",
  background: "#ffffff",
  foreground: "#0b1020",
  muted: "#5b6380",
  surface: "#f1f3f9",
  border: "#e4e7f0",
  radius: 16,
  fontFamily: 'Switzer, system-ui, sans-serif',
  mode: "light" as const,
};

/** The whole site: the page for this path, inside the shared nav and the live YouAsked launcher. */
export function Site({ path }: { path: string }) {
  const route = routeFor(path);
  const Page = route.component;
  // Icon-only launcher on phones, so it doesn't sit over the content.
  const wide = useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia("(min-width: 700px)");
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 700px)").matches,
    () => false,
  );
  return (
    <YouAsked
      appKey={SITE_KEY}
      apiUrl={API}
      appearance={SITE_LOOK}
      appName="YouAsked"
      appIcon="/apple-touch-icon.png"
      greeting="Hey! What should YouAsked do next?"
      label={wide ? "Ask us" : undefined}
    >
      {route.bare ? null : (
        <div className="v3 v3-chrome">
          <SiteNav />
        </div>
      )}
      {route.path === "/" || route.bare ? (
        <Page />
      ) : (
        <>
          <main>
            <Page />
          </main>
          <div className="v3 v3-chrome">
            <SiteFooter />
          </div>
        </>
      )}
    </YouAsked>
  );
}
