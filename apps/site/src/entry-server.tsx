// Build-time render of the landing page, so crawlers and AI agents that don't run
// JavaScript still get the full page. scripts/prerender.mjs injects it into dist/index.html.
import { renderToString } from "react-dom/server";
import { App } from "./App";
export { SITE } from "./content";

export function render() {
  return renderToString(<App />);
}
