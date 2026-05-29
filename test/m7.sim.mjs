// Unit test for the shared movement math (sim.js) that both server and client
// use. If this matches on both sides, prediction stays in sync with the server.
import { stepPosition, normalizeInput } from "../src/sim.js";
import { PLAYER_SPEED, PLAYER_HALF, GAME_WIDTH } from "../src/config.js";
import { assert } from "./helpers.mjs";

try {
  // Straight move: x increases by speed * dt.
  const a = stepPosition(100, 300, 1, 0, 0.5);
  assert(Math.abs(a.x - (100 + PLAYER_SPEED * 0.5)) < 0.001, "straight move uses full speed");
  assert(a.y === 300, "no vertical drift on a horizontal move");

  // Diagonal: normalized so it's not faster than straight.
  const d = stepPosition(0, 0, 1, 1, 1);
  const expected = (PLAYER_SPEED / Math.SQRT2);
  assert(Math.abs(d.x - expected) < 0.001, "diagonal is normalized (x)");
  assert(Math.abs(d.y - expected) < 0.001, "diagonal is normalized (y)");

  // Clamped to the arena bounds.
  const left = stepPosition(20, 300, -1, 0, 1);
  assert(left.x === PLAYER_HALF, "clamped at the left wall");
  const right = stepPosition(GAME_WIDTH - 20, 300, 1, 0, 1);
  assert(right.x === GAME_WIDTH - PLAYER_HALF, "clamped at the right wall");

  // A half-pushed stick stays slow (not normalized up to full speed).
  const half = normalizeInput(0.5, 0);
  assert(half.dx === 0.5 && half.dy === 0, "partial input keeps its magnitude");

  console.log("\nMILESTONE 7 SIM TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
