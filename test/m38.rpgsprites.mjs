// Milestone 38 (detailed RPG heroes): the hand-authored front-facing hero grids
// are well-formed. Every hero is exactly 24x24 and uses only known palette
// characters, so paintGrid can't crash at boot and nothing renders as an
// accidental hole. Pure data (rpgsprites.js has no Phaser import) — plain Node.
import { RPG_HEROES, RPG_CLASSES, validateRpgGrids } from "../src/rpgsprites.js";
import { CLASS_ORDER } from "../src/config.js";
import { assert } from "./helpers.mjs";

try {
  const n = validateRpgGrids();
  assert(n === 6, `validateRpgGrids checked all 6 heroes (got ${n})`);

  // Every class in the playable roster has a hero grid.
  for (const cls of CLASS_ORDER) {
    assert(RPG_HEROES[cls], `class "${cls}" has an RPG hero grid`);
    assert(RPG_HEROES[cls].length === 24, `${cls} is 24 rows tall`);
    assert(RPG_HEROES[cls].every((r) => r.length === 24), `${cls} rows are all 24 wide`);
  }
  assert(RPG_CLASSES.length === CLASS_ORDER.length, "one RPG grid per playable class");

  // Only known palette characters appear (a stray char would be a transparent
  // hole). Mirrors the keys defined in rpgPalette.
  const known = new Set([
    ".", "o", "L", "M", "D", "s", "k", "e", "c", "C", "p",
    "b", "h", "g", "w", "W", "r", "n", "G", "f",
  ]);
  for (const cls of RPG_CLASSES) {
    for (const ch of RPG_HEROES[cls].join("")) {
      assert(known.has(ch), `${cls} uses only known palette chars (saw "${ch}")`);
    }
  }

  console.log("\nMILESTONE 38 RPG SPRITE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
