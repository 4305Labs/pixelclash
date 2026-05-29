// ===========================================================================
// GameServer — the authoritative brain of a match. It owns the REAL positions
// of every player. Browsers send their input here; this decides what actually
// happens and broadcasts the result to everyone.
//
// It knows nothing about WebSockets or Phaser. It talks to "connections"
// (anything with .send / .onMessage / .onClose), so we can drive it with real
// network sockets in production OR with in-memory fakes in tests.
// ===========================================================================

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_SPEED,
  PLAYER_HALF,
  SPAWNS,
} from "../config.js";

export default class GameServer {
  constructor() {
    this.players = new Map(); // id -> { id, team, x, y, input:{dx,dy} }
    this.connections = new Map(); // id -> connection
    this.nextId = 1;
    this.tick = 0;
    this.loopTimer = null;
  }

  // A new browser connected. Give it an id + team + spawn, tell it, and
  // start listening for its input.
  addConnection(conn) {
    const id = "p" + this.nextId++;
    // Alternate teams: 1st, 3rd, ... = blue; 2nd, 4th, ... = red.
    const team = this.players.size % 2 === 0 ? "blue" : "red";
    const spawn = SPAWNS[team];

    this.players.set(id, { id, team, x: spawn.x, y: spawn.y, input: { dx: 0, dy: 0 } });
    this.connections.set(id, conn);

    conn.send({ t: "welcome", id, team });
    conn.onMessage((msg) => this.onMessage(id, msg));
    conn.onClose(() => this.removeConnection(id));

    // Send everyone the new roster immediately so the join feels instant.
    this.broadcast();
    return id;
  }

  removeConnection(id) {
    this.players.delete(id);
    this.connections.delete(id);
    this.broadcast();
  }

  onMessage(id, msg) {
    const p = this.players.get(id);
    if (!p || !msg) return;
    if (msg.t === "input") {
      // Clamp inputs into the -1..1 range so a client can't cheat speed.
      p.input.dx = clamp(Number(msg.dx) || 0, -1, 1);
      p.input.dy = clamp(Number(msg.dy) || 0, -1, 1);
    }
  }

  // Advance the simulation by dt seconds. Pure math — easy to test.
  step(dt) {
    this.tick++;
    for (const p of this.players.values()) {
      let { dx, dy } = p.input;
      // Normalize so diagonal isn't faster than straight.
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      p.x = clamp(p.x + dx * PLAYER_SPEED * dt, PLAYER_HALF, GAME_WIDTH - PLAYER_HALF);
      p.y = clamp(p.y + dy * PLAYER_SPEED * dt, PLAYER_HALF, GAME_HEIGHT - PLAYER_HALF);
    }
  }

  // A snapshot of the whole world, sent to every client.
  snapshot() {
    return {
      t: "state",
      tick: this.tick,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        team: p.team,
        x: Math.round(p.x),
        y: Math.round(p.y),
      })),
    };
  }

  broadcast() {
    const snap = this.snapshot();
    for (const conn of this.connections.values()) conn.send(snap);
  }

  // Start the real-time loop (used by the live server; tests call step() by hand).
  start(tickHz) {
    const dt = 1 / tickHz;
    this.loopTimer = setInterval(() => {
      this.step(dt);
      this.broadcast();
    }, 1000 / tickHz);
  }

  stop() {
    if (this.loopTimer) clearInterval(this.loopTimer);
    this.loopTimer = null;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
