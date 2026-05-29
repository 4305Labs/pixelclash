// ===========================================================================
// NetClient — the browser side of the connection. It sends our input to the
// server and remembers the latest world snapshot the server sent back, so the
// arena scene can draw every player. Transport-agnostic and Phaser-free, so we
// can test it in plain Node.
// ===========================================================================

export default class NetClient {
  constructor(conn) {
    this.conn = conn;
    this.localId = null; // our own player's id, set by the server's "welcome"
    this.team = null;
    this.players = []; // latest roster: [{ id, team, x, y, hp, alive }]
    this.projectiles = []; // bolts in flight: [{ id, team, kind, x, y }]
    this.tick = 0;
    this.connected = false;
    this._listeners = { welcome: [], state: [] };

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
      this.tick = msg.tick;
      this._emit("state", msg);
    }
  }

  // Convenience: our own player's current server position, or null.
  getLocalPlayer() {
    return this.players.find((p) => p.id === this.localId) || null;
  }
}
