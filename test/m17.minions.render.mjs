// Milestone 17 (render): the arena draws lane minions from the snapshot —
// creates a sprite per minion at the server's position, shrinks its health bar
// when it takes damage, and cleans up sprites for minions that are gone.
import { openGame, assert } from "./helpers.mjs";

const baseState = (minions) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [],
  minions,
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const inject = (minions) =>
    page.evaluate((state) => {
      const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
      s.dismissStartGate();
      window.PIXELCLASH.net._receive(state);
    }, baseState(minions));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );
  await inject([
    { id: "m1", team: "blue", x: 200, y: 280, hp: 40, alive: true },
    { id: "m2", team: "red", x: 600, y: 320, hp: 40, alive: true },
  ]);
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const m1 = s.minionSprites.get("m1");
    return { count: s.minionSprites.size, x: m1.x, y: m1.y, w: m1.hpFill.width };
  });
  assert(v.count === 2, "a sprite is created for each minion");
  assert(Math.abs(v.x - 200) < 5 && Math.abs(v.y - 280) < 5, "minion sits at its server position");
  const fullWidth = v.w;

  // Damage m1 — its health bar should shrink.
  await inject([
    { id: "m1", team: "blue", x: 200, y: 280, hp: 20, alive: true },
    { id: "m2", team: "red", x: 600, y: 320, hp: 40, alive: true },
  ]);
  await page.waitForTimeout(120);
  const dmgWidth = await page.evaluate(
    () => window.PIXELCLASH.game.scene.getScene("ArenaScene").minionSprites.get("m1").hpFill.width
  );
  assert(dmgWidth < fullWidth, "a damaged minion's health bar shrinks");

  // m1 is gone next snapshot — its sprite must be cleaned up.
  await inject([{ id: "m2", team: "red", x: 600, y: 320, hp: 40, alive: true }]);
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { count: s.minionSprites.size, hasM1: s.minionSprites.has("m1") };
  });
  assert(after.count === 1 && !after.hasM1, "a departed minion's sprite is removed");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 17 MINION RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
