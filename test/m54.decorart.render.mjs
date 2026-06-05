// Milestone 54 (render): the art polish for the NON-tree jungle decor props.
// This is an ART-ONLY change — the bush / rock / stump / flowers grids are
// repainted crisper (clearer form, a bit more shading, and a grounding base) to
// sit cohesively with the mossy-stone + bright-glades look, while the already-
// polished tree is left alone. The thing the game depends on is the TEXTURE SIZE
// (each decor grid is painted at pixel=2, so the baked dimensions feed the
// on-screen framing of the prop), so this test pins both the PRESENCE and the
// exact baked dimensions of every touched decor texture. Headless render.
import { openGame, assert } from "./helpers.mjs";

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  // --- Each decor texture bakes at its expected, UNCHANGED pixel size ---------
  // Decor grids are painted at pixel=2, so an NxM grid bakes a (2N)x(2M) sprite.
  // These sizes are load-bearing for how the prop is framed on the floor, so we
  // assert the actual baked dimensions, not just presence. (decor_tree is listed
  // too as an untouched control — it must stay 26x26.)
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return {
      bush: dims("decor_bush"),
      rock: dims("decor_rock"),
      stump: dims("decor_stump"),
      flowers: dims("decor_flowers"),
      tree: dims("decor_tree"),
    };
  });

  // Expected baked sizes (grid width × pixel=2, grid height × pixel=2):
  //   bush    10×8  -> 20×16      rock    10×8  -> 20×16
  //   stump   9×5   -> 18×10      flowers 11×6  -> 22×12
  //   tree    13×13 -> 26×26 (untouched control)
  const expected = {
    bush: { w: 20, h: 16 },
    rock: { w: 20, h: 16 },
    stump: { w: 18, h: 10 },
    flowers: { w: 22, h: 12 },
    tree: { w: 26, h: 26 },
  };

  for (const [kind, want] of Object.entries(expected)) {
    const got = tex[kind];
    assert(got !== null, `the decor_${kind} texture is baked`);
    assert(
      got.w === want.w && got.h === want.h,
      `decor_${kind} bakes at ${want.w}x${want.h} (grid at pixel=2, load-bearing) — got ${got.w}x${got.h}`
    );
  }

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 54 DECOR ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
