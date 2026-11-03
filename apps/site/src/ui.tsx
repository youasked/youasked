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

/** The YouAsked mark: a speech bubble whose tail is a tick. */
export const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="ya-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#5b74f5" />
        <stop offset="1" stopColor="#2b4bee" />
      </linearGradient>
    </defs>
    <path d="M16 3C8.8 3 3 8.2 3 14.6c0 3.5 1.7 6.6 4.4 8.7L6.2 28.4l5.6-2.9c1.3.4 2.7.6 4.2.6 7.2 0 13-5.2 13-11.5S23.2 3 16 3Z" fill="url(#ya-mark)" />
    <path d="m10.6 14.9 3.6 3.5 7.3-7.3" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
