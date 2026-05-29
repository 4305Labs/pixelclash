// Milestone 20 (scoreboard + respawn): knocking out an enemy hero credits the
// killer's team on the scoreboard (once), self/teammate and unattributed damage
// never score, the kill flows through the projectile path too, knocked-out
// players report a respawn countdown, and the score resets between matches.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const flush = () => new Promise((r) => setTimeout(r, 10));
const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(DT);
};

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect(); // p1 blue
  connect(); // p2 red
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  server.minions = [];
  server.nextWaveAt = Infinity;

  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red

  assert(server.score.blue === 0 && server.score.red === 0, "scoreboard starts 0–0");

  // --- A kill is credited to the attacking team (once) ----------------------
  server.damage(p2, 999, "blue");
  assert(!p2.alive, "the red hero is knocked out");
  assert(server.score.blue === 1 && server.score.red === 0, "the kill is credited to blue");
  server.damage(p2, 999, "blue"); // already dead — must not double-count
  assert(server.score.blue === 1, "a dead player can't be killed again");

  // --- Self / teammate / unattributed damage never scores -------------------
  p2.alive = true;
  p2.hp = COMBAT.maxHp;
  server.damage(p2, 999, "red"); // same team as the victim
  assert(server.score.red === 0, "a team can't score on its own hero");
  p2.alive = true;
  p2.hp = COMBAT.maxHp;
  server.damage(p2, 999); // no attacker (e.g. a test/util call)
  assert(server.score.blue === 1 && server.score.red === 0, "unattributed damage doesn't score");

  // --- The respawn countdown is reported in the snapshot --------------------
  // p2 is dead from above; pin the clock to integers so the seconds math is
  // exact (the live sim clock is fractional), then check the countdown.
  server.timeMs = 5000;
  p2.deadUntil = 5000 + COMBAT.respawnMs; // a full respawn out
  server.broadcast();
  await flush();
  const deadP2 = blue.players.find((p) => p.id === "p2");
  const expected = Math.ceil(COMBAT.respawnMs / 1000);
  assert(deadP2.respawnIn === expected, `a downed hero reports ${expected}s to respawn`);
  const liveP1 = blue.players.find((p) => p.id === "p1");
  assert(liveP1.respawnIn === 0, "a living hero reports 0 respawn time");

  // --- The kill also flows through the projectile path ----------------------
  server.towers.clear(); // isolate: no tower zaps stealing the kill
  server.pickups = []; // ...and no center power orb changing the bolt's damage
  for (const p of server.players.values()) {
    p.alive = true;
    p.hp = COMBAT.maxHp;
  }
  server.score = { blue: 0, red: 0 };
  server.projectiles = [];
  p2.hp = 5;
  p2.x = 400;
  p2.y = 300;
  p1.x = 380;
  p1.y = 300;
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic"); // auto-aims the nearby red hero
  stepN(server, 4);
  assert(!p2.alive, "the red hero is knocked out by a blue bolt");
  assert(server.score.blue === 1, "a bolt kill is credited to the firing team");

  // --- Score resets between matches -----------------------------------------
  server.resetMatch();
  assert(server.score.blue === 0 && server.score.red === 0, "the score resets on a new match");

  // --- The snapshot carries the score ---------------------------------------
  server.score = { blue: 4, red: 2 };
  server.broadcast();
  await flush();
  assert(blue.score.blue === 4 && blue.score.red === 2, "the client receives the scoreboard");

  console.log("\nMILESTONE 20 SCOREBOARD TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
