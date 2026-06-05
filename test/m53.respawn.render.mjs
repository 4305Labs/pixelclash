// Milestone 53 (render): respawn countdown indicator. While a hero is DEAD and
// waiting to respawn, the client draws a small team-coloured ring (an arc that
// depletes as the timer runs down) plus the integer seconds remaining at the
// hero's position, so players can read when they / allies / enemies come back.
// It's derived purely from the snapshot's existing `alive`/`respawnIn` fields —
// nothing is added to the server or the snapshot shape. Rules we verify here:
//   • an ALIVE hero has NO indicator;
//   • a DEAD hero (respawnIn = 3) gets an indicator showing "3" with a ring;
//   • a lower respawnIn updates the SAME indicator's number ("1");
//   • once ALIVE again, the indicator is destroyed (gone from the map).
import { openGame, assert } from "./helpers.mjs";
import { RESPAWN } from "../src/config.js";

// A minimal "playing" snapshot. Pass the local player's alive-state and the
// seconds until respawn so we can drive both code paths. maxHp is fixed at 100.
const state = ({ alive = true, respawnIn = 0 } = {}) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [
    { id: "p1", team: "blue", x: 200, y: 300, hp: alive ? 100 : 0, maxHp: 100, alive, respawnIn },
  ],
  projectiles: [], minions: [], pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// Read back the live respawn indicators: how many exist, and (if present) the
// number text shown for player "p1".
const readTimers = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const m = s.respawnTimers; // Map keyed by player id
    const ind = m.get("p1");
    return { count: m.size, has: !!ind, text: ind ? ind.label.text : null };
  });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // Dismiss the start gate and tell the client it is player "p1" (so the local
  // dead hero reads slightly bigger — but an indicator shows either way).
  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // 1) ALIVE hero: no indicator at all.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ alive: true }));
  await page.waitForTimeout(80);
  const aliveT = await readTimers(page);
  assert(!aliveT.has && aliveT.count === 0, "an alive hero has no respawn indicator");

  // 2) DEAD hero with respawnIn = 3: an indicator appears showing "3".
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ alive: false, respawnIn: 3 }));
  await page.waitForTimeout(80);
  const dead3 = await readTimers(page);
  assert(dead3.has, "a dead hero gets a respawn indicator");
  assert(dead3.text === "3", 'the indicator shows the seconds remaining ("3"): ' + dead3.text);

  // 3) Lower respawnIn (1): the SAME indicator updates its number to "1".
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ alive: false, respawnIn: 1 }));
  await page.waitForTimeout(80);
  const dead1 = await readTimers(page);
  assert(dead1.has && dead1.count === 1, "the same indicator persists as the timer ticks");
  assert(dead1.text === "1", 'the indicator updates to the new seconds ("1"): ' + dead1.text);

  // 4) ALIVE again: the indicator is destroyed (gone from the map).
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state({ alive: true }));
  await page.waitForTimeout(80);
  const back = await readTimers(page);
  assert(!back.has && back.count === 0, "the indicator is destroyed the instant the hero is alive again");

  // The tunables are sane (so the ring + arc actually draw).
  assert(RESPAWN.radius > 0 && RESPAWN.respawnMs > 0, "RESPAWN radius/respawnMs are positive");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 53 RESPAWN-COUNTDOWN RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
