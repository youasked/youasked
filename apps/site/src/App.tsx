import { useSyncExternalStore } from "react";
import { YouAsked } from "@youasked/react";
import { API, SITE_KEY } from "./content";
import { Entries } from "./Entries";
import { Hero } from "./Hero";
import { Agents, Faq, Final, Nav, Pricing } from "./Sections";
import { Story } from "./Story";
import { Theming } from "./Theming";

// The site runs YouAsked on itself: the launcher in the corner is a real board for YouAsked.
const SITE_LOOK = {
  accent: "#2b4bee",
  background: "#ffffff",
  foreground: "#0b1020",
  muted: "#5b6380",
  surface: "#f1f3f9",
  border: "#e4e7f0",
  radius: 16,
  fontFamily: '"Instrument Sans", system-ui, sans-serif',
  mode: "light" as const,
};

export function App() {
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
      <Nav />
      <main>
        <Hero />
        <Story />
        <Entries />
        <Theming />
        <Agents />
        <Pricing />
        <Faq />
      </main>
      <Final />
    </YouAsked>
  );
}
