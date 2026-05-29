// ===========================================================================
// GameServer — the authoritative brain of a match. Owns the REAL state:
// player positions, health, projectiles, and the two team bases. Destroying
// the enemy base wins the match.
//
// It knows nothing about WebSockets or Phaser. It talks to "connections"
// (anything with .send / .onMessage / .onClose), so the same logic runs behind
// real sockets in production and in-memory fakes in tests.
// ===========================================================================

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PLAYER_HALF,
  SPAWNS,
  TEAM_SIZE,
  COMBAT,
  BASE,
  BASE_POS,
  MATCH,
} from "../config.js";
import { stepPosition, normalizeInput } from "../sim.js";

export default class GameServer {
  constructor() {
    this.players = new Map(); // id -> player state
    this.connections = new Map(); // id -> connection
    this.projectiles = [];
    this.nextId = 1;
    this.nextProjId = 1;
    this.tick = 0;
    this.timeMs = 0; // simulated clock (advanced by step) — deterministic for tests
    this.loopTimer = null;

    this.bases = new Map(); // team -> { team, x, y, hp, alive }
    this.resetBases();
    this.phase = "playing"; // "playing" | "over"
    this.winner = null; // team that won, when phase === "over"
    this.resetAt = 0;
  }

  resetBases() {
    for (const team of ["blue", "red"]) {
      const pos = BASE_POS[team];
      this.bases.set(team, { team, x: pos.x, y: pos.y, hp: BASE.maxHp, alive: true });
    }
  }

  addConnection(conn) {
    // Pick the team with fewer players (ties go to blue) for balanced sides.
    const team = this.countTeam("blue") <= this.countTeam("red") ? "blue" : "red";

    // If that team is already full, both teams are full — reject politely.
    if (this.countTeam(team) >= TEAM_SIZE) {
      conn.send({ t: "full" });
      conn.close();
      return null;
    }

    const id = "p" + this.nextId++;
    // Give this player the first free spawn slot on their team.
    const used = new Set(
      [...this.players.values()].filter((p) => p.team === team).map((p) => p.spawnIndex)
    );
    let spawnIndex = 0;
    while (used.has(spawnIndex)) spawnIndex++;

    this.players.set(id, this.freshPlayer(id, team, spawnIndex));
    this.connections.set(id, conn);

    conn.send({ t: "welcome", id, team });
    conn.onMessage((msg) => this.onMessage(id, msg));
    conn.onClose(() => this.removeConnection(id));

    this.broadcast();
    return id;
  }

  countTeam(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team) n++;
    return n;
  }

  freshPlayer(id, team, spawnIndex) {
    const list = SPAWNS[team];
    const spawn = list[spawnIndex % list.length];
    return {
      id,
      team,
      spawnIndex,
      x: spawn.x,
      y: spawn.y,
      input: { dx: 0, dy: 0 },
      face: { x: team === "blue" ? 1 : -1, y: 0 },
      hp: COMBAT.maxHp,
      alive: true,
      deadUntil: 0,
      cd: { basic: 0, ability: 0 },
    };
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
    if (this.phase !== "playing" || !player.alive) return;
    const spec = COMBAT[kind];
    if (this.timeMs < player.cd[kind]) return; // cooling down
    player.cd[kind] = this.timeMs + spec.cd;

    // Aim at the nearest enemy target (a living enemy player OR the enemy base).
    const target = this.nearestTarget(player) || {
      x: player.x + player.face.x,
      y: player.y + player.face.y,
    };
    let ax = target.x - player.x;
    let ay = target.y - player.y;
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

  // Closest enemy thing to aim at: any living enemy player, or the enemy base.
  nearestTarget(player) {
    let best = null;
    let bestD = Infinity;
    const consider = (x, y) => {
      const d = (x - player.x) ** 2 + (y - player.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    };
    for (const o of this.players.values()) {
      if (o.team !== player.team && o.alive) consider(o.x, o.y);
    }
    for (const b of this.bases.values()) {
      if (b.team !== player.team && b.alive) consider(b.x, b.y);
    }
    return best;
  }

  step(dt) {
    this.tick++;
    this.timeMs += dt * 1000;

    // When a match is over, just count down to the rematch.
    if (this.phase === "over") {
      if (this.timeMs >= this.resetAt) this.resetMatch();
      return;
    }

    // 1) Move players; remember facing for the aim fallback.
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.timeMs >= p.deadUntil) this.respawn(p);
        continue;
      }
      const { dx, dy } = p.input;
      // Remember facing (for aim fallback) when there's real input.
      if (Math.hypot(dx, dy) > 0.01) p.face = normalizeInput(dx, dy);
      const next = stepPosition(p.x, p.y, dx, dy, dt);
      p.x = next.x;
      p.y = next.y;
    }

    // 2) Move projectiles; expire; check hits on players, then bases.
    const survivors = [];
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const offscreen = b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT;
      if (this.timeMs >= b.dieAt || offscreen) continue;

      const victim = this.hitPlayer(b);
      if (victim) {
        this.damage(victim, b.dmg);
        continue;
      }
      const base = this.hitBase(b);
      if (base) {
        this.damageBase(base, b.dmg);
        continue;
      }
      survivors.push(b);
    }
    this.projectiles = survivors;
  }

  hitPlayer(b) {
    const reach = COMBAT.hitPad + PLAYER_HALF;
    for (const p of this.players.values()) {
      if (p.team === b.team || !p.alive) continue;
      if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= reach * reach) return p;
    }
    return null;
  }

  hitBase(b) {
    const reach = COMBAT.hitPad + BASE.radius;
    for (const base of this.bases.values()) {
      if (base.team === b.team || !base.alive) continue;
      if ((base.x - b.x) ** 2 + (base.y - b.y) ** 2 <= reach * reach) return base;
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

  damageBase(base, amount) {
    base.hp = Math.max(0, base.hp - amount);
    if (base.hp === 0 && base.alive) {
      base.alive = false;
      this.phase = "over";
      this.winner = base.team === "blue" ? "red" : "blue"; // the attackers win
      this.resetAt = this.timeMs + MATCH.resetMs;
    }
  }

  respawn(p) {
    const list = SPAWNS[p.team];
    const spawn = list[p.spawnIndex % list.length];
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = COMBAT.maxHp;
    p.alive = true;
    p.input = { dx: 0, dy: 0 };
  }

  // Start a fresh round: bases and all players restored to their spawn slots.
  resetMatch() {
    this.resetBases();
    for (const p of this.players.values()) {
      const fresh = this.freshPlayer(p.id, p.team, p.spawnIndex);
      Object.assign(p, fresh);
    }
    this.projectiles = [];
    this.phase = "playing";
    this.winner = null;
  }

  snapshot() {
    return {
      t: "state",
      tick: this.tick,
      phase: this.phase,
      winner: this.winner,
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
      bases: [...this.bases.values()].map((b) => ({
        team: b.team,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: BASE.maxHp,
        alive: b.alive,
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
