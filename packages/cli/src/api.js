// Talking to the YouAsked API.
export const DEFAULT_API = "https://api.youasked.dev";

const MESSAGES = {
  too_many_apps: "That's the limit of new apps from this network for today. Reuse one with --key ya_pub_… --secret ya_sec_….",
  name_too_short: "App names need at least two characters.",
  bad_name: "App names can't contain links.",
  bad_email: "That email doesn't look right.",
};

/** Makes a new app. */
export async function signup(/** @type {string} */ api, /** @type {string} */ name, /** @type {string} */ email = "") {
  let res;
  try {
    res = await fetch(`${api}/v1/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, ...(email ? { email } : {}) }),
    });
  } catch (err) {
    throw new Error(`Couldn't reach ${api} (${err instanceof Error ? err.message : err}). Check your connection, or pass --key and --secret to reuse an app.`);
  }
  const body = /** @type {any} */ (await res.json().catch(() => ({})));
  if (!res.ok) {
    throw new Error(/** @type {Record<string, string>} */ (MESSAGES)[body.error] ?? `Sign-up failed (${res.status} ${body.error ?? ""}).`);
  }
  return /** @type {{ publicKey: string, secretKey: string, dashboardUrl: string, claimUrl?: string }} */ (body);
}

/**
 * "live" or "test" for a valid key, "invalid" if the API doesn't know it, null if unreachable.
 * Test mode answers 402 to anything that isn't coming from localhost, which still proves the key exists.
 */
export async function checkMode(/** @type {string} */ api, /** @type {string} */ key) {
  try {
    const res = await fetch(`${api}/v1/config`, { headers: { "x-youasked-key": key } });
    if (res.ok) return /** @type {{ mode?: string }} */ (await res.json().catch(() => ({}))).mode === "test" ? "test" : "live";
    if (res.status === 402) return "test";
    return "invalid";
  } catch {
    return null;
  }
}

/** true = valid, false = rejected, null = couldn't reach the API. */
export async function checkPublicKey(/** @type {string} */ api, /** @type {string} */ key) {
  const mode = await checkMode(api, key);
  return mode === null ? null : mode !== "invalid";
}

/** Same, for the secret key. Returns the app's name when valid. */
export async function checkSecretKey(/** @type {string} */ api, /** @type {string} */ key) {
  try {
    const res = await fetch(`${api}/v1/admin/app`, { headers: { authorization: `Bearer ${key}` } });
    if (!res.ok) return false;
    return /** @type {{ name: string }} */ (await res.json()).name;
  } catch {
    return null;
  }
}
