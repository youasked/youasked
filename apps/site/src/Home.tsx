import { Entries } from "./Entries";
import { Hero } from "./Hero";
import { Pricing } from "./Pricing";
import { Agents, FaqSection, Final } from "./Sections";
import { Story } from "./Story";
import { Theming } from "./Theming";

export function Home() {
  return (
    <>
      <main>
        <Hero />
        <Story />
        <Entries />
        <Theming />
        <Agents />
        <Pricing />
        <FaqSection />
      </main>
      <Final />
    </>
  );
}
