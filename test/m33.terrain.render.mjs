// Milestone 33 (terrain): the arena draws a mossy jungle floor everywhere, then
// stone "roads" for the lanes — the mid lane straight across, and the top/bottom
// lanes as straight mid-sections plus DIAGONAL connectors that fan them out of
// each base. Decor props sit in the jungle gaps between lanes. Headless render.
import { openGame, assert } from "./helpers.mjs";
import { LANES, LANE_BAND_HALF, DECOR_SPOTS } from "../src/config.js";

const onLaneBand = (y) => LANES.some((ln) => y >= ln.row - LANE_BAND_HALF && y <= ln.row + LANE_BAND_HALF);

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() =>
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate()
  );
  await page.waitForTimeout(60);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      hasFloor: s.textures.exists("floor"),
      hasJungle: s.textures.exists("floor_jungle"),
      hasJungleFloor: !!s.jungleFloor,
      // Straight stone bands are unrotated tile sprites; diagonal connectors are
      // rotated rectangles. Report both.
      straightBands: (s.laneFloors || [])
        .filter((o) => o.type === "TileSprite")
        .map((o) => ({ y: Math.round(o.y), h: Math.round(o.height) })),
      diagonals: (s.laneFloors || []).filter((o) => o.type === "Rectangle" && o.rotation !== 0).length,
    };
  });

  assert(v.hasFloor && v.hasJungle, "both the stone and jungle floor textures exist");
  assert(v.hasJungleFloor, "the jungle floor covers the whole arena");

  // Every lane has a straight stone band centred on its row (mid spans the full
  // width; the side lanes' straight sections run between their entries).
  for (const ln of LANES) {
    const band = v.straightBands.find((b) => b.y === ln.row - LANE_BAND_HALF);
    assert(band, `the ${ln.id} lane has a straight stone band at its row`);
    assert(band.h === LANE_BAND_HALF * 2, `the ${ln.id} band is the right height`);
  }
  // The two side lanes each fan out of BOTH bases → four diagonal connectors.
  assert(v.diagonals === 4, "four diagonal connectors fan the side lanes from each base");

  // --- Jungle decor: one prop per DECOR_SPOT, all in the jungle gaps ----------
  const decor = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    return {
      hasBush: s.textures.exists("decor_bush"),
      hasRock: s.textures.exists("decor_rock"),
      count: s.decor ? s.decor.length : 0,
      ys: (s.decor || []).map((o) => Math.round(o.y)),
      depths: (s.decor || []).map((o) => o.depth),
    };
  });
  assert(decor.hasBush && decor.hasRock, "bush and rock decor textures exist");
  assert(decor.count === DECOR_SPOTS.length, "one decor prop per configured spot");
  assert(
    decor.ys.every((y) => !onLaneBand(y)),
    "all decor sits in the jungle (off the stone lane bands)"
  );
  assert(decor.depths.every((d) => d < -5), "decor is drawn below the walls/units");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 33 TERRAIN TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
