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
  TOWER_X,
  LANES,
  LANE_ENTRY_X,
  PICKUP,
  PICKUP_SPOTS,
  CAMP,
  CAMP_SPOTS,
  BUSH,
  BUSH_ZONES,
  CLASSES,
  DEFAULT_CLASS,
  KILLFEED,
  PROGRESS,
} from "../config.js";
import { stepPosition, normalizeInput, resolveMove, pointInWall } from "../sim.js";

const BOT_STANDOFF = 200; // how far a bot holds from its target to shoot

export default class GameServer {
  // `opts.bots` enables AI bots that fill empty team slots so a lone player can
  // play (off by default, so tests and a pure 2-human server are unaffected).
  constructor(opts = {}) {
    this.botsEnabled = !!opts.bots;
    this.players = new Map(); // id -> player state (humans AND bots)
    this.connections = new Map(); // id -> connection (humans only)
    this.projectiles = [];
    this.minions = []; // AI lane fighters: { id, team, x, y, laneY, hp, alive, cd }
    // Short-lived AoE markers (mage Nova / brawler Slam) so the client can draw
    // an expanding ring where the blow landed: { id, x, y, r, team, dieAt }.
    this.blasts = [];
    this.nextId = 1;
    this.nextProjId = 1;
    this.nextBlastId = 1;
    this.nextMinionId = 1;
    // Sim-clock time (ms) the next wave spawns. Infinity = disarmed: waves only
    // start once a match actually begins (beginPlaying arms it), so they never
    // appear in the frozen lobby or in tests that drive the server directly.
    this.nextWaveAt = Infinity;
    this.tick = 0;
    this.timeMs = 0; // simulated clock (advanced by step) — deterministic for tests
    this.loopTimer = null;

    this.bases = new Map(); // team -> { team, x, y, hp, alive }
    this.towers = []; // [{ team, lane, x, y, hp, alive, cd }] — one per team per lane
    this.pickups = []; // [{ id, kind, x, y, active, respawnAt }]
    this.camps = []; // neutral jungle monsters: [{ id, x, y, hp, alive, cd, respawnAt }]
    this.resetBases();
    this.resetTowers();
    this.resetPickups();
    this.resetCamps();
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
    this.matchEndsAt = Infinity; // hard time limit; armed by beginPlaying
  }

  resetBases() {
    for (const team of ["blue", "red"]) {
      const pos = BASE_POS[team];
      this.bases.set(team, { team, x: pos.x, y: pos.y, hp: BASE.maxHp, alive: true });
    }
  }

  resetTowers() {
    this.towers = [];
    for (const team of ["blue", "red"]) {
      for (const ln of LANES) {
        this.towers.push({
          team,
          lane: ln.id,
          x: TOWER_X[team],
          y: ln.row,
          hp: TOWER.maxHp,
          alive: true,
          cd: 0,
        });
      }
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

  resetCamps() {
    this.camps = CAMP_SPOTS.map((s) => ({
      id: s.id,
      x: s.x,
      y: s.y,
      hp: CAMP.maxHp,
      alive: true,
      cd: 0, // next time it can bite (ms)
      respawnAt: 0, // when a cleared camp comes back (ms)
    }));
  }

  addConnection(conn) {
    // Balance humans across teams (ties go to blue).
    const team = this.countHumans("blue") <= this.countHumans("red") ? "blue" : "red";

    // Reject only when this team is full of *humans* (bots don't take seats).
    if (this.countHumans(team) >= TEAM_SIZE) {
      conn.send({ t: "full" });
      conn.close();
      return null;
    }

    // A human takes a bot's place if one is holding the line on this team.
    this.removeOneBot(team);

    const id = "p" + this.nextId++;
    this.players.set(id, this.freshPlayer(id, team, this.freeSpawnIndex(team)));
    this.connections.set(id, conn);

    conn.send({ t: "welcome", id, team });
    conn.onMessage((msg) => this.onMessage(id, msg));
    conn.onClose(() => this.removeConnection(id));

    this.fillBots(); // top the other team up with a bot so the match can start
    this.evaluateLobby(); // a new arrival may be enough to start the countdown
    this.broadcast();
    return id;
  }

  countTeam(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team) n++;
    return n;
  }

  countHumans(team) {
    let n = 0;
    for (const p of this.players.values()) if (p.team === team && !p.bot) n++;
    return n;
  }

  // The first free spawn-slot index on a team (so teammates don't stack).
  freeSpawnIndex(team) {
    const used = new Set(
      [...this.players.values()].filter((p) => p.team === team).map((p) => p.spawnIndex)
    );
    let i = 0;
    while (used.has(i)) i++;
    return i;
  }

  // --- AI bots ---------------------------------------------------------------

  // Keep each team filled to the minimum with bots while at least one human is
  // present; with no humans, clear the bots so an idle server is empty.
  fillBots() {
    if (!this.botsEnabled) return;
    const anyHuman = [...this.players.values()].some((p) => !p.bot);
    if (!anyHuman) {
      for (const p of [...this.players.values()]) if (p.bot) this.removeBot(p.id);
      return;
    }
    for (const team of ["blue", "red"]) {
      while (this.countTeam(team) < MATCH.minPerTeam) this.addBot(team);
    }
  }

  addBot(team) {
    const id = "bot" + this.nextId++;
    const p = this.freshPlayer(id, team, this.freeSpawnIndex(team));
    p.bot = true;
    this.players.set(id, p);
  }

  removeBot(id) {
    this.players.delete(id);
    this.projectiles = this.projectiles.filter((b) => b.ownerId !== id);
  }

  removeOneBot(team) {
    const bot = [...this.players.values()].find((p) => p.bot && p.team === team);
    if (bot) this.removeBot(bot.id);
  }

  // Bot brain: head for the nearest enemy (hero, minion, tower, or an exposed
  // base — the same picker the auto-aim uses) and hold at firing range; but when
  // low on HP, retreat toward home while still kiting shots back. Attacks
  // auto-aim the nearest enemy regardless of which way we're moving, and the odd
  // dash closes the gap (or covers the escape).
  stepBots() {
    for (const p of this.players.values()) {
      if (!p.bot || !p.alive) continue;
      // Prefer collapsing on a weak nearby enemy hero (a kill); otherwise head
      // for whatever the auto-aim would shoot (minion/tower/exposed base).
      const focus = this.lowestEnemyHeroNear(p, 280);
      const target = focus || this.nearestTarget(p);
      if (!target) {
        p.input.dx = 0;
        p.input.dy = 0;
        continue;
      }
      const low = p.hp < CLASSES[p.cls].maxHp * 0.3;
      const home = this.bases.get(p.team);
      const dangerTower = this.enemyTowerCovering(p, 26);
      const supported = this.hasMinionSupport(p, 170);

      let mx, my; // desired move direction
      if (low) {
        // Hurt → retreat toward home (still auto-firing back as we kite).
        mx = home.x - p.x;
        my = home.y - p.y;
      } else if (dangerTower && !supported) {
        // Don't dive an enemy tower without minions to soak it — back off to its
        // edge and wait for the wave.
        mx = p.x - dangerTower.x;
        my = p.y - dangerTower.y;
      } else {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        mx = dist > BOT_STANDOFF ? dx : 0; // close in, or hold to shoot
        my = dist > BOT_STANDOFF ? dy : 0;
      }
      const len = Math.hypot(mx, my);
      if (len > 0.01) {
        p.input.dx = mx / len;
        p.input.dy = my / len;
        p.face = { x: p.input.dx, y: p.input.dy }; // so a dash goes where we're headed
      } else {
        p.input.dx = 0;
        p.input.dy = 0;
      }

      this.tryAttack(p, "basic");
      // Use the ability with intent: when a (visible) enemy hero is in striking
      // range, not at random. tryAbility() still gates it on cooldown.
      const enemyHero = focus || this.nearestEnemyPlayer(p);
      if (!low && enemyHero && (enemyHero.x - p.x) ** 2 + (enemyHero.y - p.y) ** 2 < 300 * 300) {
        this.tryAbility(p);
      }
      // Dash with purpose: escape when hurt, or close a big gap to engage. (face
      // already points the way we're moving; tryDash gates on cooldown.)
      const gap = Math.hypot(target.x - p.x, target.y - p.y);
      if (low || (!dangerTower && gap > BOT_STANDOFF * 1.6)) this.tryDash(p);

      this.tryBuy(p); // spend gold on upgrades as soon as it can afford one
    }
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
      shieldUntil: 0, // tank Bulwark: incoming damage is reduced while timeMs < this
      shieldReduce: 0, // fraction of damage blocked while shielded (0..1)
      revealUntil: 0, // briefly visible (even in a bush) after attacking
      xp: 0,
      gold: 0,
      buys: 0, // shop upgrades purchased
      bonusHp: 0, // from shop "Max HP" buys
      bonusDmg: 0, // from shop "Damage" buys (a multiplier addend)
      bonusCdr: 0, // from shop "Atk Speed" buys (cooldown reduction)
    };
  }

  // --- Bush / stealth helpers ------------------------------------------------

  // Is the point (x,y) inside any bush zone?
  static inAnyBush(x, y) {
    for (const z of BUSH_ZONES) {
      if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return true;
    }
    return false;
  }

  // Is `p` currently HIDDEN (can't be seen/targeted by enemies)? True when the
  // hero is alive, standing in a bush, NOT recently revealed by attacking, and
  // no ENEMY hero shares a bush nearby (enemies in your bush spot you).
  isHidden(p) {
    if (!p.alive) return false;
    if (!GameServer.inAnyBush(p.x, p.y)) return false;
    if (this.timeMs < p.revealUntil) return false;
    for (const o of this.players.values()) {
      if (o.team === p.team || !o.alive) continue;
      if (GameServer.inAnyBush(o.x, o.y)) return false; // an enemy is in the brush too
    }
    return true;
  }

  // --- Progression helpers ---------------------------------------------------
  levelOf(p) {
    return Math.min(PROGRESS.maxLevel, 1 + Math.floor(p.xp / PROGRESS.xpPerLevel));
  }

  // A hero's current max HP: class base + per-level growth + shop HP buys.
  effectiveMaxHp(p) {
    return CLASSES[p.cls].maxHp + (this.levelOf(p) - 1) * PROGRESS.hpPerLevel + p.bonusHp;
  }

  // A hero's attack-damage multiplier: per-level growth + shop damage buys.
  effectiveDmgMult(p) {
    return 1 + (this.levelOf(p) - 1) * PROGRESS.dmgPerLevel + p.bonusDmg;
  }

  // A hero's cooldown multiplier from "Atk Speed" buys (floored so it can't go
  // silly). 1 = normal; lower = faster attacks.
  effectiveCdMult(p) {
    return Math.max(0.4, 1 - p.bonusCdr);
  }

  // Pay a hero for a last hit (minion | hero | tower).
  awardKill(player, kind) {
    const r = PROGRESS.reward[kind];
    if (!r) return;
    player.xp += r.xp;
    player.gold += r.gold;
  }

  // Spend gold on a shop upgrade. With `itemId`, buy that specific item;
  // without one, buy the next in the list (the legacy "B" cycle, also used by
  // bots). Capped at shopMaxStacks total.
  tryBuy(player, itemId) {
    if (this.phase !== "playing") return;
    if (player.buys >= PROGRESS.shopMaxStacks) return;
    const item = itemId
      ? PROGRESS.shop.find((s) => s.id === itemId)
      : PROGRESS.shop[player.buys % PROGRESS.shop.length];
    if (!item || player.gold < item.cost) return;
    player.gold -= item.cost;
    player.bonusHp += item.hp || 0;
    player.bonusDmg += item.dmg || 0;
    player.bonusCdr += item.cdr || 0;
    player.buys++;
  }

  removeConnection(id) {
    this.players.delete(id);
    this.connections.delete(id);
    this.projectiles = this.projectiles.filter((p) => p.ownerId !== id);
    this.fillBots(); // clear bots if that was the last human; else keep teams filled
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
      if (msg.kind === "ability") this.tryAbility(p);
      else this.tryAttack(p, "basic");
    } else if (msg.t === "dash") {
      this.tryDash(p);
    } else if (msg.t === "class") {
      this.setClass(p, msg.cls);
    } else if (msg.t === "buy") {
      this.tryBuy(p, msg.itemId);
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
    player.cd[kind] = this.timeMs + spec.cd * this.effectiveCdMult(player);
    player.revealUntil = this.timeMs + BUSH.revealMs; // attacking reveals you

    const { ax, ay } = this.aimDir(player); // toward the nearest enemy (or facing)
    this.spawnBolt(player, kind, ax, ay, spec, this.attackDmg(player, spec.dmg));
  }

  // The unit aim vector toward the nearest enemy target (player/minion/tower/
  // base/camp), or — if nothing is in sight — the way the hero is facing.
  aimDir(player) {
    const target = this.nearestTarget(player) || {
      x: player.x + player.face.x,
      y: player.y + player.face.y,
    };
    let ax = target.x - player.x;
    let ay = target.y - player.y;
    const len = Math.hypot(ax, ay) || 1;
    return { ax: ax / len, ay: ay / len };
  }

  // A hero's outgoing damage for a base amount: level + shop buys + power pickup.
  attackDmg(player, base) {
    const powered = this.timeMs < player.powerUntil;
    const mult = this.effectiveDmgMult(player) * (powered ? PICKUP.powerMult : 1);
    return Math.round(base * mult);
  }

  // Create one projectile flying from the player along (ax, ay). `extra` carries
  // behaviour flags (pierce/homing/blast) read by the projectile step.
  spawnBolt(player, kind, ax, ay, spec, dmg, extra = {}) {
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
      ...extra,
    });
  }

  // The B button: each class has a behaviourally distinct ability (not just a
  // bigger bolt). Dispatch on the ability's `type`.
  tryAbility(player) {
    if (this.phase !== "playing" || !player.alive) return;
    const spec = CLASSES[player.cls].ability;
    if (this.timeMs < player.cd.ability) return; // cooling down
    player.cd.ability = this.timeMs + spec.cd * this.effectiveCdMult(player);
    player.revealUntil = this.timeMs + BUSH.revealMs; // using an ability reveals you

    switch (spec.type) {
      case "spread": return this.abilitySpread(player, spec);
      case "pierce": return this.abilityPierce(player, spec);
      case "shield": return this.abilityShield(player, spec);
      case "homing": return this.abilityHoming(player, spec);
      case "blast": return this.abilityBlast(player, spec);
      case "leap": return this.abilityLeap(player, spec);
      default: // plain bolt (fallback)
        const { ax, ay } = this.aimDir(player);
        return this.spawnBolt(player, "ability", ax, ay, spec, this.attackDmg(player, spec.dmg));
    }
  }

  // Scout — Scatter: a fan of pellets centred on the aim direction.
  abilitySpread(player, spec) {
    const { ax, ay } = this.aimDir(player);
    const base = Math.atan2(ay, ax);
    const spread = (spec.spreadDeg * Math.PI) / 180;
    const dmg = this.attackDmg(player, spec.dmg);
    for (let i = 0; i < spec.pellets; i++) {
      // Spread evenly from -spread/2 to +spread/2 across the pellets.
      const t = spec.pellets === 1 ? 0 : i / (spec.pellets - 1) - 0.5;
      const a = base + t * spread;
      this.spawnBolt(player, "ability", Math.cos(a), Math.sin(a), spec, dmg);
    }
  }

  // Soldier — Pierce: one bolt that hits every enemy along its line (each once).
  abilityPierce(player, spec) {
    const { ax, ay } = this.aimDir(player);
    this.spawnBolt(player, "ability", ax, ay, spec, this.attackDmg(player, spec.dmg), {
      pierce: true,
      hit: new Set(), // ids already struck, so each target only takes one hit
    });
  }

  // Tank — Bulwark: a timed shield that reduces all incoming damage.
  abilityShield(player, spec) {
    player.shieldUntil = this.timeMs + spec.durationMs;
    player.shieldReduce = spec.reduce;
  }

  // Ranger — Seeker: a homing arrow locked onto the nearest enemy hero.
  abilityHoming(player, spec) {
    const { ax, ay } = this.aimDir(player);
    const target = this.nearestEnemyPlayer(player);
    this.spawnBolt(player, "ability", ax, ay, spec, this.attackDmg(player, spec.dmg), {
      homing: true,
      targetId: target ? target.id : null,
      turn: spec.turn, // max steering rate, radians/sec
    });
  }

  // Mage — Nova: a fireball that detonates on the first thing it touches (or at
  // end of flight), dealing its damage to everything enemy within blastRadius.
  abilityBlast(player, spec) {
    const { ax, ay } = this.aimDir(player);
    this.spawnBolt(player, "ability", ax, ay, spec, this.attackDmg(player, spec.dmg), {
      blast: spec.blastRadius,
    });
  }

  // Brawler — Leap Slam: lunge forward (walls stop the lunge) then smash,
  // hurting every enemy around the landing point.
  abilityLeap(player, spec) {
    const f = normalizeInput(player.face.x, player.face.y);
    const dest = resolveMove(
      player.x,
      player.y,
      player.x + f.dx * spec.distance,
      player.y + f.dy * spec.distance
    );
    player.x = dest.x;
    player.y = dest.y;
    this.areaDamage(player.x, player.y, spec.slamRadius, this.attackDmg(player, spec.dmg), player);
  }

  // Deal `dmg` to every enemy player and minion within `r` of (x, y); credit the
  // owning hero. Used by Nova detonations and the Leap Slam. Also drops a blast
  // marker so the client can draw the shockwave.
  areaDamage(x, y, r, dmg, owner) {
    for (const p of this.players.values()) {
      if (!owner || p.team === owner.team || !p.alive || this.isHidden(p)) continue;
      const reach = r + PLAYER_HALF;
      if ((p.x - x) ** 2 + (p.y - y) ** 2 <= reach * reach) {
        this.damage(p, dmg, owner.team, owner);
      }
    }
    for (const m of this.minions) {
      if (!m.alive || (owner && m.team === owner.team)) continue;
      const reach = r + MINION.half;
      if ((m.x - x) ** 2 + (m.y - y) ** 2 <= reach * reach) this.damageMinion(m, dmg, owner);
    }
    for (const tw of this.towers) {
      if (!tw.alive || (owner && tw.team === owner.team)) continue;
      const reach = r + TOWER.radius;
      if ((tw.x - x) ** 2 + (tw.y - y) ** 2 <= reach * reach) this.damageTower(tw, dmg, owner);
    }
    this.blasts.push({
      id: "x" + this.nextBlastId++,
      x: Math.round(x),
      y: Math.round(y),
      r,
      team: owner ? owner.team : "blue",
      dieAt: this.timeMs + 220,
    });
  }

  // Nearest LIVING, visible enemy hero (no base/minion) — for homing locks.
  nearestEnemyPlayer(player) {
    let best = null;
    let bestD = Infinity;
    for (const o of this.players.values()) {
      if (o.team === player.team || !o.alive || this.isHidden(o)) continue;
      const d = (o.x - player.x) ** 2 + (o.y - player.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  // --- Bot perception helpers ------------------------------------------------
  // The weakest visible enemy hero within `maxDist` (so bots collapse on a kill).
  lowestEnemyHeroNear(player, maxDist) {
    let best = null;
    let bestHp = Infinity;
    for (const o of this.players.values()) {
      if (o.team === player.team || !o.alive || this.isHidden(o)) continue;
      if ((o.x - player.x) ** 2 + (o.y - player.y) ** 2 > maxDist * maxDist) continue;
      if (o.hp < bestHp) {
        bestHp = o.hp;
        best = o;
      }
    }
    return best;
  }

  // An alive enemy tower whose guns cover the player's spot (so it knows not to
  // dive). `pad` widens the danger radius a little.
  enemyTowerCovering(player, pad = 0) {
    const r = TOWER.range + pad;
    for (const tw of this.towers) {
      if (!tw.alive || tw.team === player.team) continue;
      if ((tw.x - player.x) ** 2 + (tw.y - player.y) ** 2 <= r * r) return tw;
    }
    return null;
  }

  // Is a friendly minion close enough to soak a tower while the bot pushes?
  hasMinionSupport(player, r) {
    for (const m of this.minions) {
      if (!m.alive || m.team !== player.team) continue;
      if ((m.x - player.x) ** 2 + (m.y - player.y) ** 2 <= r * r) return true;
    }
    return false;
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
      if (o.team !== player.team && o.alive && !this.isHidden(o)) consider(o.x, o.y);
    }
    for (const m of this.minions) {
      if (m.team !== player.team && m.alive) consider(m.x, m.y);
    }
    for (const tw of this.towers) {
      if (tw.team !== player.team && tw.alive) consider(tw.x, tw.y);
    }
    for (const c of this.camps) {
      if (c.alive) consider(c.x, c.y); // neutral camps are fair game for anyone
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
    this.matchEndsAt = this.timeMs + MATCH.maxDurationMs;
  }

  // The match ran out of time: the team ahead on kills wins, ties broken by
  // base HP (healthier base = better defended), and a true tie is a draw.
  endByTimeout() {
    this.phase = "over";
    this.resetAt = this.timeMs + MATCH.resetMs;
    if (this.score.blue !== this.score.red) {
      this.winner = this.score.blue > this.score.red ? "blue" : "red";
    } else {
      const b = this.bases.get("blue").hp;
      const r = this.bases.get("red").hp;
      this.winner = b === r ? "draw" : b > r ? "blue" : "red";
    }
  }

  // Spawn one wave for each team, just in front of its base, staggered across
  // the open center lane so they march through the gap between the pillars.
  spawnWave() {
    for (const team of ["blue", "red"]) {
      const base = this.bases.get(team);
      if (!base || !base.alive) continue;
      const dir = team === "blue" ? 1 : -1; // blue pushes right, red pushes left
      const entryX = team === "blue" ? LANE_ENTRY_X : GAME_WIDTH - LANE_ENTRY_X;
      // A small column of minions per lane. They spawn AT the nexus (base row)
      // and first walk out to their lane's entry waypoint, so the lanes fan out
      // from the base instead of being parallel strips.
      for (const ln of LANES) {
        for (let i = 0; i < MINION.perWave; i++) {
          this.minions.push({
            id: "m" + this.nextMinionId++,
            team,
            lane: ln.id,
            x: base.x + dir * (MINION.spawnAhead + i * 14), // staggered, by the base
            y: base.y, // start on the nexus row
            laneY: ln.row, // the row to hold once on the lane
            waypoint: { x: entryX, y: ln.row }, // walk here first, then march across
            hp: MINION.maxHp,
            alive: true,
            cd: 0,
          });
        }
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
      // While walking out to the lane entry, just head there (no combat) — clear
      // the waypoint once reached so it then marches/fights normally.
      if (m.waypoint) {
        if (Math.hypot(m.waypoint.x - m.x, m.waypoint.y - m.y) <= 16) {
          m.waypoint = null;
        } else {
          this.moveMinion(m, m.waypoint.x, m.waypoint.y, dt);
          continue;
        }
      }
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
      if (p.team !== m.team && p.alive && !this.isHidden(p))
        consider(p.x, p.y, () => this.damage(p, MINION.dmg, m.team));
    }
    for (const tw of this.towers) {
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

  hitMinion(b, skip) {
    const reach = COMBAT.hitPad + MINION.half;
    for (const m of this.minions) {
      if (m.team === b.team || !m.alive) continue;
      if (skip && skip.has(m.id)) continue;
      if ((m.x - b.x) ** 2 + (m.y - b.y) ** 2 <= reach * reach) return m;
    }
    return null;
  }

  damageMinion(m, amount, attacker) {
    m.hp = Math.max(0, m.hp - amount);
    if (m.hp === 0) {
      m.alive = false;
      if (attacker && attacker.team !== m.team) this.awardKill(attacker, "minion");
    }
  }

  // --- Defensive towers ------------------------------------------------------

  // Each living tower zaps the nearest enemy unit in range, on its cooldown.
  stepTowers() {
    for (const tw of this.towers) {
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
      if (p.team !== src.team && p.alive && !this.isHidden(p)) consider(p.x, p.y);
    }
    for (const mob of this.minions) {
      if (mob.team !== src.team && mob.alive) consider(mob.x, mob.y);
    }
    return best;
  }

  hitTower(b) {
    const reach = COMBAT.hitPad + TOWER.radius;
    for (const tw of this.towers) {
      if (tw.team === b.team || !tw.alive) continue;
      if ((tw.x - b.x) ** 2 + (tw.y - b.y) ** 2 <= reach * reach) return tw;
    }
    return null;
  }

  damageTower(tw, amount, attacker) {
    tw.hp = Math.max(0, tw.hp - amount);
    if (tw.hp === 0) {
      tw.alive = false; // destroying a tower doesn't end the match
      if (attacker && attacker.team !== tw.team) this.awardKill(attacker, "tower");
    }
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

    // Out of time? Decide the match on kills (then base HP).
    if (this.timeMs >= this.matchEndsAt) {
      this.endByTimeout();
      return;
    }

    // 0) Drive the AI bots (sets their input + fires their attacks).
    this.stepBots();

    // 1) Move players; remember facing; trickle in passive XP/gold.
    for (const p of this.players.values()) {
      if (!p.alive) {
        if (this.timeMs >= p.deadUntil) this.respawn(p);
        continue;
      }
      p.xp += PROGRESS.passiveXpPerSec * dt;
      p.gold += PROGRESS.passiveGoldPerSec * dt;
      const { dx, dy } = p.input;
      // Remember facing (for the aim fallback and dash) when there's real
      // input. `face` is always {x,y}; normalizeInput returns {dx,dy}, so map it.
      if (Math.hypot(dx, dy) > 0.01) {
        const n = normalizeInput(dx, dy);
        p.face = { x: n.dx, y: n.dy };
      }
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

    // 3c) Healing fountains: regen heroes standing near their own base.
    this.stepFountains(dt);

    // 3d) Jungle camps: bite nearby heroes; respawn cleared ones.
    this.stepCamps();

    // 4) Move projectiles; expire; check hits on players, minions, towers, bases.
    const survivors = [];
    for (const b of this.projectiles) {
      if (b.homing) this.steerHoming(b, dt); // curve toward the locked target
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const offscreen = b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT;
      const dead = this.timeMs >= b.dieAt || offscreen;
      const inWall = !dead && pointInWall(b.x, b.y);
      if (dead || inWall) {
        // A Nova fireball still bursts where it fizzles out or smacks a wall
        // (but not if it sailed off the map edge).
        if (b.blast && !offscreen) {
          this.areaDamage(b.x, b.y, b.blast, b.dmg, this.players.get(b.ownerId));
        }
        continue; // bolt is gone
      }

      // The owning hero (if any) earns the last-hit reward; tower bolts have a
      // non-player ownerId, so `owner` is undefined and pays nothing.
      const owner = this.players.get(b.ownerId);

      // Nova fireball: detonate on the first thing it touches.
      if (b.blast) {
        if (this.hitPlayer(b) || this.hitMinion(b) || this.hitTower(b) || this.hitCamp(b) || this.hitBase(b)) {
          this.areaDamage(b.x, b.y, b.blast, b.dmg, owner);
          continue;
        }
        survivors.push(b);
        continue;
      }

      // Piercing bolt: hit each enemy hero/minion once and keep flying; a
      // structure (tower/camp/base) still stops it.
      if (b.pierce) {
        const victim = this.hitPlayer(b, b.hit);
        if (victim) {
          this.damage(victim, b.dmg, b.team, owner);
          b.hit.add(victim.id);
        }
        const mob = this.hitMinion(b, b.hit);
        if (mob) {
          this.damageMinion(mob, b.dmg, owner);
          b.hit.add(mob.id);
        }
        const tower = this.hitTower(b);
        if (tower) {
          this.damageTower(tower, b.dmg, owner);
          continue;
        }
        const camp = this.hitCamp(b);
        if (camp) {
          this.damageCamp(camp, b.dmg, owner);
          continue;
        }
        const base = this.hitBase(b);
        if (base) {
          this.damageBase(base, b.dmg);
          continue;
        }
        survivors.push(b);
        continue;
      }

      const victim = this.hitPlayer(b);
      if (victim) {
        this.damage(victim, b.dmg, b.team, owner); // credit the firing team + hero
        continue;
      }
      const mob = this.hitMinion(b);
      if (mob) {
        this.damageMinion(mob, b.dmg, owner);
        continue;
      }
      const tower = this.hitTower(b);
      if (tower) {
        this.damageTower(tower, b.dmg, owner);
        continue;
      }
      // Camps are neutral — any owner's bolt hurts them (only heroes get credit).
      const camp = this.hitCamp(b);
      if (camp) {
        this.damageCamp(camp, b.dmg, owner);
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
    // Drop expired blast markers (they live only long enough for the client to
    // draw the shockwave once).
    this.blasts = this.blasts.filter((x) => this.timeMs < x.dieAt);
  }

  // Steer a homing bolt's velocity toward its locked target, capped at `turn`
  // radians/sec so it arcs rather than snapping. A lost lock flies straight.
  steerHoming(b, dt) {
    const t = this.players.get(b.targetId);
    if (!t || !t.alive) return;
    const desired = Math.atan2(t.y - b.y, t.x - b.x);
    const cur = Math.atan2(b.vy, b.vx);
    let diff = desired - cur;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    const maxTurn = (b.turn || 5) * dt;
    const na = cur + clamp(diff, -maxTurn, maxTurn);
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(na) * sp;
    b.vy = Math.sin(na) * sp;
  }

  // `skip` (optional Set of ids) lets a piercing bolt ignore targets it already
  // struck, so it keeps finding fresh ones along its line.
  hitPlayer(b, skip) {
    const reach = COMBAT.hitPad + PLAYER_HALF;
    for (const p of this.players.values()) {
      if (p.team === b.team || !p.alive) continue;
      if (skip && skip.has(p.id)) continue;
      if (this.isHidden(p)) continue; // a hidden hero can't be hit by enemy bolts
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
  // to the scoreboard; `attacker` (optional) is the killing hero, paid XP/gold.
  damage(player, amount, byTeam, attacker) {
    if (!player.alive) return;
    // Tank's Bulwark shield soaks a fraction of every incoming hit.
    if (this.timeMs < player.shieldUntil) {
      amount = Math.round(amount * (1 - player.shieldReduce));
    }
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
      if (attacker && attacker.team !== player.team) this.awardKill(attacker, "hero");
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

  // Regen any living hero standing within healRadius of its OWN base, up to its
  // (leveled) max HP. Small radius, so you can't heal and fight at once.
  stepFountains(dt) {
    const r2 = BASE.healRadius * BASE.healRadius;
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const base = this.bases.get(p.team);
      if (!base) continue;
      if ((p.x - base.x) ** 2 + (p.y - base.y) ** 2 <= r2) {
        p.hp = Math.min(this.effectiveMaxHp(p), p.hp + BASE.healPerSec * dt);
      }
    }
  }

  // --- Jungle camps ----------------------------------------------------------

  // Camps don't roam. A live camp bites the nearest enemy hero within range on
  // its cooldown; a cleared camp respawns at full HP after its timer.
  stepCamps() {
    const r2 = CAMP.range * CAMP.range;
    for (const c of this.camps) {
      if (!c.alive) {
        if (this.timeMs >= c.respawnAt) {
          c.alive = true;
          c.hp = CAMP.maxHp;
          c.cd = 0;
        }
        continue;
      }
      if (this.timeMs < c.cd) continue;
      // Bite the nearest living hero in range (any team — it's neutral).
      let victim = null;
      let bestD = r2;
      for (const p of this.players.values()) {
        if (!p.alive || this.isHidden(p)) continue; // can't bite a hidden hero
        const d = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
        if (d <= bestD) {
          bestD = d;
          victim = p;
        }
      }
      if (victim) {
        c.cd = this.timeMs + CAMP.attackCd;
        this.damage(victim, CAMP.dmg); // no byTeam/attacker — neutral, no credit
      }
    }
  }

  hitCamp(b) {
    const reach = COMBAT.hitPad + CAMP.radius;
    for (const c of this.camps) {
      if (!c.alive) continue;
      if ((c.x - b.x) ** 2 + (c.y - b.y) ** 2 <= reach * reach) return c;
    }
    return null;
  }

  // Damage a camp; on the killing blow, pay the attacker (gold/xp) and grant a
  // short attack buff (reuses the power-pickup buff), then start its respawn.
  damageCamp(c, amount, attacker) {
    c.hp = Math.max(0, c.hp - amount);
    if (c.hp === 0 && c.alive) {
      c.alive = false;
      c.respawnAt = this.timeMs + CAMP.respawnMs;
      if (attacker) {
        this.awardKill(attacker, "camp");
        attacker.powerUntil = this.timeMs + CAMP.buffMs;
      }
    }
  }

  grantPickup(player, pk) {
    if (pk.kind === "heal") {
      player.hp = Math.min(this.effectiveMaxHp(player), player.hp + PICKUP.heal);
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

  // A base can only be harmed once ALL of its team's guard towers are gone.
  baseVulnerable(team) {
    const mine = this.towers.filter((t) => t.team === team);
    return mine.length === 0 || mine.every((t) => !t.alive);
  }

  respawn(p) {
    const list = SPAWNS[p.team];
    const spawn = list[p.spawnIndex % list.length];
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = this.effectiveMaxHp(p); // respawn with your leveled-up HP
    p.alive = true;
    p.input = { dx: 0, dy: 0 };
  }

  // Start a fresh round: bases and all players restored to their spawn slots.
  resetMatch() {
    this.resetBases();
    this.resetTowers();
    this.resetPickups();
    this.resetCamps();
    this.score = { blue: 0, red: 0 };
    this.killFeed = [];
    for (const p of this.players.values()) {
      const fresh = this.freshPlayer(p.id, p.team, p.spawnIndex, p.cls);
      Object.assign(p, fresh);
    }
    this.projectiles = [];
    this.minions = [];
    this.nextWaveAt = Infinity; // re-armed by beginPlaying on the next match
    this.matchEndsAt = Infinity; // ...likewise the time limit
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
      // Seconds left on the match clock (0 unless a timed match is in progress).
      timeLeft:
        this.phase === "playing" && isFinite(this.matchEndsAt)
          ? Math.max(0, Math.ceil((this.matchEndsAt - this.timeMs) / 1000))
          : 0,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        team: p.team,
        x: Math.round(p.x),
        y: Math.round(p.y),
        hp: p.hp,
        alive: p.alive,
        cls: p.cls, // hero class (for per-class look)
        bot: !!p.bot, // AI-controlled?
        maxHp: this.effectiveMaxHp(p), // class base + level + shop HP buys
        level: this.levelOf(p),
        gold: Math.floor(p.gold),
        buys: p.buys, // shop upgrades bought (so the client knows the next one)
        // Seconds until this player respawns (0 if alive) — for the HUD timer.
        respawnIn: p.alive ? 0 : Math.max(0, Math.ceil((p.deadUntil - this.timeMs) / 1000)),
        powered: this.timeMs < p.powerUntil, // power buff active (for the aura)
        shielded: this.timeMs < p.shieldUntil, // tank Bulwark active (shield ring)
        hidden: this.isHidden(p), // in a bush, unseen by enemies (client hides it)
      })),
      // Transient AoE shockwaves (Nova / Slam) the client draws as a ring once.
      blasts: this.blasts
        .filter((x) => this.timeMs < x.dieAt)
        .map((x) => ({ id: x.id, x: x.x, y: x.y, r: x.r, team: x.team })),
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
      camps: this.camps.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        hp: c.hp,
        maxHp: CAMP.maxHp,
        alive: c.alive,
      })),
      towers: this.towers.map((tw) => ({
        team: tw.team,
        lane: tw.lane,
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
