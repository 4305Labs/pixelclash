// Milestone 33 (terrain variety): the arena draws a stone lane floor plus mossy
// jungle floor strips above and below the center lane band, so the three routes
// read as different ground. We check the textures exist and the jungle strips
// are placed outside the lane band. Headless render.
import { openGame, assert } from "./helpers.mjs";
import { LANE_BAND, GAME_HEIGHT, DECOR_SPOTS } from "../src/config.js";

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
      hasLaneFloor: !!s.laneFloor,
      jungleCount: s.jungleFloors ? s.jungleFloors.length : 0,
      // y-extents of each jungle strip (origin 0,0 tileSprites).
      strips: (s.jungleFloors || []).map((o) => ({ y: Math.round(o.y), h: Math.round(o.height) })),
    };
  });

  assert(v.hasFloor && v.hasJungle, "both the stone and jungle floor textures exist");
  assert(v.hasLaneFloor, "the stone lane floor is laid down");
  assert(v.jungleCount === 2, "there are two jungle strips (top + bottom)");

  // One strip is the top route (ends at the lane top), the other the bottom
  // route (starts at the lane bottom) — i.e. both sit OUTSIDE the lane band.
  const top = v.strips.find((s) => s.y === 0);
  const bottom = v.strips.find((s) => s.y === LANE_BAND.bottom);
  assert(top && top.h === LANE_BAND.top, "the top jungle strip covers the top route up to the lane");
  assert(
    bottom && bottom.h === GAME_HEIGHT - LANE_BAND.bottom,
    "the bottom jungle strip covers the bottom route below the lane"
  );

  // --- Jungle decor: one prop per DECOR_SPOT, all in the jungle bands --------
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
    decor.ys.every((y) => y < LANE_BAND.top || y > LANE_BAND.bottom),
    "all decor sits in the jungle (outside the center lane band)"
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
