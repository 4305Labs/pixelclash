// Milestone 24 (match timer): a live match has a time limit; the snapshot
// reports the seconds left; when time runs out the team ahead on kills wins,
// ties break on base HP, and a true tie is a draw. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { MATCH } from "../src/config.js";
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

// Force the match back into a fresh "playing" state with a short clock so we can
// drive each timeout case independently.
const armPlaying = () => {
  server.phase = "playing";
  server.matchEndsAt = server.timeMs + 1000;
};

try {
  const blue = connect();
  connect();
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "match is live");

  // --- The clock is reported -------------------------------------------------
  server.broadcast();
  await flush();
  assert(
    blue.timeLeft === Math.ceil(MATCH.maxDurationMs / 1000),
    "the snapshot reports the seconds left on the match clock"
  );

  // --- Out of time, ahead on kills -> that team wins -------------------------
  server.score = { blue: 3, red: 1 };
  server.timeMs = server.matchEndsAt;
  server.step(1 / 30);
  assert(server.phase === "over" && server.winner === "blue", "the team ahead on kills wins on time");

  // No clock once the match is over.
  server.broadcast();
  await flush();
  assert(blue.timeLeft === 0, "the clock reads 0 once the match is over");

  // --- Tie on kills -> higher base HP wins -----------------------------------
  armPlaying();
  server.score = { blue: 2, red: 2 };
  server.bases.get("blue").hp = 200;
  server.bases.get("red").hp = 100;
  server.timeMs = server.matchEndsAt;
  server.step(1 / 30);
  assert(server.winner === "blue", "a kill tie is broken by the healthier base");

  // --- Tie on kills and base HP -> draw --------------------------------------
  armPlaying();
  server.score = { blue: 2, red: 2 };
  server.bases.get("blue").hp = 150;
  server.bases.get("red").hp = 150;
  server.timeMs = server.matchEndsAt;
  server.step(1 / 30);
  assert(server.phase === "over" && server.winner === "draw", "a true tie is a draw");

  // --- The time limit re-arms on a fresh match -------------------------------
  server.resetMatch();
  assert(!isFinite(server.matchEndsAt), "the clock disarms on reset (re-armed at next kickoff)");

  console.log("\nMILESTONE 24 TIMER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
