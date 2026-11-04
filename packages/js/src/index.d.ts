/** YouAsked for any website. Docs: https://youasked.dev/docs#web */

export type Appearance = {
  /** "auto" follows the page (a `.dark` class, data-theme, or its background). */
  mode?: "auto" | "light" | "dark";
  /** Brand colour for buttons, votes and links. Any CSS colour, including `var(--your-token)`. */
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  surface?: string;
  border?: string;
  /** Corners of cards, rows and the sheet. A number is px; any CSS length works. */
  radius?: string | number;
  /** Corners of buttons, the ask bar, the composer and chips: a number in px, any CSS length, or "pill". */
  buttonRadius?: string | number | "pill";
  fontFamily?: string;
  /** Set false to ignore the page's shadcn-style tokens (--primary, --background, …). */
  inherit?: boolean;
};

export type User = { id: string | number; email?: string | null; name?: string | null };

export type NudgeSettings = {
  everyDays: number;
  activeSeconds: number;
  skipVisits: number;
  message: string | null;
  position: "bottom" | "top";
};

export type Options = {
  /** Publishable key (ya_pub_…). Safe in client code. Not needed with `demo`. */
  appKey?: string;
  /** Sample data and a pretend team, no network. */
  demo?: boolean;
  user?: User | null;
  /** HMAC-SHA256 of user.id with your secret key, made on your server. */
  signature?: string | null;
  /** false while you're still fetching the signature. */
  ready?: boolean;
  appearance?: Appearance;
  /** "floating" adds the corner launcher; "none" if you use the elements or your own buttons. */
  trigger?: "floating" | "none";
  position?: "bottom-right" | "bottom-left";
  /** Text beside the launcher icon. */
  label?: string;
  appName?: string;
  appIcon?: string | false;
  greeting?: string;
  title?: string;
  /** Distance in px from the bottom edge, e.g. to clear a tab bar. */
  offset?: number;
  /** The corner cards for replies, shipped requests and what's new. */
  cards?: boolean;
  /** The occasional "Got an idea?" prompt. Set it up in the dashboard; this overrides it. */
  nudge?: boolean | Partial<NudgeSettings>;
  apiUrl?: string;
};

export type OpenOptions = {
  view?: "home" | "new" | "board" | "shipped" | "mine";
  requestId?: string;
  draft?: string;
  topic?: string;
};

export type YouAskedApi = {
  init(options: Options): YouAskedApi;
  update(options: Partial<Options>): YouAskedApi;
  identify(user: User | null, signature?: string | null): YouAskedApi;
  open(options?: OpenOptions): void;
  destroy(): void;
};

export declare function init(options: Options): YouAskedApi;
export declare function update(options: Partial<Options>): YouAskedApi;
export declare function identify(user: User | null, signature?: string | null): YouAskedApi;
export declare function open(options?: OpenOptions): void;
export declare function destroy(): void;
export declare const api: YouAskedApi;
declare const _default: YouAskedApi;
export default _default;

declare global {
  interface Window {
    YouAsked: YouAskedApi;
    YouAskedOptions?: Options;
  }
  interface HTMLElementTagNameMap {
    "youasked-ask-bar": HTMLElement;
    "youasked-feature-card": HTMLElement;
    "youasked-request-button": HTMLElement;
    "youasked-ask-about": HTMLElement;
    "youasked-board": HTMLElement;
  }
}
