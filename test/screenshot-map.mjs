// Screenshot the arena map: walls/obstacles with players positioned around them.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();
await page.evaluate(() => {
  window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state", tick: 1, phase: "playing", winner: null, needed: 2, countdown: 0,
    players: [
      { id: "p1", team: "blue", x: 360, y: 300, hp: 100, alive: true },
      { id: "p2", team: "red", x: 470, y: 240, hp: 100, alive: true },
      { id: "p3", team: "blue", x: 205, y: 185, hp: 70, alive: true }, // lurking in the top-left bush
    ],
    projectiles: [{ id: "b1", team: "blue", kind: "basic", x: 430, y: 270 }],
    camps: [
      { id: "camp_top", x: 200, y: 185, hp: 120, maxHp: 120, alive: true },
      { id: "camp_bot", x: 600, y: 415, hp: 78, maxHp: 120, alive: true },
    ],
    towers: [
      { team: "blue", lane: "top", x: 250, y: 110, hp: 180, maxHp: 180, alive: true },
      { team: "blue", lane: "mid", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
      { team: "blue", lane: "bot", x: 250, y: 490, hp: 180, maxHp: 180, alive: true },
      { team: "red", lane: "top", x: 550, y: 110, hp: 180, maxHp: 180, alive: true },
      { team: "red", lane: "mid", x: 550, y: 300, hp: 180, maxHp: 180, alive: true },
      { team: "red", lane: "bot", x: 550, y: 490, hp: 130, maxHp: 180, alive: true },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
    ],
  });
});
await page.waitForTimeout(150);
await page.screenshot({ path: "docs/screenshot-map.png" });
await browser.close();
console.log("saved docs/screenshot-map.png");
