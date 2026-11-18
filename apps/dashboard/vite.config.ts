import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The message preview runs the real widget from source, like the marketing site.
  resolve: { alias: { "@youasked/react": new URL("../../packages/react/src/index.ts", import.meta.url).pathname } },
  build: { rollupOptions: { input: { main: "index.html", preview: "preview.html" } } },
  // plans.ts lives in the API app, so the dashboard reads prices and limits from the one place they are defined.
  server: { fs: { allow: ["../.."] } },
});
