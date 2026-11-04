// Bundles @youasked/react with Preact (through preact/compat) into two self-contained files, so a site
// needs no React: dist/index.js (ESM, for Vue, Svelte, Angular, Nuxt, Astro…) and dist/youasked.js
// (a script tag; sets window.YouAsked and starts itself from data- attributes).
import { build } from "esbuild";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const compat = require.resolve("preact/compat");
const jsx = require.resolve("preact/jsx-runtime");

const shared = {
  bundle: true,
  target: "es2019",
  minify: true,
  jsx: "automatic",
  jsxImportSource: "preact",
  logLevel: "info",
  legalComments: "none",
  alias: { react: compat, "react-dom": compat, "react-dom/client": compat, "react/jsx-runtime": jsx },
  define: { "process.env.NODE_ENV": '"production"' },
};

await build({ ...shared, entryPoints: ["src/index.tsx"], format: "esm", outfile: "dist/index.js" });
await build({ ...shared, entryPoints: ["src/script.ts"], format: "iife", outfile: "dist/youasked.js" });
