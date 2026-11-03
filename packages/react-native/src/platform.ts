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
