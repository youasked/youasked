// `youasked doctor` and `youasked open`.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_API, checkPublicKey, checkSecretKey } from "./api.js";
import { detectProject, exists, hasDependency, read, readEnv } from "./project.js";
import { bad, bold, cyan, dim, ok, say, warn } from "./ui.js";

/** Env values from the project's env files, then the real environment. */
function loadKeys(/** @type {import("./project.js").Project} */ p) {
  const files = [".env.local", ".env", ".env.development.local", ".env.development"].map((f) => readEnv(path.join(p.cwd, f)));
  const get = (/** @type {string} */ name) => process.env[name] || files.map((f) => f[name]).find(Boolean) || "";
  return { get };
}

export async function doctor({ flags, cwd }) {
  const api = String(flags.api || process.env.YOUASKED_API_URL || DEFAULT_API).replace(/\/$/, "");
  const p = detectProject(cwd);
  say(`\n${bold("YouAsked doctor")}`);
  if (!p) {
    bad("No package.json here. Run this from your project's root.");
    process.exitCode = 1;
    return;
  }
  let failures = 0;
  const fail = (/** @type {string} */ m) => (failures++, bad(m));

  const { get } = loadKeys(p);
  const pub = get(p.keyVar);
  const sec = get(p.secretVar);
  const customApi = get(p.apiVar);
  const target = String(flags.api || customApi || process.env.YOUASKED_API_URL || api).replace(/\/$/, "");

  if (pub.startsWith("ya_pub_")) ok(`${p.keyVar} is set`);
  else fail(`${p.keyVar} is missing. Run ${cyan("npx youasked init")} or add it to ${p.envFile}.`);

  if (sec.startsWith("ya_sec_")) ok(`${p.secretVar} is set`);
  else warn(`${p.secretVar} is not set. Only needed for signed users, the dashboard and the MCP server.`);

  if (hasDependency(p, "@youasked/react")) {
    ok("@youasked/react is in package.json");
    if (!exists(path.join(cwd, "node_modules", "@youasked", "react"))) warn("…but isn't in node_modules yet. Run your package manager's install.");
  } else fail(`@youasked/react isn't installed. Run ${cyan(`${p.pm} ${p.pm === "npm" ? "install" : "add"} @youasked/react`)}.`);

  const wired = findWiring(cwd);
  if (wired) ok(`The widget is wired up in ${wired}`);
  else warn("Couldn't find <YouAsked> or <FeatureRequests> in your source. Is it added to your layout?");

  if (pub) {
    const v = await checkPublicKey(target, pub);
    if (v === true) ok(`${target} accepts your publishable key`);
    else if (v === false) fail(`${target} rejected your publishable key. Is it from a different server?`);
    else fail(`Couldn't reach ${target}.`);
  }
  if (sec) {
    const name = await checkSecretKey(target, sec);
    if (name) ok(`Secret key works (app: ${name})`);
    else if (name === false) fail(`${target} rejected your secret key.`);
    else fail(`Couldn't reach ${target} to check the secret key.`);
  }

  say(failures ? `\n  ${failures} problem${failures === 1 ? "" : "s"} found.\n` : `\n  All good.\n`);
  if (failures) process.exitCode = 1;
}

/** Looks through the usual source folders for the provider. */
function findWiring(/** @type {string} */ cwd) {
  const stack = ["app", "src", "pages", "components"].map((d) => path.join(cwd, d)).filter(exists);
  let seen = 0;
  while (stack.length && seen < 2000) {
    const dir = /** @type {string} */ (stack.pop());
    let entries;
    try {
      entries = /** @type {import("node:fs").Dirent[]} */ (fs.readdirSync(dir, { withFileTypes: true }));
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (/\.(tsx|jsx|js|ts)$/.test(e.name)) {
        seen++;
        if (/<YouAsked[\s>]|<FeatureRequests[\s>]/.test(read(full))) return path.relative(cwd, full);
      }
    }
  }
  return null;
}

export async function openDashboard({ flags }) {
  const api = String(flags.api || process.env.YOUASKED_API_URL || DEFAULT_API).replace(/\/$/, "");
  say(`\n  Your dashboard: ${cyan(`${api}/admin`)}`);
  say(`  ${dim("Sign in with your secret key (YOUASKED_SECRET_KEY in your env file).")}\n`);
}
