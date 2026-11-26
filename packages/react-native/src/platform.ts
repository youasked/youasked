// Optional native modules, loaded only if the app has them. Metro treats a require inside try/catch
// as optional, so a missing package never breaks the bundle.
import { Platform } from "react-native";

declare function require(id: string): any;

// ---------------------------------------------------------------- storage (anonymous id, "what's new" memory)

type Store = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> };

let store: Store | null | undefined;
const memory = new Map<string, string>();
let warned = false;

function asyncStorage(): Store | null {
  if (store !== undefined) return store;
  try {
    const m = require("@react-native-async-storage/async-storage");
    store = (m?.default ?? m) as Store;
  } catch {
    store = null;
  }
  return store;
}

export async function getItem(key: string): Promise<string | null> {
  const s = asyncStorage();
  if (s) {
    try {
      return await s.getItem(key);
    } catch {
      /* fall through to memory */
    }
  } else if (!warned) {
    warned = true;
    console.warn(
      "[YouAsked] @react-native-async-storage/async-storage isn't installed, so this device's anonymous id only lasts until the app restarts. Install it to keep votes and requests tied to the device.",
    );
  }
  return memory.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  memory.set(key, value);
  const s = asyncStorage();
  if (s) {
    try {
      await s.setItem(key, value);
    } catch {
      /* memory copy is enough for this session */
    }
  }
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

let anonPromise: Promise<string> | null = null;

/** One random id per install, kept in AsyncStorage when available. */
export function getAnonId(): Promise<string> {
  return (anonPromise ??= (async () => {
    const existing = await getItem("youasked:anon");
    if (existing) return existing;
    const id = randomId();
    await setItem("youasked:anon", id);
    return id;
  })());
}

// ---------------------------------------------------------------- haptics

type Haptics = {
  impactAsync(style: unknown): Promise<void>;
  notificationAsync(type: unknown): Promise<void>;
  ImpactFeedbackStyle: { Light: unknown };
  NotificationFeedbackType: { Success: unknown };
};

let haptics: Haptics | null | undefined;
function loadHaptics(): Haptics | null {
  if (haptics !== undefined) return haptics;
  if (Platform.OS === "web") return (haptics = null);
  try {
    haptics = require("expo-haptics") as Haptics;
  } catch {
    haptics = null;
  }
  return haptics;
}

/** Tiny taps when expo-haptics is installed; silent otherwise. */
export const haptic = {
  light() {
    const h = loadHaptics();
    h?.impactAsync(h.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success() {
    const h = loadHaptics();
    h?.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
  },
};

// ---------------------------------------------------------------- safe area

let safeArea: { SafeAreaInsetsContext?: import("react").Context<{ top: number; bottom: number; left: number; right: number } | null> } | null | undefined;

/** react-native-safe-area-context, if the app has it. */
export function loadSafeArea() {
  if (safeArea !== undefined) return safeArea;
  try {
    safeArea = require("react-native-safe-area-context");
  } catch {
    safeArea = null;
  }
  return safeArea;
}

// ---------------------------------------------------------------- device and app version

/** Bump with package.json. */
export const SDK_VERSION = "0.4.0";

let clientHeader: string | undefined;

/** First optional module that loads, or null. */
function optional(...ids: string[]): any {
  for (const id of ids) {
    try {
      const m = require(id);
      if (m) return m.default ?? m;
    } catch {
      /* not installed */
    }
  }
  return null;
}

/**
 * The app's version and the phone, for the app's team (never shown to other people): sent as
 * `x-youasked-client`. Uses expo-application / expo-device or react-native-device-info when the app
 * has them, and React Native's own constants otherwise.
 */
export function clientInfoHeader(): string {
  if (clientHeader !== undefined) return clientHeader;
  // Built by hand: React Native's URLSearchParams can't set values.
  const parts: string[] = [];
  const put = (k: string, v: unknown) => {
    if (v !== undefined && v !== null && String(v).trim()) parts.push(`${k}=${encodeURIComponent(String(v).trim().slice(0, 60))}`);
  };
  try {
    const c = (Platform.constants ?? {}) as Record<string, unknown>;
    put("platform", Platform.OS);
    const app = optional("expo-application");
    const info = optional("react-native-device-info");
    const dev = optional("expo-device");
    put("app", app?.nativeApplicationVersion ?? safe(() => info?.getVersion()));
    put("build", app?.nativeBuildVersion ?? safe(() => info?.getBuildNumber()));
    if (Platform.OS === "android") {
      put("os", `Android ${c.Release ?? Platform.Version}`);
      const brand = String(dev?.manufacturer ?? c.Manufacturer ?? c.Brand ?? "");
      const model = String(dev?.modelName ?? c.Model ?? safe(() => info?.getModel()) ?? "");
      put("device", model && brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${capital(brand)} ${model}` : model);
    } else if (Platform.OS === "ios") {
      put("os", `${c.systemName === "iPadOS" ? "iPadOS" : "iOS"} ${c.osVersion ?? Platform.Version}`);
      put("device", dev?.modelId ?? safe(() => info?.getDeviceId()) ?? dev?.modelName ?? (c.interfaceIdiom === "pad" ? "iPad" : "iPhone"));
    } else {
      put("os", `${Platform.OS} ${Platform.Version ?? ""}`);
    }
    put("sdk", `react-native/${SDK_VERSION}`);
  } catch {
    /* send what we have */
  }
  clientHeader = parts.join("&");
  return clientHeader;
}

function safe<T>(f: () => T): T | undefined {
  try {
    return f();
  } catch {
    return undefined;
  }
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
