// Dash ability: a player dashes a fixed distance along their facing direction,
// respecting cooldown, arena bounds, death, and the game-over freeze. Plus the
// client can request a dash. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { DASH, PLAYER_HALF, GAME_WIDTH } from "../src/config.js";
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
  const alice = connect(); // blue, faces right by default ({x:1,y:0})
  await flush();
  const A = server.players.get("p1");
  A.x = 300;
  A.y = 300;
  A.face = { x: 1, y: 0 };

  // Dash right: x jumps by DASH.distance, y unchanged.
  alice.sendDash();
  await flush();
  assert(Math.abs(A.x - (300 + DASH.distance)) < 0.001, "dash moves a fixed distance");
  assert(A.y === 300, "dash follows facing (no sideways drift)");

  // Cooldown: an immediate second dash does nothing.
  const afterFirst = A.x;
  alice.sendDash();
  await flush();
  assert(A.x === afterFirst, "dash is blocked while on cooldown");

  // After the cooldown elapses, dash works again.
  server.timeMs += DASH.cd + 1;
  A.face = { x: -1, y: 0 };
  alice.sendDash();
  await flush();
  assert(Math.abs(A.x - (afterFirst - DASH.distance)) < 0.001, "dash works after cooldown");

  // Dash clamps to the arena edge instead of leaving the field.
  server.timeMs += DASH.cd + 1;
  A.x = GAME_WIDTH - 20;
  A.face = { x: 1, y: 0 };
  alice.sendDash();
  await flush();
  assert(A.x === GAME_WIDTH - PLAYER_HALF, "dash clamps at the wall");

  // Dead players can't dash.
  server.timeMs += DASH.cd + 1;
  A.alive = false;
  const deadX = A.x;
  alice.sendDash();
  await flush();
  assert(A.x === deadX, "dead players can't dash");
  A.alive = true;

  // No dashing during game over.
  server.timeMs += DASH.cd + 1;
  server.phase = "over";
  const frozenX = A.x;
  alice.sendDash();
  await flush();
  assert(A.x === frozenX, "no dashing during game over");

  console.log("\nMILESTONE 9 DASH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
