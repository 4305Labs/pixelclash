// Phase B — match lifecycle on the authoritative server: a server starts in
// the lobby ("waiting"), begins a "countdown" once both teams have a player,
// falls back to "waiting" if a team empties, and flips to "playing" when the
// countdown elapses. The snapshot carries the lobby info the client needs.
// Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import { MATCH } from "../src/config.js";
import { assert } from "./helpers.mjs";

// A throwaway connection that just records what the server sends it.
function stubConn() {
  return {
    sent: [],
    send(m) {
      this.sent.push(m);
    },
    onMessage() {},
    onClose() {},
    close() {},
  };
}

const server = new GameServer();
function join() {
  return server.addConnection(stubConn());
}

try {
  assert(server.phase === "waiting", "a new server starts in the lobby (waiting)");

  join(); // p1 -> blue
  assert(server.phase === "waiting", "one team alone keeps the match waiting");

  const red = join(); // p2 -> red
  assert(server.phase === "countdown", "both teams present -> the countdown begins");

  const snap = server.snapshot();
  assert(snap.needed === MATCH.minPerTeam * 2, "snapshot reports how many players are needed");
  assert(snap.countdown >= 1, "snapshot reports a countdown in whole seconds");

  // If a whole team empties during the countdown, fall back to waiting.
  server.removeConnection(red);
  assert(server.phase === "waiting", "losing a whole team cancels the countdown");
  assert(server.snapshot().countdown === 0, "no countdown reported while waiting");

  // Refilling resumes the countdown; letting it elapse starts the match.
  join(); // p3 -> red again
  assert(server.phase === "countdown", "refilling the team resumes the countdown");

  // Jump the sim clock to the start line and step once to cross it.
  server.timeMs = server.startAt;
  server.step(1 / 30);
  assert(server.phase === "playing", "the match begins once the countdown elapses");
  assert(server.snapshot().countdown === 0, "no countdown reported once playing");

  console.log("\nMILESTONE 12 LOBBY TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
