// Milestone 5 (combat): health, basic attack, ability, cooldowns, death and
// respawn — all verified on the authoritative server, plus the client
// receiving projectile + HP updates. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { COMBAT, SPAWNS } from "../src/config.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));
const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(1 / 30);
};

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const client = new NetClient(pair.client);
  client.join();
  return client;
}

try {
  const alice = connect(); // blue, spawns left (x=120, y=300)
  connect(); // bob: red, spawns right (x=680, y=300) — same row, so aim is straight
  await flush();

  const A = server.players.get("p1");
  const B = server.players.get("p2");
  assert(A.hp === COMBAT.maxHp && B.hp === COMBAT.maxHp, "both start at full HP");

  // Cooldown: two basic attacks fired instantly => only one bolt spawns.
  alice.sendAttack("basic");
  alice.sendAttack("basic");
  await flush();
  assert(server.projectiles.length === 1, "cooldown blocks an instant second basic");

  // Client should receive the projectile in the next snapshot.
  server.step(1 / 30);
  server.broadcast();
  await flush();
  assert(alice.projectiles.length === 1, "client receives the in-flight bolt");

  // Let the bolt fly across and hit bob.
  stepN(server, 45);
  assert(B.hp === COMBAT.maxHp - COMBAT.basic.dmg, "basic attack deals 8 damage");
  assert(server.projectiles.length === 0, "bolt is consumed after the hit");

  // Ability (separate cooldown) hits for 30.
  alice.sendAttack("ability");
  await flush();
  stepN(server, 45);
  assert(
    B.hp === COMBAT.maxHp - COMBAT.basic.dmg - COMBAT.ability.dmg,
    "ability deals 30 damage"
  );

  // Client sees bob's reduced HP after a broadcast.
  server.broadcast();
  await flush();
  assert(
    alice.players.find((p) => p.id === "p2").hp === B.hp,
    "client sees opponent's updated HP"
  );

  // Knock bob out and confirm respawn at full HP at the red spawn.
  server.damage(B, 999);
  assert(!B.alive && B.hp === 0, "bob is knocked out at 0 HP");
  stepN(server, Math.ceil(COMBAT.respawnMs / (1000 / 30)) + 2);
  assert(B.alive && B.hp === COMBAT.maxHp, "bob respawns at full HP");
  assert(
    B.x === SPAWNS.red[0].x && B.y === SPAWNS.red[0].y,
    "bob respawns at the red spawn"
  );

  // Friendly fire: a bolt should never hit a teammate (only 1v1 here, but the
  // rule matters for 3v3). Confirm same-team is skipped by the hit check.
  const fakeBolt = { team: "blue", x: A.x, y: A.y };
  assert(server.hitPlayer(fakeBolt) === null, "bolts never hit teammates");

  console.log("\nMILESTONE 5 COMBAT TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
