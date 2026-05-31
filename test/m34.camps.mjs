// Milestone 34 (jungle camps): neutral monsters sit in the jungle, bite nearby
// heroes, can be damaged by any bolt, and on the killing blow pay the attacker
// gold/xp + a brief attack buff, then respawn on a timer. Cleared/reset cleanly.
// Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { CAMP, CAMP_SPOTS, PROGRESS, COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect();
  connect();
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  // Quiet other systems so they don't perturb HP/positions.
  server.minions = [];
  server.nextWaveAt = Infinity;
  server.towers.clear();
  server.pickups = [];

  // --- Camps exist, full HP, one per spot -----------------------------------
  assert(server.camps.length === CAMP_SPOTS.length, "there is one camp per spot");
  assert(server.camps.every((c) => c.alive && c.hp === CAMP.maxHp), "camps start full + alive");

  const camp = server.camps[0];
  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  // Park heroes far away to start.
  p1.x = 120; p1.y = 300;
  p2.x = 680; p2.y = 300;

  // --- A camp bites a hero standing in range --------------------------------
  // The camp sits in a bush, so a hero is hidden there until they reveal (e.g.
  // by attacking the camp). Reveal p1 so we test the bite, not the stealth.
  p1.x = camp.x; p1.y = camp.y; // stand on the camp
  p1.hp = 100;
  p1.revealUntil = server.timeMs + 9999;
  server.step(DT);
  assert(p1.hp === 100 - CAMP.dmg, "a camp bites a hero in range");
  assert(camp.cd > server.timeMs, "the camp goes on its bite cooldown");

  // It does NOT bite a hero out of range.
  p1.x = 120; p1.y = 300;
  p1.hp = 100;
  camp.cd = 0;
  server.step(DT);
  assert(p1.hp === 100, "a camp ignores heroes out of range");

  // --- Any hero's bolt damages a camp (it's neutral) ------------------------
  server.projectiles = [];
  p1.x = camp.x - 20; p1.y = camp.y;
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic"); // auto-aims the nearby camp
  const shot = server.projectiles.at(-1);
  assert(shot, "the hero fires (auto-aims the camp)");
  const hp0 = camp.hp;
  for (let i = 0; i < 3; i++) server.step(DT);
  assert(camp.hp < hp0, "a hero bolt damages the camp");

  // --- Killing a camp pays the attacker + grants a buff, then it respawns ----
  p1.xp = 0; p1.gold = 0; p1.powerUntil = 0;
  server.damageCamp(camp, 9999, p1);
  assert(!camp.alive && camp.hp === 0, "the camp is cleared");
  assert(
    p1.xp === PROGRESS.reward.camp.xp && p1.gold === PROGRESS.reward.camp.gold,
    "clearing a camp pays the attacker gold + xp"
  );
  assert(server.timeMs < p1.powerUntil, "clearing a camp grants a brief attack buff");
  assert(camp.respawnAt > server.timeMs, "the cleared camp is on a respawn timer");

  // A dead camp neither bites nor takes damage, and isn't an auto-aim target.
  p1.x = camp.x; p1.y = camp.y; p1.hp = 100;
  server.step(DT);
  assert(p1.hp === 100, "a cleared camp doesn't bite");

  // --- It respawns at full HP once the timer elapses ------------------------
  server.timeMs = camp.respawnAt;
  server.step(DT);
  assert(camp.alive && camp.hp === CAMP.maxHp, "the camp respawns at full HP");

  // --- The snapshot carries camps -------------------------------------------
  server.broadcast();
  await new Promise((r) => setTimeout(r, 10));
  assert(blue.camps.length === CAMP_SPOTS.length, "client receives the camps");
  assert(blue.camps[0].maxHp === CAMP.maxHp, "camp snapshot includes maxHp");

  // --- A match reset restores the camps -------------------------------------
  server.camps[0].alive = false;
  server.resetMatch();
  assert(server.camps.every((c) => c.alive && c.hp === CAMP.maxHp), "resetMatch restores camps");

  server.stop();
  console.log("\nMILESTONE 34 CAMP TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
