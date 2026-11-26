/**
 * What the person was using when they asked: app version, platform, OS and device. The SDKs send it in
 * an `x-youasked-client` header (a query string, e.g. `app=1.5.3&build=109&os=Android 15&device=Pixel 8&sdk=react-native/0.4.0`);
 * for a browser without it, the User-Agent gives the browser and OS. Only the app's team ever sees it.
 */
export type ClientInfo = {
  platform?: "ios" | "android" | "web" | "macos" | "windows";
  /** The app's own version, and build number. */
  app?: string;
  build?: string;
  /** "iOS 18.1", "Android 15", "Windows". */
  os?: string;
  /** "iPhone16,2", "Google Pixel 8". */
  device?: string;
  /** "Chrome 131" (web only). */
  browser?: string;
  /** "react-native/0.4.0". */
  sdk?: string;
};

const PLATFORMS = new Set(["ios", "android", "web", "macos", "windows"]);

const clean = (v: unknown, max = 60): string =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Browser and OS from a User-Agent. Major versions only; null for things that aren't browsers. */
export function fromUserAgent(ua: string | null | undefined): Pick<ClientInfo, "os" | "browser" | "device"> | null {
  if (!ua || !/Mozilla\//.test(ua)) return null;
  const out: Pick<ClientInfo, "os" | "browser" | "device"> = {};
  let m: RegExpMatchArray | null;
  if ((m = ua.match(/\((iPhone|iPad|iPod)[^)]*OS (\d+)[_.](\d+)/))) {
    out.os = `iOS ${m[2]}.${m[3]}`;
    out.device = m[1];
  } else if ((m = ua.match(/Android (\d+(?:\.\d+)?)/))) {
    out.os = `Android ${m[1]}`;
    // Most browsers now send "K" instead of the model; keep a real one when it's there.
    const model = ua.match(/Android [^;)]*;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\)/)?.[1]?.trim();
    if (model && model !== "K" && !/^wv$|^Linux/.test(model)) out.device = model;
  } else if (/Windows NT/.test(ua)) out.os = "Windows";
  else if (/CrOS/.test(ua)) out.os = "ChromeOS";
  else if (/Mac OS X/.test(ua)) out.os = "macOS";
  else if (/Linux/.test(ua)) out.os = "Linux";

  const browsers: [RegExp, string][] = [
    [/EdgA?\/(\d+)/, "Edge"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/OPR\/(\d+)/, "Opera"],
    [/FxiOS\/(\d+)/, "Firefox"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/CriOS\/(\d+)/, "Chrome"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+(?:\.\d+)?).*Safari\//, "Safari"],
  ];
  for (const [re, name] of browsers) {
    if ((m = ua.match(re))) {
      out.browser = `${name} ${m[1]}`;
      break;
    }
  }
  if (!out.browser && /\(iP(hone|ad|od)/.test(ua) && /AppleWebKit/.test(ua)) out.browser = "In-app browser";
  return Object.keys(out).length ? out : null;
}

/** From the request headers. Null when there's nothing worth keeping. */
export function clientInfo(headers: Headers): ClientInfo | null {
  const out: ClientInfo = {};
  const sent = new URLSearchParams(headers.get("x-youasked-client")?.slice(0, 600) ?? "");
  const plat = clean(sent.get("platform") ?? headers.get("x-youasked-platform"), 20).toLowerCase();
  if (PLATFORMS.has(plat)) out.platform = plat as ClientInfo["platform"];
  for (const k of ["app", "build", "os", "device", "sdk"] as const) {
    const v = clean(sent.get(k));
    if (v) out[k] = v;
  }
  // A browser: fill in what the SDK didn't say. Native SDKs send no Mozilla User-Agent.
  const ua = fromUserAgent(headers.get("user-agent"));
  if (ua) {
    out.platform ??= "web";
    if (out.platform === "web") {
      out.os ??= ua.os;
      out.browser ??= ua.browser;
      out.device ??= ua.device;
    }
  }
  // React Native says only "react-native" in the platform header; the OS tells which one.
  if (!out.platform && out.os) {
    if (/^android/i.test(out.os)) out.platform = "android";
    else if (/^(ios|ipados)/i.test(out.os)) out.platform = "ios";
  }
  for (const k of Object.keys(out) as (keyof ClientInfo)[]) if (!out[k]) delete out[k];
  return Object.keys(out).length ? out : null;
}

/** One line for people: "Android app 1.5.3 (109) · Android 15 · Pixel 8", "Chrome 131 on Windows". */
export function clientLine(c: ClientInfo | null | undefined): string | null {
  if (!c) return null;
  if (c.platform === "web" || (!c.app && c.browser)) {
    const where = [c.browser, c.os && `on ${c.os}`].filter(Boolean).join(" ");
    const parts = [c.app ? `Web ${c.app}` : null, where || null, c.device ?? null];
    return parts.filter(Boolean).join(" · ") || null;
  }
  const name = c.platform === "ios" ? "iOS app" : c.platform === "android" ? "Android app" : c.platform ? `${c.platform} app` : "App";
  const version = c.app ? `${name} ${c.app}${c.build ? ` (${c.build})` : ""}` : null;
  return [version, c.os, c.device].filter(Boolean).join(" · ") || null;
}
