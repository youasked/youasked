import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { Site } from "./App";
import "./styles.css";
import "./pages.css";

const root = document.getElementById("root")!;
const app = (
  <StrictMode>
    <Site path={location.pathname} />
  </StrictMode>
);
// The build pre-renders each page into #root; in dev it's empty.
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
