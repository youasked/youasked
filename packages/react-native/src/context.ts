import { createContext, useContext } from "react";
import type { ImageSourcePropType } from "react-native";
import type { Client, Config, WhatsNew } from "./client";
import type { Styles } from "./styles";
import type { Theme } from "./theme";

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
  /** `from` is where Back goes: the list they opened it from. */
  | { view: "detail"; id: string; from?: "home" | "board" | "mine" }
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

/**
 * A way for the host app to attach a screenshot ("Show us"). Return an image the person took, or null
 * if they cancelled. Not built in yet: pass this if you have a capture library such as
 * react-native-view-shot, and the composer shows an "Add screenshot" button.
 */
export type CaptureScreenshot = () => Promise<{ uri: string } | null>;

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
  theme: Theme;
  styles: Styles;
  /** The API said this app is in test mode for this build: every component renders nothing. */
  disabled: boolean;
  appName: string;
  appIcon: ImageSourcePropType | null;
  title: string;
  greeting?: string;
  captureScreenshot?: CaptureScreenshot;
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

// ---------------------------------------------------------------- opening from outside React

const openers = new Set<(o?: OpenOptions) => void>();

export function registerOpener(fn: (o?: OpenOptions) => void) {
  openers.add(fn);
  return () => {
    openers.delete(fn);
  };
}

/** Opens the sheet from anywhere, such as a push-notification handler. */
export function openYouAsked(options?: OpenOptions) {
  openers.forEach((fn) => fn(options));
}

/** Lets the header of a sheet screen carry the swipe-down handlers (set by the sheet, absent when embedded). */
export const DragContext = createContext<Record<string, unknown> | null>(null);
