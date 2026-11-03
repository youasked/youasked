// Copies the wasm engines and fonts the share-card renderer needs into worker/vendor/ (git-ignored),
// so the worker imports them by a stable path however npm hoisted the packages.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// Some packages don't export package.json, so walk up from a resolvable file to the package root.
const pkg = (name) => {
  let dir = dirname(require.resolve(name));
  while (!existsSync(join(dir, "package.json")) || JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).name !== name) dir = dirname(dir);
  return dir;
};
const out = new URL("../worker/vendor/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

// satori's own yoga.wasm is corrupted in the npm tarball (0.18.x), so take the engine from yoga-layout,
// which embeds the same binary as base64.
const yogaSrc = readFileSync(join(pkg("yoga-layout"), "dist/binaries/yoga-wasm-base64-esm.js"), "utf8");
const b64 = /"(AGFzbQ[A-Za-z0-9+/=]{1000,})"/.exec(yogaSrc)?.[1] ?? /data:application\/octet-stream;base64,(AGFzbQ[A-Za-z0-9+/=]+)/.exec(yogaSrc)?.[1];
if (!b64) throw new Error("could not find the yoga wasm in yoga-layout");
writeFileSync(join(out, "yoga.wasm"), Buffer.from(b64, "base64"));

const files = [
  [join(pkg("@resvg/resvg-wasm"), "index_bg.wasm"), "resvg.wasm"],
  [join(pkg("@fontsource/bricolage-grotesque"), "files/bricolage-grotesque-latin-700-normal.woff"), "display-700.woff"],
  [join(pkg("@fontsource/instrument-sans"), "files/instrument-sans-latin-400-normal.woff"), "body-400.woff"],
  [join(pkg("@fontsource/instrument-sans"), "files/instrument-sans-latin-600-normal.woff"), "body-600.woff"],
];
for (const [from, name] of files) copyFileSync(from, join(out, name));
console.log(`vendored ${files.length} files`);
