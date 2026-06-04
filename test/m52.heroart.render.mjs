// Milestone 52 (render): hero sprite readability polish. This is an ART-ONLY /
// DATA-ONLY change — the ranger's longbow and the scout's dagger grids in
// src/rpgsprites.js were repainted for a clearer, more characterful weapon
// silhouette at gameplay scale, while staying exactly 24x24 and keeping the
// team-garment chars (c/C/p) so blue vs red still read apart.
//
// The thing gameplay/layout depends on is the BAKED TEXTURE SIZE: each 24x24
// grid bakes a 24x24 "hero_<cls>_<team>" texture (pixel=1). So this test pins
// the exact baked dimensions of the touched classes for BOTH teams, and confirms
// the arena wires the right per-team texture onto a Player when it switches
// class. (m38 still validates the 24x24 grid shape in plain Node.) Headless.
import { openGame, assert } from "./helpers.mjs";

// The classes whose grids we touched in this polish pass.
const TOUCHED = ["ranger", "scout"];
const EXPECTED = 24; // 24x24 grid at pixel=1 → 24x24 baked texture (load-bearing)

const state = (players) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players,
  projectiles: [],
  minions: [],
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

  // --- The touched hero textures bake at the unchanged 24x24 size, both teams --
  const tex = await page.evaluate((classes) => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    const out = {};
    for (const cls of classes) {
      out[cls] = { blue: dims(`hero_${cls}_blue`), red: dims(`hero_${cls}_red`) };
    }
    return out;
  }, TOUCHED);

  for (const cls of TOUCHED) {
    for (const team of ["blue", "red"]) {
      const d = tex[cls][team];
      assert(d !== null, `the ${team} ${cls} hero texture is baked`);
      assert(
        d.w === EXPECTED && d.h === EXPECTED,
        `the ${team} ${cls} hero is ${EXPECTED}x${EXPECTED} (24x24 grid at pixel=1, load-bearing)`
      );
    }
  }

  // --- The arena wires the touched per-team hero texture onto a Player ---------
  // A blue player on the ranger class and a red player on the scout class: each
  // Player's body sprite must use its own "hero_<cls>_<team>" texture, proving
  // the repainted grids are live AND that team tinting still resolves per team.
  await page.evaluate((s) => {
    const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    sc.dismissStartGate();
    window.PIXELCLASH.net._receive(s);
  }, state([
    { id: "p1", team: "blue", x: 200, y: 280, hp: 100, alive: true, cls: "ranger", powered: false },
    { id: "p2", team: "red", x: 600, y: 320, hp: 100, alive: true, cls: "scout", powered: false },
  ]));
  await page.waitForTimeout(150);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const keyOf = (id) => {
      const p = s.sprites.get(id);
      return p && p.bodySprite ? p.bodySprite.texture.key : null;
    };
    return { rangerKey: keyOf("p1"), scoutKey: keyOf("p2") };
  });
  assert(v.rangerKey === "hero_ranger_blue", "the blue ranger uses hero_ranger_blue (team tint preserved)");
  assert(v.scoutKey === "hero_scout_red", "the red scout uses hero_scout_red (team tint preserved)");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 52 HERO ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
