import { LOGOS, type LogoKey } from "./logo-data";

export function Logo({ k, size = 20, mono }: { k: LogoKey; size?: number; mono?: string }) {
  const logo = LOGOS.find((l) => l.key === k)!;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={{ flex: "none" }}>
      <path d={logo.d} fill={mono ?? logo.color} />
    </svg>
  );
}

/** A row of the tools YouAsked works with, each a logo and its name. */
export function LogoRow({ keys, tone = "dark", label }: { keys: LogoKey[]; tone?: "dark" | "light"; label?: string }) {
  return (
    <div className={`logo-row ${tone}`} aria-label={label ?? "Works with"}>
      {keys.map((k) => {
        const logo = LOGOS.find((l) => l.key === k)!;
        return (
          <span className="logo-chip" key={k}>
            <Logo k={k} mono={tone === "light" ? "#0b1020" : undefined} />
            {logo.name}
          </span>
        );
      })}
    </div>
  );
}
