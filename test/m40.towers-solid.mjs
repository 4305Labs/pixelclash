// Milestone 40 (solid towers): live towers are obstacles heroes path AROUND
// (movement only — projectiles still register tower hits separately, and minions
// march straight through since their movement doesn't pass the obstacle list).
// A destroyed tower stops blocking. Pure movement-math test on sim.js.
import { resolveMove, towerObstacles, TOWER_BLOCK_HALF } from "../src/sim.js";
import { PLAYER_HALF } from "../src/config.js";
import { assert } from "./helpers.mjs";

try {
  const towers = [
    { x: 250, y: 300, alive: true },
    { x: 550, y: 300, alive: false }, // destroyed
  ];
  const obs = towerObstacles(towers);
  assert(obs.length === 1, "only LIVE towers become obstacles");
  assert(obs[0].x === 250 - TOWER_BLOCK_HALF, "the obstacle box is centred on the tower");

  // Walking right into the live tower stops at its near face (you can't pass through).
  const blocked = resolveMove(200, 300, 320, 300, obs);
  assert(
    Math.abs(blocked.x - (250 - TOWER_BLOCK_HALF - PLAYER_HALF)) < 0.001,
    "a hero is stopped at the live tower's near face"
  );

  // Sliding past above the tower (out of its box) is unobstructed — you route around.
  const around = resolveMove(200, 300 - TOWER_BLOCK_HALF - PLAYER_HALF - 4, 320, 300 - TOWER_BLOCK_HALF - PLAYER_HALF - 4, obs);
  assert(around.x > 300, "a hero routes around the tower (above its box) freely");

  // No obstacle list (e.g. lane minions) → the lane is walkable straight through.
  const through = resolveMove(200, 300, 320, 300);
  assert(through.x > 250, "minions / un-obstructed movers march straight through the tower row");

  // A destroyed tower no longer blocks — walk through where it stood.
  const past = resolveMove(500, 300, 620, 300, towerObstacles(towers));
  assert(past.x > 550, "a destroyed tower stops blocking movement");

  console.log("\nMILESTONE 40 SOLID-TOWER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
