// 3v3 foundation: teams auto-balance, each player gets a distinct spawn slot,
// and a 7th player (both teams full) is rejected with a "full" message.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { TEAM_SIZE, SPAWNS } from "../src/config.js";
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

try {
  assert(TEAM_SIZE === 3, "configured for 3v3");

  // Fill both teams (6 players for 3v3).
  const clients = [];
  for (let i = 0; i < TEAM_SIZE * 2; i++) clients.push(connect());
  await flush();

  const blue = [...server.players.values()].filter((p) => p.team === "blue");
  const red = [...server.players.values()].filter((p) => p.team === "red");
  assert(blue.length === TEAM_SIZE, "blue team filled to TEAM_SIZE");
  assert(red.length === TEAM_SIZE, "red team filled to TEAM_SIZE");

  // Each teammate occupies a distinct spawn slot and a distinct position.
  const blueSlots = new Set(blue.map((p) => p.spawnIndex));
  assert(blueSlots.size === TEAM_SIZE, "blue teammates use distinct spawn slots");
  const bluePts = new Set(blue.map((p) => `${p.x},${p.y}`));
  assert(bluePts.size === TEAM_SIZE, "blue teammates don't stack on one point");
  // Positions actually match the configured spawn list.
  for (const p of blue) {
    const s = SPAWNS.blue[p.spawnIndex];
    assert(p.x === s.x && p.y === s.y, `blue slot ${p.spawnIndex} at its spawn`);
  }

  // The teams are balanced as people join (never off by more than 1).
  assert(Math.abs(blue.length - red.length) <= 1, "teams stay balanced");

  // A 7th player can't join — both teams are full.
  const overflow = connect();
  await flush();
  assert(overflow.full === true, "7th player is told the match is full");
  assert(overflow.localId === null, "rejected player got no id");
  assert(server.players.size === TEAM_SIZE * 2, "server still has exactly 6 players");

  // When someone leaves, their slot frees up and the next joiner takes it.
  blue[1].x; // (no-op reference)
  const leaving = clients[2]; // some blue player
  const leavingTeam = server.players.get(leaving.localId).team;
  const leavingSlot = server.players.get(leaving.localId).spawnIndex;
  leaving.conn.close();
  await flush();
  const rejoin = connect();
  await flush();
  const rejoined = server.players.get(rejoin.localId);
  assert(rejoined.team === leavingTeam, "rejoiner fills the team that has room");
  assert(rejoined.spawnIndex === leavingSlot, "rejoiner reuses the freed spawn slot");

  console.log("\nMILESTONE 8 TEAM TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
