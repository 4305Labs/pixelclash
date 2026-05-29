// Screenshot the pre-match lobby countdown banner.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state", tick: 1, phase: "countdown", winner: null, needed: 2, countdown: 3,
    players: [
      { id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true },
      { id: "p2", team: "red", x: 680, y: 300, hp: 100, alive: true },
    ],
    projectiles: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(120);
await page.screenshot({ path: "docs/screenshot-lobby.png" });
await browser.close();
console.log("saved docs/screenshot-lobby.png");
