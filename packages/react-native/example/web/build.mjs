// Renders the example with react-native-web, so it can be screenshotted in headless Chrome.
// Usage: node web/build.mjs   (then serve web/out, or run web/shots.mjs)
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
mkdirSync(resolve(here, "out"), { recursive: true });

// Expo's modules aren't needed on web: stand in a status bar that renders nothing.
const stubs = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^expo-status-bar$/ }, () => ({ path: "expo-status-bar", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "export const StatusBar = () => null;", loader: "js" }));
  },
};

await build({
  entryPoints: [resolve(here, "main.tsx")],
  bundle: true,
  outfile: resolve(here, "out/bundle.js"),
  format: "iife",
  jsx: "automatic",
  platform: "browser",
  logLevel: "info",
  alias: { "react-native": resolve(root, "node_modules/react-native-web") },
  nodePaths: [resolve(root, "node_modules")],
  define: { __DEV__: "false", "process.env.NODE_ENV": '"production"', global: "window" },
  resolveExtensions: [".web.tsx", ".web.ts", ".tsx", ".ts", ".web.js", ".js", ".json"],
  plugins: [stubs],
});

writeFileSync(
  resolve(here, "out/index.html"),
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>YouAsked RN</title>
<style>html,body,#root{height:100%;margin:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#root{display:flex}</style></head>
<body><div id="root"></div><script src="bundle.js"></script></body></html>`,
);
console.log("built web/out");
