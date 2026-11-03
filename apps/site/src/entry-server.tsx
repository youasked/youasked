// Build-time render of every page, so crawlers and AI agents that don't run JavaScript still get the
// full content. scripts/prerender.mjs writes each one to its own HTML file in dist/.
import { renderToString } from "react-dom/server";
import { Site } from "./App";
import { ROUTES, NOT_FOUND, jsonLdFor } from "./routes";
export { API, SITE } from "./content";

export const pages = [...ROUTES, NOT_FOUND].map((r) => ({
  path: r.path,
  title: r.title,
  description: r.description,
  hidden: Boolean(r.hidden),
  priority: r.priority ?? 0.5,
  jsonLd: jsonLdFor(r),
}));

export function render(path: string) {
  return renderToString(<Site path={path} />);
}
