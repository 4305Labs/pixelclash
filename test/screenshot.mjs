// Render the real game in headless Chromium with a hand-crafted snapshot, then
// save PNG screenshots so we can visually confirm how it looks.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();

// A lively mid-match scene: two players, health bars, bolts, and both bases.
await page.evaluate(() => {
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state",
    tick: 1,
    phase: "playing",
    winner: null,
    players: [
      { id: "p1", team: "blue", x: 300, y: 320, hp: 80, alive: true },
      { id: "p2", team: "red", x: 470, y: 260, hp: 45, alive: true },
    ],
    projectiles: [
      { id: "b1", team: "blue", kind: "basic", x: 360, y: 300 },
      { id: "b2", team: "blue", kind: "ability", x: 410, y: 285 },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 90, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-match.png" });

// The victory screen.
await page.evaluate(() => {
  window.PIXELCLASH.net._receive({
    t: "state",
    tick: 2,
    phase: "over",
    winner: "blue",
    players: [{ id: "p1", team: "blue", x: 700, y: 300, hp: 100, alive: true }],
    projectiles: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 0, maxHp: 250, alive: false },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-win.png" });

await browser.close();
console.log("screenshots saved to docs/");
