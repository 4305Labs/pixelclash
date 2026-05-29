// Screenshot the action buttons mid-cooldown so the dark sweep is visible.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state",
    tick: 1,
    phase: "playing",
    winner: null,
    players: [
      { id: "p1", team: "blue", x: 300, y: 360, hp: 100, alive: true },
      { id: "p2", team: "red", x: 470, y: 300, hp: 60, alive: true },
    ],
    projectiles: [{ id: "b1", team: "blue", kind: "ability", x: 380, y: 330 }],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 120, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(60);
// Fire the ability (2.5s) and dash (2s) so both show partial sweeps.
await page.keyboard.press("k");
await page.keyboard.press("l");
await page.waitForTimeout(700); // let the sweeps wind down a bit
await page.screenshot({ path: "docs/screenshot-cooldown.png" });
await browser.close();
console.log("saved docs/screenshot-cooldown.png");
