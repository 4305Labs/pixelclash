// Phase C — a real map: solid walls block movement, the dash, and projectiles.
// The movement/dash math lives in sim.js (shared by server + client); the
// projectile absorption lives on the authoritative server. Pure Node.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { stepPosition, resolveMove, pointInWall } from "../src/sim.js";
import { WALLS, PLAYER_HALF, COMBAT, DASH } from "../src/config.js";
import { assert } from "./helpers.mjs";

// Use the first central pillar as our test wall.
const pillar = WALLS[0]; // { x:392, y:80, w:16, h:150 }
const midY = pillar.y + pillar.h / 2; // a y that's level with the pillar

const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(1 / 30);
};
const flush = () => new Promise((r) => setTimeout(r, 10));

try {
  // 1) Walking right into the pillar stops at its left face (over many steps).
  let x = 300;
  for (let i = 0; i < 60; i++) x = stepPosition(x, midY, 1, 0, 1 / 30).x;
  assert(
    Math.abs(x - (pillar.x - PLAYER_HALF)) < 0.001,
    "walking into a wall stops at its near face"
  );

  // 2) A move that runs parallel to a wall isn't blocked (sliding works).
  const above = pillar.y - PLAYER_HALF - 5; // just clear of the pillar's top
  const slid = stepPosition(380, above, 1, 0, 1 / 30);
  assert(slid.x > 380, "moving alongside a wall (not into it) is unobstructed");

  // 3) A dash that would cross the pillar stops at its face instead.
  const dest = resolveMove(300, midY, 300 + DASH.distance, midY);
  assert(
    Math.abs(dest.x - (pillar.x - PLAYER_HALF)) < 0.001,
    "a dash is stopped by a wall"
  );

  // 4) pointInWall correctly reports inside vs. outside.
  assert(pointInWall(pillar.x + 1, midY), "a point inside a wall is detected");
  assert(!pointInWall(10, 10), "a point in open space is not in a wall");

  // 5) A projectile flying into a wall is absorbed (server-authoritative).
  const server = new GameServer();
  const pair = createLocalPair();
  server.addConnection(pair.server);
  new NetClient(pair.client).join();
  server.phase = "playing";
  server.projectiles.push({
    id: "b1",
    ownerId: "p1",
    team: "blue",
    kind: "basic",
    x: 300,
    y: midY,
    vx: COMBAT.basic.speed, // flying right toward the pillar at x=392
    vy: 0,
    dmg: COMBAT.basic.dmg,
    dieAt: server.timeMs + 9999,
  });
  stepN(server, 12); // ~92px to cover at ~14px/step
  assert(server.projectiles.length === 0, "a bolt is consumed by a wall");
  server.stop();

  console.log("\nMILESTONE 13 WALL TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
