// Screenshot the six heroes lined up in a live match (one of each class), plus
// the lobby class picker, so the distinct sprites are visible in the docs.
import { openGame } from "./helpers.mjs";
import { CLASS_ORDER, CLASSES } from "../src/config.js";

const { browser, page } = await openGame();
await page.evaluate(
  ({ order, classes }) => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    s.dismissStartGate();
    const net = window.PIXELCLASH.net;
    net._receive({ t: "welcome", id: "p1", team: "blue" });
    // One hero of each class, spread across the arena, alternating teams.
    const players = order.map((cls, i) => ({
      id: "p" + i,
      team: i % 2 ? "red" : "blue",
      x: 130 + i * 100,
      y: 250,
      hp: classes[cls].maxHp,
      maxHp: classes[cls].maxHp,
      alive: true,
      cls,
      level: i + 1,
    }));
    net._receive({
      t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
      players, projectiles: [], minions: [], pickups: [], towers: [],
      bases: [
        { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
        { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      ],
    });
  },
  { order: CLASS_ORDER, classes: CLASSES }
);
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-heroes.png" });

// Also capture the lobby picker (two rows of three buttons).
await page.evaluate(() => {
  window.PIXELCLASH.net.sendClass("mage");
  window.PIXELCLASH.net._receive({
    t: "state", tick: 2, phase: "waiting", winner: null, needed: 2, countdown: 0,
    score: { blue: 0, red: 0 },
    players: [{ id: "p1", team: "blue", x: 130, y: 250, hp: 90, maxHp: 90, alive: true, cls: "mage" }],
    projectiles: [], minions: [], pickups: [], towers: [], bases: [],
  });
});
await page.waitForTimeout(200);
await page.screenshot({ path: "docs/screenshot-heroes-lobby.png" });

await browser.close();
console.log("saved docs/screenshot-heroes.png and docs/screenshot-heroes-lobby.png");
