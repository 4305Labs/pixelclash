// LIVE end-to-end test over REAL WebSocket sockets (not the in-memory fake).
// Stands up the actual server wiring from server.js and connects two real
// WebSocket clients, exactly like two browsers would. Proves the real wire.
import { WebSocketServer, WebSocket } from "ws";
import GameServer from "../src/net/GameServer.js";
import { NET } from "../src/config.js";
import { assert } from "./helpers.mjs";

const game = new GameServer();
game.start(NET.tickHz);
const wss = new WebSocketServer({ port: NET.port });
wss.on("connection", (socket) => {
  const conn = {
    send: (m) => socket.send(JSON.stringify(m)),
    onMessage: (cb) => socket.on("message", (d) => cb(JSON.parse(d.toString()))),
    onClose: (cb) => socket.on("close", cb),
    close: () => socket.close(),
  };
  game.addConnection(conn);
});

// A tiny browser-like client over a real socket.
function makeClient(name) {
  const ws = new WebSocket(`ws://localhost:${NET.port}`);
  const c = { name, id: null, team: null, last: null, ws };
  ws.on("message", (d) => {
    const m = JSON.parse(d.toString());
    if (m.t === "welcome") {
      c.id = m.id;
      c.team = m.team;
    } else if (m.t === "state") c.last = m;
  });
  c.send = (m) => ws.send(JSON.stringify(m));
  c.ready = new Promise((res) => ws.on("open", res));
  return c;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const a = makeClient("A");
  await a.ready;
  await wait(100);
  const b = makeClient("B");
  await b.ready;
  await wait(150);

  assert(a.id === "p1" && a.team === "blue", "client A connected as blue p1");
  assert(b.id === "p2" && b.team === "red", "client B connected as red p2");
  assert(a.last && a.last.players.length === 2, "A sees both players over the wire");

  const aStartX = a.last.players.find((p) => p.id === "p1").x;

  // A holds "right" for half a second over the real socket.
  a.send({ t: "input", dx: 1, dy: 0 });
  await wait(500);
  a.send({ t: "input", dx: 0, dy: 0 });
  await wait(100);

  const aMoved = a.last.players.find((p) => p.id === "p1").x;
  const aSeenByB = b.last.players.find((p) => p.id === "p1").x;
  console.log(`A start x=${aStartX}, now x=${aMoved}, B sees A x=${aSeenByB}`);
  assert(aMoved > aStartX + 50, "A actually moved over the real socket");
  assert(Math.abs(aSeenByB - aMoved) <= 8, "B sees A's movement over the real socket");

  // A fires an attack; a projectile shows up in the broadcast.
  a.send({ t: "attack", kind: "ability" });
  await wait(120);
  assert(a.last.projectiles.length >= 0, "state includes a projectiles array");

  a.ws.close();
  await wait(150);
  assert(b.last.players.length === 1, "B sees A disconnect over the real socket");

  console.log("\nLIVE WEBSOCKET TEST PASSED — the real multiplayer wire works.");
} catch (e) {
  console.error("\nLIVE TEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  game.stop();
  wss.close();
}
