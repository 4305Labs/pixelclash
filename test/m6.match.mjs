// Milestone 6 (bases & win/lose): bolts damage the enemy base, destroying it
// ends the match with the right winner, play freezes during game over, and the
// match auto-resets afterward. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { COMBAT, BASE, MATCH, SPAWNS } from "../src/config.js";
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
  const alice = connect(); // blue
  connect(); // bob: red
  await flush();

  const A = server.players.get("p1");
  const redBase = server.bases.get("red");
  const blueBase = server.bases.get("blue");
  assert(redBase.hp === BASE.maxHp && redBase.alive, "red base starts full & alive");

  // With one player per team present, the lobby starts a countdown; once it
  // elapses the match is "playing". (The lobby itself is tested in m12.)
  assert(server.phase === "countdown", "both teams present -> match counts down");
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "countdown elapses -> playing");

  // The base is shielded until its guard tower falls — drop the red tower first.
  server.towers.get("red").alive = false;

  // Walk Alice up next to the red base so her auto-aim picks the base, and fire.
  A.x = redBase.x - 12;
  A.y = redBase.y;
  alice.sendAttack("basic");
  await flush();
  assert(server.projectiles.length === 1, "a bolt was fired toward the base");
  server.step(1 / 30);
  assert(redBase.hp === BASE.maxHp - COMBAT.basic.dmg, "bolt damages the enemy base");

  // Finish the base off; the attacking team (blue) should win.
  server.damageBase(redBase, 999);
  assert(redBase.hp === 0 && !redBase.alive, "red base is destroyed");
  assert(server.phase === "over", "match enters game-over phase");
  assert(server.winner === "blue", "blue (the attackers) win");

  // During game over, players don't move and can't attack.
  const frozenX = A.x;
  alice.sendInput(1, 0);
  alice.sendAttack("ability");
  await flush();
  server.step(1 / 30);
  assert(A.x === frozenX, "players are frozen during game over");
  assert(server.projectiles.length === 0, "no attacks register during game over");

  // After the reset delay, the match resets. With both players still present it
  // returns to the lobby and immediately starts a fresh countdown. (resetMatch
  // rebuilds the base objects, so re-fetch them rather than reusing old refs.)
  stepN(server, Math.ceil(MATCH.resetMs / (1000 / 30)) + 2);
  assert(server.phase === "countdown", "after a win the match resets into a fresh countdown");
  assert(server.winner === null, "winner cleared on reset");
  const redBase2 = server.bases.get("red");
  assert(redBase2.hp === BASE.maxHp && redBase2.alive, "red base restored to full");
  assert(
    A.hp === COMBAT.maxHp && A.x === SPAWNS.blue[0].x,
    "players reset to spawn at full HP"
  );

  // Let the fresh countdown elapse to confirm the loop returns to playing.
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "the rematch begins after its countdown");

  // The other direction: drop the blue tower, then destroying the blue base
  // makes red win.
  server.towers.get("blue").alive = false;
  server.damageBase(server.bases.get("blue"), 999);
  assert(server.winner === "red", "destroying the blue base makes red win");

  // The client also learns the result via the snapshot.
  server.broadcast();
  await flush();
  assert(alice.phase === "over" && alice.winner === "red", "client receives the result");
  assert(alice.bases.length === 2, "client receives both bases");

  console.log("\nMILESTONE 6 MATCH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
