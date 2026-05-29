// ===========================================================================
// GameServer — the authoritative brain of a match. It owns the REAL state:
// player positions, health, and projectiles. Browsers send input + attack
// requests; this decides what actually happens and broadcasts the result.
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
  COMBAT,
} from "../config.js";

export default class GameServer {
  constructor() {
    this.players = new Map(); // id -> player state
    this.connections = new Map(); // id -> connection
    this.projectiles = []; // active bolts in flight
    this.nextId = 1;
    this.nextProjId = 1;
    this.tick = 0;
    this.timeMs = 0; // simulated clock (advanced by step) — keeps tests deterministic
    this.loopTimer = null;
  }

  addConnection(conn) {
    const id = "p" + this.nextId++;
    const team = this.players.size % 2 === 0 ? "blue" : "red";
    const spawn = SPAWNS[team];

    this.players.set(id, {
      id,
      team,
      x: spawn.x,
      y: spawn.y,
      input: { dx: 0, dy: 0 },
      face: { x: team === "blue" ? 1 : -1, y: 0 }, // last move direction (aim fallback)
      hp: COMBAT.maxHp,
      alive: true,
      deadUntil: 0,
      cd: { basic: 0, ability: 0 }, // timestamps when each attack is ready again
    });
    this.connections.set(id, conn);

    conn.send({ t: "welcome", id, team });
    conn.onMessage((msg) => this.onMessage(id, msg));
    conn.onClose(() => this.removeConnection(id));

    this.broadcast();
    return id;
  }

  removeConnection(id) {
    this.players.delete(id);
    this.connections.delete(id);
    this.projectiles = this.projectiles.filter((p) => p.ownerId !== id);
    this.broadcast();
  }

  onMessage(id, msg) {
    const p = this.players.get(id);
    if (!p || !msg) return;

    if (msg.t === "input") {
      p.input.dx = clamp(Number(msg.dx) || 0, -1, 1);
      p.input.dy = clamp(Number(msg.dy) || 0, -1, 1);
    } else if (msg.t === "attack") {
      this.tryAttack(p, msg.kind === "ability" ? "ability" : "basic");
    }
  }

  tryAttack(player, kind) {
    if (!player.alive) return;
    const spec = COMBAT[kind];
    if (this.timeMs < player.cd[kind]) return; // still cooling down
    player.cd[kind] = this.timeMs + spec.cd;

    // Aim at the nearest living enemy; if none, fire the way we're facing.
    const target = this.nearestEnemy(player);
    let ax, ay;
    if (target) {
      ax = target.x - player.x;
      ay = target.y - player.y;
    } else {
      ax = player.face.x;
      ay = player.face.y;
    }
    const len = Math.hypot(ax, ay) || 1;
    ax /= len;
    ay /= len;

    this.projectiles.push({
      id: "b" + this.nextProjId++,
      ownerId: player.id,
      team: player.team,
      kind,
      x: player.x,
      y: player.y,
      vx: ax * spec.speed,
      vy: ay * spec.speed,
      dmg: spec.dmg,
      dieAt: this.timeMs + spec.ttl,
    });
  }

  nearestEnemy(player) {
    let best = null;
    let bestD = Infinity;
    for (const o of this.players.values()) {
      if (o.team === player.team || !o.alive) continue;
      const d = (o.x - player.x) ** 2 + (o.y - player.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  step(dt) {
    this.tick++;
    this.timeMs += dt * 1000;

    // 1) Move players from their input; remember facing for aim fallback.
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.timeMs >= p.deadUntil) this.respawn(p);
        continue;
      }
      let { dx, dy } = p.input;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      if (len > 0.01) p.face = { x: dx / (len || 1), y: dy / (len || 1) };
      p.x = clamp(p.x + dx * PLAYER_SPEED * dt, PLAYER_HALF, GAME_WIDTH - PLAYER_HALF);
      p.y = clamp(p.y + dy * PLAYER_SPEED * dt, PLAYER_HALF, GAME_HEIGHT - PLAYER_HALF);
    }

    // 2) Move projectiles, expire old ones, and check for hits.
    const survivors = [];
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const offscreen = b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT;
      if (this.timeMs >= b.dieAt || offscreen) continue;

      const victim = this.hitPlayer(b);
      if (victim) {
        this.damage(victim, b.dmg);
        continue; // bolt is consumed on hit
      }
      survivors.push(b);
    }
    this.projectiles = survivors;
  }

  // Find an enemy player this projectile is currently touching.
  hitPlayer(b) {
    const reach = COMBAT.hitPad + PLAYER_HALF;
    for (const p of this.players.values()) {
      if (p.team === b.team || !p.alive) continue;
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= reach * reach) return p;
    }
    return null;
  }

  damage(player, amount) {
    player.hp = Math.max(0, player.hp - amount);
    if (player.hp === 0) {
      player.alive = false;
      player.deadUntil = this.timeMs + COMBAT.respawnMs;
    }
  }

  respawn(p) {
    const spawn = SPAWNS[p.team];
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = COMBAT.maxHp;
    p.alive = true;
    p.input = { dx: 0, dy: 0 };
  }

  snapshot() {
    return {
      t: "state",
      tick: this.tick,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        team: p.team,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: p.hp,
        alive: p.alive,
      })),
      projectiles: this.projectiles.map((b) => ({
        id: b.id,
        team: b.team,
        kind: b.kind,
        x: Math.round(b.x),
        y: Math.round(b.y),
      })),
    };
  }

  broadcast() {
    const snap = this.snapshot();
    for (const conn of this.connections.values()) conn.send(snap);
  }

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
