// Milestone 17 (lane minions): waves spawn from each base and march toward the
// enemy base, fight enemy units in their way, chip the enemy base on arrival,
// can be killed by player bolts (and are valid auto-aim targets), and are
// cleared on reset / never spawn outside live play. Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { MINION, BASE, COMBAT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(DT);
};

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const c = new NetClient(pair.client);
  c.join();
  return c;
}

try {
  const blue = connect(); // p1
  connect(); // p2 (red)

  // Get to live play.
  assert(server.phase === "countdown", "both teams present -> countdown");
  server.timeMs = server.startAt;
  server.step(DT);
  assert(server.phase === "playing", "countdown elapses -> playing");
  assert(server.minions.length === 0, "no minions at the opening whistle");

  // --- Waves spawn after the first-wave delay -------------------------------
  // Just before the wave, nothing; once the timer is due, a full wave per team.
  stepN(server, 5);
  assert(server.minions.length === 0, "no minions before the first wave is due");
  server.timeMs = server.nextWaveAt;
  server.step(DT);
  assert(server.minions.length === MINION.perWave * 2, "first wave: perWave minions per team");
  assert(
    server.minions.filter((m) => m.team === "blue").length === MINION.perWave &&
      server.minions.filter((m) => m.team === "red").length === MINION.perWave,
    "the wave is split evenly between the teams"
  );
  // They appear just in front of their base, on the side facing the enemy.
  // (They also take their first step on the spawn tick, so allow a little slack.)
  assert(
    server.minions.every((m) => {
      const b = server.bases.get(m.team);
      const ahead = m.team === "blue" ? m.x - b.x : b.x - m.x;
      return ahead > 0 && ahead <= MINION.spawnAhead + 5;
    }),
    "minions appear just in front of their own base"
  );

  // --- They march toward the enemy base -------------------------------------
  server.nextWaveAt = Infinity; // suppress further waves for the marching check
  const blueX0 = server.minions.find((m) => m.team === "blue").x;
  const redX0 = server.minions.find((m) => m.team === "red").x;
  stepN(server, 20);
  const blueX1 = server.minions.find((m) => m.team === "blue").x;
  const redX1 = server.minions.find((m) => m.team === "red").x;
  assert(blueX1 > blueX0, "blue minions advance to the right (toward red's base)");
  assert(redX1 < redX0, "red minions advance to the left (toward blue's base)");

  // --- Enemy minions fight when they meet -----------------------------------
  server.minions = [];
  server.minions.push({ id: "mb", team: "blue", x: 400, y: 300, laneY: 300, hp: MINION.maxHp, alive: true, cd: 0 });
  server.minions.push({ id: "mr", team: "red", x: 420, y: 300, laneY: 300, hp: MINION.maxHp, alive: true, cd: 0 });
  server.step(DT);
  assert(
    server.minions.find((m) => m.id === "mb").hp === MINION.maxHp - MINION.dmg &&
      server.minions.find((m) => m.id === "mr").hp === MINION.maxHp - MINION.dmg,
    "adjacent enemy minions trade blows"
  );

  // --- A minion at the enemy base chips it ----------------------------------
  // Move the heroes well clear so the minion's only target is the base.
  for (const p of server.players.values()) {
    p.x = 400;
    p.y = 60;
  }
  const redBase = server.bases.get("red");
  server.minions = [
    { id: "siege", team: "blue", x: redBase.x, y: redBase.y, laneY: redBase.y, hp: MINION.maxHp, alive: true, cd: 0 },
  ];
  const baseHp0 = redBase.hp;
  server.step(DT);
  assert(redBase.hp === baseHp0 - MINION.dmg, "a minion at the enemy base damages it");
  assert(server.phase === "playing", "one chip doesn't end the match");

  // --- Player bolts kill minions (and minions are auto-aim targets) ---------
  server.minions = [
    { id: "tgt", team: "red", x: 440, y: 300, laneY: 300, hp: MINION.maxHp, alive: true, cd: 0 },
  ];
  const p1 = server.players.get("p1"); // blue
  p1.x = 400;
  p1.y = 300;
  p1.cd.basic = 0;
  server.tryAttack(p1, "basic");
  assert(server.projectiles.length === 1, "blue fires — auto-aim locks the nearby red minion");
  assert(server.projectiles[0].vx > 0, "the bolt heads toward the minion (to the right)");
  stepN(server, 4);
  assert(
    server.minions.find((m) => m.id === "tgt").hp < MINION.maxHp,
    "the bolt damages the red minion"
  );

  // --- No minions outside live play -----------------------------------------
  server.phase = "waiting";
  server.minions = [];
  server.nextWaveAt = 0; // would be "due", but waiting freezes the world
  server.step(DT);
  assert(server.minions.length === 0, "no minions spawn while waiting in the lobby");

  // --- Reset clears the lane ------------------------------------------------
  server.phase = "playing";
  server.minions.push({ id: "x", team: "blue", x: 200, y: 300, laneY: 300, hp: 10, alive: true, cd: 0 });
  server.resetMatch();
  assert(server.minions.length === 0, "resetMatch clears all minions");

  // --- The snapshot carries minions to the client ---------------------------
  server.minions = [
    { id: "snap", team: "blue", x: 222, y: 311, laneY: 300, hp: 17, alive: true, cd: 0 },
  ];
  server.broadcast();
  await new Promise((r) => setTimeout(r, 10));
  assert(blue.minions.length === 1 && blue.minions[0].id === "snap", "client receives minions");
  assert(blue.minions[0].x === 222 && blue.minions[0].hp === 17, "minion fields round-trip");

  console.log("\nMILESTONE 17 MINION TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
