// Milestone 32 (animation math): the pure anim.js helpers behave — phase
// advances and wraps, idle vs walk poses differ sensibly, and the attack pop
// eases from a punch back to 1. No Phaser; pure Node.
import assert from "node:assert";
import { advancePhase, bodyPose, popScale, POP_MS, WALK_HZ, IDLE_HZ } from "../src/anim.js";

try {
  // --- advancePhase: moves faster while walking, and wraps at 2π ------------
  const idleStep = advancePhase(0, 100, false);
  const walkStep = advancePhase(0, 100, true);
  assert(walkStep > idleStep, "phase advances faster while moving");
  assert(WALK_HZ > IDLE_HZ, "walk cadence is faster than idle");
  const wrapped = advancePhase(Math.PI * 2 - 0.01, 1000, true);
  assert(wrapped >= 0 && wrapped < Math.PI * 2, "phase stays within [0, 2π)");

  // --- bodyPose: idle bobs both ways, no squash; walk hops up with squash ----
  const idleA = bodyPose(Math.PI / 2, false); // sin = +1
  const idleB = bodyPose(-Math.PI / 2, false); // sin = -1
  assert(Math.sign(idleA.bob) === -Math.sign(idleB.bob), "idle bob swings both ways");
  assert(idleA.bob !== 0, "idle bob actually moves the body");
  assert(idleA.sx === 1 && idleA.sy === 1, "idle has no squash/stretch");

  const ground = bodyPose(0, true); // sin = 0 -> grounded
  const apex = bodyPose(Math.PI / 2, true); // sin = 1 -> apex
  assert(apex.bob < 0, "a walking hop lifts the body up");
  assert(Math.abs(ground.bob) < 1e-9, "the hop is at ground level at phase 0");
  assert(ground.sx > 1 && ground.sy < 1, "grounded = squashed wider/shorter");
  assert(apex.sy > 1 && apex.sx < 1, "apex = stretched taller/narrower");

  // --- popScale: punch at 0, eased back to 1 by POP_MS, 1 outside the window -
  assert(Math.abs(popScale(0, 0.25) - 1.25) < 1e-9, "pop starts at +amount");
  assert(popScale(POP_MS, 0.25) === 1, "pop is back to 1 when it ends");
  assert(popScale(-5) === 1 && popScale(POP_MS + 100) === 1, "pop is 1 outside its window");
  assert(popScale(POP_MS / 2, 0.25) < 1.25 && popScale(POP_MS / 2, 0.25) > 1, "pop eases back over time");

  console.log("\nMILESTONE 32 ANIMATION MATH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
