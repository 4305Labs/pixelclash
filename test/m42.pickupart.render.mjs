// Milestone 42 (render): the glow-up for the map pickup orbs. This is an
// ART-ONLY change — the heal and power orbs are repainted with an outer glow
// ring, a rim light, and a white specular dot for a glossier, more enticing
// look. The thing the gameplay actually depends on is the TEXTURE SIZE (it's
// tied to PICKUP.radius and feeds hit detection), so this test pins both the
// presence AND the exact baked dimensions of the two orb textures, and confirms
// the arena still wires them onto pickup sprites. Headless render.
import { openGame, assert } from "./helpers.mjs";
import { PICKUP } from "../src/config.js";

const state = (pickups) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, powered: false }],
  projectiles: [],
  minions: [],
  pickups,
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

  // --- Both orb textures bake at the expected pixel size --------------------
  // Size is load-bearing (radius*2), so assert the actual baked dimensions, not
  // just that the textures exist.
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return { heal: dims("pickup_heal"), power: dims("pickup_power") };
  });

  const expected = PICKUP.radius * 2;
  assert(tex.heal !== null, "the heal orb texture is baked");
  assert(tex.power !== null, "the power orb texture is baked");
  assert(
    tex.heal.w === expected && tex.heal.h === expected,
    `the heal orb is ${expected}x${expected} (radius*2, load-bearing for hits)`
  );
  assert(
    tex.power.w === expected && tex.power.h === expected,
    `the power orb is ${expected}x${expected} (radius*2, load-bearing for hits)`
  );

  // --- The arena still draws a sprite per available orb, using those textures.
  await page.evaluate((s) => {
    const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    sc.dismissStartGate();
    window.PIXELCLASH.net._receive(s);
  }, state([
    { id: "heal_top", kind: "heal", x: 400, y: 60 },
    { id: "power_mid", kind: "power", x: 400, y: 300 },
  ]));
  await page.waitForTimeout(100);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const keyOf = (id) => {
      const sp = s.pickupSprites.get(id);
      return sp ? sp.texture.key : null;
    };
    return {
      count: s.pickupSprites.size,
      healKey: keyOf("heal_top"),
      powerKey: keyOf("power_mid"),
    };
  });
  assert(v.count === 2, "a sprite is created for each available orb");
  assert(v.healKey === "pickup_heal", "the heal orb sprite uses the heal texture");
  assert(v.powerKey === "pickup_power", "the power orb sprite uses the power texture");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 42 PICKUP ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
