export type Appearance = {
  /** "auto" follows the host page (a `.dark` class, data-theme, or its background). */
  mode?: "auto" | "light" | "dark";
  /** Brand colour for buttons, votes and links. Any CSS colour, including `var(--your-token)`. */
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  surface?: string;
  border?: string;
  radius?: string | number;
  fontFamily?: string;
  /** Set false to ignore the host's shadcn-style tokens (--primary, --background, …). */
  inherit?: boolean;
};

type Tokens = {
  mode: "light" | "dark";
  accent: string;
  accentForeground?: string;
  background: string;
  foreground: string;
  muted?: string;
  surface?: string;
  border?: string;
  radius: string;
  fontFamily: string;
};

const DEFAULTS: Record<"light" | "dark", Omit<Tokens, "mode">> = {
  light: { accent: "#2B4BEE", background: "#ffffff", foreground: "#141B2D", radius: "14px", fontFamily: "inherit" },
  dark: { accent: "#7d93ff", background: "#161d31", foreground: "#F4F6FA", radius: "14px", fontFamily: "inherit" },
};

let probe: HTMLElement | null = null;

/** Resolves any CSS colour (including var() references) to an rgb() string, or null. */
function computeColor(value: string): string | null {
  if (typeof document === "undefined") return null;
  if (!probe) {
    probe = document.createElement("span");
    probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;";
    probe.setAttribute("aria-hidden", "true");
  }
  if (!probe.isConnected) document.body.appendChild(probe);
  probe.style.color = "";
  probe.style.color = value;
  if (!probe.style.color) return null;
  return getComputedStyle(probe).color;
}

function luminance(rgb: string | null): number | null {
  const m = rgb?.match(/rgba?\(([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
    const c = parseFloat(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Accepts full colours, and shadcn v3's bare HSL channels ("222 47% 11%"). */
function cssColor(raw: string): string | undefined {
  const v = raw.trim();
  if (!v || typeof CSS === "undefined") return undefined;
  if (CSS.supports("color", v)) return v;
  if (CSS.supports("color", `hsl(${v})`)) return `hsl(${v})`;
  return undefined;
}

export function hostIsDark(): boolean {
  const html = document.documentElement;
  if (html.classList.contains("dark") || html.dataset.theme === "dark") return true;
  if (html.classList.contains("light") || html.dataset.theme === "light") return false;
  const lum = luminance(getComputedStyle(document.body).backgroundColor) ?? luminance(getComputedStyle(html).backgroundColor);
  if (lum !== null) return lum < 0.35;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function readHost(): Partial<Tokens> {
  const root = getComputedStyle(document.documentElement);
  const v = (name: string) => cssColor(root.getPropertyValue(name));
  const radius = root.getPropertyValue("--radius").trim();
  return {
    accent: v("--primary"),
    accentForeground: v("--primary-foreground"),
    background: v("--popover") ?? v("--card") ?? v("--background"),
    foreground: v("--popover-foreground") ?? v("--card-foreground") ?? v("--foreground"),
    muted: v("--muted-foreground"),
    surface: v("--muted") ?? v("--secondary"),
    border: v("--border"),
    radius: radius && CSS.supports("border-radius", radius) ? radius : undefined,
    fontFamily: getComputedStyle(document.body).fontFamily || undefined,
  };
}

function defined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")) as Partial<T>;
}

export function resolveTokens(appearance: Appearance = {}): Tokens {
  const mode = appearance.mode === "dark" || (appearance.mode !== "light" && hostIsDark()) ? "dark" : "light";
  const host = appearance.inherit === false ? {} : readHost();
  const { mode: _m, inherit: _i, radius, ...colours } = appearance;
  const merged: Tokens = {
    ...DEFAULTS[mode],
    ...defined(host),
    ...defined(colours),
    ...(radius !== undefined ? { radius: typeof radius === "number" ? `${radius}px` : radius } : {}),
    mode,
  };
  if (!merged.accentForeground) {
    // Pick whichever of white or near-black reads better on the accent (WCAG contrast).
    const lum = luminance(computeColor(merged.accent));
    const onWhite = lum === null ? Infinity : 1.05 / (lum + 0.05);
    const onDark = lum === null ? 0 : (lum + 0.05) / 0.056;
    merged.accentForeground = onDark > onWhite ? "#0d1220" : "#ffffff";
  }
  return merged;
}

export function tokenStyle(t: Tokens): Record<string, string> {
  const style: Record<string, string> = {
    "--ya-accent": t.accent,
    "--ya-accent-fg": t.accentForeground ?? "#fff",
    "--ya-bg": t.background,
    "--ya-fg": t.foreground,
    "--ya-radius": t.radius,
  };
  if (t.fontFamily && t.fontFamily !== "inherit") style["--ya-font"] = t.fontFamily;
  if (t.muted) style["--ya-muted"] = t.muted;
  if (t.surface) style["--ya-surface"] = t.surface;
  if (t.border) style["--ya-border"] = t.border;
  return style;
}
