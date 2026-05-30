// Milestone 31 (healing fountain): a living hero standing within healRadius of
// its OWN base regens HP up to its (leveled) max; it never heals past max, never
// heals a dead hero, and never heals an ENEMY hero parked at your base. Pure
// Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { BASE, COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const stepN = (s, n) => {
  for (let i = 0; i < n; i++) s.step(DT);
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
  connect();
  connect();
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  // Quiet the lane so nothing else perturbs HP.
  server.minions = [];
  server.nextWaveAt = Infinity;
  server.towers.clear();
  server.pickups = [];

  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  const blueBase = server.bases.get("blue");

  // --- Standing on your own base regens HP ----------------------------------
  p1.x = blueBase.x;
  p1.y = blueBase.y;
  p1.hp = 40;
  const before = p1.hp;
  stepN(server, 30); // ~1s
  assert(p1.hp > before, "a hero on its own base regenerates HP");
  assert(Math.abs(p1.hp - (before + BASE.healPerSec)) < 2, "regen is about healPerSec per second");

  // --- It never overheals past max ------------------------------------------
  p1.hp = COMBAT.maxHp - 2;
  stepN(server, 30);
  assert(p1.hp === server.effectiveMaxHp(p1), "regen is capped at max HP");

  // --- Out of range: no regen -----------------------------------------------
  p1.hp = 50;
  p1.x = blueBase.x + BASE.healRadius + 40; // clear of the fountain
  p1.y = blueBase.y;
  stepN(server, 30);
  assert(p1.hp === 50, "a hero away from its base does not regen");

  // --- A dead hero doesn't regen --------------------------------------------
  p1.x = blueBase.x;
  p1.y = blueBase.y;
  p1.hp = 0;
  p1.alive = false;
  p1.deadUntil = server.timeMs + 999999; // keep it down for the check
  stepN(server, 30);
  assert(p1.hp === 0 && !p1.alive, "a knocked-out hero doesn't regen on the fountain");

  // --- An ENEMY at your base is not healed by your fountain ------------------
  p2.x = blueBase.x; // red hero sitting on the BLUE base
  p2.y = blueBase.y;
  p2.hp = 30;
  stepN(server, 30);
  assert(p2.hp === 30, "an enemy hero is not healed by your fountain");

  console.log("\nMILESTONE 31 FOUNTAIN TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
