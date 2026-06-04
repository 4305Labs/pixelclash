// Milestone 48 (render): the art touch-up for the team BASES / nexuses. This is
// an ART-ONLY change — each base is repainted as a grand mossy-stone keep with a
// stepped plinth, flanking pillars + team banners, creeping moss, and a large
// glowing team-coloured crystal core, cohesive with the glade/stone palette and
// the mossy-stone towers, reading clearly bigger / more important than a tower.
// The thing the gameplay depends on is the TEXTURE SIZE: the base texture bakes
// at BASE.radius*2 (48×48), which is tied to placement / hit detection / the
// shield ring rendering, so this test pins both the PRESENCE and the exact baked
// dimensions of BOTH team textures, and confirms the arena still wires them onto
// base sprites (blue vs red). Headless render.
import { openGame, assert } from "./helpers.mjs";
import { BASE } from "../src/config.js";

const state = () => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true, powered: false }],
  projectiles: [],
  minions: [],
  pickups: [],
  towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: true },
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

  // --- Both team base textures bake at the expected pixel size ----------------
  // BASE.radius*2 (48×48) is load-bearing for base placement / hit detection /
  // the shield-ring render, so assert the actual baked dimensions, not just
  // presence.
  const tex = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const dims = (key) => {
      if (!s.textures.exists(key)) return null;
      const img = s.textures.get(key).getSourceImage();
      return { w: img.width, h: img.height };
    };
    return { blue: dims("base_blue"), red: dims("base_red") };
  });

  const expected = BASE.radius * 2; // 48 — unchanged from before the touch-up
  assert(tex.blue !== null, "the blue base texture is baked");
  assert(tex.red !== null, "the red base texture is baked");
  assert(
    tex.blue.w === expected && tex.blue.h === expected,
    `the blue base is ${expected}x${expected} (BASE.radius*2, load-bearing)`
  );
  assert(
    tex.red.w === expected && tex.red.h === expected,
    `the red base is ${expected}x${expected} (BASE.radius*2, load-bearing)`
  );

  // --- The arena still draws a Base per base, using the per-team texture ------
  await page.evaluate((s) => {
    const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    sc.dismissStartGate();
    window.PIXELCLASH.net._receive(s);
  }, state());
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const keyOf = (team) => {
      const b = s.baseSprites.get(team);
      return b && b.crystal ? b.crystal.texture.key : null;
    };
    // The shield overlay is a separate runtime visual on the base body; confirm
    // it still exists and tracks the snapshot's shielded flag (art repaint must
    // NOT have removed it).
    const shieldVisible = (team) => {
      const b = s.baseSprites.get(team);
      return b && b.shield ? b.shield.visible : null;
    };
    return {
      count: s.baseSprites.size,
      blueKey: keyOf("blue"),
      redKey: keyOf("red"),
      blueShield: shieldVisible("blue"),
      redShield: shieldVisible("red"),
    };
  });
  assert(v.count === 2, "a Base is created for each base");
  assert(v.blueKey === "base_blue", "the blue base uses the blue texture (team colour preserved)");
  assert(v.redKey === "base_red", "the red base uses the red texture (team colour preserved)");
  // Shield overlay still works: shown for the shielded base, hidden for the other.
  assert(v.blueShield === true, "the shielded base shows its shield ring (overlay intact)");
  assert(v.redShield === false, "the unshielded base hides its shield ring");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 48 BASE ART RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
