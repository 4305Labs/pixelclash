// Render the real game in headless Chromium with a hand-crafted snapshot, then
// save PNG screenshots so we can visually confirm how it looks.
import { openGame } from "./helpers.mjs";

const { browser, page } = await openGame();

// A lively mid-match scene showing it all: heroes (one a powered tank, plus a
// bot), minions clashing, towers, pickups, bolts, the scoreboard + clock, and
// the kill feed.
await page.evaluate(() => {
  window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
  const net = window.PIXELCLASH.net;
  net._receive({ t: "welcome", id: "p1", team: "blue" });
  net._receive({
    t: "state",
    tick: 1,
    phase: "playing",
    winner: null,
    score: { blue: 3, red: 2 },
    timeLeft: 132,
    killFeed: [
      { id: 1, byTeam: "blue", victimTeam: "red", victimCls: "scout" },
      { id: 2, byTeam: "red", victimTeam: "blue", victimCls: "tank" },
    ],
    players: [
      { id: "p1", team: "blue", x: 320, y: 300, hp: 150, maxHp: 170, alive: true, cls: "tank", powered: true },
      { id: "p2", team: "red", x: 470, y: 250, hp: 45, maxHp: 70, alive: true, cls: "scout", bot: true },
    ],
    projectiles: [
      { id: "b1", team: "blue", kind: "basic", x: 380, y: 290 },
      { id: "z1", team: "red", kind: "tower", x: 500, y: 296 },
    ],
    minions: [
      { id: "mb1", team: "blue", x: 360, y: 270, hp: 40, alive: true },
      { id: "mb2", team: "blue", x: 360, y: 330, hp: 26, alive: true },
      { id: "mr1", team: "red", x: 430, y: 270, hp: 15, alive: true },
      { id: "mr2", team: "red", x: 430, y: 330, hp: 40, alive: true },
    ],
    pickups: [
      { id: "heal_bot", kind: "heal", x: 400, y: 540 },
      { id: "power_mid", kind: "power", x: 400, y: 300 },
    ],
    towers: [
      { team: "blue", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
      { team: "red", x: 550, y: 300, hp: 110, maxHp: 180, alive: true },
    ],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
      { team: "red", x: 756, y: 300, hp: 200, maxHp: 250, alive: true, shielded: true },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-match.png" });

// The victory screen, with the final score.
await page.evaluate(() => {
  window.PIXELCLASH.net._receive({
    t: "state",
    tick: 2,
    phase: "over",
    winner: "blue",
    score: { blue: 7, red: 4 },
    players: [{ id: "p1", team: "blue", x: 700, y: 300, hp: 100, alive: true }],
    projectiles: [],
    bases: [
      { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
      { team: "red", x: 756, y: 300, hp: 0, maxHp: 250, alive: false },
    ],
  });
});
await page.waitForTimeout(250);
await page.screenshot({ path: "docs/screenshot-win.png" });

await browser.close();
console.log("screenshots saved to docs/");
