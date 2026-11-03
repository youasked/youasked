// A very small router: pathname + query, history.pushState, and a Link that doesn't reload the page.
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
window.addEventListener("popstate", emit);

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const snapshot = () => location.pathname + location.search;

export function navigate(to: string, replace = false) {
  if (to === snapshot()) return;
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.scrollTo(0, 0);
  emit();
}

export function useRoute() {
  const key = useSyncExternalStore(subscribe, snapshot);
  const [path, search = ""] = key.split("?");
  return { path, query: new URLSearchParams(search), key };
}

export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      {...rest}
      href={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || rest.target === "_blank") return;
        e.preventDefault();
        navigate(to);
      }}
    />
  );
}
