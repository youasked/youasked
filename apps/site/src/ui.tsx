import { useEffect, useRef, useState, type ReactNode } from "react";

export const Check = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

export const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

/** The YouAsked mark: a speech bubble with a tick (it shipped) and a spark (it's live). */
export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="ya-mark" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stopColor="#6d84ff" />
        <stop offset="1" stopColor="#2b4bee" />
      </linearGradient>
    </defs>
    <path d="M11.4 3.2c-4.97 0-9 3.47-9 7.75 0 2.3 1.17 4.37 3.03 5.8L4.6 20.2l4.1-2.06c.86.2 1.76.31 2.7.31 4.97 0 9-3.47 9-7.75S16.37 3.2 11.4 3.2Z" fill="url(#ya-mark)" />
    <path d="m7.9 11.2 2.5 2.4 4.7-4.7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="19.4" cy="4.4" r="2.6" fill="#ffe066" stroke="#f6f7fb" strokeWidth="1.3" />
  </svg>
);

/** Outlines a real YouAsked component inside a mock app, so it's clear which part is ours. */
export function Spot({ children, label = "YouAsked", inline }: { children: ReactNode; label?: string; inline?: boolean }) {
  return (
    <div className={inline ? "spot spot-inline" : "spot"}>
      <span className="spot-tag">
        <Mark className="spot-mark" />
        {label}
      </span>
      {children}
    </div>
  );
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function useCopied(): [boolean, (text: string | (() => Promise<string>)) => void] {
  const [done, setDone] = useState(false);
  const timer = useRef<number>(undefined);
  const copy = async (text: string | (() => Promise<string>)) => {
    const value = typeof text === "string" ? text : await text();
    if (await copyText(value)) {
      setDone(true);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDone(false), 1800);
    }
  };
  return [done, copy];
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, copy] = useCopied();
  return (
    <button type="button" className="copy-btn" data-done={done || undefined} onClick={() => copy(text)}>
      {done ? <Check size={14} /> : <CopyIcon />}
      {done ? "Copied" : label}
    </button>
  );
}

/** Fades a block up once it scrolls into view. */
export function Reveal({ children, as: Tag = "div", className = "", delay = 0 }: { children: ReactNode; as?: "div" | "section"; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} data-in={inView || undefined} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
