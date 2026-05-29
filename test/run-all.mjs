// Runs every milestone test in one process so the game bundle is built once
// and reused (the build is cached inside helpers.mjs).
import { buildInlinedHtml } from "./helpers.mjs";

console.log("Building game bundle once for all tests...");
buildInlinedHtml();

const tests = [
  "./m3.movement.mjs",
  "./m4.server.mjs",
  "./m4.render.mjs",
  "./m5.combat.mjs",
  "./m5.render.mjs",
  "./m6.match.mjs",
  "./m6.render.mjs",
  "./m7.sim.mjs",
  "./m7.prediction.mjs",
  "./m8.teams.mjs",
  "./m9.dash.mjs",
  "./m9.render.mjs",
  "./m10.cooldown.mjs",
];

let failed = false;
for (const t of tests) {
  console.log(`\n=== ${t} ===`);
  const before = process.exitCode;
  await import(t);
  if (process.exitCode && process.exitCode !== before) failed = true;
}

console.log(failed ? "\nSOME TESTS FAILED" : "\nALL TESTS PASSED");
process.exit(failed ? 1 : 0);
