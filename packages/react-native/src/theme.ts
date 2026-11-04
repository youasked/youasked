export type Appearance = {
  /** "auto" follows the phone's light or dark setting. */
  mode?: "auto" | "light" | "dark";
  /** Brand colour for buttons, votes and links. Hex, rgb() or hsl(). */
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  muted?: string;
  surface?: string;
  border?: string;
  /** Corner radius of cards, rows and the sheet, in points. */
  radius?: number | string;
  /**
   * Corner radius of buttons, the ask bar, the composer and chips, separately from cards.
   * A number in points, or "pill" for fully round. Leave it out and each keeps its own shape.
   */
  buttonRadius?: number | "pill";
  /** Applied to every piece of text, e.g. "Inter_600SemiBold" or "System". */
  fontFamily?: string;
};

export type Theme = {
  mode: "light" | "dark";
  accent: string;
  accentFg: string;
  bg: string;
  fg: string;
  muted: string;
  surface: string;
  border: string;
  tint: string;
  green: string;
  greenTint: string;
  amber: string;
  amberTint: string;
  red: string;
  redTint: string;
  radius: number;
  /** Undefined means each control keeps its own shape. */
  buttonRadius?: number;
  fontFamily?: string;
};

type RGBA = [number, number, number, number];

function parseColor(input: string | undefined): RGBA | null {
  if (!input) return null;
  const v = input.trim().toLowerCase();
  if (v === "white") return [255, 255, 255, 1];
  if (v === "black") return [0, 0, 0, 1];
  if (v === "transparent") return [0, 0, 0, 0];
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.replace(/./g, (c) => c + c);
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+)(%?))?\s*\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : m[5] ? +m[4] / 100 : +m[4]];
  m = v.match(/^hsla?\(\s*([\d.]+)(?:deg)?[ ,]+([\d.]+)%[ ,]+([\d.]+)%(?:[ ,/]+([\d.]+))?\s*\)$/);
  if (m) {
    const h = (+m[1] % 360) / 360;
    const s = +m[2] / 100;
    const l = +m[3] / 100;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
      t = (t + 1) % 1;
      return Math.round(255 * (t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p));
    };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3), m[4] === undefined ? 1 : +m[4]];
  }
  return null;
}

const out = ([r, g, b, a]: RGBA) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${+a.toFixed(3)})`;

/** `amount` of `a` over `b`, like CSS color-mix(in srgb, a amount, b). */
export function mix(a: string, b: string, amount: number): string {
  const x = parseColor(a);
  const y = parseColor(b);
  if (!x || !y) return a;
  return out([0, 1, 2, 3].map((i) => x[i] * amount + y[i] * (1 - amount)) as RGBA);
}

/** The colour with some opacity, for tints. */
export function alpha(color: string, amount: number): string {
  const c = parseColor(color);
  return c ? out([c[0], c[1], c[2], c[3] * amount]) : color;
}

function luminance(color: string): number {
  const c = parseColor(color);
  if (!c) return 0.5;
  const [r, g, b] = c.slice(0, 3).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DEFAULTS = {
  light: { accent: "#2B4BEE", bg: "#ffffff", fg: "#141B2D" },
  dark: { accent: "#7d93ff", bg: "#161d31", fg: "#F4F6FA" },
};

const valid = (c: string | undefined, fallback: string) => (c && parseColor(c) ? c : fallback);

export function resolveTheme(appearance: Appearance = {}, scheme: "light" | "dark" | null | undefined): Theme {
  const mode: "light" | "dark" =
    appearance.mode === "dark" || appearance.mode === "light" ? appearance.mode : scheme === "dark" ? "dark" : "light";
  const d = DEFAULTS[mode];
  const accent = valid(appearance.accent, d.accent);
  const bg = valid(appearance.background, d.bg);
  const fg = valid(appearance.foreground, d.fg);
  const lum = luminance(accent);
  const accentFg = valid(appearance.accentForeground, 1.05 / (lum + 0.05) >= (lum + 0.05) / 0.056 ? "#ffffff" : "#0d1220");
  const dark = mode === "dark";
  const green = dark ? "#3fd07f" : "#16a34a";
  const amber = dark ? "#f2a93b" : "#c26a04";
  const red = "#e5484d";
  const radius = typeof appearance.radius === "number" ? appearance.radius : parseFloat(String(appearance.radius ?? "")) || 14;
  return {
    mode,
    accent,
    accentFg,
    bg,
    fg,
    muted: valid(appearance.muted, mix(fg, bg, 0.58)),
    surface: valid(appearance.surface, mix(fg, bg, 0.05)),
    border: valid(appearance.border, mix(fg, bg, 0.11)),
    tint: alpha(accent, 0.12),
    green,
    greenTint: mix(green, bg, 0.14),
    amber,
    amberTint: alpha(amber, 0.16),
    red,
    redTint: mix(red, bg, 0.12),
    radius,
    buttonRadius: appearance.buttonRadius === "pill" ? 999 : typeof appearance.buttonRadius === "number" ? appearance.buttonRadius : undefined,
    fontFamily: appearance.fontFamily,
  };
}
