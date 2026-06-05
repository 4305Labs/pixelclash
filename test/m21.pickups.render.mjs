// Milestone 21 (render): the arena draws available pickup orbs (and removes one
// that's been grabbed), and a powered hero shows its aura.
import { openGame, assert } from "./helpers.mjs";

const state = (pickups, powered) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, powered }],
  projectiles: [],
  minions: [],
  pickups,
  towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const inject = (pickups, powered = false) =>
    page.evaluate((s) => {
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(pickups, powered));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );
  await inject([
    { id: "heal_top", kind: "heal", x: 400, y: 60 },
    { id: "power_mid", kind: "power", x: 400, y: 300 },
  ]);
  await page.waitForTimeout(100);

  let v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { count: s.pickupSprites.size, aura: s.sprites.get("p1").aura.fillAlpha };
  });
  assert(v.count === 2, "a sprite is created for each available pickup");
  assert(v.aura === 0, "no aura while the hero is unpowered");

  // power_mid grabbed -> only heal_top remains; p1 is now powered.
  await inject([{ id: "heal_top", kind: "heal", x: 400, y: 60 }], true);
  await page.waitForTimeout(100);
  v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return { count: s.pickupSprites.size, hasPower: s.pickupSprites.has("power_mid"), aura: s.sprites.get("p1").aura.fillAlpha };
  });
  assert(v.count === 1 && !v.hasPower, "a grabbed pickup's sprite is removed");
  assert(v.aura > 0, "a powered hero shows its aura");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 21 PICKUP RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
