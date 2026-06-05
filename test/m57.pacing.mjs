// Milestone 57 (match pacing & economy): lock the invariants that keep a MATCH
// flowing into a satisfying arc — early laning, then pressure cracks a tower,
// then an exposed base can be razed; and a match that nobody finishes still
// RESOLVES at the timer with a decided winner (it never drags forever). These
// guard the pacing knobs in config.js (MINION / TOWER / BASE / COMBAT.respawnMs
// / MATCH clock) so a future edit can't silently turn the game into an eternal
// stalemate or an instant blowout.
//
// We drive the REAL step() loop (like m29) and apply our OWN sustained pressure
// rather than leaning on the bots, because the bots farm passively — these are
// invariants about the *systems*, not about how aggressively the AI plays.
import GameServer from "../src/net/GameServer.js";
import {
  MINION,
  TOWER,
  BASE,
  COMBAT,
  MATCH,
  LANES,
  GAME_WIDTH,
} from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

try {
  // === 1) A tower is DESTRUCTIBLE under sustained pressure — not unkillable. ===
  // The classic pacing failure is a tower so tanky no realistic push ever takes
  // it, so every match limps to the timer. We park ONE blue soldier just outside
  // the red mid tower and let it auto-attack (server auto-aims the nearest enemy
  // = the tower) while we suppress the red wave it would otherwise have to chew
  // through first — i.e. a lane the attackers have WON. The tower must fall in a
  // sane window: long enough to feel like an objective, short enough to be a
  // real, reachable goal within a match.
  {
    const s = new GameServer({ bots: false });
    s.beginPlaying();
    s.minions = [];
    s.nextWaveAt = Infinity; // isolate: just the hero's DPS on the tower

    const redMid = s.towers.find((t) => t.team === "red" && t.lane === "mid");
    // Remove every other tower so the hero's auto-aim can only pick redMid.
    s.towers = s.towers.filter((t) => t === redMid);

    const hero = s.freshPlayer("h1", "blue", 0, "soldier");
    hero.x = redMid.x - (TOWER.range - 10); // just inside its own bolt range, attacking in
    hero.y = redMid.y;
    s.players.set("h1", hero);

    let fellAt = null;
    const maxTicks = Math.ceil(60 / DT); // give it up to a generous minute
    for (let i = 0; i < maxTicks; i++) {
      hero.x = redMid.x - (TOWER.range - 10); // hold position (don't drift)
      hero.y = redMid.y;
      hero.hp = CLAMP_FULL(s, hero); // keep the test hero up so we measure tower HP, not a duel
      s.tryAttack(hero, "basic");
      s.step(DT);
      if (!redMid.alive) {
        fellAt = s.timeMs;
        break;
      }
    }
    assert(fellAt !== null, "a tower CAN be destroyed by sustained pressure (it is not unkillable)");
    // Sane band: a single hero takes a real but reachable amount of time. (At the
    // current 180 HP / 8-dmg soldier basic this is ~10s; the band stays wide so
    // re-tuning tower HP or hero dmg within reason doesn't trip the lock.)
    assert(fellAt <= 45000, `tower falls within a sane time (was ${secs(fellAt)})`);
    assert(fellAt >= 2000, `tower does NOT fall near-instantly (was ${secs(fellAt)})`);
  }

  // === 2) The base shield gate: shielded while ANY tower stands, vulnerable ===
  // === only once they're ALL down. ===
  {
    const s = new GameServer({ bots: false });
    s.beginPlaying();
    const redTowers = s.towers.filter((t) => t.team === "red");
    assert(redTowers.length === LANES.length, "each team has one tower per lane");

    assert(s.baseVulnerable("red") === false, "base starts shielded (towers standing)");
    // Drop towers one at a time: still shielded until the LAST falls.
    for (let i = 0; i < redTowers.length; i++) {
      redTowers[i].alive = false;
      const expectVuln = i === redTowers.length - 1;
      assert(
        s.baseVulnerable("red") === expectVuln,
        expectVuln
          ? "base becomes vulnerable only after the LAST tower falls"
          : `base stays shielded while ${redTowers.length - 1 - i} tower(s) still stand`
      );
    }

    // A shielded base ignores damage; an exposed one takes it and can be razed.
    const s2 = new GameServer({ bots: false });
    s2.beginPlaying();
    const redBase = s2.bases.get("red");
    const hp0 = redBase.hp;
    s2.damageBase(redBase, 50);
    assert(redBase.hp === hp0, "a shielded base ignores damage");
    s2.towers.forEach((t) => { if (t.team === "red") t.alive = false; });
    s2.damageBase(redBase, 40);
    assert(redBase.hp === hp0 - 40, "an exposed base takes damage");
    s2.damageBase(redBase, BASE.maxHp);
    assert(s2.phase === "over" && s2.winner === "blue", "razing an exposed base ends the match");
  }

  // === 3) A match nobody finishes RESOLVES at the timer with a decided winner. ===
  // Drive a full bots match; if no base falls, the clock must end it and pick a
  // winner/draw — it can never run past the limit forever.
  {
    const s = new GameServer({ bots: true });
    s.addBot("blue");
    s.addBot("red");
    s.beginPlaying();
    const limitTick = Math.ceil((MATCH.maxDurationMs / 1000 + 1) / DT);
    let ended = false;
    for (let i = 0; i < limitTick; i++) {
      s.step(DT);
      if (s.phase === "over") { ended = true; break; }
    }
    assert(ended, "the match reaches a conclusion at or before the time limit (never drags forever)");
    assert(
      s.winner === "blue" || s.winner === "red" || s.winner === "draw",
      "a finished match always has a decided result (winner or explicit draw)"
    );
    // The clock must not have overrun its hard limit.
    assert(s.timeMs <= MATCH.maxDurationMs + DT * 1000 + 1, "the match ended within the configured clock");
  }

  // === 4) Minion waves spawn on cadence — the lane keeps getting pressure. ===
  {
    const s = new GameServer({ bots: false });
    s.beginPlaying();
    // The first wave is armed firstWaveMs after play begins.
    assert(s.nextWaveAt === s.timeMs + MINION.firstWaveMs, "first wave is armed on beginPlaying");

    // Step to just past the first wave: minions appear, one column per lane/team.
    const stepTo = (targetMs) => { while (s.timeMs < targetMs) s.step(DT); };
    stepTo(MINION.firstWaveMs + 50);
    const afterFirst = s.minions.length;
    assert(afterFirst > 0, "the first wave actually spawned minions");
    // 2 teams * LANES * perWave fresh fighters (some may already be trading, so >=).
    assert(
      afterFirst >= 2 * LANES.length * MINION.perWave * 0.5,
      "the first wave spawns a meaningful number of minions"
    );

    // A SECOND wave must arrive about waveEvery later — count spawns over a window.
    const spawnTick = s.nextMinionId; // ids only ever increase as minions spawn
    stepTo(MINION.firstWaveMs + MINION.waveEvery + 50);
    assert(
      s.nextMinionId > spawnTick,
      "another wave spawns on the configured cadence (the lane keeps getting pressure)"
    );
  }

  // === 5) Respawn time sits in a sane band — long enough to matter, short ===
  // === enough that one death never ends the game. ===
  {
    // A killed hero stays down COMBAT.respawnMs, then returns at full HP.
    const s = new GameServer({ bots: false });
    s.beginPlaying();
    const hero = s.freshPlayer("h1", "blue", 0, "soldier");
    s.players.set("h1", hero);
    s.damage(hero, hero.hp, "red"); // knock it out
    assert(!hero.alive, "the hero is knocked out");
    assert(
      hero.deadUntil === s.timeMs + COMBAT.respawnMs,
      "respawn is scheduled COMBAT.respawnMs after death"
    );
    // Just before the timer it is still down; just after, it is back at full HP.
    s.timeMs = hero.deadUntil - 1;
    s.step(DT); // crosses the threshold (timeMs advances by DT*1000)
    assert(hero.alive, "the hero respawns once its timer elapses");
    assert(hero.hp === s.effectiveMaxHp(hero), "respawn restores full (leveled) HP");

    // The band itself: a meaningful window, but not a single-death-loses eternity.
    assert(COMBAT.respawnMs >= 3000, "respawn is long enough to create a real push window");
    assert(COMBAT.respawnMs <= 12000, "respawn is short enough that one death never ends the game");
    // And it must be a small fraction of the whole match (so deaths recur).
    assert(
      COMBAT.respawnMs < MATCH.maxDurationMs / 10,
      "respawn is a small fraction of the match clock"
    );
  }

  console.log("\nMILESTONE 57 PACING TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}

// Keep the lone test hero topped up so test #1 measures TOWER durability, not a
// hero-vs-tower duel (the tower out-damages a stationary soldier otherwise).
function CLAMP_FULL(server, p) {
  return server.effectiveMaxHp(p);
}
