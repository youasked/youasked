import { createContext, useContext, type CSSProperties } from "react";
import type { Client, Config } from "./client";

export type OpenOptions = {
  /** "home" is the chat-style start screen; "new" opens it with the composer focused. */
  view?: "home" | "new" | "board" | "shipped" | "mine";
  requestId?: string;
  /** Pre-fills the composer, e.g. "Export to Excel" from a locked feature. */
  draft?: string;
};

export type Route =
  | { view: "home"; draft?: string; focus?: boolean }
  | { view: "board"; tab?: "top" | "new" | "shipped" }
  | { view: "detail"; id: string }
  | { view: "mine" };

export function toRoute(o: OpenOptions = {}): Route {
  if (o.requestId) return { view: "detail", id: o.requestId };
  switch (o.view) {
    case "new":
      return { view: "home", draft: o.draft, focus: true };
    case "board":
      return { view: "board" };
    case "shipped":
      return { view: "board", tab: "shipped" };
    case "mine":
      return { view: "mine" };
    default:
      return { view: "home", draft: o.draft, focus: Boolean(o.draft) };
  }
}

export type InternalContext = {
  open: (options?: OpenOptions) => void;
  close: () => void;
  isOpen: boolean;
  unseenCount: number;
  client: Client;
  config: Config | null;
  markSeen: (ids: string[]) => void;
  /** Spread onto any element that renders widget UI inside the host page. */
  scope: { className: string; style?: CSSProperties; "data-ya-mode"?: string };
  appName: string;
  /** The app's icon: from the appIcon prop, else the page's apple-touch-icon or a large favicon, else null. */
  appIcon: string | null;
  title: string;
  greeting?: string;
};

export const YouAskedContext = createContext<InternalContext | null>(null);

export function useInternal(): InternalContext {
  const ctx = useContext(YouAskedContext);
  if (!ctx) throw new Error("YouAsked components must be rendered inside <YouAsked>…</YouAsked>");
  return ctx;
}

/** Open, close and the unseen badge count, for wiring YouAsked to your own buttons. */
export function useYouAsked() {
  const { open, close, isOpen, unseenCount } = useInternal();
  return { open, close, isOpen, unseenCount };
}

/** Opens the panel from anywhere, even outside React. */
export function openYouAsked(options?: OpenOptions) {
  window.dispatchEvent(new CustomEvent("youasked:open", { detail: options ?? {} }));
}
