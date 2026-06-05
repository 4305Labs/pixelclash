// Milestone 29 (integration smoke test): boot a real bots-enabled server and
// run a FULL match through the actual step loop — every system live at once
// (movement, minions, towers, pickups, projectiles, progression, bots, the
// match timer, kill feed). This catches cross-system regressions the isolated
// unit tests miss. We assert the simulation never crashes and that core
// invariants hold on every tick, then that a match actually reaches "over".
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  MATCH,
  PROGRESS,
  PICKUP_SPOTS,
} from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;

// One human joins a bots-enabled server (a bot fills the other team), then we
// drive the real loop. The human just sits still — the bots do the fighting.
const server = new GameServer({ bots: true });
const pair = createLocalPair();
server.addConnection(pair.server);
const client = new NetClient(pair.client);
client.join();

// Validate every invariant we care about on a single snapshot/tick.
function checkInvariants(where) {
  for (const p of server.players.values()) {
    assert(Number.isFinite(p.x) && Number.isFinite(p.y), `${where}: player pos is finite`);
    assert(
      p.x >= 0 && p.x <= GAME_WIDTH && p.y >= 0 && p.y <= GAME_HEIGHT,
      `${where}: player stays in the arena`
    );
    assert(p.hp >= 0 && p.hp <= server.effectiveMaxHp(p) + 0.001, `${where}: hp within [0,max]`);
    assert(p.gold >= 0 && p.xp >= 0, `${where}: gold/xp never go negative`);
    assert(p.buys <= PROGRESS.shopMaxStacks, `${where}: buys never exceed the cap`);
    assert(server.levelOf(p) <= PROGRESS.maxLevel, `${where}: level never exceeds the cap`);
  }
  for (const m of server.minions) {
    assert(Number.isFinite(m.x) && Number.isFinite(m.y), `${where}: minion pos is finite`);
    assert(m.hp >= 0, `${where}: minion hp non-negative`);
  }
  // Pickups are never double-counted: an active orb has no pending respawn.
  for (const pk of server.pickups) {
    if (pk.active) assert(pk.respawnAt <= server.timeMs, `${where}: active orb isn't mid-respawn`);
  }
  const snap = server.snapshot();
  assert(snap.players.length === server.players.size, `${where}: snapshot covers all players`);
  // The snapshot only lists active pickups.
  assert(
    snap.pickups.length <= PICKUP_SPOTS.length,
    `${where}: snapshot pickups within bounds`
  );
}

try {
  // Reach live play through the real lobby -> countdown -> playing path.
  assert(server.phase === "countdown", "a lone human + bot starts the countdown");
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "the match goes live");

  // Run a big chunk of real ticks: ~40s of game time. Bots fight, minions wave,
  // towers fire, pickups cycle, gold/xp accrue — all together.
  const ticks = Math.ceil(40 / DT);
  let sawMinion = false;
  let sawProjectile = false;
  let sawBotProgress = false;
  for (let i = 0; i < ticks; i++) {
    server.step(DT);
    checkInvariants(`tick ${i}`);
    if (server.minions.length) sawMinion = true;
    if (server.projectiles.length) sawProjectile = true;
    if ([...server.players.values()].some((p) => p.bot && (p.gold > 0 || p.xp > 0))) {
      sawBotProgress = true;
    }
    if (server.phase === "over") break; // a base fell early — fine, that's a real end
  }

  assert(sawMinion, "minion waves spawned during the match");
  assert(sawProjectile, "projectiles flew during the match (bots/towers fired)");
  assert(sawBotProgress, "bots accrued gold/xp from the live economy");

  // Either a base fell, or the clock should be close to expiring; push to the
  // time limit and confirm the match resolves cleanly with a valid winner.
  if (server.phase === "playing") {
    server.timeMs = server.matchEndsAt;
    server.step(DT);
  }
  assert(server.phase === "over", "the match reaches a conclusion");
  assert(
    server.winner === "blue" || server.winner === "red" || server.winner === "draw",
    "the match has a valid result"
  );

  // The client received a coherent final snapshot over the (in-memory) socket.
  // (The real loop broadcasts after every step; here we drive step() directly,
  // so push one snapshot explicitly.)
  server.broadcast();
  await new Promise((r) => setTimeout(r, 10));
  assert(client.phase === "over", "the client sees the match end");
  assert(client.players.length === server.players.size, "client roster matches the server");

  // The world resets cleanly and can start again.
  server.timeMs = server.resetAt;
  server.step(DT);
  checkInvariants("after reset");
  assert(
    server.phase === "countdown" || server.phase === "playing" || server.phase === "waiting",
    "the match returns to a sane lifecycle state after a win"
  );

  console.log("\nMILESTONE 29 INTEGRATION SMOKE TEST PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
