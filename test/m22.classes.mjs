// Milestone 22 (hero classes): players start as the default class; you can pick
// a class in the lobby (but not during live play); each class has its own max
// HP and attack damage; respawn restores the class HP; the snapshot carries the
// class + maxHp; and your pick is preserved across a match reset. Pure Node.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { CLASSES, DEFAULT_CLASS } from "../src/config.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect(); // p1
  connect(); // p2
  await flush();

  const p1 = server.players.get("p1");
  const p2 = server.players.get("p2");
  assert(
    p1.cls === DEFAULT_CLASS && p1.hp === CLASSES[DEFAULT_CLASS].maxHp,
    "players start as the default class at its full HP"
  );
  assert(server.phase === "countdown", "both present -> lobby countdown");

  // --- Pick a class in the lobby --------------------------------------------
  blue.sendClass("tank");
  await flush();
  assert(p1.cls === "tank" && p1.hp === CLASSES.tank.maxHp, "picking a class applies its HP");

  blue.sendClass("wizard"); // not a real class
  await flush();
  assert(p1.cls === "tank", "an unknown class is ignored");

  // --- Class is locked during live play -------------------------------------
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "the match starts");
  blue.sendClass("scout");
  await flush();
  assert(p1.cls === "tank", "you can't switch class mid-fight");

  // --- Per-class attack damage ----------------------------------------------
  server.minions = [];
  server.nextWaveAt = Infinity;
  server.towers.clear();
  server.pickups = [];
  server.projectiles = [];
  p1.x = 400;
  p1.y = 300;
  p1.cd.basic = 0;
  p2.x = 500;
  p2.y = 300;
  p2.alive = true;
  server.tryAttack(p1, "basic");
  assert(
    server.projectiles.at(-1).dmg === CLASSES.tank.basic.dmg,
    "a tank's basic bolt deals its class damage"
  );

  // --- Respawn restores the class's full HP ---------------------------------
  server.damage(p1, 9999, "red");
  assert(!p1.alive, "tank is knocked out");
  server.timeMs = p1.deadUntil;
  server.step(1 / 30);
  assert(p1.alive && p1.hp === CLASSES.tank.maxHp, "respawn restores the class's full HP");

  // --- Snapshot carries class + maxHp ---------------------------------------
  server.broadcast();
  await flush();
  const me = blue.players.find((p) => p.id === "p1");
  assert(me.cls === "tank" && me.maxHp === CLASSES.tank.maxHp, "snapshot carries class and maxHp");

  // --- A reset keeps your chosen class --------------------------------------
  server.resetMatch();
  assert(server.players.get("p1").cls === "tank", "your class is preserved across a reset");
  assert(server.players.get("p1").hp === CLASSES.tank.maxHp, "...at the class's full HP");

  console.log("\nMILESTONE 22 CLASS TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
