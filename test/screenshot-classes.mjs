// Screenshot the lobby hero-class picker, plus heroes drawn at their class
// sizes (scout small, tank big) for the docs.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
  s.dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net.sendClass("tank"); // mark a selection in the picker
  net._receive({
    t: "state",
    tick: 1,
    phase: "waiting",
    winner: null,
    needed: 2,
    countdown: 0,
    score: { blue: 0, red: 0 },
    players: [
      { id: "p1", team: "blue", x: 140, y: 230, hp: 170, alive: true, cls: "tank", maxHp: 170 },
      { id: "p3", team: "blue", x: 140, y: 370, hp: 70, alive: true, cls: "scout", maxHp: 70 },
      { id: "p2", team: "red", x: 660, y: 300, hp: 100, alive: true, cls: "soldier", maxHp: 100 },
    ],
    projectiles: [],
    minions: [],
    pickups: [],
    towers: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-classes.png" });
await browser.close();
console.log("saved docs/screenshot-classes.png");
