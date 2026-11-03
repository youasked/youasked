#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { doctor, openDashboard } from "../src/doctor.js";
import { init } from "../src/init.js";
import { bold, cyan, dim, say } from "../src/ui.js";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = `
${bold("youasked")} ${dim(`v${VERSION}`)}  feature requests your users can vote on

${bold("Usage")}
  npx youasked ${cyan("init")}      add YouAsked to this project
  npx youasked ${cyan("doctor")}    check keys, install and API connection
  npx youasked ${cyan("open")}      print your dashboard URL

${bold("Options for init")}
  --yes, -y          answer every question with its default (floating launcher, anonymous users)
  --no-install       don't install @youasked/react
  --key ya_pub_…     reuse an existing app instead of creating one
  --secret ya_sec_…  its secret key
  --api <url>        use a different API server
`;

/** @returns {{ command: string | undefined, flags: Record<string, string | boolean> }} */
function parse(/** @type {string[]} */ argv) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  /** @type {string[]} */
  const rest = [];
  const valued = new Set(["key", "secret", "api"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-y") flags.yes = true;
    else if (a === "-h") flags.help = true;
    else if (a === "-v") flags.version = true;
    else if (a.startsWith("--")) {
      const [name, inline] = a.slice(2).split(/=(.*)/s);
      if (inline !== undefined) flags[name] = inline;
      else if (valued.has(name) && argv[i + 1] && !argv[i + 1].startsWith("-")) flags[name] = argv[++i];
      else flags[name] = true;
    } else rest.push(a);
  }
  return { command: rest[0], flags };
}

const { command, flags } = parse(process.argv.slice(2));
const cwd = process.cwd();

if (flags.version) say(VERSION);
else if (flags.help || !command || command === "help") say(HELP);
else if (command === "init") await init({ flags, cwd });
else if (command === "doctor") await doctor({ flags, cwd });
else if (command === "open") await openDashboard({ flags });
else {
  say(`\n  Unknown command "${command}".\n${HELP}`);
  process.exitCode = 1;
}
