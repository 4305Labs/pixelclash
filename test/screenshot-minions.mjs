// Screenshot a lane-minion clash: two waves meeting in the center, with heroes
// and both bases, to show the minions in the docs.
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
    score: { blue: 2, red: 1 },
    players: [
      { id: "p1", team: "blue", x: 330, y: 300, hp: 100, alive: true, powered: true },
      { id: "p2", team: "red", x: 470, y: 240, hp: 70, alive: true },
    ],
    pickups: [
      { id: "heal_top", kind: "heal", x: 400, y: 60 },
      { id: "heal_bot", kind: "heal", x: 400, y: 540 },
    ],
    projectiles: [
      { id: "b1", team: "blue", kind: "basic", x: 410, y: 290 },
      { id: "z1", team: "red", kind: "tower", x: 500, y: 296 },
    ],
    minions: [
      { id: "mb1", team: "blue", x: 360, y: 260, hp: 40, alive: true },
      { id: "mb2", team: "blue", x: 360, y: 300, hp: 28, alive: true },
      { id: "mb3", team: "blue", x: 360, y: 340, hp: 40, alive: true },
      { id: "mr1", team: "red", x: 430, y: 260, hp: 16, alive: true },
      { id: "mr2", team: "red", x: 430, y: 300, hp: 40, alive: true },
      { id: "mr3", team: "red", x: 430, y: 340, hp: 40, alive: true },
    ],
    towers: [
      { team: "blue", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
      { team: "red", x: 550, y: 300, hp: 120, maxHp: 180, alive: true },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      { team: "red", x: 756, y: 300, hp: 200, maxHp: 250, alive: true, shielded: true },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-minions.png" });
await browser.close();
console.log("saved docs/screenshot-minions.png");
