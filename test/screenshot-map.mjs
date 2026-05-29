// Screenshot the arena map: walls/obstacles with players positioned around them.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state", tick: 1, phase: "playing", winner: null, needed: 2, countdown: 0,
    players: [
      { id: "p1", team: "blue", x: 360, y: 300, hp: 100, alive: true },
      { id: "p2", team: "red", x: 470, y: 240, hp: 100, alive: true },
      { id: "p3", team: "blue", x: 250, y: 200, hp: 70, alive: true },
    ],
    projectiles: [{ id: "b1", team: "blue", kind: "basic", x: 430, y: 270 }],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(150);
await page.screenshot({ path: "docs/screenshot-map.png" });
await browser.close();
console.log("saved docs/screenshot-map.png");
