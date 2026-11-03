// Looking at the project: what framework, which package manager, where files go.
import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {"next-app" | "next-pages" | "vite" | "remix" | "cra" | "expo" | "unknown"} Kind
 * @typedef {{
 *   cwd: string, kind: Kind, label: string, pkg: any, ts: boolean, src: boolean,
 *   pm: "npm" | "pnpm" | "yarn" | "bun", envFile: string,
 *   keyVar: string, secretVar: string, apiVar: string, keyExpr: string, apiExpr: string,
 * }} Project
 */

export const exists = (/** @type {string} */ p) => fs.existsSync(p);
export const read = (/** @type {string} */ p) => fs.readFileSync(p, "utf8");

export function readPackageJson(/** @type {string} */ cwd) {
  try {
    return JSON.parse(read(path.join(cwd, "package.json")));
  } catch {
    return null;
  }
}

function detectPm(/** @type {string} */ cwd, /** @type {any} */ pkg) {
  const field = String(pkg?.packageManager ?? "");
  for (const pm of /** @type {const} */ (["pnpm", "yarn", "bun", "npm"])) if (field.startsWith(`${pm}@`)) return pm;
  if (exists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (exists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (exists(path.join(cwd, "bun.lockb")) || exists(path.join(cwd, "bun.lock"))) return "bun";
  return "npm";
}

/** @returns {Project | null} null when there is no package.json here. */
export function detectProject(/** @type {string} */ cwd) {
  const pkg = readPackageJson(cwd);
  if (!pkg) return null;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (/** @type {string} */ n) => n in deps;
  const ts = exists(path.join(cwd, "tsconfig.json")) || has("typescript");
  const src = exists(path.join(cwd, "src", "app")) || exists(path.join(cwd, "src", "pages"));

  /** @type {Kind} */
  let kind = "unknown";
  let label = "an unrecognised project";
  if (has("expo") || has("react-native")) {
    kind = "expo";
    label = "Expo / React Native";
  } else if (has("next")) {
    const appDir = exists(path.join(cwd, "app")) || exists(path.join(cwd, "src", "app"));
    kind = appDir ? "next-app" : "next-pages";
    label = appDir ? "Next.js (app router)" : "Next.js (pages router)";
  } else if (has("@remix-run/react") || has("@react-router/dev")) {
    kind = "remix";
    label = has("@remix-run/react") ? "Remix" : "React Router";
  } else if (has("vite") && has("react")) {
    kind = "vite";
    label = "Vite + React";
  } else if (has("react-scripts")) {
    kind = "cra";
    label = "React (Create React App)";
  }

  const vars =
    kind === "next-app" || kind === "next-pages"
      ? { envFile: ".env.local", keyVar: "NEXT_PUBLIC_YOUASKED_KEY", apiVar: "NEXT_PUBLIC_YOUASKED_API_URL", keyExpr: "process.env.NEXT_PUBLIC_YOUASKED_KEY", apiExpr: "process.env.NEXT_PUBLIC_YOUASKED_API_URL" }
      : kind === "unknown"
        ? { envFile: ".env", keyVar: "YOUASKED_KEY", apiVar: "YOUASKED_API_URL", keyExpr: "process.env.YOUASKED_KEY", apiExpr: "process.env.YOUASKED_API_URL" }
        : kind === "cra"
        ? { envFile: ".env", keyVar: "REACT_APP_YOUASKED_KEY", apiVar: "REACT_APP_YOUASKED_API_URL", keyExpr: "process.env.REACT_APP_YOUASKED_KEY", apiExpr: "process.env.REACT_APP_YOUASKED_API_URL" }
        : { envFile: ".env", keyVar: "VITE_YOUASKED_KEY", apiVar: "VITE_YOUASKED_API_URL", keyExpr: "import.meta.env.VITE_YOUASKED_KEY", apiExpr: "import.meta.env.VITE_YOUASKED_API_URL" };

  return { cwd, kind, label, pkg, ts, src, pm: detectPm(cwd, pkg), secretVar: "YOUASKED_SECRET_KEY", ...vars };
}

/** First existing file out of the candidates (relative to cwd), or null. */
export function firstExisting(/** @type {string} */ cwd, /** @type {string[]} */ candidates) {
  return candidates.find((c) => exists(path.join(cwd, c))) ?? null;
}

/** @returns {[string, string[]]} */
export function installCommand(/** @type {Project["pm"]} */ pm, /** @type {string} */ pkgName) {
  return pm === "npm" ? ["npm", ["install", pkgName]] : [pm, ["add", pkgName]];
}

export function hasDependency(/** @type {Project} */ p, /** @type {string} */ name) {
  return Boolean(p.pkg.dependencies?.[name] || p.pkg.devDependencies?.[name]);
}

// ---------------------------------------------------------------- env files and .gitignore

/** Reads KEY=value pairs from an env file. Missing file is an empty object. */
export function readEnv(/** @type {string} */ file) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!exists(file)) return out;
  for (const line of read(file).split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

/**
 * Adds variables that aren't there yet and leaves existing ones alone.
 * @returns {{ added: string[], kept: string[] }}
 */
export function upsertEnv(/** @type {string} */ file, /** @type {Record<string, string>} */ vars) {
  const current = readEnv(file);
  const added = [];
  const kept = [];
  let text = exists(file) ? read(file) : "";
  for (const [k, v] of Object.entries(vars)) {
    if (current[k]) {
      kept.push(k);
      continue;
    }
    // An empty `KEY=` line gets filled in place instead of duplicated.
    const empty = new RegExp(`^(\\s*(?:export\\s+)?${k}\\s*=).*$`, "m");
    if (empty.test(text)) text = text.replace(empty, `$1${v}`);
    else text += `${text && !text.endsWith("\n") ? "\n" : ""}${k}=${v}\n`;
    added.push(k);
  }
  if (added.length) fs.writeFileSync(file, text, { mode: 0o600 });
  return { added, kept };
}

/** Does .gitignore already cover this file? Handles the usual globs (.env*, *.local, …). */
export function isIgnored(/** @type {string} */ gitignore, /** @type {string} */ file) {
  for (const raw of gitignore.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const pattern = line.replace(/^\//, "").replace(/\/$/, "");
    const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]")}$`);
    if (re.test(file)) return true;
  }
  return false;
}

/** @returns {"already" | "added" | "created"} */
export function ensureIgnored(/** @type {string} */ cwd, /** @type {string} */ file) {
  const gi = path.join(cwd, ".gitignore");
  if (!exists(gi)) {
    fs.writeFileSync(gi, `${file}\n`);
    return "created";
  }
  const text = read(gi);
  if (isIgnored(text, file)) return "already";
  fs.writeFileSync(gi, `${text}${text.endsWith("\n") || !text ? "" : "\n"}\n# YouAsked keys\n${file}\n`);
  return "added";
}
