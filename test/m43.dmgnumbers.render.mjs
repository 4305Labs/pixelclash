// Milestone 43 (render): floating damage-number popups. When a unit (hero or
// lane minion) LOSES HP between two consecutive snapshots, the client pops a
// small "-N" number at the unit's position that floats up and fades out. The
// amount is derived purely from HP deltas on the client — nothing is added to
// the server or the snapshot shape. Rules we verify here:
//   • a hero whose hp DROPPED gets a popup showing the right amount;
//   • a lane minion whose hp dropped gets one too;
//   • HEALING (hp goes UP) does NOT pop a number;
//   • a RESPAWN (dead -> alive at full HP) does NOT pop a number;
//   • a brand-new id (first sighting) does NOT pop a number.
import { openGame, assert } from "./helpers.mjs";
import { DMGTEXT } from "../src/config.js";

// A minimal "playing" snapshot. Pass the local player's hp/alive and an optional
// list of lane minions so we can drive both code paths. maxHp is fixed at 100.
const state = ({ hp = 100, alive = true, minions = [] } = {}) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 200, y: 300, hp, maxHp: 100, alive }],
  projectiles: [], minions, pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// One lane minion at a given hp (id stays the same across calls so we can detect
// damage on the SAME unit between snapshots).
const minion = (hp) => ({ id: "m1", team: "red", x: 400, y: 300, hp, maxHp: 40 });

// Read back the live damage-number texts: how many are active and the strings
// they show (so we can assert the right amount appears).
const readNumbers = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const list = s.damageNumbers || [];
    return { count: list.length, texts: list.map((t) => t.text) };
  });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Dismiss the start gate and tell the client it is player "p1" (so the local
  // hero is known — the local hit reads bigger/red, but a popup either way).
  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // First snapshot: full HP, no minions. This SEEDS the per-id "lastHp" — a
  // brand-new id must NOT pop a number on its first sighting.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ hp: 100 }));
  await page.waitForTimeout(80);
  const seeded = await readNumbers(page);
  assert(seeded.count === 0, "no popup on a unit's first appearance");

  // Hero takes 12 damage (100 -> 88): a popup showing "-12" appears.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ hp: 88 }));
  await page.waitForTimeout(80);
  const hurt = await readNumbers(page);
  assert(hurt.count >= 1, "a damage popup appears when a hero loses HP");
  assert(hurt.texts.includes("-12"), "the popup shows the right amount (-12): " + JSON.stringify(hurt.texts));

  // Hero HEALS back up (88 -> 100): no new popup (count must not grow).
  const beforeHeal = (await readNumbers(page)).count;
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ hp: 100 }));
  await page.waitForTimeout(80);
  const healed = await readNumbers(page);
  assert(healed.count <= beforeHeal, "healing (hp up) does NOT pop a damage number");

  // Hero DIES (alive -> false at 0 hp): a death is not a tracked "drop" we show,
  // and then RESPAWNS (dead -> alive at full 100): still no popup.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ hp: 0, alive: false }));
  await page.waitForTimeout(40);
  const afterDeath = (await readNumbers(page)).count;
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ hp: 100, alive: true }));
  await page.waitForTimeout(80);
  const respawned = await readNumbers(page);
  assert(respawned.count <= afterDeath, "respawn (dead -> alive at full HP) does NOT pop a number");

  // --- Lane minions ---------------------------------------------------------
  // Seed the minion at full HP (40): first sighting, no popup.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ minions: [minion(40)] }));
  await page.waitForTimeout(80);
  const mSeed = (await readNumbers(page)).count;

  // Minion takes 8 damage (40 -> 32): a "-8" popup appears.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ minions: [minion(32)] }));
  await page.waitForTimeout(80);
  const mHurt = await readNumbers(page);
  assert(mHurt.count > mSeed, "a damage popup appears when a minion loses HP");
  assert(mHurt.texts.includes("-8"), "the minion popup shows the right amount (-8): " + JSON.stringify(mHurt.texts));

  // The tunables are sane (so the popup actually rises + fades).
  assert(DMGTEXT.rise > 0 && DMGTEXT.lifeMs > 0, "DMGTEXT rise/lifeMs are positive");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 43 DAMAGE-NUMBERS RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
