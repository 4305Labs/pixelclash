// Milestone 56 (ability balance pass): lock in the hero-ABILITY balance
// INVARIANTS so a future config edit can't silently make one class's B-ability
// strictly over- or under-powered relative to its cooldown and the rest of the
// roster. Pure Node — imports only src/config.js (no browser, no server).
//
// Background: each class in CLASSES has an `ability` with a `type`, a cooldown
// `cd` (ms), and type-specific params. The six ability identities this file is
// written against (settle these in config.js):
//   • scout   "spread" — a fan of light pellets (multi-hit, short cooldown).
//   • soldier "pierce" — one heavy bolt through a whole line.
//   • tank    "shield" — PURE UTILITY: a damage-reduction bubble, deals NO
//                        direct damage (the durability pick mustn't also nuke).
//   • ranger  "homing" — a tracking bolt that curves onto its target.
//   • mage    "blast"  — the PREMIER BURST: the single biggest hit, an AoE nova.
//   • brawler "leap"   — a mobility dash + AoE slam (durable bruiser, so its
//                        ability is NOT allowed to out-burst the squishy nukers).
//
// "ability-DPS" below = single-hit ability damage / (cooldown in seconds). It's
// a rough yardstick for how much burst-per-second an ability trades for its
// cooldown; we cap it so no class gets huge burst on a short cooldown. (The
// scout's spread is multi-pellet, so we measure its PER-PELLET damage — landing
// the whole fan is the skill payoff, not a guarantee.)
import { CLASSES } from "../src/config.js";
import { assert } from "./helpers.mjs";

// Ability types that deal direct projectile/AoE damage (everything except the
// tank's utility shield).
const DAMAGING = ["spread", "pierce", "homing", "blast", "leap"];

// Single-hit ability damage for a class (0 for the utility shield, which has no
// `dmg` key at all).
const abilityDmg = (c) => c.ability.dmg || 0;
// Rough ability-DPS: single-hit damage per cooldown-second.
const abilityDps = (c) => abilityDmg(c) / (c.ability.cd / 1000);

try {
  // --- Every ability is sane (positive cooldown; damagers deal damage) -------
  for (const [k, c] of Object.entries(CLASSES)) {
    const a = c.ability;
    assert(a && typeof a.type === "string", `${k}: ability has a type string`);
    assert(typeof a.cd === "number" && a.cd > 0, `${k}: ability cooldown positive`);
    // Cooldowns sit in a sane band — long enough to be a "cooldown ability",
    // short enough to actually use in a fight (1.5s..6s).
    assert(a.cd >= 1500 && a.cd <= 6000, `${k}: ability cooldown within sane band (1.5s..6s)`);

    if (DAMAGING.includes(a.type)) {
      assert(abilityDmg(c) > 0, `${k}: damaging ability (${a.type}) has positive dmg`);
    }
  }

  // --- The tank's shield is PURE UTILITY: it deals no direct damage ----------
  // (the durability pick must not also have a damage ability — that would make
  // it a strict dominator on top of its top HP).
  assert(CLASSES.tank.ability.type === "shield", "tank's ability is the shield (utility)");
  assert(
    !("dmg" in CLASSES.tank.ability) || CLASSES.tank.ability.dmg === 0,
    "tank shield deals NO direct damage (pure utility)"
  );
  assert(
    CLASSES.tank.ability.reduce > 0 && CLASSES.tank.ability.reduce < 1,
    "tank shield reduces incoming damage by a fraction (its payoff)"
  );

  // --- The mage's nova is the PREMIER single-hit burst ----------------------
  // It must strictly out-hit every other class's single ability hit, so the
  // glass-cannon burst caster stays the best nuke in the game.
  for (const k of Object.keys(CLASSES)) {
    if (k === "mage") continue;
    assert(
      CLASSES.mage.ability.dmg > abilityDmg(CLASSES[k]),
      `mage nova (${CLASSES.mage.ability.dmg}) hits harder per cast than ${k} (${abilityDmg(CLASSES[k])})`
    );
  }
  // And it's a real AoE nuke, not just a big single bolt.
  assert(CLASSES.mage.ability.blastRadius > 0, "mage nova is an AoE (positive blastRadius)");

  // --- No damaging ability is over- or under-tuned for its cooldown ----------
  // Ceiling: nobody gets huge burst on a cheap cooldown. Floor: a damaging
  // ability has to be worth pressing. Per-pellet for the scout's spread fan.
  for (const k of Object.keys(CLASSES)) {
    const c = CLASSES[k];
    if (!DAMAGING.includes(c.ability.type)) continue;
    const dps = abilityDps(c);
    assert(dps <= 15, `${k}: ability-DPS (${dps.toFixed(1)}) under the 15 ceiling`);
    assert(dps >= 5, `${k}: ability-DPS (${dps.toFixed(1)}) above the 5 floor (worth using)`);
  }

  // --- The durable bruiser's ability does NOT out-burst the squishy nukers ---
  // The brawler is tanky (120 HP) with high basic DPS, so its slam must hit for
  // LESS per cast than the single-target glass nukers (soldier pierce, ranger
  // homing). Mobility + AoE is its trade, not raw burst.
  assert(
    CLASSES.brawler.ability.dmg < CLASSES.soldier.ability.dmg &&
      CLASSES.brawler.ability.dmg < CLASSES.ranger.ability.dmg,
    "brawler's slam hits for less per cast than the soldier/ranger single-target nukes"
  );

  console.log("\nMILESTONE 56 ABILITY-BALANCE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
