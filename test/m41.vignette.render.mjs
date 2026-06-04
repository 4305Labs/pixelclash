// Milestone 41 (render): the low-HP "danger" vignette. When the LOCAL hero is
// alive and below VIGNETTE.threshold of its max HP, a red edge glow fades in and
// gets stronger the closer to death they are; it clears the instant they heal
// back above the threshold or die. This is a client-only HUD effect read from
// the snapshot — it never touches the server or the snapshot shape.
import { openGame, assert } from "./helpers.mjs";
import { VIGNETTE } from "../src/config.js";

// A minimal "playing" snapshot with one local player at a given HP. maxHp is
// fixed at 100 so the HP fraction is just `hp / 100`.
const state = (hp, alive = true) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp, maxHp: 100, alive }],
  projectiles: [], minions: [], pickups: [], camps: [], towers: [],
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true, shielded: false },
  ],
});

// Read back the vignette overlay's visible flag + alpha.
const readVignette = (page) =>
  page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const v = s.dangerVignette;
    return { exists: !!v, visible: v.visible, alpha: v.alpha };
  });

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  await page.evaluate(() => {
    window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" });
  });

  // The overlay object exists from the start (just hidden).
  const initial = await readVignette(page);
  assert(initial.exists, "the danger vignette overlay is created");

  // Full HP: well above the threshold → hidden.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(100));
  await page.waitForTimeout(120);
  const healthy = await readVignette(page);
  assert(!healthy.visible || healthy.alpha === 0, "vignette is hidden at full HP");

  // Below the threshold (here 20% < 30%): visible with a real opacity.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(20));
  await page.waitForTimeout(120);
  const hurt = await readVignette(page);
  assert(hurt.visible && hurt.alpha > 0, "vignette shows when below the threshold");

  // Even lower HP intensifies it (closer to death = stronger glow).
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(3));
  await page.waitForTimeout(120);
  const critical = await readVignette(page);
  assert(
    critical.visible && critical.alpha > hurt.alpha,
    "vignette is stronger at lower HP"
  );
  assert(critical.alpha <= 1, "vignette alpha stays within range");

  // Heal back above the threshold → clears instantly.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(90));
  await page.waitForTimeout(120);
  const healed = await readVignette(page);
  assert(!healed.visible || healed.alpha === 0, "vignette clears when healed above the threshold");

  // Drop low again, then DIE → clears even though HP is below the threshold.
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(10));
  await page.waitForTimeout(80);
  await page.evaluate((s) => window.PIXELCLASH.net._receive(s), state(0, false));
  await page.waitForTimeout(120);
  const dead = await readVignette(page);
  assert(!dead.visible || dead.alpha === 0, "vignette clears when the hero is dead");

  // The threshold matches config (sanity check on the tunable).
  assert(VIGNETTE.threshold > 0 && VIGNETTE.threshold < 1, "threshold is a sane fraction");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 41 VIGNETTE RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
