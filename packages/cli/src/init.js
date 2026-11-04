// `youasked init`: keys, env file, package, and the code that puts the widget in your app.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_API, signup, checkPublicKey } from "./api.js";
import { detectProject, detectNative, ensureIgnored, exists, firstExisting, hasDependency, installCommand, read, readEnv, upsertEnv } from "./project.js";
import {
  AGENTS_MARKER,
  agentsSection,
  entrySnippets,
  feedbackPageApp,
  feedbackPagePages,
  identityRouteApp,
  identityRoutePages,
  providerComponent,
  skillMd,
} from "./templates.js";
import { bold, bad, codeBlock, cyan, dim, green, makePrompter, ok, say, showDiff, step, warn, yellow } from "./ui.js";

/** @typedef {import("./project.js").Project} Project */
/** @typedef {"floating" | "askbar" | "card" | "settings" | "page"} Entry */

const posix = (/** @type {string} */ p) => p.split(path.sep).join("/");

/** Turns "my-cool_app" / "@scope/my-app" into "My Cool App". */
function niceName(/** @type {string | undefined} */ raw) {
  const base = String(raw ?? "").replace(/^@[^/]+\//, "");
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * @param {{ flags: Record<string, string | boolean>, cwd: string }} o
 */
export async function init({ flags, cwd }) {
  const yes = Boolean(flags.yes);
  const api = String(flags.api || process.env.YOUASKED_API_URL || DEFAULT_API).replace(/\/$/, "");
  const customApi = api !== DEFAULT_API;
  const ask = makePrompter({ yes });

  say(`\n${bold("YouAsked")} ${dim("· feature requests your users can vote on")}`);

  const project = detectProject(cwd) ?? detectNative(cwd);
  if (!project) {
    bad("No package.json, Xcode project or Gradle build in this folder. Run this from the root of your project.");
    process.exitCode = 1;
    return;
  }
  say(`  Found ${bold(project.label)} ${dim(`(${project.pm})`)}`);

  /** @type {{ rel: string, status: "created" | "modified" | "unchanged" | "manual" }[]} */
  const changes = [];
  /** @type {string[]} */
  const manual = [];

  try {
    // ------------------------------------------------------------ keys
    step("1. Your app");
    const envPath = path.join(cwd, project.envFile);
    const existing = readEnv(envPath);
    let publicKey = String(flags.key || "");
    let secretKey = String(flags.secret || "");
    let dashboardUrl = "https://app.youasked.dev";
    let claimUrl = "";

    if (!publicKey && existing[project.keyVar]?.startsWith("ya_pub_")) {
      const reuse = await ask.confirm(`${project.envFile} already has a YouAsked key. Keep using it?`, true);
      if (reuse) {
        publicKey = existing[project.keyVar];
        secretKey = existing[project.secretVar] ?? "";
      }
    }
    if (publicKey) {
      if (!publicKey.startsWith("ya_pub_")) throw new Error("--key should be a publishable key starting with ya_pub_");
      if (secretKey && !secretKey.startsWith("ya_sec_")) throw new Error("--secret should be a secret key starting with ya_sec_");
      const valid = await checkPublicKey(api, publicKey);
      if (valid === false) throw new Error(`${api} doesn't know that publishable key.`);
      if (valid === null) warn(`Couldn't reach ${api} to check the key. Carrying on.`);
      ok(`Using your existing app ${dim(publicKey.slice(0, 14) + "…")}`);
    } else {
      const name = await ask.text("App name?", niceName(project.pkg.name) || "My App");
      const made = await signup(api, name);
      publicKey = made.publicKey;
      secretKey = made.secretKey;
      dashboardUrl = made.dashboardUrl || dashboardUrl;
      claimUrl = made.claimUrl || "";
      ok(`Created ${bold(name)}`);
    }

    // ------------------------------------------------------------ env + gitignore
    /** @type {Record<string, string>} */
    const vars = { [project.keyVar]: publicKey };
    if (secretKey) vars[project.secretVar] = secretKey;
    if (customApi) vars[project.apiVar] = api;
    const envExisted = exists(envPath);
    const { added, kept } = upsertEnv(envPath, vars);
    if (added.length) {
      changes.push({ rel: project.envFile, status: envExisted ? "modified" : "created" });
      ok(`Wrote ${added.join(", ")} to ${bold(project.envFile)}`);
    }
    if (kept.length) ok(`${kept.join(", ")} already in ${project.envFile}, left as is`);
    const ig = ensureIgnored(cwd, project.envFile);
    if (ig !== "already") {
      changes.push({ rel: ".gitignore", status: ig === "created" ? "created" : "modified" });
      ok(`Added ${project.envFile} to .gitignore`);
    } else {
      ok(`${project.envFile} is already git-ignored`);
    }
    if (!secretKey) warn("No secret key saved. You'll need it for signed users, the dashboard and the MCP server.");

    // ------------------------------------------------------------ package
    step("2. Install");
    const native = project.kind === "ios" || project.kind === "android";
    if (native) {
      say(
        project.kind === "ios"
          ? `  In Xcode: File > Add Package Dependencies, paste ${cyan("https://github.com/youasked/youasked")} and add the ${bold("YouAsked")} library.`
          : `  Add ${cyan('maven("https://jitpack.io")')} to your repositories, then ${cyan('implementation("com.github.youasked:youasked:0.1.0")')}.`,
      );
    } else if (flags["no-install"]) {
      say(`  ${dim("Skipped (--no-install).")} Install it yourself: ${cyan(installLine(project))}`);
    } else if (hasDependency(project, project.sdk)) {
      ok(`${project.sdk} is already in package.json`);
    } else {
      const [cmd, args] = installCommand(project.pm, project.sdk);
      say(`  ${dim("$")} ${cmd} ${args.join(" ")}`);
      const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
      if (r.status === 0) ok(`Installed ${project.sdk}`);
      else {
        warn(`The install failed. Run it yourself: ${cyan(installLine(project))}`);
      }
    }
    if (project.kind === "expo" && !flags["no-install"]) {
      // Optional peers: a remembered anonymous id across restarts, and haptics on vote and ship.
      const peers = ["@react-native-async-storage/async-storage", "expo-haptics"].filter((n) => !hasDependency(project, n));
      if (peers.length) {
        say(`  ${dim("$")} npx expo install ${peers.join(" ")}`);
        const r = spawnSync("npx", ["expo", "install", ...peers], { cwd, stdio: "inherit" });
        if (r.status === 0) ok(`Installed ${peers.join(" and ")}`);
        else warn(`Couldn't install ${peers.join(" and ")}. Optional, but run ${cyan(`npx expo install ${peers.join(" ")}`)} for a remembered device id and haptics.`);
      }
    }

    // ------------------------------------------------------------ what to add
    if (project.kind === "unknown") {
      printManual(project, publicKey, manual);
    } else if (project.kind === "ios" || project.kind === "android") {
      printNative(project, publicKey, manual);
    } else if (project.kind === "web") {
      printWeb(project, publicKey, manual);
    } else if (project.kind === "expo") {
      step("3. Where should people ask?");
      /** @type {string[]} */
      const entries = await ask.multi(
        "Entry points",
        [
          { key: "settings", label: "Settings row", hint: "a row in your settings or profile screen" },
          { key: "icon", label: "Header button", hint: "a round icon in a screen header" },
          { key: "card", label: "Feature card", hint: "top requests with vote buttons, for a home screen" },
          { key: "askbar", label: "Ask bar", hint: "chat-style input for a home screen" },
          { key: "floating", label: "Floating launcher", hint: "a chat bubble in the corner (skip it if you have a tab bar)" },
        ],
        ["settings", "icon"],
      );
      step("4. Code");
      addExpoProvider(project, { floating: entries.includes("floating"), api: customApi, changes, manual });
      const rnSnippets = {
        settings: { import: "RequestButton", jsx: '<RequestButton variant="row" />', what: "settings row" },
        icon: { import: "RequestButton", jsx: '<RequestButton variant="icon" />', what: "header button" },
        card: { import: "FeatureCard", jsx: "<FeatureCard />", what: "feature card" },
        askbar: { import: "AskBar", jsx: "<AskBar />", what: "ask bar" },
      };
      for (const key of /** @type {const} */ (["settings", "icon", "card", "askbar"])) {
        if (entries.includes(key)) {
          const sn = rnSnippets[key];
          manual.push(`Put the ${sn.what} where it fits your screens:\n\nimport { ${sn.import} } from "@youasked/react-native";\n\n${sn.jsx}`);
        }
      }
      manual.push(
        `If people sign in, sign their id on your server (never in the app) and pass it in, so nobody can vote as someone else:\n\n// server: signUser(process.env.YOUASKED_SECRET_KEY, user.id) from "@youasked/react/server"\n<YouAsked appKey={…} user={{ id: userId }} signature={signature} ready={loaded}>`,
      );
    } else {
      step("3. Where should people ask?");
      /** @type {Entry[]} */
      const entries = await ask.multi(
        "Entry points",
        [
          { key: "floating", label: "Floating launcher", hint: "a chat bubble in the corner" },
          { key: "askbar", label: "Ask bar", hint: "chat-style input for a home screen" },
          { key: "card", label: "Feature card", hint: "top requests with vote buttons" },
          { key: "settings", label: "Settings row", hint: "a row in your menu or settings" },
          { key: "page", label: "Embedded page", hint: "a /feedback page" },
        ],
        ["floating"],
      );
      say(`  ${entries.length ? "Adding: " + entries.map((e) => ({ floating: "floating launcher", askbar: "ask bar", card: "feature card", settings: "settings row", page: "embedded page" })[e]).join(", ") : "No entry points. Just the provider, so you can use useYouAsked().open()."}`);
      const nextish = project.kind === "next-app" || project.kind === "next-pages";
      let identity = false;
      if (nextish) {
        identity = await ask.confirm("Do your users sign in? (lets us know who is asking, and stops anyone voting as someone else)", false);
      } else {
        say(`  ${dim("Signed-in users need a server endpoint; see the README. Everyone is anonymous for now.")}`);
      }

      step("4. Code");
      const wired = wireProvider(project, { entries, identity, api: customApi, changes, manual });
      if (wired && identity) addIdentityRoute(project, changes);
      if (entries.includes("page")) addFeedbackPage(project, changes, manual);
      for (const key of /** @type {const} */ (["askbar", "card", "settings"])) {
        if (entries.includes(key)) {
          const s = entrySnippets[key];
          manual.push(`Put the ${s.what} wherever you want it:\n\nimport { ${s.import} } from "@youasked/react";\n\n${s.jsx}`);
        }
      }
    }

    // ------------------------------------------------------------ agent files
    step("5. For your coding agent");
    const skillRel = ".claude/skills/youasked/SKILL.md";
    if (exists(path.join(cwd, skillRel))) {
      ok(`${skillRel} already there`);
    } else if (await ask.confirm("Add a Claude Code skill (.claude/skills/youasked) so your agent knows how to use YouAsked?", true)) {
      writeNew(cwd, skillRel, skillMd, changes);
    }
    const agentsRel = firstExisting(cwd, ["AGENTS.md", "agents.md"]);
    if (agentsRel) {
      const text = read(path.join(cwd, agentsRel));
      if (text.includes(AGENTS_MARKER)) ok(`${agentsRel} already mentions YouAsked`);
      else if (await ask.confirm(`Add a short YouAsked section to ${agentsRel}?`, true)) {
        const next = `${text}${text.endsWith("\n") ? "" : "\n"}\n${agentsSection}`;
        fs.writeFileSync(path.join(cwd, agentsRel), next);
        changes.push({ rel: agentsRel, status: "modified" });
        ok(`Added a YouAsked section to ${agentsRel}`);
        showDiff(text, next);
      }
    }

    // ------------------------------------------------------------ summary
    step("Done");
    for (const c of changes) {
      const tag = c.status === "created" ? green("+ created ") : c.status === "modified" ? yellow("~ modified") : dim("= unchanged");
      say(`  ${tag} ${c.rel}`);
    }
    if (manual.length) {
      say(`\n${bold("Left for you")} ${dim("(they go where they suit your UI, or I couldn't edit them safely)")}`);
      manual.forEach((m, i) => {
        say(`\n  ${i + 1}. ${m.split("\n")[0]}`);
        const rest = m.split("\n").slice(1).join("\n").trim();
        if (rest) codeBlock(rest);
      });
    }
    say(`\n${bold("Next")}`);
    say(
      project.kind === "expo"
        ? `  1. Start the app (${cyan("npx expo start")}), open an entry point, add a request and vote on it. Dev builds count as test mode.`
        : project.kind === "ios" || project.kind === "android"
          ? `  1. Run a debug build (it's in test mode) and tap the bubble in the corner. Add a request, vote on it.`
          : `  1. Start your dev server and look for the chat bubble in the corner. Add a request, vote on it.`,
    );
    if (claimUrl) {
      say(`  2. Try it now on localhost. To go live, claim it: ${cyan(claimUrl)}`);
      say(`     ${dim("Until it's claimed and on a plan, the widget only answers on localhost.")}`);
    } else {
      say(`  2. Your dashboard: ${cyan(dashboardUrl)}`);
    }
    say(`  3. Ship from your commits: connect GitHub in the dashboard, then write ${bold('"closes YA-12"')} in a commit or PR.`);
    say(`  4. Let your agent read and ship requests:`);
    say(`     ${cyan("claude mcp add youasked -e YOUASKED_SECRET_KEY=ya_sec_… -- npx -y @youasked/mcp")}`);
    say(`  5. Something off? ${cyan("npx youasked doctor")}\n`);
  } catch (err) {
    bad(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    ask.close();
  }
}

function installLine(/** @type {Project} */ p) {
  const [cmd, args] = installCommand(p.pm, p.sdk);
  return `${cmd} ${args.join(" ")}`;
}

// ---------------------------------------------------------------- writing files

/** Writes a file that must not exist yet. If it does, leaves it alone. */
function writeNew(cwd, rel, content, changes) {
  const abs = path.join(cwd, rel);
  if (exists(abs)) {
    const same = read(abs) === content;
    changes.push({ rel, status: "unchanged" });
    (same ? ok : warn)(same ? `${rel} is already set up` : `${rel} already exists, left alone`);
    return same;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  changes.push({ rel, status: "created" });
  ok(`Created ${bold(rel)}`);
  return true;
}

/** Applies `edit` to a file and shows what changed. Returns false if it declined (nothing written). */
function editFile(cwd, rel, edit, changes) {
  const abs = path.join(cwd, rel);
  const before = read(abs);
  const after = edit(before);
  if (after === null) return false;
  if (after === before) {
    changes.push({ rel, status: "unchanged" });
    ok(`${rel} already set up`);
    return true;
  }
  fs.writeFileSync(abs, after);
  changes.push({ rel, status: "modified" });
  ok(`Edited ${bold(rel)}`);
  showDiff(before, after);
  return true;
}

/** Adds an import after the last existing one (or at the top, under a directive). */
export function addImport(code, line) {
  if (code.includes(line)) return code;
  const re = /^import\s[^;]*?['"][^'"]+['"];?[ \t]*$/gm;
  let end = -1;
  for (const m of code.matchAll(re)) end = m.index + m[0].length;
  if (end >= 0) return `${code.slice(0, end)}\n${line}${code.slice(end)}`;
  const directive = /^\s*(['"])use (?:client|server)\1;?[ \t]*\n/.exec(code);
  const at = directive ? directive[0].length : 0;
  return `${code.slice(0, at)}${line}\n${at ? "" : "\n"}${code.slice(at)}`;
}

/** Wraps the one place `target` appears. Returns null if it appears zero or several times. */
export function wrapOnce(code, target, open = "<FeatureRequests>", close = "</FeatureRequests>") {
  if (code.includes("<FeatureRequests")) return code;
  const matches = [...code.matchAll(target)];
  if (matches.length !== 1) return null;
  const m = matches[0];
  return `${code.slice(0, m.index)}${open}${m[0]}${close}${code.slice(m.index + m[0].length)}`;
}

/** Import specifier for a file, via the "@/" alias when the tsconfig has one, else relative. */
function specifier(cwd, fromFile, toFileNoExt) {
  for (const cfg of ["tsconfig.json", "jsconfig.json"]) {
    if (!exists(path.join(cwd, cfg))) continue;
    try {
      const json = JSON.parse(read(path.join(cwd, cfg)).replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/,(\s*[}\]])/g, "$1"));
      const target = json.compilerOptions?.paths?.["@/*"]?.[0];
      if (typeof target === "string") {
        const base = target.replace(/^\.\//, "").replace(/\*$/, "");
        if (toFileNoExt.startsWith(base)) return `@/${toFileNoExt.slice(base.length)}`;
      }
    } catch {
      // fall through to a relative import
    }
  }
  const rel = posix(path.relative(path.dirname(fromFile), toFileNoExt));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

// ---------------------------------------------------------------- per-framework wiring

/**
 * Creates the provider component and wraps the app in it.
 * @returns {boolean} whether the app is now wrapped
 */
function wireProvider(/** @type {Project} */ p, { entries, identity, api, changes, manual }) {
  const { cwd, kind } = p;
  const floating = entries.includes("floating");
  const jsx = (/** @type {string} */ ts, /** @type {string} */ js) => (p.ts ? ts : js);

  /** @type {{ host: string | null, dir: string, target: RegExp, hostHint: string }} */
  let plan;
  if (kind === "next-app") {
    plan = {
      host: firstExisting(cwd, ["app/layout.tsx", "app/layout.jsx", "app/layout.js", "src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.js"]),
      dir: p.src ? "src/components" : "components",
      target: /(?<=>\s*)\{children\}(?=\s*<\/)/g,
      hostHint: "app/layout.tsx",
    };
  } else if (kind === "next-pages") {
    plan = {
      host: firstExisting(cwd, ["pages/_app.tsx", "pages/_app.jsx", "pages/_app.js", "src/pages/_app.tsx", "src/pages/_app.jsx", "src/pages/_app.js"]),
      dir: p.src ? "src/components" : "components",
      target: /<Component\s+\{\.\.\.pageProps\}\s*\/>/g,
      hostHint: "pages/_app.tsx",
    };
  } else if (kind === "remix") {
    plan = {
      host: firstExisting(cwd, ["app/root.tsx", "app/root.jsx", "app/root.js"]),
      dir: "app/components",
      target: /<Outlet\s*\/>/g,
      hostHint: "app/root.tsx",
    };
  } else {
    const host = firstExisting(cwd, ["src/main.tsx", "src/main.jsx", "src/main.ts", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.js", "src/index.ts"]);
    plan = { host, dir: host ? posix(path.dirname(host)) : "src", target: /<App\s*\/>/g, hostHint: "src/main.tsx" };
  }

  const ext = plan.host ? (/\.tsx?$/.test(plan.host) ? "tsx" : "jsx") : jsx("tsx", "jsx");
  const compRel = `${plan.dir}/feature-requests.${ext}`;
  const source = providerComponent({
    keyExpr: p.keyExpr,
    apiExpr: api ? p.apiExpr : null,
    ts: ext === "tsx",
    next: kind === "next-app",
    identity,
    floating,
    identityPath: kind === "next-app" ? `${p.src ? "src/" : ""}app/api/youasked/identity/route` : `${p.src ? "src/" : ""}pages/api/youasked/identity`,
  });
  const fresh = !exists(path.join(cwd, compRel));
  const wrote = writeNew(cwd, compRel, source, changes);
  if (!fresh && !wrote && identity) {
    manual.push(`${compRel} already exists with different contents, so I left it. Make sure it wraps your app in <YouAsked appKey={${p.keyExpr}}>. Reference:\n\n${source}`);
  }

  const wrapLine = (/** @type {string} */ what) => `wrap ${what} in <FeatureRequests>`;
  const manualWrap = (/** @type {string} */ file) =>
    manual.push(
      `In ${file}, import FeatureRequests from ${compRel.replace(/\.\w+$/, "")} and ${wrapLine(kind === "next-app" ? "{children}" : kind === "next-pages" ? "<Component />" : kind === "remix" ? "<Outlet />" : "<App />")}:\n\nimport { FeatureRequests } from "${specifierFor(plan.host ?? plan.hostHint)}";\n\n<FeatureRequests>\n  ${kind === "next-app" ? "{children}" : kind === "next-pages" ? "<Component {...pageProps} />" : kind === "remix" ? "<Outlet />" : "<App />"}\n</FeatureRequests>`,
    );
  const specifierFor = (/** @type {string} */ host) => specifier(cwd, path.join(cwd, host), compRel.replace(/\.\w+$/, ""));

  if (!plan.host) {
    warn(`Couldn't find ${plan.hostHint}.`);
    manualWrap(plan.hostHint);
    return false;
  }
  const spec = specifierFor(plan.host);
  const done = editFile(
    cwd,
    plan.host,
    (code) => {
      if (code.includes("FeatureRequests")) return code;
      const wrapped = wrapOnce(code, plan.target);
      return wrapped === null ? null : addImport(wrapped, `import { FeatureRequests } from "${spec}";`);
    },
    changes,
  );
  if (!done) {
    warn(`Couldn't safely edit ${plan.host} (expected exactly one place to wrap).`);
    manualWrap(plan.host);
    return false;
  }
  return true;
}

/** Expo: a FeatureRequests wrapper the root layout uses. Editing the root layout is left to the developer, since layouts vary too much to edit safely. */
function addExpoProvider(/** @type {Project} */ p, { floating, api, changes, manual }) {
  const dir = exists(path.join(p.cwd, "src")) ? "src/components" : "components";
  const rel = `${dir}/FeatureRequests.${p.ts ? "tsx" : "jsx"}`;
  const props = [`appKey={${p.keyExpr}${p.ts ? "!" : ""}}`, `trigger="${floating ? "floating" : "none"}"`];
  if (api) props.push(`apiUrl={${p.apiExpr}}`);
  const typed = p.ts ? ": { children: React.ReactNode }" : "";
  writeNew(
    p.cwd,
    rel,
    `import { YouAsked } from "@youasked/react-native";

// Feature requests: people ask and vote inside the app, and hear when what they asked for ships.
export function FeatureRequests({ children }${typed}) {
  return <YouAsked ${props.join(" ")}>{children}</YouAsked>;
}
`,
    changes,
  );
  const layout = firstExisting(p.cwd, ["app/_layout.tsx", "app/_layout.jsx", "src/app/_layout.tsx", "App.tsx", "App.jsx", "App.js"]);
  manual.push(
    `Wrap your root ${layout ? `in ${layout}` : "component"} so every screen can open the sheet:\n\nimport { FeatureRequests } from "${layout?.startsWith("src/") ? "../components/FeatureRequests" : layout?.startsWith("app/") ? "../components/FeatureRequests" : "./components/FeatureRequests"}";\n\n<FeatureRequests>\n  {/* your navigator */}\n</FeatureRequests>`,
  );
}

function addIdentityRoute(/** @type {Project} */ p, changes) {
  const ext = p.ts ? "ts" : "js";
  if (p.kind === "next-app") {
    const root = p.src ? "src/app" : "app";
    writeNew(p.cwd, `${root}/api/youasked/identity/route.${ext}`, identityRouteApp(p.ts), changes);
  } else {
    const root = p.src ? "src/pages" : "pages";
    writeNew(p.cwd, `${root}/api/youasked/identity.${ext}`, identityRoutePages(p.ts), changes);
  }
  warn(`Open the new identity route and fill in getCurrentUser(). Until then everyone is anonymous.`);
}

function addFeedbackPage(/** @type {Project} */ p, changes, /** @type {string[]} */ manual) {
  const ext = p.ts ? "tsx" : "jsx";
  if (p.kind === "next-app") {
    writeNew(p.cwd, `${p.src ? "src/app" : "app"}/feedback/page.${ext}`, feedbackPageApp, changes);
  } else if (p.kind === "next-pages") {
    writeNew(p.cwd, `${p.src ? "src/pages" : "pages"}/feedback.${ext}`, feedbackPagePages, changes);
  } else {
    manual.push(`Add a page (e.g. at /feedback in your router) that renders the whole board:\n\nimport { FeatureBoard } from "@youasked/react";\n\n<FeatureBoard />`);
  }
}

/** For projects we don't recognise: no guessing, just what to paste. */
/** Native iOS and Android: the publishable key is safe in the app; the secret stays on your server. */
function printNative(/** @type {Project} */ p, /** @type {string} */ publicKey, /** @type {string[]} */ manual) {
  step("3. Add it to your app");
  if (p.kind === "ios") {
    manual.push(
      `Configure once and add the modifier to your root view:\n\nimport YouAsked\n\n@main struct MyApp: App {\n    init() { YouAsked.configure(appKey: "${publicKey}") }\n    var body: some Scene {\n        WindowGroup { ContentView().youAsked() }\n    }\n}`,
      `Put entry points where people already look: YARequestButton(.row) in settings, YARequestButton(.icon) in a toolbar, YAFeatureCard() on a home screen, YAAskAbout(topic: "charts") next to a feature. Or YouAsked.open() from any button.`,
      `If people sign in, sign their id on your server with YOUASKED_SECRET_KEY (never in the app) and call YouAsked.identify(user:signature:). See https://youasked.dev/docs#ios`,
    );
  } else {
    manual.push(
      `Configure once in Application.onCreate, and wrap your UI:\n\nYouAsked.configure(this, appKey = "${publicKey}")\n\nsetContent {\n    YouAskedHost {\n        AppContent()\n    }\n}`,
      `Put entry points where people already look: RequestButton(variant = Row) in settings, FeatureCard() on a home screen, AskAbout(topic = "charts") next to a feature. Or YouAsked.open() from any button.`,
      `If people sign in, sign their id on your server with YOUASKED_SECRET_KEY (never in the app) and call YouAsked.identify(user, signature). See https://youasked.dev/docs#android`,
    );
  }
  manual.push(`Keep the secret key (${p.secretVar}, saved in ${p.envFile} when there is one) on your server. Never ship it in the app.`);
}

/** Vue, Svelte, Angular, Nuxt, Astro and plain Vite sites: @youasked/js, with the key inlined (it's publishable). */
function printWeb(/** @type {Project} */ p, /** @type {string} */ publicKey, /** @type {string[]} */ manual) {
  step("3. Add it to your app");
  say(`  ${dim(`${p.label} isn't React, so this uses @youasked/js. It draws the same widget with its own renderer.`)}`);
  const where =
    p.label === "Nuxt"
      ? "a client plugin (plugins/youasked.client.ts)"
      : p.label === "Angular"
        ? "your root component's ngOnInit"
        : p.label === "SvelteKit" || p.label === "Svelte"
          ? "onMount in your root layout"
          : p.label === "Vue"
            ? "main.ts, or onMounted in App.vue"
            : p.label === "Astro"
              ? "a <script> in your base layout"
              : "your entry file";
  manual.push(
    `Start it in ${where}. The publishable key is safe in client code:\n\nimport { init } from "@youasked/js";\n\ninit({ appKey: "${publicKey}", label: "Ask us" });`,
    `Put entry points anywhere in your markup. They're custom elements:\n\n<youasked-feature-card limit="3"></youasked-feature-card>\n<youasked-request-button variant="row"></youasked-request-button>\n<a href="#" data-youasked-open>Request a feature</a>`,
  );
  if (p.label === "Vue" || p.label === "Nuxt") manual.push(`Tell Vue the youasked- tags are custom elements, in vite.config (or nuxt.config vue.compilerOptions):\n\nvue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("youasked-") } } })`);
  if (p.label === "Angular") manual.push(`Add CUSTOM_ELEMENTS_SCHEMA to the schemas of any component that uses the youasked- elements.`);
  manual.push(`If people sign in, sign their id on your server and pass it in: identify({ id: user.id }, signature). See https://youasked.dev/docs#identity`);
}

function printManual(/** @type {Project} */ p, /** @type {string} */ publicKey, /** @type {string[]} */ manual) {
  step("3. Add it to your app");
  warn("I don't recognise this project, so I haven't touched any code.");
  manual.push(
    `Wrap your app (React 18+) in the provider. Your publishable key is safe in client code:\n\nimport { YouAsked } from "@youasked/react";\n\n<YouAsked appKey="${publicKey}">\n  <App />\n</YouAsked>`,
  );
}
