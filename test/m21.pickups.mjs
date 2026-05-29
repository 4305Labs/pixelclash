// Milestone 21 (map pickups): orbs sit at fixed spots; walking over a HEAL orb
// restores HP and a POWER orb buffs attack damage for a while; a taken orb
// disappears and respawns on a timer; only active orbs are sent in the snapshot;
// pickups reset between matches. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { PICKUP, PICKUP_SPOTS, COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const flush = () => new Promise((r) => setTimeout(r, 10));

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

const spot = (id) => PICKUP_SPOTS.find((s) => s.id === id);
const pk = (id) => server.pickups.find((p) => p.id === id);

try {
  const blue = connect(); // p1 blue
  connect(); // p2 red
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  server.nextWaveAt = Infinity; // no minion waves (we jump the clock around below)
  server.minions = [];

  assert(server.pickups.length === PICKUP_SPOTS.length, "all pickups exist");
  assert(server.pickups.every((p) => p.active), "pickups start active");

  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  // Park both heroes far from every orb so they don't grab anything by accident.
  p1.x = 120;
  p1.y = 150;
  p2.x = 680;
  p2.y = 150;

  // --- HEAL orb restores HP and then goes on a respawn timer ----------------
  const healSpot = spot("heal_top");
  p1.hp = COMBAT.maxHp - PICKUP.heal - 10; // hurt enough to see the full heal
  p1.x = healSpot.x;
  p1.y = healSpot.y; // stand on it
  const hpBefore = p1.hp;
  server.step(DT);
  assert(p1.hp === hpBefore + PICKUP.heal, "walking over a heal orb restores HP");
  assert(!pk("heal_top").active, "the heal orb is taken (inactive)");

  // Heal never overheals past max.
  p1.hp = COMBAT.maxHp - 5;
  pk("heal_top").active = true; // force it back for this check
  server.step(DT);
  assert(p1.hp === COMBAT.maxHp, "healing is capped at max HP");

  // --- It respawns after the timer ------------------------------------------
  p1.x = 120;
  p1.y = 150; // step off so it isn't re-grabbed instantly
  const taken = pk("heal_top");
  taken.active = false;
  taken.respawnAt = server.timeMs + PICKUP.respawnMs;
  server.step(DT);
  assert(!pk("heal_top").active, "a taken orb stays gone before its timer");
  server.timeMs = taken.respawnAt;
  server.step(DT);
  assert(pk("heal_top").active, "the orb reappears once its timer elapses");

  // --- POWER orb buffs attack damage for a while ----------------------------
  const powerSpot = spot("power_mid");
  p1.x = powerSpot.x;
  p1.y = powerSpot.y;
  server.step(DT);
  assert(server.timeMs < p1.powerUntil, "grabbing a power orb starts the buff");

  // A buffed attack deals boosted damage. Aim p1 at the red base after dropping
  // its tower so the bolt has a clean target, and read the projectile's damage.
  server.towers.get("red").alive = false;
  server.projectiles = [];
  p1.x = 700;
  p1.y = 300;
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  const boosted = server.projectiles.at(-1).dmg;
  assert(
    boosted === Math.round(COMBAT.basic.dmg * PICKUP.powerMult),
    "a power-buffed bolt deals boosted damage"
  );

  // After the buff expires, damage is back to normal.
  server.timeMs = p1.powerUntil + 1;
  server.projectiles = [];
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  assert(server.projectiles.at(-1).dmg === COMBAT.basic.dmg, "damage returns to normal after the buff");

  // --- The snapshot lists only active pickups, with a powered flag -----------
  // Two orbs were taken above (power_mid, and heal_bot is still untouched).
  server.broadcast();
  await flush();
  assert(
    blue.pickups.every((p) => server.pickups.find((q) => q.id === p.id)?.active),
    "snapshot lists only active pickups"
  );
  assert(
    blue.pickups.length === server.pickups.filter((p) => p.active).length,
    "snapshot pickup count matches active count"
  );

  // --- Reset restores all pickups -------------------------------------------
  server.resetMatch();
  assert(
    server.pickups.length === PICKUP_SPOTS.length && server.pickups.every((p) => p.active),
    "resetMatch restores every pickup"
  );

  console.log("\nMILESTONE 21 PICKUP TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
