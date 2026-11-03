import { build } from "esbuild";

const shared = { bundle: true, format: "esm", target: "es2020", outdir: "dist", logLevel: "info" };

await build({
  ...shared,
  entryPoints: ["src/index.ts"],
  external: ["react", "react-dom", "react/jsx-runtime"],
  jsx: "automatic",
  // Next.js App Router needs the directive at the top of the bundle; esbuild drops it from sources.
  banner: { js: '"use client";' },
});

await build({ ...shared, entryPoints: ["src/server.ts"], platform: "neutral" });
