// Milestone 47 (render): projectile trails. As a flying bolt moves between
// snapshots (interpolated each frame on the client), it leaves a short fading
// "ghost" trail — small dots dropped at its recent positions that shrink + fade
// and then clean themselves up. The trail is driven purely from the projectile's
// motion in the existing snapshot `projectiles[]` — nothing is added to the
// server or the snapshot shape. Rules we verify here:
//   • a projectile that MOVES between two snapshots spawns trail dots
//     (the scene's `this.projectileTrails` array grows);
//   • with NO projectiles present, no trail dots are spawned;
//   • the dots clean themselves up (the array doesn't grow without bound).
import { openGame, assert } from "./helpers.mjs";
import { TRAIL } from "../src/config.js";

// A minimal "playing" snapshot carrying a list of projectiles. Each projectile
// is `{ id, kind, x, y }` — the client colours/sizes it from its kind, so a
// plain "basic" bolt is enough to drive the trail.
const state = (projectiles = []) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, maxHp: 100, alive: true }],
  projectiles, minions: [], pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// One basic bolt (id "b1") at a given x — moving it between snapshots is what
// drives the trail. y is fixed so it travels in a straight line across the lane.
const bolt = (x) => ({ id: "b1", kind: "basic", x, y: 300 });

// How many trail dots are currently active (read from the scene's array).
const trailCount = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return (s.projectileTrails || []).length;
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

  // First snapshot: NO projectiles. This must spawn no trail dots at all.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([]));
  await page.waitForTimeout(80);
  assert((await trailCount(page)) === 0, "no trail dots when there are no projectiles");

  // Seed the bolt at x=200. Its first sighting just creates the bolt + remembers
  // its position; it hasn't MOVED yet, so no trail dot is dropped from this.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([bolt(200)]));
  await page.waitForTimeout(60);

  // Now move the bolt well past TRAIL.minStepPx across a few snapshots so it
  // leaves a trail. Each step is ~50px (far more than minStepPx), so each frame
  // that sees a moved bolt drops a dot. We expect the array to have grown.
  for (const x of [250, 300, 350, 400]) {
    await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([bolt(x)]));
    await page.waitForTimeout(50);
  }
  const grew = await trailCount(page);
  assert(grew > 0, "a moving projectile spawns trail dots (the array grew)");

  // The dots fade + clean themselves up: after a wait longer than their life,
  // and with the bolt gone (no projectiles), the array drains back toward empty
  // and never exceeds the configured cap.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state([]));
  await page.waitForTimeout(TRAIL.lifeMs + 150);
  const drained = await trailCount(page);
  assert(drained <= TRAIL.max, `trail dots stay within the cap (<= ${TRAIL.max}), got ${drained}`);
  assert(drained === 0, "trail dots clean themselves up once the bolt is gone");

  // The tunables are sane (so the trail actually drops + fades + is bounded).
  assert(TRAIL.minStepPx > 0 && TRAIL.lifeMs > 0 && TRAIL.max > 0, "TRAIL minStepPx/lifeMs/max are positive");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 47 PROJECTILE-TRAILS RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
