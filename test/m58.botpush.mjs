// Milestone 58 (bots actually PUSH): lock the fix for the long-standing
// bot-vs-bot stalemate. Before this, every bot match ended a frozen 0-0 — bots
// idled in their own jungle and never engaged, AND the two teams' minion waves
// were identical, met at dead centre, and annihilated, so no minion ever reached
// a tower. This test drives the REAL step() loop (like m29/m57) through full
// bots-only matches and asserts that REAL PROGRESS happens: an enemy tower takes
// damage, heroes die / the score moves, and over a bigger fight a tower can fall
// — i.e. the match is a real MOBA arc, no longer a stalemate.
//
// We also keep a hard SANITY net: across every tick of every match the sim must
// stay finite and in-bounds (the bots' new "advance down the lane" movement must
// never walk a hero out of the arena or to NaN — the same invariants m29 guards).
import GameServer from "../src/net/GameServer.js";
import { MATCH, TOWER, BASE, GAME_WIDTH, GAME_HEIGHT } from "../src/config.js";
import { assert } from "./helpers.mjs";

const DT = 1 / 30;
const secs = (ms) => (ms / 1000).toFixed(1) + "s";

// Drive a full bots-only match (n bots per team) and report what happened, while
// asserting the per-tick sanity invariants the whole time.
function runMatch(n, label) {
  const s = new GameServer({ bots: true });
  for (let i = 0; i < n; i++) {
    s.addBot("blue");
    s.addBot("red");
  }
  s.beginPlaying();

  let firstTowerDmg = null; // when any tower first dropped below full HP
  let firstTowerFall = null; // when any tower was first destroyed
  let firstBaseDmg = null; // when any base first took damage (towers all down)
  // Sanity flags, checked ONCE after the loop so we don't spam an assert per tick
  // (a full 3-minute match is ~5400 ticks).
  let sane = true;
  const limitTick = Math.ceil((MATCH.maxDurationMs / 1000 + 1) / DT);

  for (let i = 0; i < limitTick; i++) {
    s.step(DT);

    // --- SANITY: the world stays finite and in-bounds on every single tick. ---
    for (const p of s.players.values()) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) sane = false;
      if (p.x < 0 || p.x > GAME_WIDTH || p.y < 0 || p.y > GAME_HEIGHT) sane = false;
    }
    for (const m of s.minions) {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) sane = false;
    }

    // --- Track the progress milestones. ---
    for (const tw of s.towers) {
      if (tw.hp < TOWER.maxHp && firstTowerDmg === null) firstTowerDmg = s.timeMs;
      if (!tw.alive && firstTowerFall === null) firstTowerFall = s.timeMs;
    }
    for (const b of s.bases.values()) {
      if (b.hp < BASE.maxHp && firstBaseDmg === null) firstBaseDmg = s.timeMs;
    }
    if (s.phase === "over") break;
  }

  assert(
    sane,
    `${label}: the sim stays finite and every pushing bot/minion stays in the arena, all match`
  );

  const kills = s.score.blue + s.score.red;
  console.log(
    `  ${label}: towerDmg=${firstTowerDmg ? secs(firstTowerDmg) : "never"} ` +
      `towerFall=${firstTowerFall ? secs(firstTowerFall) : "never"} ` +
      `baseDmg=${firstBaseDmg ? secs(firstBaseDmg) : "never"} ` +
      `kills=${kills} score=${s.score.blue}-${s.score.red} winner=${s.winner}`
  );
  return { firstTowerDmg, firstTowerFall, firstBaseDmg, kills, score: s.score, winner: s.winner };
}

try {
  // === 1) A small (1v1) bots match is no longer a frozen 0-0. ===
  // The minimum bar the old game always failed: SOMETHING happens. With the
  // pushing bots + the short minion leash, a 1v1 reliably chips a tower and
  // trades a kill (and, given the full clock, can crack a tower outright).
  {
    const r = runMatch(1, "1v1");
    assert(
      r.firstTowerDmg !== null,
      "1v1: an enemy tower takes real damage (lanes open — not a frozen 0-0)"
    );
    const decided =
      r.kills > 0 || r.firstTowerFall !== null || r.score.blue !== r.score.red;
    assert(
      decided,
      "1v1: the match makes real progress — a kill and/or a tower falls (no stalemate)"
    );
  }

  // === 2) A bigger fight (3v3) produces a full MOBA arc: towers FALL. ===
  // With three bots a side spread across the lanes, the extra pressure must crack
  // at least one tower within the match — proving structures are reachable, not
  // just chip-able, once a lane is genuinely won.
  {
    const r = runMatch(3, "3v3");
    assert(
      r.firstTowerDmg !== null,
      "3v3: towers take damage under bot pressure"
    );
    assert(
      r.firstTowerFall !== null,
      "3v3: at least one tower is DESTROYED — a lane is won and the objective falls"
    );
    assert(r.kills > 0, "3v3: heroes actually fight and trade kills");
  }

  // === 3) The match always RESOLVES (never overruns the clock). ===
  // A safety re-check of the m57 invariant under the new, more aggressive bots:
  // their pushing must not somehow wedge the lifecycle — the match still ends.
  {
    const s = new GameServer({ bots: true });
    s.addBot("blue");
    s.addBot("red");
    s.beginPlaying();
    const limitTick = Math.ceil((MATCH.maxDurationMs / 1000 + 1) / DT);
    let ended = false;
    for (let i = 0; i < limitTick; i++) {
      s.step(DT);
      if (s.phase === "over") {
        ended = true;
        break;
      }
    }
    assert(ended, "a bots match always reaches a conclusion within the clock");
    assert(
      s.winner === "blue" || s.winner === "red" || s.winner === "draw",
      "a finished bots match has a decided result"
    );
  }

  console.log("\nMILESTONE 58 BOT-PUSH TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
