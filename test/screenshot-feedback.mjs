// Screenshot combat feedback: a hit flash + floating damage numbers.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state", tick: 1, phase: "playing", winner: null,
    players: [
      { id: "p1", team: "blue", x: 300, y: 320, hp: 100, alive: true },
      { id: "p2", team: "red", x: 470, y: 280, hp: 100, alive: true },
    ],
    projectiles: [{ id: "b1", team: "blue", kind: "ability", x: 440, y: 290 }],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 200, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(80);
// Apply damage so a flash + damage number appear, then snapshot quickly.
await page.evaluate(() => {
  window.PIXELCLASH.net._receive({
    t: "state", tick: 2, phase: "playing", winner: null,
    players: [
      { id: "p1", team: "blue", x: 300, y: 320, hp: 100, alive: true },
      { id: "p2", team: "red", x: 470, y: 280, hp: 70, alive: true },
    ],
    projectiles: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 200, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(120); // mid-flash, number still rising
await page.screenshot({ path: "docs/screenshot-feedback.png" });
await browser.close();
console.log("saved docs/screenshot-feedback.png");
