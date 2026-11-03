import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // plans.ts lives in the API app, so the dashboard reads prices and limits from the one place they are defined.
  server: { fs: { allow: ["../.."] } },
});
