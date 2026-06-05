// Milestone 55 (balance pass): lock in the hero-class balance INVARIANTS so a
// future config edit can't silently reintroduce a strictly-dominant or dead
// class. Pure Node — imports only src/config.js (no browser, no server).
//
// Roster identities this file is written against (settle these in config.js):
//   • tank    — the DURABILITY pick: HIGHEST HP, low sustained DPS, short range.
//   • scout   — the GLASS CANNON: HIGHEST sustained DPS, LOWEST HP.
//   • mage    — the BURST CASTER: lowest sustained DPS (it pays off via its big
//               cooldown nuke), so it must NOT be the top DPS or top HP.
//   • soldier — the balanced baseline (equals the base COMBAT stats).
//   • ranger  — the LONG-RANGE poke: longest effective reach, low-ish HP.
//   • brawler — the BRUISER: durable + high (but not top) DPS, SHORTEST range.
//
// The key anti-dominance invariant: NO single class may have BOTH the maximum HP
// and the maximum sustained DPS at once (that would be a strict dominator).
import { CLASSES, CLASS_ORDER, DEFAULT_CLASS } from "../src/config.js";
import { assert } from "./helpers.mjs";

// Sustained DPS from the basic attack: damage per hit / cooldown in seconds.
// (cd is in ms.) This is the "damage / attack interval" sense; abilities are
// deliberately excluded — they're bursty, on long cooldowns.
const dps = (c) => c.basic.dmg / (c.basic.cd / 1000);
// Effective reach of the basic bolt: how far it travels before it expires.
const reach = (c) => c.basic.speed * (c.basic.ttl / 1000);

try {
  // --- The roster shape is intact -------------------------------------------
  const expected = ["scout", "soldier", "tank", "ranger", "mage", "brawler"];
  for (const k of expected) assert(CLASSES[k], `class "${k}" exists`);
  assert(
    CLASS_ORDER.length === expected.length &&
      expected.every((k) => CLASS_ORDER.includes(k)),
    "CLASS_ORDER lists exactly the six expected heroes"
  );
  assert(CLASSES[DEFAULT_CLASS], "the default class exists");

  // --- Every class is sane (positive, in-band) ------------------------------
  for (const [k, c] of Object.entries(CLASSES)) {
    assert(c.maxHp > 0 && c.maxHp <= 300, `${k}: HP positive and within sane band`);
    assert(c.basic.dmg > 0 && c.basic.dmg <= 40, `${k}: basic dmg positive and in-band`);
    assert(c.basic.cd > 0, `${k}: basic cooldown positive`);
    assert(c.basic.speed > 0 && c.basic.ttl > 0, `${k}: bolt speed + ttl positive`);
    assert(c.ability && typeof c.ability.cd === "number" && c.ability.cd > 0, `${k}: ability cooldown positive`);
    assert(dps(c) > 0 && dps(c) <= 60, `${k}: sustained DPS positive and in-band`);
  }

  // Helpers: find the class key with the max / min of some measure.
  const argmax = (fn) =>
    Object.keys(CLASSES).reduce((best, k) => (fn(CLASSES[k]) > fn(CLASSES[best]) ? k : best));
  const argmin = (fn) =>
    Object.keys(CLASSES).reduce((best, k) => (fn(CLASSES[k]) < fn(CLASSES[best]) ? k : best));

  const maxHpClass = argmax((c) => c.maxHp);
  const maxDpsClass = argmax((c) => dps(c));
  const minDpsClass = argmin((c) => dps(c));
  const minHpClass = argmin((c) => c.maxHp);

  // --- No strict dominator: nobody is top HP AND top DPS at once ------------
  assert(
    maxHpClass !== maxDpsClass,
    `no strict dominator: top-HP (${maxHpClass}) is not also top-DPS (${maxDpsClass})`
  );

  // --- The tank is the durability pick: highest HP, and NOT the top DPS -----
  assert(maxHpClass === "tank", "the tank has the highest HP");
  assert(maxDpsClass !== "tank", "the tank does NOT have the highest DPS");

  // --- The scout is the glass cannon: top DPS, but NOT the top HP -----------
  assert(maxDpsClass === "scout", "the scout has the highest sustained DPS");
  assert(maxHpClass !== "scout", "the scout does NOT have the highest HP");
  assert(minHpClass === "scout", "the scout sits at the bottom of the HP range (fragile)");

  // --- The mage is the burst caster: lowest sustained basic DPS -------------
  // (it earns its keep through the biggest single-cast nuke, not auto-attacks).
  assert(minDpsClass === "mage", "the mage has the lowest sustained DPS (burst caster)");
  assert(CLASSES.mage.ability.dmg >= 35, "the mage's nuke hits hard (its payoff)");

  // --- The ranger out-reaches everyone (its defining trade) -----------------
  assert(argmax((c) => reach(c)) === "ranger", "the ranger has the longest basic reach");

  // --- The brawler is the shortest-range bruiser ----------------------------
  assert(argmin((c) => reach(c)) === "brawler", "the brawler has the shortest basic reach");

  console.log("\nMILESTONE 55 BALANCE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
