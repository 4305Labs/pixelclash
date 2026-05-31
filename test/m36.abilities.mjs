// Milestone 36 (per-hero abilities): each class's B ability is behaviourally
// distinct, not just a bigger bolt. Verified on the authoritative server, plus
// the snapshot/contract bits the client needs (shielded flag, blast markers).
// Pure Node, no sockets.
import GameServer from "../src/net/GameServer.js";
import NetClient from "../src/net/NetClient.js";
import { createLocalPair } from "../src/net/LocalConnection.js";
import { CLASSES, MINION } from "../src/config.js";
import { assert } from "./helpers.mjs";

const flush = () => new Promise((r) => setTimeout(r, 10));
const stepN = (srv, n) => {
  for (let i = 0; i < n; i++) srv.step(1 / 30);
};

const server = new GameServer();
function connect() {
  const pair = createLocalPair();
  server.addConnection(pair.server);
  const client = new NetClient(pair.client);
  client.join();
  return client;
}

// A throwaway enemy (red) minion at (x,y), full HP, for hit/AoE checks.
let mid = 1;
function enemyMinion(x, y) {
  const m = { id: "m" + mid++, team: "red", x, y, hp: MINION.maxHp, alive: true, cd: 0 };
  server.minions.push(m);
  return m;
}

// Switch p's class (only allowed outside live play) then return to playing, and
// clear its cooldown + the in-flight projectiles/blasts so each case is clean.
function arm(p, cls) {
  server.phase = "waiting";
  server.setClass(p, cls);
  server.phase = "playing";
  p.cd.ability = 0;
  p.alive = true;
  server.projectiles = [];
  server.blasts = [];
  server.minions = [];
}

try {
  const alice = connect(); // blue p1, spawns left
  connect(); // bob: red p2, spawns right
  await flush();

  const A = server.players.get("p1");
  const B = server.players.get("p2");

  server.phase = "playing";
  server.towers = [];
  server.camps = [];
  A.x = 120; A.y = 300; A.face = { x: 1, y: 0 };
  B.x = 680; B.y = 300;

  // --- Scout — Scatter: three pellets from one press --------------------------
  arm(A, "scout");
  server.tryAbility(A);
  assert(
    server.projectiles.length === CLASSES.scout.ability.pellets,
    "scout Scatter fires a 3-pellet spread"
  );
  // The pellets fan out: not all share the same velocity vector.
  const vys = new Set(server.projectiles.map((b) => Math.round(b.vy)));
  assert(vys.size > 1, "scatter pellets fan out at different angles");

  // --- Soldier — Pierce: one bolt hits a whole line ---------------------------
  arm(A, "soldier");
  const lineA = enemyMinion(280, 300);
  const lineB = enemyMinion(360, 300);
  server.tryAbility(A);
  assert(server.projectiles.length === 1, "pierce is a single bolt");
  stepN(server, 30); // fly across both minions
  assert(
    lineA.hp < MINION.maxHp && lineB.hp < MINION.maxHp,
    "one pierce bolt damages BOTH minions in its line"
  );

  // --- Tank — Bulwark: halves incoming damage ---------------------------------
  arm(A, "tank");
  server.tryAbility(A);
  assert(server.timeMs < A.shieldUntil, "Bulwark sets a shield window");
  const before = A.hp;
  server.damage(A, 20, "red");
  assert(A.hp === before - 10, "Bulwark halves a 20 hit to 10");

  // --- Ranger — Seeker: a homing arrow curves onto a moved target -------------
  arm(A, "ranger");
  B.x = 400; B.y = 300; B.hp = B.maxHp = 100; B.alive = true; B.cls = "soldier";
  server.tryAbility(A); // locks + aims at B's current (straight-ahead) spot
  B.y = 230; // now step B off the straight line — only homing can still connect
  const bHp0 = B.hp;
  stepN(server, 50);
  assert(B.hp < bHp0, "Seeker homes onto the displaced target and hits it");

  // --- Mage — Nova: detonates and hits everything nearby ----------------------
  arm(A, "mage");
  B.x = 9999; // park the human enemy far away so the bolt aims at the minions
  const novaA = enemyMinion(400, 300);
  const novaB = enemyMinion(400, 336); // close enough to share the blast radius
  server.tryAbility(A);
  let sawNovaBlast = false;
  for (let i = 0; i < 40; i++) {
    server.step(1 / 30);
    if (server.blasts.length) sawNovaBlast = true; // marker is short-lived
  }
  assert(
    !novaA.alive && !novaB.alive,
    "Nova's blast kills both clustered minions"
  );
  assert(sawNovaBlast, "Nova records a shockwave marker");

  // --- Brawler — Leap Slam: lunges forward and smashes ------------------------
  arm(A, "brawler");
  A.x = 120; A.y = 300; A.face = { x: 1, y: 0 };
  const slamTarget = enemyMinion(260, 300);
  server.tryAbility(A);
  assert(A.x > 240, "Leap carries the brawler forward");
  assert(slamTarget.hp < MINION.maxHp, "the slam damages a nearby enemy");
  assert(server.blasts.length >= 1, "Slam records a shockwave marker");

  // --- Contract: client reads shielded + blasts -------------------------------
  arm(A, "tank");
  server.tryAbility(A); // shield up
  server.areaDamage(A.x, A.y, 40, 0, A); // emit a blast marker (no friendly dmg)
  server.broadcast();
  await flush();
  const aliceSeesA = alice.players.find((p) => p.id === "p1");
  assert(aliceSeesA.shielded === true, "client snapshot exposes the shield flag");
  assert(alice.blasts.length >= 1, "client snapshot exposes blast markers");

  console.log("\nMILESTONE 36 ABILITY TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  server.stop();
}
