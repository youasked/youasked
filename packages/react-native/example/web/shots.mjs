// Screenshots the react-native-web build at 390x844 in headless Chrome. Usage: node web/shots.mjs [outDir]
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/Users/adenteo/otay-landing/node_modules/");
const puppeteer = require("puppeteer-core");

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? "/tmp/ya-rn-shots";
const { mkdirSync } = await import("node:fs");
mkdirSync(out, { recursive: true });

const server = createServer((req, res) => {
  const file = req.url?.startsWith("/bundle.js") ? "bundle.js" : "index.html";
  res.setHeader("content-type", file.endsWith(".js") ? "text/javascript" : "text/html");
  res.end(readFileSync(resolve(here, "out", file)));
}).listen(0);
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox"],
});

async function shot(name, query, scheme, steps) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: false });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
  page.on("console", (m) => ["error", "warning"].includes(m.type()) && console.log(`[${name}] ${m.type()}: ${m.text().slice(0, 200)}`));
  page.on("pageerror", (e) => console.log(`[${name}] pageerror: ${e.message}`));
  await page.goto(`http://localhost:${port}/?scheme=${scheme}&${query}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1800));
  if (steps) await steps(page);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
}

const click = async (page, text) => {
  await page.evaluate((t) => {
    const el = [...document.querySelectorAll("[role=button],[role=tab],[role=switch],div[tabindex]")].find((e) => e.textContent?.includes(t));
    el?.click();
  }, text);
  await new Promise((r) => setTimeout(r, 700));
};

for (const scheme of ["light", "dark"]) {
  await shot(`${scheme}-1-home`, "", scheme);
  await shot(`${scheme}-2-sheet`, "open=sheet", scheme);
  await shot(`${scheme}-3-board`, "open=board", scheme);
  await shot(`${scheme}-4-detail`, "open=detail", scheme);
  await shot(`${scheme}-5-compose`, "open=new", scheme);
  await shot(`${scheme}-6-embedded-board`, "screen=board", scheme);
}

// Drag-to-dismiss: pull the sheet down by its handle past the threshold and check it closes.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:${port}/?scheme=light&open=sheet`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1800));
  const visible = async () => page.evaluate(() => Boolean([...document.querySelectorAll("*")].find((e) => e.textContent === "Ideas, votes and what's new")));
  console.log("sheet open before drag:", await visible());
  // Small drag first: should snap back.
  await page.mouse.move(195, 120);
  await page.mouse.down();
  await page.mouse.move(195, 150, { steps: 6 });
  await new Promise((r) => setTimeout(r, 100));
  await page.screenshot({ path: `${out}/drag-mid.png` });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 700));
  console.log("sheet open after small drag (expect true):", await visible());
  // Big drag: should dismiss.
  await page.mouse.move(195, 120);
  await page.mouse.down();
  await page.mouse.move(195, 520, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));
  console.log("sheet open after big drag (expect false):", await visible());
  await page.screenshot({ path: `${out}/drag-after.png` });
  await page.close();
}

// Typing shows the "already asked?" tray, sending shows the chat thread, voting flips a vote.
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`http://localhost:${port}/?scheme=light&open=sheet`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1800));
  await page.click("textarea");
  await page.keyboard.type("Export my expenses to Excel please", { delay: 8 });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${out}/flow-1-tray.png` });
  await page.click("[aria-label=Send]");
  await new Promise((r) => setTimeout(r, 900));
  await page.screenshot({ path: `${out}/flow-2-posting.png` });
  await new Promise((r) => setTimeout(r, 7500));
  await page.screenshot({ path: `${out}/flow-3-reply.png` });
  await page.close();
}

await browser.close();
server.close();
