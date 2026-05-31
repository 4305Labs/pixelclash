// Milestone 34 (render): the arena draws the jungle camps from the snapshot —
// a sprite per camp at its spot, an HP bar that shrinks on damage, and a faded
// look when cleared (it respawns later). Headless render.
import { openGame, assert } from "./helpers.mjs";

const state = (camps) => ({
  t: "state", tick: 1, phase: "playing", winner: null, score: { blue: 0, red: 0 },
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles: [], minions: [], pickups: [], camps, towers: [],
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

  const inject = (camps) =>
    page.evaluate((s) => {
      window.PIXELCLASH.game.scene.getScene("ArenaScene").dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(camps));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );

  await inject([
    { id: "camp_top", x: 200, y: 185, hp: 120, maxHp: 120, alive: true },
    { id: "camp_bot", x: 600, y: 415, hp: 120, maxHp: 120, alive: true },
  ]);
  await page.waitForTimeout(120);

  let v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const c = s.campSprites.get("camp_top");
    return {
      hasCampTex: s.textures.exists("camp"),
      count: s.campSprites.size,
      x: c.x, y: c.y, w: c.hpFill.width, alpha: c.body.alpha,
    };
  });
  assert(v.hasCampTex, "the camp texture exists");
  assert(v.count === 2, "a sprite is created for each camp");
  assert(Math.abs(v.x - 200) < 2 && Math.abs(v.y - 185) < 2, "camp sits at its spot");
  const fullWidth = v.w;

  // Damage camp_top -> its bar shrinks.
  await inject([
    { id: "camp_top", x: 200, y: 185, hp: 40, maxHp: 120, alive: true },
    { id: "camp_bot", x: 600, y: 415, hp: 120, maxHp: 120, alive: true },
  ]);
  await page.waitForTimeout(80);
  v = await page.evaluate(() =>
    window.PIXELCLASH.game.scene.getScene("ArenaScene").campSprites.get("camp_top").hpFill.width
  );
  assert(v < fullWidth, "a damaged camp's health bar shrinks");

  // Cleared -> the camp fades.
  await inject([
    { id: "camp_top", x: 200, y: 185, hp: 0, maxHp: 120, alive: false },
    { id: "camp_bot", x: 600, y: 415, hp: 120, maxHp: 120, alive: true },
  ]);
  await page.waitForTimeout(80);
  const cleared = await page.evaluate(() => {
    const c = window.PIXELCLASH.game.scene.getScene("ArenaScene").campSprites.get("camp_top");
    return { alpha: c.body.alpha, barVisible: c.hpBg.visible };
  });
  assert(cleared.alpha < 1 && !cleared.barVisible, "a cleared camp fades and hides its bar");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 34 CAMP RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
