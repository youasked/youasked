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

/** The YouAsked mark: a speech bubble holding the vote arrow. Same drawing as v3/Mark.tsx. */
export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <path d="M16 6h32a12 12 0 0 1 12 12v22a12 12 0 0 1-12 12H30L16 62V52a12 12 0 0 1-12-12V18A12 12 0 0 1 16 6Z" fill="#2b4bee" />
    <path d="M21 37 32 26l11 11" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Outlines a real YouAsked component inside a mock app, so it's clear which part is ours. */
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
