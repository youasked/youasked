import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use the widget's source so the site always shows the current components.
  resolve: { alias: { "@youasked/react": new URL("../../packages/react/src/index.ts", import.meta.url).pathname } },
});
