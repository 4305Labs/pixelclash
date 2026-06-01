// Milestone 37 (Game Boy top-down heroes): the hand-authored pixel grids are
// well-formed. Every head/body grid is exactly 16 wide × 8 tall, and a composed
// hero is a full 16×16 for every class / direction / walk frame. Pure data test
// (gbsprites.js has no Phaser import), so it runs in plain Node and catches a
// miscount before it can crash paintGrid at boot.
import { GB_HEADS, GB_BODY, GB_DIRS, GB_FRAMES, gbHeroRows, validateGbGrids } from "../src/gbsprites.js";
import { CLASS_ORDER } from "../src/config.js";
import { assert } from "./helpers.mjs";

try {
  const n = validateGbGrids();
  assert(n === 24, `validateGbGrids checked all 24 grids (got ${n})`);

  // Every class in the roster has a head in all three authored directions.
  for (const cls of CLASS_ORDER) {
    assert(GB_HEADS[cls], `class "${cls}" has a GB head`);
    for (const dir of GB_DIRS) {
      assert(GB_HEADS[cls][dir].length === 8, `${cls}/${dir} head is 8 rows`);
    }
  }

  // The shared body covers every facing (up reuses down) and walk frame.
  for (const dir of GB_DIRS) {
    for (const frame of GB_FRAMES) {
      assert(GB_BODY[dir] && GB_BODY[dir][frame], `body has ${dir}/${frame}`);
    }
  }

  // A composed hero is a clean 16×16 grid for every combination.
  for (const cls of CLASS_ORDER) {
    for (const dir of GB_DIRS) {
      for (const frame of GB_FRAMES) {
        const rows = gbHeroRows(cls, dir, frame);
        assert(rows.length === 16, `${cls}/${dir}/${frame} is 16 rows`);
        assert(rows.every((r) => r.length === 16), `${cls}/${dir}/${frame} rows all 16 wide`);
      }
    }
  }

  // Only known palette characters appear (so nothing renders as an accidental
  // transparent hole). Mirrors the keys defined in gbPalette / GB_BODY.
  const known = new Set([".", "o", "h", "H", "s", "S", "e", "k", "l", "b", "B", "f", "v", "V", "w"]);
  for (const cls of CLASS_ORDER) {
    for (const dir of GB_DIRS) {
      for (const ch of gbHeroRows(cls, dir, "idle").join("")) {
        assert(known.has(ch), `${cls}/${dir} uses only known palette chars (saw "${ch}")`);
      }
    }
  }

  console.log("\nMILESTONE 37 GB SPRITE TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
}
