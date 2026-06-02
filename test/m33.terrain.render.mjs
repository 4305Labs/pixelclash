// Milestone 33 (terrain): the arena draws a mossy jungle floor everywhere, then
// the three lanes as flowing stone ROAD ribbons — the mid lane straight across,
// and the top/bottom lanes sweeping diagonally out of each base and back in.
// Decor props sit in the jungle gaps between lanes. Headless render.
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
    // Each lane ribbon is rotated rectangles (the straight runs) + discs (the
    // rounded bends). Straight runs lie level with a lane row; the diagonal runs
    // of the side lanes are rotated.
    const objs = (s.laneFloors || []).map((o) => ({
      type: o.type,
      rot: o.rotation || 0,
      y: Math.round(o.y),
    }));
    return {
      hasJungle: s.textures.exists("floor_jungle"),
      hasJungleFloor: !!s.jungleFloor,
      laneCount: objs.length,
      diagonals: objs.filter((o) => o.type === "Rectangle" && Math.abs(o.rot) > 0.01).length,
      levelRowYs: objs.filter((o) => o.type === "Rectangle" && Math.abs(o.rot) < 0.01).map((o) => o.y),
    };
  });

  assert(v.hasJungle, "the jungle floor texture exists");
  assert(v.hasJungleFloor, "the jungle floor covers the whole arena");
  assert(v.laneCount > 0, "the lanes are drawn as flowing road ribbons");

  // Every lane's road runs level along its row (mid straight across; the side
  // lanes' middle sections between their entries).
  for (const ln of LANES) {
    assert(
      v.levelRowYs.some((y) => Math.abs(y - ln.row) <= 2),
      `the ${ln.id} lane road runs along its row`
    );
  }
  // The two side lanes each sweep out of BOTH bases → at least four diagonal runs.
  assert(v.diagonals >= 4, "the side lanes sweep diagonally out of both bases");

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
