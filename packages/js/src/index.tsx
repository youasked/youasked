// YouAsked for any website. The React SDK, bundled with Preact, behind a small imperative API and a few
// custom elements, so it works the same in plain HTML, Vue, Svelte, Angular, Nuxt, Astro and no-code
// builders. One hidden root renders the widget; each custom element is a portal into that root, so they
// all share one sheet, one client and one set of notices.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal, render } from "react-dom";
import { AskAbout, AskBar, FeatureBoard, FeatureCard, RequestButton, YouAsked, openYouAsked, type YouAskedProps } from "@youasked/react";

export type Options = Omit<YouAskedProps, "children">;
type User = NonNullable<Options["user"]>;

let options: Options | null = null;
let mount: HTMLElement | null = null;
const hosts = new Map<HTMLElement, () => ReactNode>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function Root() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  if (!options) return null;
  return <YouAsked {...options}>{[...hosts].map(([el, node]) => createPortal(node(), el))}</YouAsked>;
}

/** Starts YouAsked on the page. Call it once; calling it again updates the options. */
export function init(opts: Options) {
  options = { ...opts };
  if (typeof document === "undefined") return api;
  if (!mount) {
    mount = document.createElement("div");
    mount.setAttribute("data-youasked-root", "");
    document.body.appendChild(mount);
    render(<Root />, mount);
  } else emit();
  return api;
}

/** Changes options after `init`, for example the theme when the page switches to dark mode. */
export function update(opts: Partial<Options>) {
  if (!options) return init(opts as Options);
  options = { ...options, ...opts };
  emit();
  return api;
}

/** Says who's asking, once your page knows. `signature` is HMAC-SHA256 of user.id with your secret key, made on your server. */
export function identify(user: User | null, signature?: string | null) {
  return update({ user, signature: signature ?? null, ready: true });
}

/** Opens the sheet, optionally on a topic ("charts") or with a draft typed in. */
export function open(opts?: Parameters<typeof openYouAsked>[0]) {
  openYouAsked(opts);
}

/** Removes YouAsked from the page. */
export function destroy() {
  if (mount) {
    render(null, mount);
    mount.remove();
  }
  mount = null;
  options = null;
  hosts.clear();
}

export const api = { init, update, identify, open, destroy };

/* ------------------------------------------------------------------ custom elements */

const num = (v: string | null) => (v === null || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));
const str = (v: string | null) => (v === null || v === "" ? undefined : v);

const ELEMENTS: Record<string, { attrs: string[]; render: (el: HTMLElement) => ReactNode }> = {
  "youasked-ask-bar": { attrs: ["placeholder"], render: (el) => <AskBar placeholder={str(el.getAttribute("placeholder"))} /> },
  "youasked-feature-card": {
    attrs: ["heading", "description", "limit"],
    render: (el) => <FeatureCard heading={str(el.getAttribute("heading"))} description={str(el.getAttribute("description"))} limit={num(el.getAttribute("limit"))} />,
  },
  "youasked-request-button": {
    attrs: ["variant", "label", "sublabel"],
    render: (el) => (
      <RequestButton
        variant={(str(el.getAttribute("variant")) as "pill" | "icon" | "row" | undefined) ?? "pill"}
        label={str(el.getAttribute("label"))}
        sublabel={str(el.getAttribute("sublabel"))}
      />
    ),
  },
  "youasked-ask-about": {
    attrs: ["topic", "prompt"],
    render: (el) => <AskAbout topic={el.getAttribute("topic") ?? "this"} prompt={str(el.getAttribute("prompt"))} />,
  },
  "youasked-board": {
    attrs: ["start", "height"],
    render: (el) => <FeatureBoard start={el.getAttribute("start") === "board" ? "board" : "home"} height={str(el.getAttribute("height")) ?? undefined} />,
  },
};

function defineElements() {
  if (typeof window === "undefined" || !("customElements" in window)) return;
  for (const [tag, def] of Object.entries(ELEMENTS)) {
    if (customElements.get(tag)) continue;
    customElements.define(
      tag,
      class extends HTMLElement {
        static get observedAttributes() {
          return def.attrs;
        }
        connectedCallback() {
          if (!this.style.display) this.style.display = "block";
          hosts.set(this, () => def.render(this));
          emit();
        }
        disconnectedCallback() {
          hosts.delete(this);
          emit();
        }
        attributeChangedCallback() {
          if (hosts.has(this)) emit();
        }
      },
    );
  }
}

/** Any element with data-youasked-open opens the sheet when clicked; data-youasked-topic and data-youasked-draft are optional. */
function delegateClicks() {
  if (typeof document === "undefined") return;
  document.addEventListener("click", (e) => {
    const el = (e.target as Element | null)?.closest?.("[data-youasked-open]");
    if (!el) return;
    e.preventDefault();
    const topic = el.getAttribute("data-youasked-topic") ?? undefined;
    const draft = el.getAttribute("data-youasked-draft") ?? undefined;
    open({ ...(topic ? { topic } : {}), ...(draft ? { draft } : {}) });
  });
}

defineElements();
delegateClicks();

export default api;
