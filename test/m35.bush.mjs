// Milestone 35 (bush stealth): a hero standing in a bush is hidden — untargetable
// by enemy bolts, hero/bot auto-aim, towers, minions, and camp bites — UNLESS it
// just attacked (a brief reveal) or an enemy shares a bush. The snapshot exposes
// a per-player `hidden` flag. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { BUSH, BUSH_ZONES, COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const bushCenter = (z) => ({ x: z.x + z.w / 2, y: z.y + z.h / 2 });

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect();
  connect();
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "match is live");
  server.minions = [];
  server.nextWaveAt = Infinity;
  server.towers = [];
  server.camps = [];

  const p1 = server.players.get("p1"); // blue
  const p2 = server.players.get("p2"); // red
  const b0 = bushCenter(BUSH_ZONES[0]);
  const b1 = bushCenter(BUSH_ZONES[1]);

  // --- A hero in a bush is hidden -------------------------------------------
  p1.x = b0.x; p1.y = b0.y;
  p1.revealUntil = 0;
  p2.x = 700; p2.y = 100; // red far away, not in any bush
  assert(server.isHidden(p1), "a hero alone in a bush is hidden");
  assert(!server.isHidden(p2), "a hero out in the open is not hidden");

  // Hidden -> not in the snapshot-visible sense + flag set.
  server.broadcast();
  await new Promise((r) => setTimeout(r, 10));
  const meSnap = blue.players.find((p) => p.id === "p1");
  assert(meSnap.hidden === true, "the snapshot marks a bushed hero hidden");

  // --- A hidden hero can't be hit by an enemy bolt --------------------------
  const fakeBolt = { team: "red", x: p1.x, y: p1.y };
  assert(server.hitPlayer(fakeBolt) === null, "an enemy bolt can't hit a hidden hero");
  // ...but a revealed/open hero can be.
  p2.x = p1.x + 5; p2.y = p1.y; // red also steps into the bush
  assert(!server.isHidden(p1), "an enemy in your bush reveals you");
  assert(server.hitPlayer(fakeBolt) === p1, "a revealed hero can be hit");
  p2.x = 700; p2.y = 100; // red leaves

  // --- Enemy auto-aim ignores a hidden hero ---------------------------------
  // p2 (red) near p1 (blue, hidden) but they don't aim at it.
  p2.x = b0.x + 30; p2.y = b0.y + 10; // close but red is now in p1's bush -> reveals!
  // Move red just OUTSIDE the bush but within aim range.
  p2.x = BUSH_ZONES[0].x - 20; p2.y = b0.y;
  assert(server.isHidden(p1), "p1 still hidden (red is outside the bush)");
  const tgt = server.nearestTarget(p2);
  // The only enemy unit is hidden p1; with no other targets, nearestTarget skips
  // it (may still pick the enemy base if in range — assert it's NOT p1's spot).
  assert(!tgt || tgt.x !== p1.x || tgt.y !== p1.y, "auto-aim skips a hidden enemy hero");

  // --- Attacking reveals you for a short window -----------------------------
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  assert(!server.isHidden(p1), "attacking reveals you (even in a bush)");
  assert(p1.revealUntil > server.timeMs, "the reveal has a timer");
  // After the reveal window, hidden again.
  server.timeMs = p1.revealUntil + 1;
  assert(server.isHidden(p1), "you go hidden again after the reveal window");

  // --- Camps don't bite a hidden hero ---------------------------------------
  // (handled in stepCamps; verify isHidden gates it by checking the camp loop's
  //  victim selection indirectly — a hidden hero on a camp takes no bite.)
  server.camps = [{ id: "c", x: p1.x, y: p1.y, hp: 120, alive: true, cd: 0, respawnAt: 0 }];
  p1.revealUntil = 0;
  p1.hp = 100;
  server.step(DT);
  assert(p1.hp === 100, "a camp can't bite a hidden hero");

  // --- A dead hero is never hidden ------------------------------------------
  p1.alive = false;
  assert(!server.isHidden(p1), "a dead hero is not hidden");

  console.log("\nMILESTONE 35 BUSH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
