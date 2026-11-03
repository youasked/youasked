// AES-GCM for third-party tokens we have to store (GitHub today). The key is TOKEN_ENC_KEY: 32 random
// bytes, base64. Stored as "v1.<iv>.<ciphertext>" (base64url), so the format can change later.
const enc = new TextEncoder();

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
};

async function importKey(keyB64: string) {
  const raw = Uint8Array.from(atob(keyB64.trim()), (ch) => ch.charCodeAt(0));
  if (raw.byteLength !== 32) throw new Error("TOKEN_ENC_KEY must be 32 bytes, base64");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptToken(keyB64: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importKey(keyB64), enc.encode(plain));
  return `v1.${toB64(iv)}.${toB64(new Uint8Array(ct))}`;
}

export async function decryptToken(keyB64: string, stored: string): Promise<string> {
  const [v, iv, ct] = stored.split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("bad token format");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(iv) }, await importKey(keyB64), fromB64(ct));
  return new TextDecoder().decode(plain);
}
