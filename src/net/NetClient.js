// ===========================================================================
// NetClient — the browser side of the connection. It sends our input to the
// server and remembers the latest world snapshot the server sent back, so the
// arena scene can draw every player. Transport-agnostic and Phaser-free, so we
// can test it in plain Node.
// ===========================================================================

import { DEFAULT_CLASS } from "../config.js";

export default class NetClient {
  constructor(conn) {
    this.conn = conn;
    this.localId = null; // our own player's id, set by the server's "welcome"
    this.team = null;
    this.cls = DEFAULT_CLASS; // our chosen hero class (for the lobby UI)
    this.players = []; // latest roster: [{ id, team, x, y, hp, alive }]
    this.projectiles = []; // bolts in flight: [{ id, team, kind, x, y }]
    this.minions = []; // lane minions: [{ id, team, x, y, hp, alive }]
    this.pickups = []; // available map pickups: [{ id, kind, x, y }]
    this.towers = []; // guard towers: [{ team, x, y, hp, maxHp, alive }]
    this.bases = []; // [{ team, x, y, hp, maxHp, alive }]
    this.phase = "playing"; // "waiting" | "countdown" | "playing" | "over"
    this.score = { blue: 0, red: 0 }; // hero kills this match, per team
    this.killFeed = []; // recent knockouts for the corner feed
    this.winner = null; // winning team when phase === "over"
    this.needed = 0; // players needed for a match to start (for the lobby text)
    this.countdown = 0; // seconds left on the "get ready" countdown, else 0
    this.tick = 0;
    this.connected = false;
    this._listeners = { welcome: [], state: [], full: [] };

    conn.onMessage((msg) => this._receive(msg));
    conn.onClose(() => {
      this.connected = false;
    });
  }

  // Announce ourselves to the server.
  join() {
    this.connected = true;
    this.conn.send({ t: "join" });
  }

  // Send our movement intent (each component -1..1).
  sendInput(dx, dy) {
    this.conn.send({ t: "input", dx, dy });
  }

  // Ask the server to fire an attack. kind is "basic" or "ability".
  sendAttack(kind) {
    this.conn.send({ t: "attack", kind });
  }

  // Ask the server to dash along our facing direction.
  sendDash() {
    this.conn.send({ t: "dash" });
  }

  // Pick a hero class (only takes effect outside live play, server-enforced).
  sendClass(cls) {
    this.cls = cls;
    this.conn.send({ t: "class", cls });
  }

  on(event, cb) {
    if (this._listeners[event]) this._listeners[event].push(cb);
  }
  _emit(event, payload) {
    (this._listeners[event] || []).forEach((cb) => cb(payload));
  }

  // Handle a message from the server. Also callable directly by tests.
  _receive(msg) {
    if (!msg) return;
    if (msg.t === "welcome") {
      this.localId = msg.id;
      this.team = msg.team;
      this._emit("welcome", msg);
    } else if (msg.t === "state") {
      this.players = msg.players;
      this.projectiles = msg.projectiles || [];
      this.minions = msg.minions || [];
      this.pickups = msg.pickups || [];
      this.towers = msg.towers || [];
      this.bases = msg.bases || [];
      this.phase = msg.phase || "playing";
      this.score = msg.score || { blue: 0, red: 0 };
      this.killFeed = msg.killFeed || [];
      this.winner = msg.winner || null;
      this.needed = msg.needed || 0;
      this.countdown = msg.countdown || 0;
      this.tick = msg.tick;
      this._emit("state", msg);
    } else if (msg.t === "full") {
      this.full = true;
      this._emit("full", msg);
    }
  }

  // Convenience: our own player's current server position, or null.
  getLocalPlayer() {
    return this.players.find((p) => p.id === this.localId) || null;
  }
}
