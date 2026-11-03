import { createContext, useContext, type CSSProperties } from "react";
import type { Client, Config, WhatsNew } from "./client";

export type OpenOptions = {
  /** "home" is the chat-style start screen; "new" opens it with the composer focused. */
  view?: "home" | "new" | "board" | "shipped" | "mine";
  requestId?: string;
  /** Pre-fills the composer, e.g. "Export to Excel" from a locked feature. */
  draft?: string;
  /**
   * What the request is about, e.g. "charts". It's saved with the request, and the composer asks
   * "What would make charts better?". "search" and "locked" are used by AskForIt and keep the default wording.
   */
  topic?: string;
  /** Replaces the composer's placeholder. */
  placeholder?: string;
};

export type Route =
  | { view: "home"; draft?: string; focus?: boolean; topic?: string; placeholder?: string }
  | { view: "board"; tab?: "top" | "new" | "shipped" }
  | { view: "detail"; id: string }
  | { view: "mine" };

/** Topics that tag a request without changing how the composer talks. */
const QUIET_TOPICS = new Set(["search", "locked"]);

export function toRoute(o: OpenOptions = {}): Route {
  if (o.requestId) return { view: "detail", id: o.requestId };
  const topic = o.topic?.trim() || undefined;
  const placeholder = o.placeholder ?? (topic && !o.draft && !QUIET_TOPICS.has(topic) ? `What would make ${topic} better?` : undefined);
  const scope = { topic, placeholder };
  switch (o.view) {
    case "new":
      return { view: "home", draft: o.draft, focus: true, ...scope };
    case "board":
      return { view: "board" };
    case "shipped":
      return { view: "board", tab: "shipped" };
    case "mine":
      return { view: "mine" };
    default:
      return { view: "home", draft: o.draft, focus: Boolean(o.draft || topic), ...scope };
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
  /** What shipped since this person's last visit, until they've been shown it. */
  whatsNew: WhatsNew | null;
  dismissWhatsNew: () => void;
  /**
   * Hides the sheet, lets the person draw on the page, and resolves with a screenshot of it
   * (null if they cancel or the page can't be captured).
   */
  pointAtIt: () => Promise<Blob | null>;
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
