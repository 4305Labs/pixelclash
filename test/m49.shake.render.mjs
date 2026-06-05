// Milestone 49 (render): "camera shake on knockouts". A short, punchy camera
// shake fires on big moments so they feel weighty — a hero being knocked out
// (alive -> dead for the same id between snapshots) gives a noticeable jolt, and
// a base/nexus taking damage gives a stronger one. The shake is triggered purely
// from snapshot transitions on the client (reusing the SAME hero alive -> dead
// branch that plays the death poof, and the base hp-drop branch) — nothing is
// added to the server or the snapshot shape. `triggerShake(kind)` records the
// last shake in `this._lastShake` AND calls Phaser's real camera shake, so the
// test can assert WHEN a shake fired without needing real camera motion.
// Rules we verify here:
//   • a HERO going alive -> dead (same id) triggers a shake;
//   • a snapshot with NO deaths does NOT trigger a (new) shake;
//   • a brand-new hero appearing alive does NOT trigger a shake (first sighting);
//   • a base losing HP triggers the stronger "base" shake.
import { openGame, assert } from "./helpers.mjs";
import { SHAKE } from "../src/config.js";

// A minimal "playing" snapshot. Pass the local hero's alive flag, an optional
// SECOND hero (id "p2"), and the two bases' HP so we can drive every code path.
// HP is full unless overridden so only the alive/hp transitions are in play.
const state = ({ p1Alive = true, others = [], blueBaseHp = 250 } = {}) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [
    { id: "p1", team: "blue", x: 200, y: 300, hp: 100, maxHp: 100, alive: p1Alive },
    ...others,
  ],
  projectiles: [], minions: [], pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: blueBaseHp, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// A second hero (id "p2") at a given alive state, so we can test alive -> dead
// for a NON-local unit (and confirm a still-alive one never shakes).
const p2 = (alive) => ({ id: "p2", team: "red", x: 400, y: 300, hp: 100, maxHp: 100, alive });

// Read the scene's recorded last shake (or null if none has fired yet).
const lastShake = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return s._lastShake || null;
  });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Dismiss the start gate and tell the client it is player "p1".
  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // First snapshot: an alive hero p2. This SEEDS its sprite — a brand-new id
  // must NOT shake on its first appearance.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ others: [p2(true)] }));
  await page.waitForTimeout(80);
  assert((await lastShake(page)) === null, "no shake on a unit's first appearance");

  // Now p2 dies (alive -> false): we expect a "kill" shake to be recorded.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ others: [p2(false)] }));
  await page.waitForTimeout(60);
  const killShake = await lastShake(page);
  assert(killShake !== null, "a hero knockout triggers a shake");
  assert(killShake.kind === "kill", `the knockout uses the "kill" preset (got ${killShake && killShake.kind})`);
  assert(killShake.ms === SHAKE.kill.ms, "the shake duration comes from SHAKE.kill");

  // A snapshot with NO deaths (p2 already gone, p1 still alive, no base damage)
  // must NOT fire a NEW shake — the recorded shake stays the same one.
  const before = killShake.at;
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state());
  await page.waitForTimeout(60);
  const still = await lastShake(page);
  assert(still && still.at === before, "a snapshot with no deaths does NOT trigger a new shake");

  // A brand-new hero appearing alive must NOT shake (first sighting), even
  // though the array changed.
  await page.evaluate(
    (s) => window.PIXELCLASH.net._receive(s),
    state({ others: [{ id: "p3", team: "red", x: 420, y: 300, hp: 100, maxHp: 100, alive: true }] })
  );
  await page.waitForTimeout(60);
  const afterNew = await lastShake(page);
  assert(afterNew && afterNew.at === before, "a newly-appeared alive hero does NOT trigger a shake");

  // A base losing HP fires the stronger "base" shake.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ blueBaseHp: 200 }));
  await page.waitForTimeout(60);
  const baseShake = await lastShake(page);
  assert(baseShake && baseShake.kind === "base", "a base taking damage triggers the stronger base shake");
  assert(baseShake.intensity === SHAKE.base.intensity, "the base shake intensity comes from SHAKE.base");

  // The tunables are sane (so a shake actually fires and then ends).
  assert(SHAKE.kill.ms > 0 && SHAKE.kill.intensity > 0, "SHAKE.kill ms/intensity are positive");
  assert(SHAKE.base.ms > 0 && SHAKE.base.intensity > 0, "SHAKE.base ms/intensity are positive");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 49 CAMERA-SHAKE RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
