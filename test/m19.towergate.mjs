// Milestone 19 (tower-gating): a base is shielded — immune to damage and
// ignored by auto-aim — until its own guard tower is destroyed. Once the tower
// falls, the base is exposed and can be razed to win. The snapshot exposes a
// `shielded` flag per base. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
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

try {
  const blue = connect(); // p1 blue
  connect(); // p2 red
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  server.minions = [];
  server.nextWaveAt = Infinity;

  const redBase = server.bases.get("red");
  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  p2.x = 120;
  p2.y = 450; // red hero out of the way

  // --- Shielded while the tower stands --------------------------------------
  assert(server.baseVulnerable("red") === false, "base is shielded while its tower stands");
  const hp0 = redBase.hp;
  server.damageBase(redBase, 50);
  assert(redBase.hp === hp0, "a shielded base ignores damage");

  // Auto-aim should skip the shielded base. With the blue hero between the red
  // tower (x=550) and red base (x=756), a shot must head LEFT to the tower, not
  // right to the base.
  p1.x = 700;
  p1.y = 300;
  p1.cd.basic = 0;
  server.projectiles = [];
  server.tryAttack(p1, "basic");
  const shot = server.projectiles.at(-1);
  assert(shot && shot.vx < 0, "auto-aim ignores the shielded base and picks the tower");

  // --- Tower down -> base exposed -------------------------------------------
  server.towers.get("red").alive = false;
  assert(server.baseVulnerable("red") === true, "base is exposed once its tower is gone");

  server.projectiles = [];
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  const shot2 = server.projectiles.at(-1);
  assert(shot2 && shot2.vx > 0, "auto-aim now locks the exposed base (to the right)");

  const hp1 = redBase.hp;
  server.damageBase(redBase, 40);
  assert(redBase.hp === hp1 - 40, "an exposed base now takes damage");

  // --- The snapshot reports the shield state --------------------------------
  server.resetMatch(); // restores towers -> shielded again
  server.broadcast();
  await flush();
  assert(
    blue.bases.find((b) => b.team === "red").shielded === true,
    "snapshot marks a base shielded while its tower stands"
  );
  server.towers.get("red").alive = false;
  server.broadcast();
  await flush();
  assert(
    blue.bases.find((b) => b.team === "red").shielded === false,
    "snapshot marks a base unshielded once its tower falls"
  );

  // --- Razing an exposed base wins the match --------------------------------
  server.phase = "playing";
  server.towers.get("blue").alive = false;
  server.damageBase(server.bases.get("blue"), 999);
  assert(
    server.phase === "over" && server.winner === "red",
    "razing an exposed base wins the match for the attackers"
  );

  console.log("\nMILESTONE 19 TOWER-GATE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
