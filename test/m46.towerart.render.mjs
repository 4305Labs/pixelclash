// Milestone 46 (render): the art touch-up for the guard towers. This is an
// ART-ONLY change — the towers are repainted as crisp mossy-stone defensive
// turrets (crenellated battlements, a tapered stone shaft with shading + moss,
// and a glowing team-coloured crystal in a dark socket where the bolt zaps from),
// while staying cohesive with the glade/stone palette. The thing the gameplay
// depends on is the TEXTURE SIZE: the tower texture bakes at TOWER.radius*2
// (44×44), which is tied to hit detection / placement, so this test pins both
// the PRESENCE and the exact baked dimensions of BOTH team textures, and confirms
// the arena still wires them onto tower sprites (blue vs red). Headless render.
import { openGame, assert } from "./helpers.mjs";
import { TOWER } from "../src/config.js";

const state = (towers) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, powered: false }],
  projectiles: [],
  minions: [],
  pickups: [],
  towers,
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

  // --- Both team tower textures bake at the expected pixel size --------------
  // TOWER.radius*2 (44×44) is load-bearing for tower hit detection / placement,
  // so assert the actual baked dimensions, not just presence.
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return { blue: dims("tower_blue"), red: dims("tower_red") };
  });

  const expected = TOWER.radius * 2; // 44 — unchanged from before the touch-up
  assert(tex.blue !== null, "the blue tower texture is baked");
  assert(tex.red !== null, "the red tower texture is baked");
  assert(
    tex.blue.w === expected && tex.blue.h === expected,
    `the blue tower is ${expected}x${expected} (TOWER.radius*2, load-bearing)`
  );
  assert(
    tex.red.w === expected && tex.red.h === expected,
    `the red tower is ${expected}x${expected} (TOWER.radius*2, load-bearing)`
  );

  // --- The arena still draws a sprite per tower, using the per-team texture ---
  await page.evaluate((s) => {
    const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    sc.dismissStartGate();
    window.PIXELCLASH.net._receive(s);
  }, state([
    { team: "blue", lane: "mid", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
    { team: "red", lane: "mid", x: 550, y: 300, hp: 180, maxHp: 180, alive: true },
  ]));
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const keyOf = (k) => {
      const t = s.towerSprites.get(k);
      return t && t.body ? t.body.texture.key : null;
    };
    return {
      count: s.towerSprites.size,
      blueKey: keyOf("blue_mid"),
      redKey: keyOf("red_mid"),
    };
  });
  assert(v.count === 2, "a sprite is created for each tower");
  assert(v.blueKey === "tower_blue", "the blue tower uses the blue texture (team colour preserved)");
  assert(v.redKey === "tower_red", "the red tower uses the red texture (team colour preserved)");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 46 TOWER ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
