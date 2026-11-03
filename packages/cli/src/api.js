// Talking to the YouAsked API.
export const DEFAULT_API = "https://youasked-api.adenteo.workers.dev";

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
  return /** @type {{ publicKey: string, secretKey: string, dashboardUrl: string }} */ (body);
}

/** true = valid, false = rejected, null = couldn't reach the API. */
export async function checkPublicKey(/** @type {string} */ api, /** @type {string} */ key) {
  try {
    const res = await fetch(`${api}/v1/config`, { headers: { "x-youasked-key": key } });
    return res.ok;
  } catch {
    return null;
  }
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
