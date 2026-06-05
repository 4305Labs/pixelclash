// Milestone 23 (kill feed): an attributed knockout adds a feed entry (with the
// killing team, victim team, and victim class); self/unattributed kills don't;
// entries fade out of the snapshot after the window; the feed is capped; and it
// clears on reset. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { KILLFEED } from "../src/config.js";
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

const revive = (p) => {
  p.alive = true;
  p.hp = 100;
};

try {
  const blue = connect(); // p1
  connect(); // p2
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "match is live");

  const p2 = server.players.get("p2"); // red

  // --- An attributed kill adds a feed entry ---------------------------------
  server.damage(p2, 999, "blue");
  assert(server.killFeed.length === 1, "a kill adds a feed entry");
  const e = server.killFeed[0];
  assert(
    e.byTeam === "blue" && e.victimTeam === "red" && e.victimCls === p2.cls,
    "the entry records killer team, victim team, and victim class"
  );

  // --- Self / unattributed kills don't feed ---------------------------------
  revive(p2);
  server.damage(p2, 999, "red"); // same team as victim
  revive(p2);
  server.damage(p2, 999); // no attacker
  assert(server.killFeed.length === 1, "self/unattributed kills add nothing to the feed");

  // --- The snapshot carries the recent feed ---------------------------------
  server.broadcast();
  await flush();
  assert(blue.killFeed.length === 1 && blue.killFeed[0].byTeam === "blue", "client receives the feed");

  // --- Entries fade after the window ----------------------------------------
  server.timeMs = e.at + KILLFEED.ms + 1;
  server.broadcast();
  await flush();
  assert(blue.killFeed.length === 0, "old entries fade out of the snapshot");

  // --- The feed is capped ----------------------------------------------------
  for (let i = 0; i < KILLFEED.max + 3; i++) {
    revive(p2);
    server.damage(p2, 999, "blue");
  }
  server.broadcast();
  await flush();
  assert(blue.killFeed.length === KILLFEED.max, "the feed snapshot is capped at the max");

  // --- Reset clears the feed -------------------------------------------------
  server.resetMatch();
  assert(server.killFeed.length === 0, "resetMatch clears the kill feed");

  console.log("\nMILESTONE 23 KILL-FEED TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
