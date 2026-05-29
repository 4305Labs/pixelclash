// Test harness that needs NO running server (this environment blocks listening
// sockets). We build the game into a single self-contained bundle, inline it
// into one HTML string, and load that straight into headless Chromium via
// setContent. We can then drive input and read live game state.
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { chromium } from "playwright";

// Path to a Chromium binary. Override with PIXELCLASH_CHROME if needed.
// (These automated tests are for development verification only — you never
// need to run them to play the game.)
const CHROME =
  process.env.PIXELCLASH_CHROME ||
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Build once and cache the inlined HTML for the whole test run.
let cachedHtml = null;

export function buildInlinedHtml() {
  if (cachedHtml) return cachedHtml;
  execSync("npx vite build", { cwd: process.cwd(), stdio: "ignore" });

  const jsFile = readdirSync("dist/assets").find((f) => f.endsWith(".js"));
  const js = readFileSync(`dist/assets/${jsFile}`, "utf8");

  // Minimal page with our game-root div and the bundle inlined as a module.
  // game-root fills the viewport, so the Playwright viewport size controls the
  // play area (lets us test phone/portrait sizes by changing the viewport).
  cachedHtml = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;width:100%;height:100%;background:#111}
    #game-root{width:100vw;height:100vh}</style></head>
    <body><div id="game-root"></div>
    <script type="module">${js}</script></body></html>`;
  return cachedHtml;
}

// Open the game in a headless browser. Pass { width, height } to simulate a
// different screen (e.g. a portrait phone); defaults to the desktop test size.
export async function openGame({ width = 900, height = 700 } = {}) {
  const html = buildInlinedHtml();
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.setContent(html, { waitUntil: "load" });
  // Wait for Phaser to boot and the arena scene's create() to finish (it sets
  // up the `sprites` map and `joystick` near the end of create()).
  await page.waitForFunction(
    () => window.PIXELCLASH?.game?.scene?.getScene("ArenaScene")?.joystick,
    { timeout: 10000 }
  );
  return { browser, page, errors };
}

export function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ok:", msg);
}
