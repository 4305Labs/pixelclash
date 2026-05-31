// Screenshot the per-hero abilities in flight: a tank with its Bulwark shield
// ring, a mage's Nova shockwave mid-expansion, a scout's scatter pellets, and a
// ranger's homing arrow — for the README gallery.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
  s.dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state", tick: 1, phase: "playing", winner: null, needed: 2, countdown: 0,
    score: { blue: 1, red: 0 },
    players: [
      // Blue tank with Bulwark up (cyan shield ring).
      { id: "p1", team: "blue", x: 250, y: 300, hp: 150, maxHp: 170, alive: true, cls: "tank", shielded: true, powered: false },
      // Blue scout spraying a scatter (pellets below).
      { id: "p3", team: "blue", x: 300, y: 430, hp: 70, maxHp: 70, alive: true, cls: "scout", shielded: false, powered: false },
      // Red mage caught in its own Nova blast.
      { id: "p2", team: "red", x: 470, y: 300, hp: 60, maxHp: 90, alive: true, cls: "mage", shielded: false, powered: false },
      // Red ranger being chased by a homing arrow.
      { id: "p4", team: "red", x: 560, y: 430, hp: 85, maxHp: 85, alive: true, cls: "ranger", shielded: false, powered: false },
    ],
    projectiles: [
      { id: "b1", team: "blue", kind: "ability", x: 360, y: 410 }, // scatter pellets
      { id: "b2", team: "blue", kind: "ability", x: 372, y: 432 },
      { id: "b3", team: "blue", kind: "ability", x: 360, y: 454 },
      { id: "b4", team: "red", kind: "ability", x: 520, y: 408 },   // homing arrow
    ],
    blasts: [{ id: "x1", x: 470, y: 300, r: 74, team: "red" }],     // Nova shockwave
    minions: [], pickups: [], camps: [], towers: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
    ],
  });
});
// Grab it ~110ms in so the Nova ring is caught mid-expansion.
await page.waitForTimeout(110);
await page.screenshot({ path: "docs/screenshot-abilities.png" });
await browser.close();
console.log("saved docs/screenshot-abilities.png");
