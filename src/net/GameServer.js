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
  DASH,
  BASE,
  BASE_POS,
  MATCH,
  MINION,
  TOWER,
  TOWER_POS,
  PICKUP,
  PICKUP_SPOTS,
  CLASSES,
  DEFAULT_CLASS,
  KILLFEED,
} from "../config.js";
import { stepPosition, normalizeInput, resolveMove, pointInWall } from "../sim.js";

export default class GameServer {
  constructor() {
    this.players = new Map(); // id -> player state
    this.connections = new Map(); // id -> connection
    this.projectiles = [];
    this.minions = []; // AI lane fighters: { id, team, x, y, laneY, hp, alive, cd }
    this.nextId = 1;
    this.nextProjId = 1;
    this.nextMinionId = 1;
    // Sim-clock time (ms) the next wave spawns. Infinity = disarmed: waves only
    // start once a match actually begins (beginPlaying arms it), so they never
    // appear in the frozen lobby or in tests that drive the server directly.
    this.nextWaveAt = Infinity;
    this.tick = 0;
    this.timeMs = 0; // simulated clock (advanced by step) — deterministic for tests
    this.loopTimer = null;

    this.bases = new Map(); // team -> { team, x, y, hp, alive }
    this.towers = new Map(); // team -> { team, x, y, hp, alive, cd }
    this.pickups = []; // [{ id, kind, x, y, active, respawnAt }]
    this.resetBases();
    this.resetTowers();
    this.resetPickups();
    // Match lifecycle:
    //   "waiting"   — not enough players yet; the world is frozen in the lobby
    //   "countdown" — enough players; a short "get ready" timer is running
    //   "playing"   — the action is live
    //   "over"      — a base fell; the win banner shows, then we reset
    this.phase = "waiting";
    this.score = { blue: 0, red: 0 }; // hero kills this match, per team
    this.killFeed = []; // recent knockouts: { id, byTeam, victimTeam, victimCls, at }
    this.nextKillId = 1;
    this.winner = null; // team that won, when phase === "over"
    this.resetAt = 0; // when an "over" match resets (ms on our sim clock)
    this.startAt = 0; // when a "countdown" flips to "playing" (ms)
  }

  resetBases() {
    for (const team of ["blue", "red"]) {
      const pos = BASE_POS[team];
      this.bases.set(team, { team, x: pos.x, y: pos.y, hp: BASE.maxHp, alive: true });
    }
  }

  resetTowers() {
    for (const team of ["blue", "red"]) {
      const pos = TOWER_POS[team];
      this.towers.set(team, { team, x: pos.x, y: pos.y, hp: TOWER.maxHp, alive: true, cd: 0 });
    }
  }

  resetPickups() {
    this.pickups = PICKUP_SPOTS.map((s) => ({
      id: s.id,
      kind: s.kind,
      x: s.x,
      y: s.y,
      active: true, // available to grab
      respawnAt: 0, // when an inactive one comes back (ms on the sim clock)
    }));
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

    this.evaluateLobby(); // a new arrival may be enough to start the countdown
    this.broadcast();
    return id;
  }

  countTeam(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team) n++;
    return n;
  }

  // True once both teams have at least the configured minimum of players.
  enoughToStart() {
    return (
      this.countTeam("blue") >= MATCH.minPerTeam &&
      this.countTeam("red") >= MATCH.minPerTeam
    );
  }

  // Move between the two lobby states based on who's here. Called whenever the
  // roster changes (join/leave) and right after a finished match resets.
  evaluateLobby() {
    if (this.phase === "waiting" && this.enoughToStart()) {
      this.phase = "countdown";
      this.startAt = this.timeMs + MATCH.countdownMs;
    } else if (this.phase === "countdown" && !this.enoughToStart()) {
      this.phase = "waiting";
      this.startAt = 0;
    }
  }

  freshPlayer(id, team, spawnIndex, cls = DEFAULT_CLASS) {
    const list = SPAWNS[team];
    const spawn = list[spawnIndex % list.length];
    return {
      id,
      team,
      spawnIndex,
      cls, // hero class key (scout | soldier | tank)
      x: spawn.x,
      y: spawn.y,
      input: { dx: 0, dy: 0 },
      face: { x: team === "blue" ? 1 : -1, y: 0 },
      hp: CLASSES[cls].maxHp,
      alive: true,
      deadUntil: 0,
      cd: { basic: 0, ability: 0, dash: 0 },
      powerUntil: 0, // attack-damage buff active while timeMs < this
    };
  }

  removeConnection(id) {
    this.players.delete(id);
    this.connections.delete(id);
    this.projectiles = this.projectiles.filter((p) => p.ownerId !== id);
    this.evaluateLobby(); // dropping below the minimum cancels the countdown
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
    } else if (msg.t === "dash") {
      this.tryDash(p);
    } else if (msg.t === "class") {
      this.setClass(p, msg.cls);
    }
  }

  // Choose a hero class. Only allowed outside live play (in the lobby, the
  // countdown, or on the game-over screen), so you can't swap mid-fight. Picks
  // up the new class's full HP immediately.
  setClass(player, cls) {
    if (this.phase === "playing") return;
    if (!CLASSES[cls] || player.cls === cls) return;
    player.cls = cls;
    player.hp = CLASSES[cls].maxHp;
    this.broadcast();
  }

  tryDash(player) {
    if (this.phase !== "playing" || !player.alive) return;
    if (this.timeMs < player.cd.dash) return; // cooling down
    player.cd.dash = this.timeMs + DASH.cd;

    // Dash along the way we're facing (last movement direction). Walls stop
    // the dash just like normal movement does (shared resolveMove).
    const f = normalizeInput(player.face.x, player.face.y);
    const dest = resolveMove(
      player.x,
      player.y,
      player.x + f.dx * DASH.distance,
      player.y + f.dy * DASH.distance
    );
    player.x = dest.x;
    player.y = dest.y;
  }

  tryAttack(player, kind) {
    if (this.phase !== "playing" || !player.alive) return;
    const spec = CLASSES[player.cls][kind]; // per-class attack stats
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

    // A power pickup boosts this attack's damage while the buff is active.
    const powered = this.timeMs < player.powerUntil;
    const dmg = Math.round(spec.dmg * (powered ? PICKUP.powerMult : 1));

    this.projectiles.push({
      id: "b" + this.nextProjId++,
      ownerId: player.id,
      team: player.team,
      kind,
      x: player.x,
      y: player.y,
      vx: ax * spec.speed,
      vy: ay * spec.speed,
      dmg,
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
    for (const m of this.minions) {
      if (m.team !== player.team && m.alive) consider(m.x, m.y);
    }
    for (const tw of this.towers.values()) {
      if (tw.team !== player.team && tw.alive) consider(tw.x, tw.y);
    }
    for (const b of this.bases.values()) {
      if (b.team !== player.team && b.alive && this.baseVulnerable(b.team)) consider(b.x, b.y);
    }
    return best;
  }

  // --- Lane minions ----------------------------------------------------------

  // Called when the countdown flips to live play: clear any leftover minions
  // and arm the first wave.
  beginPlaying() {
    this.phase = "playing";
    this.minions = [];
    this.nextWaveAt = this.timeMs + MINION.firstWaveMs;
  }

  // Spawn one wave for each team, just in front of its base, staggered across
  // the open center lane so they march through the gap between the pillars.
  spawnWave() {
    const cy = GAME_HEIGHT / 2;
    for (const team of ["blue", "red"]) {
      const base = this.bases.get(team);
      if (!base || !base.alive) continue;
      const dir = team === "blue" ? 1 : -1; // blue pushes right, red pushes left
      const startX = base.x + dir * MINION.spawnAhead;
      for (let i = 0; i < MINION.perWave; i++) {
        const laneY = cy + (i - (MINION.perWave - 1) / 2) * MINION.laneGap;
        this.minions.push({
          id: "m" + this.nextMinionId++,
          team,
          x: startX,
          y: laneY,
          laneY,
          hp: MINION.maxHp,
          alive: true,
          cd: 0,
        });
      }
    }
  }

  stepMinions(dt) {
    if (this.timeMs >= this.nextWaveAt) {
      this.spawnWave();
      this.nextWaveAt = this.timeMs + MINION.waveEvery;
    }
    for (const m of this.minions) {
      if (!m.alive) continue;
      const target = this.minionTarget(m);
      if (!target) continue;
      const dist = Math.hypot(target.x - m.x, target.y - m.y);
      if (dist <= MINION.range) {
        // In reach: stand and trade blows on the minion's own cooldown.
        if (this.timeMs >= m.cd) {
          m.cd = this.timeMs + MINION.attackCd;
          this.hurtTarget(target);
        }
      } else {
        this.moveMinion(m, target.x, target.y, dt);
      }
    }
    // Sweep up the fallen.
    this.minions = this.minions.filter((m) => m.alive);
  }

  // Pick what a minion fights: the nearest enemy unit (minion or player) within
  // aggro range, otherwise march on the enemy base. Returns the point to head
  // for plus a `hurt` callback that applies damage to whatever it is.
  minionTarget(m) {
    let best = null;
    let bestD = MINION.aggro * MINION.aggro;
    const consider = (x, y, hurt) => {
      const d = (x - m.x) ** 2 + (y - m.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y, hurt };
      }
    };
    for (const o of this.minions) {
      if (o.team !== m.team && o.alive) consider(o.x, o.y, () => this.damageMinion(o, MINION.dmg));
    }
    for (const p of this.players.values()) {
      if (p.team !== m.team && p.alive) consider(p.x, p.y, () => this.damage(p, MINION.dmg, m.team));
    }
    for (const tw of this.towers.values()) {
      if (tw.team !== m.team && tw.alive) consider(tw.x, tw.y, () => this.damageTower(tw, MINION.dmg));
    }
    if (best) return best;
    const base = this.bases.get(m.team === "blue" ? "red" : "blue");
    if (base && base.alive) {
      return { x: base.x, y: base.y, hurt: () => this.damageBase(base, MINION.dmg) };
    }
    return null;
  }

  hurtTarget(target) {
    target.hurt();
  }

  // Step a minion toward (tx,ty), sliding along walls. If a wall blocks the
  // straight approach, funnel toward the open center lane to get around it.
  moveMinion(m, tx, ty, dt) {
    let dx = tx - m.x;
    let dy = ty - m.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const stepLen = MINION.speed * dt;
    let next = resolveMove(m.x, m.y, m.x + dx * stepLen, m.y + dy * stepLen);
    if (Math.hypot(next.x - m.x, next.y - m.y) < stepLen * 0.5) {
      const cy = GAME_HEIGHT / 2;
      const toward = Math.sign(cy - m.y) || 1;
      next = resolveMove(m.x, m.y, m.x + dx * stepLen, m.y + toward * stepLen);
    }
    m.x = next.x;
    m.y = next.y;
  }

  hitMinion(b) {
    const reach = COMBAT.hitPad + MINION.half;
    for (const m of this.minions) {
      if (m.team === b.team || !m.alive) continue;
      if ((m.x - b.x) ** 2 + (m.y - b.y) ** 2 <= reach * reach) return m;
    }
    return null;
  }

  damageMinion(m, amount) {
    m.hp = Math.max(0, m.hp - amount);
    if (m.hp === 0) m.alive = false;
  }

  // --- Defensive towers ------------------------------------------------------

  // Each living tower zaps the nearest enemy unit in range, on its cooldown.
  stepTowers() {
    for (const tw of this.towers.values()) {
      if (!tw.alive || this.timeMs < tw.cd) continue;
      const target = this.nearestEnemyUnit(tw, TOWER.range);
      if (!target) continue;
      tw.cd = this.timeMs + TOWER.cd;
      let ax = target.x - tw.x;
      let ay = target.y - tw.y;
      const len = Math.hypot(ax, ay) || 1;
      ax /= len;
      ay /= len;
      this.projectiles.push({
        id: "b" + this.nextProjId++,
        ownerId: "tower_" + tw.team,
        team: tw.team,
        kind: "tower",
        x: tw.x,
        y: tw.y,
        vx: ax * TOWER.speed,
        vy: ay * TOWER.speed,
        dmg: TOWER.dmg,
        dieAt: this.timeMs + TOWER.ttl,
      });
    }
  }

  // Nearest living enemy unit (minion or hero) to a source point, within range.
  // Towers only shoot units, never bases — so they can't snipe across the map.
  nearestEnemyUnit(src, range) {
    let best = null;
    let bestD = range * range;
    const consider = (x, y) => {
      const d = (x - src.x) ** 2 + (y - src.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x, y };
      }
    };
    for (const p of this.players.values()) {
      if (p.team !== src.team && p.alive) consider(p.x, p.y);
    }
    for (const mob of this.minions) {
      if (mob.team !== src.team && mob.alive) consider(mob.x, mob.y);
    }
    return best;
  }

  hitTower(b) {
    const reach = COMBAT.hitPad + TOWER.radius;
    for (const tw of this.towers.values()) {
      if (tw.team === b.team || !tw.alive) continue;
      if ((tw.x - b.x) ** 2 + (tw.y - b.y) ** 2 <= reach * reach) return tw;
    }
    return null;
  }

  damageTower(tw, amount) {
    tw.hp = Math.max(0, tw.hp - amount);
    if (tw.hp === 0) tw.alive = false; // destroying a tower doesn't end the match
  }

  step(dt) {
    this.tick++;
    this.timeMs += dt * 1000;

    // When a match is over, just count down to the rematch.
    if (this.phase === "over") {
      if (this.timeMs >= this.resetAt) this.resetMatch();
      return;
    }

    // In the lobby (waiting / counting down), the world is frozen.
    if (this.phase === "waiting") return;
    if (this.phase === "countdown") {
      if (this.timeMs >= this.startAt) this.beginPlaying();
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

    // 2) Spawn, march, and resolve the lane minions.
    this.stepMinions(dt);

    // 3) Let the towers zap any enemy in range.
    this.stepTowers();

    // 3b) Pick-ups: grant to anyone standing on them; respawn taken ones.
    this.stepPickups();

    // 4) Move projectiles; expire; check hits on players, minions, towers, bases.
    const survivors = [];
    for (const b of this.projectiles) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const offscreen = b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT;
      if (this.timeMs >= b.dieAt || offscreen) continue;
      if (pointInWall(b.x, b.y)) continue; // a wall swallows the bolt

      const victim = this.hitPlayer(b);
      if (victim) {
        this.damage(victim, b.dmg, b.team); // credit the firing team for a kill
        continue;
      }
      const mob = this.hitMinion(b);
      if (mob) {
        this.damageMinion(mob, b.dmg);
        continue;
      }
      const tower = this.hitTower(b);
      if (tower) {
        this.damageTower(tower, b.dmg);
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

  // `byTeam` (optional) is the team that dealt the blow, used to credit a kill
  // to the scoreboard when this knocks the player out.
  damage(player, amount, byTeam) {
    if (!player.alive) return;
    player.hp = Math.max(0, player.hp - amount);
    if (player.hp === 0) {
      player.alive = false;
      player.deadUntil = this.timeMs + COMBAT.respawnMs;
      if (byTeam && byTeam !== player.team && this.score[byTeam] !== undefined) {
        this.score[byTeam]++;
        this.killFeed.push({
          id: this.nextKillId++,
          byTeam,
          victimTeam: player.team,
          victimCls: player.cls,
          at: this.timeMs,
        });
        if (this.killFeed.length > 20) this.killFeed.shift(); // keep it bounded
      }
    }
  }

  // --- Map pickups -----------------------------------------------------------

  // Grant any active pickup to a living player standing on it (then send it on a
  // respawn timer), and bring back ones whose timer has elapsed.
  stepPickups() {
    const reach = PICKUP.radius + PLAYER_HALF;
    for (const pk of this.pickups) {
      if (!pk.active) {
        if (this.timeMs >= pk.respawnAt) pk.active = true;
        continue;
      }
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        if ((p.x - pk.x) ** 2 + (p.y - pk.y) ** 2 <= reach * reach) {
          this.grantPickup(p, pk);
          pk.active = false;
          pk.respawnAt = this.timeMs + PICKUP.respawnMs;
          break;
        }
      }
    }
  }

  grantPickup(player, pk) {
    if (pk.kind === "heal") {
      player.hp = Math.min(CLASSES[player.cls].maxHp, player.hp + PICKUP.heal);
    } else if (pk.kind === "power") {
      player.powerUntil = this.timeMs + PICKUP.powerMs;
    }
  }

  damageBase(base, amount) {
    if (!this.baseVulnerable(base.team)) return; // shielded while its tower stands
    base.hp = Math.max(0, base.hp - amount);
    if (base.hp === 0 && base.alive) {
      base.alive = false;
      this.phase = "over";
      this.winner = base.team === "blue" ? "red" : "blue"; // the attackers win
      this.resetAt = this.timeMs + MATCH.resetMs;
    }
  }

  // A base can only be harmed once its own team's guard tower is gone.
  baseVulnerable(team) {
    const tw = this.towers.get(team);
    return !tw || !tw.alive;
  }

  respawn(p) {
    const list = SPAWNS[p.team];
    const spawn = list[p.spawnIndex % list.length];
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = CLASSES[p.cls].maxHp;
    p.alive = true;
    p.input = { dx: 0, dy: 0 };
  }

  // Start a fresh round: bases and all players restored to their spawn slots.
  resetMatch() {
    this.resetBases();
    this.resetTowers();
    this.resetPickups();
    this.score = { blue: 0, red: 0 };
    this.killFeed = [];
    for (const p of this.players.values()) {
      const fresh = this.freshPlayer(p.id, p.team, p.spawnIndex, p.cls);
      Object.assign(p, fresh);
    }
    this.projectiles = [];
    this.minions = [];
    this.nextWaveAt = Infinity; // re-armed by beginPlaying on the next match
    this.winner = null;
    // Return to the lobby; if enough players are still here, evaluateLobby
    // immediately kicks off a fresh "get ready" countdown.
    this.phase = "waiting";
    this.startAt = 0;
    this.evaluateLobby();
  }

  snapshot() {
    return {
      t: "state",
      tick: this.tick,
      phase: this.phase,
      winner: this.winner,
      score: { blue: this.score.blue, red: this.score.red },
      // The most recent knockouts that are still within the fade window.
      killFeed: this.killFeed
        .filter((k) => this.timeMs - k.at <= KILLFEED.ms)
        .slice(-KILLFEED.max)
        .map((k) => ({ id: k.id, byTeam: k.byTeam, victimTeam: k.victimTeam, victimCls: k.victimCls })),
      // Lobby info so the client can show "Waiting… N/NEEDED" and the countdown.
      needed: MATCH.minPerTeam * 2,
      countdown:
        this.phase === "countdown"
          ? Math.max(0, Math.ceil((this.startAt - this.timeMs) / 1000))
          : 0,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        team: p.team,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: p.hp,
        alive: p.alive,
        cls: p.cls, // hero class (for per-class look)
        maxHp: CLASSES[p.cls].maxHp, // so the client scales the health bar
        // Seconds until this player respawns (0 if alive) — for the HUD timer.
        respawnIn: p.alive ? 0 : Math.max(0, Math.ceil((p.deadUntil - this.timeMs) / 1000)),
        powered: this.timeMs < p.powerUntil, // power buff active (for the aura)
      })),
      projectiles: this.projectiles.map((b) => ({
        id: b.id,
        team: b.team,
        kind: b.kind,
        x: Math.round(b.x),
        y: Math.round(b.y),
      })),
      minions: this.minions.map((m) => ({
        id: m.id,
        team: m.team,
        x: Math.round(m.x),
        y: Math.round(m.y),
        hp: m.hp,
        alive: m.alive,
      })),
      // Only the currently-available pickups (the client shows what's listed).
      pickups: this.pickups
        .filter((pk) => pk.active)
        .map((pk) => ({ id: pk.id, kind: pk.kind, x: pk.x, y: pk.y })),
      towers: [...this.towers.values()].map((tw) => ({
        team: tw.team,
        x: tw.x,
        y: tw.y,
        hp: tw.hp,
        maxHp: TOWER.maxHp,
        alive: tw.alive,
      })),
      bases: [...this.bases.values()].map((b) => ({
        team: b.team,
        x: b.x,
        y: b.y,
        hp: b.hp,
        maxHp: BASE.maxHp,
        alive: b.alive,
        shielded: !this.baseVulnerable(b.team), // protected while its tower lives
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
