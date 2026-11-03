// Terminal output and prompts with no dependencies. Colours respect NO_COLOR and non-TTY output.
import readline from "node:readline/promises";

const color = !process.env.NO_COLOR && process.env.TERM !== "dumb" && (process.stdout.isTTY || process.env.FORCE_COLOR);
const wrap = (open, close) => (/** @type {string} */ s) => (color ? `\x1b[${open}m${s}\x1b[${close}m` : s);

export const bold = wrap(1, 22);
export const dim = wrap(2, 22);
export const red = wrap(31, 39);
export const green = wrap(32, 39);
export const yellow = wrap(33, 39);
export const cyan = wrap(36, 39);

export const say = (/** @type {string} */ s = "") => console.log(s);
export const ok = (/** @type {string} */ s) => say(`  ${green("✓")} ${s}`);
export const warn = (/** @type {string} */ s) => say(`  ${yellow("!")} ${s}`);
export const bad = (/** @type {string} */ s) => say(`  ${red("✗")} ${s}`);
export const step = (/** @type {string} */ s) => say(`\n${bold(s)}`);

/** Prints a block of code the user should paste somewhere, indented and dimmed in the margin. */
export function codeBlock(/** @type {string} */ code) {
  for (const line of code.replace(/\n$/, "").split("\n")) say(`    ${dim("│")} ${line}`);
}

/**
 * Prompts that fall back to their default with --yes (or when there is nobody to answer).
 * @param {{ yes: boolean }} opts
 */
export function makePrompter({ yes }) {
  /** @type {readline.Interface | null} */
  let rl = null;
  /** @type {string[] | null} */
  let piped = null;
  /** @param {string} q */
  const raw = async (q) => {
    // Piped input (scripts, CI): read every line up front, readline loses lines when stdin ends early.
    if (!process.stdin.isTTY) {
      if (!piped) {
        const chunks = [];
        for await (const c of process.stdin) chunks.push(c);
        piped = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
      }
      const a = (piped.shift() ?? "").trim();
      process.stdout.write(`${q}${a}\n`);
      return a;
    }
    rl ??= readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      return (await rl.question(q)).trim();
    } catch {
      return "";
    }
  };

  return {
    /** @param {string} q @param {string} def */
    async text(q, def) {
      if (yes) return def;
      const a = await raw(`  ${q} ${dim(`(${def})`)} `);
      return a || def;
    },
    /** @param {string} q @param {boolean} def */
    async confirm(q, def) {
      if (yes) return def;
      const a = (await raw(`  ${q} ${dim(def ? "[Y/n]" : "[y/N]")} `)).toLowerCase();
      if (!a) return def;
      return a.startsWith("y");
    },
    /**
     * Numbered multi-select. Answer with numbers like "1,3"; Enter keeps the defaults.
     * @template {string} K
     * @param {string} q
     * @param {{ key: K, label: string, hint?: string }[]} options
     * @param {K[]} defaults
     * @returns {Promise<K[]>}
     */
    async multi(q, options, defaults) {
      if (yes) return defaults;
      say(`  ${q}`);
      options.forEach((o, i) => {
        const on = defaults.includes(o.key);
        say(`    ${on ? green("●") : dim("○")} ${i + 1}. ${o.label}${o.hint ? dim(`  ${o.hint}`) : ""}`);
      });
      const a = await raw(`  Pick numbers, comma separated ${dim("(Enter for the ● ones, 0 for none)")} `);
      if (!a) return defaults;
      if (a === "0") return [];
      const picked = a
        .split(/[\s,]+/)
        .map((n) => options[Number(n) - 1]?.key)
        .filter((k) => k !== undefined);
      return /** @type {K[]} */ (picked);
    },
    close() {
      rl?.close();
    },
  };
}

/** Line-level summary of an edit: what went away, what came in. Good enough for small, targeted edits. */
export function showDiff(/** @type {string} */ before, /** @type {string} */ after) {
  const count = (/** @type {string[]} */ lines) => {
    const m = new Map();
    for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const a = before.split("\n");
  const b = after.split("\n");
  const inA = count(a);
  const inB = count(b);
  for (const l of a) {
    if ((inB.get(l) ?? 0) > 0) inB.set(l, /** @type {number} */ (inB.get(l)) - 1);
    else if (l.trim()) say(`      ${red(`- ${l}`)}`);
  }
  for (const l of b) {
    if ((inA.get(l) ?? 0) > 0) inA.set(l, /** @type {number} */ (inA.get(l)) - 1);
    else if (l.trim()) say(`      ${green(`+ ${l}`)}`);
  }
}
