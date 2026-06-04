// Milestone 44 (render): the art touch-up for the lane minions. This is an
// ART-ONLY change — the goblin minions are repainted with a crisper silhouette,
// clearer eyes, more shading, and a little grey club, while staying in their
// lighter team tint so they still read as "lesser" units. The thing the gameplay
// depends on is the TEXTURE SIZE (the 10×10 grid at pixel=2 bakes a 20×20 sprite,
// which feeds rendering/hit framing), so this test pins both the PRESENCE and the
// exact baked dimensions of BOTH team textures, and confirms the arena still
// wires them onto minion sprites (blue vs red). Headless render.
import { openGame, assert } from "./helpers.mjs";

const state = (minions) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, powered: false }],
  projectiles: [],
  minions,
  pickups: [],
  towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );

  // --- Both team minion textures bake at the expected pixel size -------------
  // The 10×10 grid at pixel=2 must stay 20×20 (load-bearing for the minion's
  // on-screen framing), so assert the actual baked dimensions, not just presence.
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return { blue: dims("minion_blue"), red: dims("minion_red") };
  });

  const expected = 20; // 10×10 grid × pixel=2
  assert(tex.blue !== null, "the blue minion texture is baked");
  assert(tex.red !== null, "the red minion texture is baked");
  assert(
    tex.blue.w === expected && tex.blue.h === expected,
    `the blue minion is ${expected}x${expected} (10x10 grid at pixel=2, load-bearing)`
  );
  assert(
    tex.red.w === expected && tex.red.h === expected,
    `the red minion is ${expected}x${expected} (10x10 grid at pixel=2, load-bearing)`
  );

  // --- The arena still draws a sprite per minion, using the per-team texture --
  await page.evaluate((s) => {
    const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    sc.dismissStartGate();
    window.PIXELCLASH.net._receive(s);
  }, state([
    { id: "m1", team: "blue", x: 200, y: 280, hp: 40, alive: true },
    { id: "m2", team: "red", x: 600, y: 320, hp: 40, alive: true },
  ]));
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const keyOf = (id) => {
      const m = s.minionSprites.get(id);
      return m && m.bodySprite ? m.bodySprite.texture.key : null;
    };
    return {
      count: s.minionSprites.size,
      blueKey: keyOf("m1"),
      redKey: keyOf("m2"),
    };
  });
  assert(v.count === 2, "a sprite is created for each minion");
  assert(v.blueKey === "minion_blue", "the blue minion uses the blue texture (team tint preserved)");
  assert(v.redKey === "minion_red", "the red minion uses the red texture (team tint preserved)");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 44 MINION ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
