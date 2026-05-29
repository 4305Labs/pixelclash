// Milestone 4 (server logic): two clients connect through the in-memory
// transport; one moves; the server replicates the new position to BOTH
// clients. Pure Node — no sockets, no browser. Verifies the netcode end to end
// minus the literal WebSocket wire (which you verify by running it on your Mac).
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));

const server = new GameServer();

function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const client = new NetClient(pair.client);
  client.join();
  return client;
}

let ok = true;
try {
  const alice = connect(); // 1st -> blue, spawns left (x=120)
  const bob = connect(); // 2nd -> red, spawns right (x=680)
  await flush();

  assert(alice.localId === "p1", "alice got id p1");
  assert(bob.localId === "p2", "bob got id p2");
  assert(alice.team === "blue", "alice is blue");
  assert(bob.team === "red", "bob is red");
  assert(alice.players.length === 2, "alice sees both players");
  assert(bob.players.length === 2, "bob sees both players");

  const aliceStartX = alice.getLocalPlayer().x;

  // Alice holds "right". Advance the server ~0.5s, then broadcast.
  alice.sendInput(1, 0);
  await flush();
  for (let i = 0; i < 15; i++) server.step(1 / 30);
  server.broadcast();
  await flush();

  const aliceNowX = alice.getLocalPlayer().x;
  assert(aliceNowX > aliceStartX + 50, "alice moved right on her own screen");

  // Crucially, BOB sees alice's new position too (replication works).
  const aliceSeenByBob = bob.players.find((p) => p.id === "p1");
  assert(aliceSeenByBob.x === aliceNowX, "bob sees alice at the same position");

  // Bob disconnects; alice's roster drops to 1.
  bob.conn.close();
  await flush();
  assert(alice.players.length === 1, "alice sees bob leave");

  console.log("\nMILESTONE 4 SERVER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  ok = false;
  process.exitCode = 1;
} finally {
  server.stop();
}
if (ok) process.exitCode = process.exitCode || 0;
