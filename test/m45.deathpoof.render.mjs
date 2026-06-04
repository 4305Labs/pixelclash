// Milestone 45 (render): the "death poof". When a unit dies, the client plays a
// brief pixel "poof" (a cluster of dusty puff dots + an expanding ring) at the
// unit's last position, then cleans itself up. Death is detected purely from
// snapshot transitions on the client — nothing is added to the server or the
// snapshot shape. Rules we verify here:
//   • a HERO going alive -> dead (same id) spawns a poof;
//   • a lane MINION that disappears from the snapshot (it was killed) spawns one;
//   • a still-alive hero / a brand-new hero that just appeared does NOT poof;
//   • a brand-new minion that just appeared does NOT poof.
import { openGame, assert } from "./helpers.mjs";
import { POOF } from "../src/config.js";

// A minimal "playing" snapshot. Pass the local hero's alive flag, an optional
// SECOND hero (id "p2"), and an optional list of lane minions so we can drive
// every code path. HP is fixed at full so only the alive/disappear transitions
// (not damage) are in play.
const state = ({ p1Alive = true, others = [], minions = [] } = {}) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [
    { id: "p1", team: "blue", x: 200, y: 300, hp: 100, maxHp: 100, alive: p1Alive },
    ...others,
  ],
  projectiles: [], minions, pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// A second hero (id "p2") at a given alive state, so we can test alive -> dead
// for a NON-local unit (and confirm a still-alive one never poofs).
const p2 = (alive) => ({ id: "p2", team: "red", x: 400, y: 300, hp: 100, maxHp: 100, alive });

// One lane minion (id "m1"); the SAME id across calls lets us detect it leaving.
const minion = () => ({ id: "m1", team: "red", x: 500, y: 300, hp: 40, maxHp: 40 });

// How many poof shapes are currently active (read from the scene's array).
const poofCount = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return (s.deathPoofs || []).length;
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

  // First snapshot: an alive hero p2 + an alive minion m1. This SEEDS their
  // sprites — a brand-new id must NOT poof on its first appearance.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ others: [p2(true)], minions: [minion()] }));
  await page.waitForTimeout(80);
  assert((await poofCount(page)) === 0, "no poof on a unit's first appearance");

  // Now p2 dies (alive -> false) AND the minion vanishes from the snapshot
  // (server removes dead minions): we expect TWO poofs to be born — one per
  // dead unit. The grow+fade tween outlives this brief wait, so they're active.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ others: [p2(false)], minions: [] }));
  await page.waitForTimeout(60);
  const grew = await poofCount(page);
  assert(grew > 0, "a death spawns poof shapes (the array grew)");
  // Each poof = POOF.count puffs + 1 ring; two dead units => two such bursts.
  const perPoof = POOF.count + 1;
  assert(grew >= perPoof * 2, `two dead units make two poofs (>= ${perPoof * 2} shapes), got ${grew}`);

  // A still-alive hero and a freshly-appeared hero must NOT add a poof. Send a
  // snapshot where p2 is gone (already dead, no longer listed) and a NEW hero
  // p3 appears alive, while p1 stays alive — neither should poof.
  const before = await poofCount(page);
  await page.evaluate(
    (s) => window.PIXELCLASH.net._receive(s),
    state({ others: [{ id: "p3", team: "red", x: 420, y: 300, hp: 100, maxHp: 100, alive: true }] })
  );
  await page.waitForTimeout(60);
  const after = await poofCount(page);
  assert(after <= before, "a still-alive / newly-appeared unit does NOT spawn a poof");

  // The tunables are sane (so the poof actually bursts + cleans up).
  assert(POOF.count > 0 && POOF.lifeMs > 0, "POOF count/lifeMs are positive");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 45 DEATH-POOF RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
