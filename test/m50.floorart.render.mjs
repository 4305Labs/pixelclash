// Milestone 50 (render): the "glade floor & decor art enrichment" touch-up. This
// is an ART-ONLY change — the repeating grass floor tile gains a few extra subtle
// grass tufts, single blades, tiny earthy pebbles and a couple more muted blooms,
// and the decor TREE canopy is dappled with its mid-tone leaf colour — so the
// glades read lusher and more varied while staying calm/low-contrast under the
// units. Nothing about gameplay changes.
//
// The thing that is load-bearing here is TEXTURE SIZE / TILING: the floor is a
// repeating tileSprite, so its baked dimensions must stay EXACTLY the same or the
// tiling seams shift; the tree decor likewise bakes at a fixed size. So this test
// pins the PRESENCE and exact baked dimensions of the floor tile (80×80, the
// "moss" style) and the tree decor (26×26 = a 13×13 grid at pixel=2), and
// confirms the arena actually builds the floor tileSprite. Headless render.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );

  // --- The floor + decor textures bake at their expected UNCHANGED sizes ------
  // The floor tile is a repeating tileSprite (80×80 "moss" tile); the decor tree
  // bakes from a 13×13 grid at pixel=2 (→ 26×26). Both sizes are tiling/placement
  // sensitive, so assert the actual baked pixel dimensions, not just presence.
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return {
      floor: dims("floor_jungle"),
      tree: dims("decor_tree"),
      bush: dims("decor_bush"),
      flowers: dims("decor_flowers"),
    };
  });

  assert(tex.floor !== null, "the jungle floor texture is baked");
  assert(
    tex.floor.w === 80 && tex.floor.h === 80,
    "the floor tile is 80x80 (tileSprite tiling is load-bearing — must be unchanged)"
  );
  assert(tex.tree !== null, "the decor tree texture is baked");
  assert(
    tex.tree.w === 26 && tex.tree.h === 26,
    "the decor tree is 26x26 (13x13 grid at pixel=2 — must be unchanged)"
  );
  // The other decor we did NOT resize should also still be present.
  assert(tex.bush !== null, "the decor bush texture is still baked");
  assert(tex.flowers !== null, "the decor flowers texture is still baked");

  // --- The arena still builds the repeating floor tileSprite ------------------
  // drawGrid() stores the floor on this.jungleFloor. Phaser gives a tileSprite an
  // internal UUID texture key (HANDOVER gotcha), so we don't assert the key — we
  // confirm the tileSprite exists and is a full-arena floor at the back depth, so
  // the enriched glades are actually painted under everything.
  const floorOk = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const f = s.jungleFloor;
    return {
      present: !!f,
      width: f ? f.width : 0,
      depth: f ? f.depth : null,
    };
  });
  assert(floorOk.present, "the arena builds the floor tileSprite (this.jungleFloor)");
  assert(
    floorOk.width > 0,
    "the floor tileSprite spans the arena (positive width)"
  );
  assert(
    floorOk.depth < 0,
    "the floor tileSprite sits at the back depth (under units/decor)"
  );

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 50 FLOOR ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
