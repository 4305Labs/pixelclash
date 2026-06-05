// Milestone 18 (render): the arena draws guard towers from the snapshot — a
// sprite per team at the right spot, a health bar that shrinks on damage, a
// faded look when destroyed, and tower zaps drawn with their own bolt style.
import { openGame, assert } from "./helpers.mjs";
import { TOWER } from "../src/config.js";

const state = (towers, projectiles = []) => ({
  t: "state",
  tick: 1,
  phase: "playing",
  winner: null,
  players: [{ id: "p1", team: "blue", x: 120, y: 300, hp: 100, alive: true }],
  projectiles,
  minions: [],
  towers,
  bases: [
    { team: "blue", x: 44, y: 300, hp: 250, maxHp: 250, alive: true },
    { team: "red", x: 756, y: 300, hp: 250, maxHp: 250, alive: true },
  ],
});

let browser;
try {
  const game = await openGame();
  browser = game.browser;
  const { page, errors } = game;

  const inject = (towers, projectiles) =>
    page.evaluate((s) => {
      const sc = window.PIXELCLASH.game.scene.getScene("ArenaScene");
      sc.dismissStartGate();
      window.PIXELCLASH.net._receive(s);
    }, state(towers, projectiles));

  await page.evaluate(() =>
    window.PIXELCLASH.net._receive({ t: "welcome", id: "p1", team: "blue" })
  );
  await inject(
    [
      { team: "blue", lane: "mid", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
      { team: "red", lane: "mid", x: 550, y: 300, hp: 180, maxHp: 180, alive: true },
    ],
    [{ id: "z1", team: "blue", kind: "tower", x: 300, y: 300 }]
  );
  await page.waitForTimeout(120);

  const v = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const t = s.towerSprites.get("blue_mid");
    const z = s.bolts.get("z1");
    return { count: s.towerSprites.size, x: t.x, y: t.y, w: t.hpFill.width, boltR: z ? z.radius : -1 };
  });
  assert(v.count === 2, "a sprite is created for each tower");
  assert(Math.abs(v.x - 250) < 2 && Math.abs(v.y - 300) < 2, "tower sits at its server spot");
  assert(v.boltR === TOWER.boltRadius, "a tower zap is drawn with the tower bolt style");
  const fullWidth = v.w;

  // Damage the red tower — its bar shrinks; then destroy it — it fades out.
  await inject([
    { team: "blue", lane: "mid", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
    { team: "red", lane: "mid", x: 550, y: 300, hp: 60, maxHp: 180, alive: true },
  ]);
  await page.waitForTimeout(80);
  await inject([
    { team: "blue", lane: "mid", x: 250, y: 300, hp: 180, maxHp: 180, alive: true },
    { team: "red", lane: "mid", x: 550, y: 300, hp: 0, maxHp: 180, alive: false },
  ]);
  await page.waitForTimeout(120);

  const after = await page.evaluate(() => {
    const s = window.PIXELCLASH.game.scene.getScene("ArenaScene");
    const red = s.towerSprites.get("red_mid");
    return { redWidth: red.hpFill.width, redAlpha: red.body.alpha, redBarVisible: red.hpBg.visible };
  });
  assert(after.redWidth < fullWidth, "a damaged tower's health bar shrinks");
  assert(after.redAlpha < 1 && !after.redBarVisible, "a destroyed tower fades and hides its bar");

  const realErrors = errors.filter((e) => !/websocket|ws:\/\//i.test(e));
  assert(realErrors.length === 0, "no unexpected errors: " + JSON.stringify(realErrors));

  console.log("\nMILESTONE 18 TOWER RENDER TESTS PASSED");
} catch (e) {
  console.error("\nTEST FAILURE:", e.message);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
}
