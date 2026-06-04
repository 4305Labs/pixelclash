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
  "./m11.feedback.mjs",
  "./m12.lobby.mjs",
  "./m12.lobby.render.mjs",
  "./m13.walls.mjs",
  "./m14.audio.node.mjs",
  "./m14.audio.mjs",
  "./m15.mobile.mjs",
  "./m16.serverurl.node.mjs",
  "./m17.minions.mjs",
  "./m17.minions.render.mjs",
  "./m18.towers.mjs",
  "./m18.towers.render.mjs",
  "./m19.towergate.mjs",
  "./m19.towergate.render.mjs",
  "./m20.scoreboard.mjs",
  "./m20.scoreboard.render.mjs",
  "./m21.pickups.mjs",
  "./m21.pickups.render.mjs",
  "./m22.classes.mjs",
  "./m22.classes.render.mjs",
  "./m23.killfeed.mjs",
  "./m23.killfeed.render.mjs",
  "./m24.timer.mjs",
  "./m24.timer.render.mjs",
  "./m25.bots.mjs",
  "./m25.bots.render.mjs",
  "./m26.record.node.mjs",
  "./m27.progress.mjs",
  "./m27.progress.render.mjs",
  "./m28.touch.render.mjs",
  "./m29.integration.mjs",
  "./m30.snapshot.mjs",
  "./m31.fountain.mjs",
  "./m31.fountain.render.mjs",
  "./m32.anim.node.mjs",
  "./m32.anim.render.mjs",
  "./m33.terrain.render.mjs",
  "./m34.camps.mjs",
  "./m34.camps.render.mjs",
  "./m35.bush.mjs",
  "./m35.bush.render.mjs",
  "./m36.abilities.mjs",
  "./m38.rpgsprites.mjs",
  "./m39.bots.mjs",
  "./m40.towers-solid.mjs",
  "./m41.vignette.render.mjs",
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
