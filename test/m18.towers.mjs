// Milestone 18 (defensive towers): each team has a guard tower that auto-zaps
// the nearest enemy unit in range (damaging it), towers are destructible by
// player bolts (and are valid auto-aim targets) and by minions, destroying a
// tower does NOT end the match, and towers reset between matches. Pure Node.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { TOWER, COMBAT, MINION } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const flush = () => new Promise((r) => setTimeout(r, 10));
const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(DT);
};
// Reset the arena to a quiet, wave-free live match for a focused sub-test.
// Heal the towers IN PLACE (not resetTowers, which would replace the objects
// and invalidate the references we hold onto below).
const quiet = (srv) => {
  for (const tw of srv.towers.values()) {
    tw.hp = TOWER.maxHp;
    tw.alive = true;
    tw.cd = 0;
  }
  srv.projectiles = [];
  srv.minions = [];
  srv.nextWaveAt = Infinity;
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

  // Towers start full and alive, one per team.
  assert(server.towers.size === 2, "there are two towers");
  assert(
    [...server.towers.values()].every((t) => t.hp === TOWER.maxHp && t.alive),
    "towers start at full HP and alive"
  );

  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  // These objects live for the whole match (quiet() heals them in place).
  const blueTower = server.towers.get("blue");
  const redTower = server.towers.get("red");

  // --- A tower zaps the nearest enemy in range ------------------------------
  quiet(server);
  p1.x = 120;
  p1.y = 150; // blue hero well clear of the red tower
  p2.x = 300;
  p2.y = 300; // red hero stands in front of the blue tower (at x=250)
  p2.hp = COMBAT.maxHp;
  server.step(DT);
  const zaps = server.projectiles.filter((b) => b.kind === "tower");
  assert(zaps.length === 1 && zaps[0].team === "blue", "the blue tower zaps the enemy in range");
  assert(zaps[0].vx > 0, "the zap flies toward the enemy");
  assert(blueTower.cd > server.timeMs, "the tower goes on cooldown after firing");

  // The zap lands and hurts the enemy hero.
  stepN(server, 4);
  assert(p2.hp <= COMBAT.maxHp - TOWER.dmg, "the tower's zap damages the enemy hero");

  // --- Player bolts destroy a tower (and auto-aim it) -----------------------
  quiet(server);
  p2.x = 120;
  p2.y = 450; // red hero out of the way
  p1.x = 520;
  p1.y = 300; // blue hero right next to the red tower (at x=550)
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  const shot = server.projectiles.find((b) => b.kind !== "tower");
  assert(shot && shot.vx > 0, "blue auto-aims the nearby red tower");
  const towerHp0 = redTower.hp;
  stepN(server, 3);
  assert(redTower.hp < towerHp0, "player bolts damage the tower");

  // --- Minions chip the enemy tower too -------------------------------------
  quiet(server);
  p1.x = 120;
  p1.y = 150;
  p2.x = 680;
  p2.y = 450;
  server.minions = [
    { id: "mr", team: "red", x: 260, y: 300, laneY: 300, hp: MINION.maxHp, alive: true, cd: 0 },
  ];
  const blueHp0 = blueTower.hp;
  server.step(DT);
  assert(blueTower.hp === blueHp0 - MINION.dmg, "a minion at the tower chips it");

  // --- Destroying a tower does NOT end the match ----------------------------
  server.damageTower(redTower, 9999);
  assert(!redTower.alive && redTower.hp === 0, "the red tower is destroyed");
  assert(
    server.phase === "playing" && server.winner === null,
    "destroying a tower doesn't end the match (only the base does)"
  );

  // --- Reset restores both towers -------------------------------------------
  server.resetMatch();
  assert(
    [...server.towers.values()].every((t) => t.hp === TOWER.maxHp && t.alive),
    "resetMatch restores both towers to full"
  );

  // --- The snapshot carries towers to the client ----------------------------
  server.broadcast();
  await flush();
  assert(blue.towers.length === 2, "client receives both towers");
  assert(
    blue.towers.every((t) => t.maxHp === TOWER.maxHp && t.alive),
    "tower snapshot includes maxHp and alive"
  );

  console.log("\nMILESTONE 18 TOWER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
