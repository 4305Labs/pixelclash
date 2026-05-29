// Screenshot a 3v3 scene to visually confirm the new spawn layout.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state",
    tick: 1,
    phase: "playing",
    winner: null,
    players: [
      { id: "p1", team: "blue", x: 120, y: 150, hp: 100, alive: true },
      { id: "p3", team: "blue", x: 120, y: 300, hp: 70, alive: true },
      { id: "p5", team: "blue", x: 120, y: 450, hp: 100, alive: true },
      { id: "p2", team: "red", x: 680, y: 150, hp: 55, alive: true },
      { id: "p4", team: "red", x: 680, y: 300, hp: 100, alive: true },
      { id: "p6", team: "red", x: 680, y: 450, hp: 90, alive: true },
    ],
    projectiles: [
      { id: "b1", team: "blue", kind: "ability", x: 400, y: 150 },
      { id: "b2", team: "red", kind: "basic", x: 500, y: 300 },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 160, maxHp: 250, alive: true },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-3v3.png" });
await browser.close();
console.log("saved docs/screenshot-3v3.png");
